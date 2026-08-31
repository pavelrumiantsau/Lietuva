// Populates `photos` and `highlightPhoto` in each src/content/places/*.json
// from tools/photos-manifest.json (written by process-photos.js).
// Highlight photo defaults to the middle photo of the chronological set (a
// reasonable generic "cover shot" heuristic) unless one is already set.
const fs = require("fs");
const path = require("path");

const PLACES_DIR = path.join(__dirname, "..", "src", "content", "places");
const MANIFEST_PATH = path.join(__dirname, "photos-manifest.json");

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

const files = fs.readdirSync(PLACES_DIR).filter((f) => f.endsWith(".json"));
let updated = 0;
let missingPhotos = [];

for (const file of files) {
  const filePath = path.join(PLACES_DIR, file);
  const place = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = manifest[place.slug];

  if (!entries || entries.length === 0) {
    missingPhotos.push(place.slug);
    continue;
  }

  const photoFiles = entries.map((e) => e.file);
  place.photos = photoFiles;
  if (!place.highlightPhoto) {
    place.highlightPhoto = photoFiles[Math.floor(photoFiles.length / 2)];
  }

  fs.writeFileSync(filePath, JSON.stringify(place, null, 2) + "\n");
  updated++;
}

console.log(`Updated ${updated} place files with photos.`);
if (missingPhotos.length) {
  console.log(`No processed photos found for: ${missingPhotos.join(", ")}`);
}
