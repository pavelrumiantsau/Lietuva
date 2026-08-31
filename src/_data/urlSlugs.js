// Maps each internal language code (used everywhere for content lookups,
// the <html lang> attribute, and i18n filenames — "uk" is the correct
// ISO 639-1 code for Ukrainian) to the path segment used in URLs. Kept
// separate because "uk" reads as United Kingdom in a URL, so the public
// URL uses the more recognizable "ua" while everything else stays "uk".
module.exports = { lt: "lt", en: "en", uk: "ua" };
