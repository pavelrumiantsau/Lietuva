// Crawls the built _site/ output and checks for issues a browser would hit
// but a template build won't catch: broken internal links, missing image
// files, stray hardcoded locale paths, html lang mismatches, duplicate ids.
const fs = require("fs");
const path = require("path");

const SITE_DIR = path.join(__dirname, "..", "_site");

// Absolute hrefs/srcs in the built HTML carry whatever --pathprefix the site
// was built with (e.g. "/Lietuva/lt/"), but _site's own directory layout
// never does (it's just "lt/index.html") — so links have to be de-prefixed
// before resolving them against SITE_DIR. Set PATH_PREFIX to match the build.
const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/$/, "");
function stripPrefix(url) {
  if (PATH_PREFIX && url.startsWith(PATH_PREFIX)) {
    const rest = url.slice(PATH_PREFIX.length);
    return rest === "" ? "/" : rest;
  }
  return url;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const htmlFiles = walk(SITE_DIR);
console.log(`Scanning ${htmlFiles.length} HTML files...\n`);

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`[WARN] ${msg}`);
  warnings++;
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const rel = path.relative(SITE_DIR, file);

  // 1. Stray hardcoded /uk/ locale paths (should all be /ua/ now).
  const ukPattern = new RegExp(`(?:href|src)="${PATH_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/uk/`, "g");
  const ukMatches = html.match(ukPattern);
  if (ukMatches) fail(`${rel}: found ${ukMatches.length} stray "/uk/" URL(s) — should be "/ua/"`);

  // 2. html lang attribute sanity: must be one of lt/en/uk (internal code, not "ua").
  const langMatch = html.match(/<html lang="([^"]+)"/);
  if (!langMatch) {
    fail(`${rel}: missing <html lang> attribute`);
  } else if (!["lt", "en", "uk"].includes(langMatch[1])) {
    fail(`${rel}: unexpected <html lang="${langMatch[1]}">`);
  }

  // 3. Duplicate ids (gallery-grid, main, etc.)
  const ids = html.match(/\sid="([^"]+)"/g) || [];
  const idValues = ids.map((m) => m.match(/id="([^"]+)"/)[1]);
  const dupes = idValues.filter((id, i) => idValues.indexOf(id) !== i);
  if (dupes.length) fail(`${rel}: duplicate id(s): ${[...new Set(dupes)].join(", ")}`);

  // 4. Internal links (href="/...") resolve to a real file.
  const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const href of hrefs) {
    const clean = stripPrefix(href.split("#")[0].split("?")[0]);
    if (!clean || clean === "/") continue;
    let target = path.join(SITE_DIR, clean);
    if (clean.endsWith("/")) target = path.join(target, "index.html");
    else if (!path.extname(clean)) target = target + "/index.html";
    if (!fs.existsSync(target)) fail(`${rel}: broken link to "${href}"`);
  }

  // 5. Image src references resolve to a real file.
  const srcs = [...html.matchAll(/src="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const src of srcs) {
    if (src.startsWith("//") || src.startsWith("http")) continue;
    const target = path.join(SITE_DIR, stripPrefix(src.split("?")[0]));
    if (!fs.existsSync(target)) fail(`${rel}: missing image "${src}"`);
  }
}

console.log(`\n${htmlFiles.length} files scanned, ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
