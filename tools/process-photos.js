// Resizes/compresses photos from ../Photos (raw, never committed) into
// ../src/assets/photos/<slug>/{full,thumb}/ (committed, served by the site).
//
// Usage:
//   node tools/process-photos.js                  full run, all places
//   node tools/process-photos.js --only=kaunas,trakai   just these place slugs
//   node tools/process-photos.js --limit=5         first N photos per place (calibration)
//
// Also writes tools/photos-manifest.json: { [slug]: [{file, capturedAt, sourceFolder}] }
// sorted by real capture date, for use when authoring src/content/places/*.json.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const exifr = require("exifr");

const ROOT = path.join(__dirname, "..");
const PHOTOS_DIR = path.join(ROOT, "Photos");
const OUT_DIR = path.join(ROOT, "src", "assets", "photos");
const FOLDER_MAP_PATH = path.join(__dirname, "folder-to-place-map.json");
const SPLIT_MAP_PATH = path.join(__dirname, "klaipeda-trakai-split.json");
const MANIFEST_PATH = path.join(__dirname, "photos-manifest.json");
const SPLIT_FOLDER_NAME = "Klaipėda, Trakai (december 2017)".normalize("NFC");

const FULL_MAX = 1280;
const THUMB_MAX = 400;
const JPEG_QUALITY = 56;

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="));
const onlySlugs = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
const limitArg = args.find((a) => a.startsWith("--limit="));
const perPlaceLimit = limitArg ? parseInt(limitArg.slice("--limit=".length), 10) : null;

const folderMap = JSON.parse(fs.readFileSync(FOLDER_MAP_PATH, "utf8"));
const splitMap = JSON.parse(fs.readFileSync(SPLIT_MAP_PATH, "utf8"));

const FILENAME_DATE_PATTERNS = [
  // Photo 2023-07-09 13 20 11.jpg
  { re: /Photo (\d{4})-(\d{2})-(\d{2}) (\d{2}) (\d{2}) (\d{2})/, order: ["y", "m", "d", "H", "M", "S"] },
  // Photo 18-07-2026, 16 04 42.jpg
  { re: /Photo (\d{2})-(\d{2})-(\d{4}), (\d{2}) (\d{2}) (\d{2})/, order: ["d", "m", "y", "H", "M", "S"] },
  // IMG_20231028_153211.jpg or IMG-20231028-WA0001.jpg
  { re: /(?:IMG|VID)[_-](\d{4})(\d{2})(\d{2})/, order: ["y", "m", "d"] },
  // 2014-08-10 08.57.02.jpg
  { re: /(\d{4})-(\d{2})-(\d{2}) (\d{2})\.(\d{2})\.(\d{2})/, order: ["y", "m", "d", "H", "M", "S"] },
];

