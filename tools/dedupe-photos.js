// Finds photos in ../Photos that were captured within 1-2 seconds of each
// other (near-simultaneous shots, almost always burst duplicates) and moves
// all but the newest in each burst into ../Photos/_duplicates-removed/,
// mirroring the source folder structure. Nothing is permanently deleted -
// review the quarantine folder and delete it yourself once you're happy.
//
// Usage:
//   node tools/dedupe-photos.js                  move duplicates (default)
//   node tools/dedupe-photos.js --dry-run         just print what would move
//   node tools/dedupe-photos.js --threshold=1     use a 1s window instead of 2s

const fs = require("fs");
const path = require("path");
const exifr = require("exifr");

const ROOT = path.join(__dirname, "..");
const PHOTOS_DIR = path.join(ROOT, "Photos");
const TRASH_DIR = path.join(PHOTOS_DIR, "_duplicates-removed");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const thresholdArg = args.find((a) => a.startsWith("--threshold="));
const THRESHOLD_MS = (thresholdArg ? parseFloat(thresholdArg.slice("--threshold=".length)) : 2) * 1000;

// Same patterns/order as tools/process-photos.js, PLUS second-precision
// variants for IMG_/VID_ names (process-photos.js only needs a date to sort
// by; we need real seconds, or a same-day gap could look like a 2s gap and
// wipe out an entire unrelated burst taken hours apart).
const FILENAME_DATE_PATTERNS = [
  { re: /Photo (\d{4})-(\d{2})-(\d{2}) (\d{2}) (\d{2}) (\d{2})/, order: ["y", "m", "d", "H", "M", "S"], hasTime: true },
  { re: /Photo (\d{2})-(\d{2})-(\d{4}), (\d{2}) (\d{2}) (\d{2})/, order: ["d", "m", "y", "H", "M", "S"], hasTime: true },
  // IMG_20220624_182117_361.jpg (Samsung burst/motion-photo, ms counter)
  { re: /(?:IMG|VID)[_-](\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})_(\d{3})\b/, order: ["y", "m", "d", "H", "M", "S", "ms"], hasTime: true },
  // IMG_20220723_123027.jpg / VID_20220723_123027.mp4
  { re: /(?:IMG|VID)[_-](\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})\b/, order: ["y", "m", "d", "H", "M", "S"], hasTime: true },
  { re: /(\d{4})-(\d{2})-(\d{2}) (\d{2})\.(\d{2})\.(\d{2})/, order: ["y", "m", "d", "H", "M", "S"], hasTime: true },
  // IMG-20231028-WA0001.jpg (WhatsApp) - date only, no time of day available.
  { re: /(?:IMG|VID)[_-](\d{4})(\d{2})(\d{2})/, order: ["y", "m", "d"], hasTime: false },
];

function dateFromFilename(filename) {
  for (const { re, order, hasTime } of FILENAME_DATE_PATTERNS) {
    const m = filename.match(re);
    if (!m) continue;
    const parts = {};
    order.forEach((key, i) => (parts[key] = parseInt(m[i + 1], 10)));
    const dt = new Date(parts.y, (parts.m || 1) - 1, parts.d || 1, parts.H || 0, parts.M || 0, parts.S || 0, parts.ms || 0);
    if (!isNaN(dt.getTime())) return { date: dt, hasTime };
  }
  return null;
}

// hasTime = false means we only know the calendar day, not the time of day
// (EXIF missing/unreadable AND filename has no time component). Such files
// must never be chain-clustered with neighbors - we have no way to tell if
// they're 2 seconds or 12 hours apart - so they're always their own cluster.
async function getCaptureDate(filePath, filename) {
  try {
    const exifDate = await exifr.parse(filePath, { pick: ["DateTimeOriginal", "CreateDate"] });
    if (exifDate && (exifDate.DateTimeOriginal || exifDate.CreateDate)) {
      return { date: exifDate.DateTimeOriginal || exifDate.CreateDate, source: "exif", hasTime: true };
    }
  } catch (e) {
    // fall through
  }
  const fromName = dateFromFilename(filename);
  if (fromName) return { date: fromName.date, source: "filename", hasTime: fromName.hasTime };
  const stat = fs.statSync(filePath);
  return { date: stat.mtime, source: "mtime", hasTime: false };
}

async function processFolder(folder) {
  const folderPath = path.join(PHOTOS_DIR, folder);
  const files = fs.readdirSync(folderPath).filter((f) => /\.jpe?g$/i.test(f));
  if (files.length < 2) return { moved: 0, groups: 0 };

  const withDates = [];
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const { date, source, hasTime } = await getCaptureDate(filePath, file);
    // Camera-generated variants of the same shot (panorama result, filter
    // effect, an edited "_1" copy) are content-distinct, not duplicates,
    // even though they share the source shot's timestamp - never cluster
    // them.
    const isVariant = /-PANO\b|-EFFECTS?\b|-HDR\b|_[1-9]\.jpe?g$/i.test(file);
    withDates.push({ file, filePath, date, source, hasTime: hasTime && !isVariant });
  }
  withDates.sort((a, b) => a.date - b.date || a.file.localeCompare(b.file));

  // Chain-cluster consecutive photos whose gap to the previous one is
  // within the threshold; keep the newest (last) in each cluster. Photos
  // without real time-of-day precision, or flagged as a distinct variant
  // (hasTime: false either way), are never merged with a neighbor.
  let clusters = [];
  let current = [withDates[0]];
  for (let i = 1; i < withDates.length; i++) {
    const prev = withDates[i - 1];
    const cur = withDates[i];
    if (prev.hasTime && cur.hasTime && cur.date - prev.date <= THRESHOLD_MS) {
      current.push(cur);
    } else {
      clusters.push(current);
      current = [cur];
    }
  }
  clusters.push(current);

  let moved = 0;
  let groupCount = 0;
  for (const cluster of clusters) {
    if (cluster.length < 2) continue;
    groupCount++;
    const keep = cluster[cluster.length - 1];
    const toRemove = cluster.slice(0, -1);
    console.log(`  [${folder}] burst of ${cluster.length} within ${THRESHOLD_MS / 1000}s -> keeping ${keep.file}`);
    for (const dup of toRemove) {
      console.log(`      - ${dup.file} (${dup.source}, ${dup.date.toISOString()})${dryRun ? " [dry-run]" : ""}`);
      if (!dryRun) {
        const destDir = path.join(TRASH_DIR, folder);
        fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(dup.filePath, path.join(destDir, dup.file));
      }
      moved++;
    }
  }
  return { moved, groups: groupCount };
}

async function main() {
  const folders = fs
    .readdirSync(PHOTOS_DIR)
    .filter((f) => !f.startsWith(".") && f !== "_duplicates-removed")
    .filter((f) => fs.statSync(path.join(PHOTOS_DIR, f)).isDirectory());

  console.log(
    `Scanning ${folders.length} folder(s) for photos within ${THRESHOLD_MS / 1000}s of each other${
      dryRun ? " (dry run, nothing will move)" : ""
    }...\n`
  );

  let totalMoved = 0;
  let totalGroups = 0;
  for (const folder of folders) {
    const { moved, groups } = await processFolder(folder);
    totalMoved += moved;
    totalGroups += groups;
  }

  console.log(`\n${totalGroups} burst(s) found, ${totalMoved} duplicate photo(s) ${dryRun ? "would be" : ""} moved${
    dryRun ? "" : ` to ${path.relative(ROOT, TRASH_DIR)}/`
  }.`);
  if (!dryRun && totalMoved > 0) {
    console.log(`Review that folder and delete it once you're happy with the result.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
