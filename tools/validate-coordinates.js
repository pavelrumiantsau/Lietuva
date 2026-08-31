// Sanity-checks src/content/places/*.json: every place has coordinates inside
// Lithuania's bounding box, and no two places share the exact same lat/lng
// (a common copy-paste bug when hand-authoring ~120 coordinate pairs).
const fs = require("fs");
const path = require("path");

const PLACES_DIR = path.join(__dirname, "..", "src", "content", "places");

// Generous bounding box around Lithuania (includes a small margin).
const BOUNDS = { minLat: 53.85, maxLat: 56.55, minLng: 20.85, maxLng: 26.95 };

function main() {
  const files = fs.readdirSync(PLACES_DIR).filter((f) => f.endsWith(".json"));
  let errors = 0;
  const seenCoords = new Map();

  for (const file of files) {
    const place = JSON.parse(fs.readFileSync(path.join(PLACES_DIR, file), "utf8"));
    const label = `${file} (${place.slug})`;

    if (!place.coordinates || typeof place.coordinates.lat !== "number" || typeof place.coordinates.lng !== "number") {
      console.error(`[FAIL] ${label}: missing or invalid coordinates`);
      errors++;
      continue;
    }

    const { lat, lng } = place.coordinates;
    if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
      console.error(`[FAIL] ${label}: coordinates (${lat}, ${lng}) fall outside Lithuania's bounding box`);
      errors++;
    }

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seenCoords.has(key)) {
      console.error(`[FAIL] ${label}: coordinates (${lat}, ${lng}) duplicate ${seenCoords.get(key)}`);
      errors++;
    } else {
      seenCoords.set(key, label);
    }

    for (const lang of ["lt", "en", "uk"]) {
      if (!place.name || !place.name[lang]) {
        console.error(`[FAIL] ${label}: missing name.${lang}`);
        errors++;
      }
      if (!place.shortDescription || !place.shortDescription[lang]) {
        console.error(`[FAIL] ${label}: missing shortDescription.${lang}`);
        errors++;
      }
      if (!place.longDescription || !place.longDescription[lang]) {
        console.error(`[FAIL] ${label}: missing longDescription.${lang}`);
        errors++;
      }
    }
  }

  console.log(`\nChecked ${files.length} places, ${errors} error(s).`);
  if (errors > 0) process.exit(1);
}

main();
