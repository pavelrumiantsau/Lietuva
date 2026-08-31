const fs = require("fs");
const path = require("path");

const placesDir = path.join(__dirname, "..", "content", "places");

module.exports = () => {
  if (!fs.existsSync(placesDir)) return [];

  return fs
    .readdirSync(placesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(placesDir, file), "utf8");
      return JSON.parse(raw);
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
};
