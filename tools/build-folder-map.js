// One-off helper: derive tools/folder-to-place-map.json from the raw Photos/
// folder names. Run once, then hand-review the output (see the plan's notes
// on merges like Kaunas/Klaipeda/Daugai and the Klaipeda+Trakai split).
const fs = require("fs");
const path = require("path");

const photosDir = path.join(__dirname, "..", "Photos");

const DIACRITICS_MAP = {
  ą: "a", č: "c", ę: "e", ė: "e", į: "i", š: "s", ų: "u", ū: "u", ž: "z",
  Ą: "A", Č: "C", Ę: "E", Ė: "E", Į: "I", Š: "S", Ų: "U", Ū: "U", Ž: "Z",
};

function stripDiacritics(str) {
  return str.replace(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, (c) => DIACRITICS_MAP[c] || c);
}

function slugify(str) {
  return stripDiacritics(str.normalize("NFC"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const folders = fs
  .readdirSync(photosDir)
  .filter((f) => fs.statSync(path.join(photosDir, f)).isDirectory());

const map = {};
for (const folder of folders) {
  const baseName = folder.replace(/\s*\([^)]*\)\s*$/, "").trim();
  map[folder] = slugify(baseName);
}

fs.writeFileSync(
  path.join(__dirname, "folder-to-place-map.json"),
  JSON.stringify(map, null, 2) + "\n"
);

console.log(`Wrote ${Object.keys(map).length} folder mappings.`);