function dateFromFilename(filename) {
  for (const { re, order } of FILENAME_DATE_PATTERNS) {
    const m = filename.match(re);
    if (!m) continue;
    const parts = {};
    order.forEach((key, i) => (parts[key] = parseInt(m[i + 1], 10)));
    const y = parts.y;
    const mo = (parts.m || 1) - 1;
    const d = parts.d || 1;
    const H = parts.H || 0;
    const M = parts.M || 0;
    const S = parts.S || 0;
    const dt = new Date(y, mo, d, H, M, S);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

async function getCaptureDate(filePath, filename) {
  try {
    const exifDate = await exifr.parse(filePath, { pick: ["DateTimeOriginal", "CreateDate"] });
    if (exifDate && (exifDate.DateTimeOriginal || exifDate.CreateDate)) {
      return { date: exifDate.DateTimeOriginal || exifDate.CreateDate, source: "exif" };
    }
  } catch (e) {
    // fall through
  }
  const fromName = dateFromFilename(filename);
  if (fromName) return { date: fromName, source: "filename" };

  const stat = fs.statSync(filePath);
  console.warn(`  [warn] no EXIF/filename date for ${filename}, falling back to mtime`);
  return { date: stat.mtime, source: "mtime" };
}

function sanitizeBaseName(filename) {
  const ext = path.extname(filename).toLowerCase();
  let base = path.basename(filename, path.extname(filename));
  base = base.normalize("NFC");
  base = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return { base, ext: ext === ".jpeg" ? ".jpg" : ext };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function fileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha1").update(buf).digest("hex");
}

async function collectSourceFiles() {
  // slug -> [{ filePath, sourceFolder, originalName }]
  const bySlug = {};

  function addFile(slug, filePath, sourceFolder, originalName) {
    if (!bySlug[slug]) bySlug[slug] = [];
    bySlug[slug].push({ filePath, sourceFolder, originalName });
  }

  const folders = fs
    .readdirSync(PHOTOS_DIR)
    .filter((f) => fs.statSync(path.join(PHOTOS_DIR, f)).isDirectory());

  for (const folder of folders) {
    const folderPath = path.join(PHOTOS_DIR, folder);
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => /\.(jpe?g)$/i.test(f));

    if (folder.normalize("NFC") === SPLIT_FOLDER_NAME) {
      for (const file of files) {
        const slug = splitMap[file];
        if (!slug) {
          console.warn(`  [warn] ${folder}/${file} not in klaipeda-trakai-split.json, skipping`);
          continue;
        }
        addFile(slug, path.join(folderPath, file), folder, file);
      }
      continue;
    }

    const slug = folderMap[folder];
    if (!slug) {
      console.warn(`  [warn] no place mapping for folder "${folder}", skipping`);
      continue;
    }
    for (const file of files) {
      addFile(slug, path.join(folderPath, file), folder, file);
    }
  }

  return bySlug;
}

async function processPlace(slug, files) {
  // De-dupe byte-identical files (e.g. "IMG_4067 (1).jpg" vs "IMG_4067.jpg").
  const seenHashes = new Set();
  const deduped = [];
  for (const f of files) {
    const hash = fileHash(f.filePath);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);
    deduped.push(f);
  }

  // Determine capture date for each, then sort chronologically.
  const withDates = [];
  for (const f of deduped) {
    const { date, source } = await getCaptureDate(f.filePath, f.originalName);
    withDates.push({ ...f, date, dateSource: source });
  }
  withDates.sort((a, b) => a.date - b.date);

  const limited = perPlaceLimit ? withDates.slice(0, perPlaceLimit) : withDates;

  const fullDir = path.join(OUT_DIR, slug, "full");
  const thumbDir = path.join(OUT_DIR, slug, "thumb");
  fs.mkdirSync(fullDir, { recursive: true });
  fs.mkdirSync(thumbDir, { recursive: true });

  const usedNames = new Set();
  const manifestEntries = [];

  for (const f of limited) {
    const { base, ext } = sanitizeBaseName(f.originalName);
    const d = f.date;
    const dateTag = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    let outName = `${dateTag}-${base}${ext}`;
    let suffix = 2;
    while (usedNames.has(outName)) {
      outName = `${dateTag}-${base}-${suffix}${ext}`;
      suffix++;
    }
    usedNames.add(outName);

    const fullOut = path.join(fullDir, outName);
    const thumbOut = path.join(thumbDir, outName);

    await sharp(f.filePath)
      .rotate()
      .resize({ width: FULL_MAX, height: FULL_MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(fullOut);

    await sharp(f.filePath)
      .rotate()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(thumbOut);

    manifestEntries.push({
      file: outName,
      capturedAt: d.toISOString(),
      dateSource: f.dateSource,
      sourceFolder: f.sourceFolder,
      sourceFile: f.originalName,
    });
  }

  return manifestEntries;
}

async function main() {
  console.log("Collecting source files...");
  const bySlug = await collectSourceFiles();

  let slugs = Object.keys(bySlug).sort();
  if (onlySlugs) slugs = slugs.filter((s) => onlySlugs.has(s));

  console.log(`Processing ${slugs.length} place(s)${perPlaceLimit ? ` (limit ${perPlaceLimit}/place)` : ""}...`);

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
    : {};

  for (const slug of slugs) {
    process.stdout.write(`  ${slug} (${bySlug[slug].length} source files)...`);
    const entries = await processPlace(slug, bySlug[slug]);
    manifest[slug] = entries;
    console.log(` -> ${entries.length} photos`);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nManifest written to ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
