const i18nStrings = {
  lt: require("./src/_data/i18n/lt.json"),
  en: require("./src/_data/i18n/en.json"),
  uk: require("./src/_data/i18n/uk.json"),
};

// Note: language routing/hreflang are hand-rolled (see src/_data/placePages.js
// and the base layout) rather than via @11ty/eleventy's EleventyI18nPlugin,
// since our URL scheme is generated through custom pagination (locale x place
// x gallery-page) rather than the plugin's directory-based language convention.
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  eleventyConfig.addFilter("placeUrl", (place, lang) => `/${lang}/places/${place.slug}/`);
  eleventyConfig.addFilter("homeUrl", (lang) => `/${lang}/`);
  eleventyConfig.addFilter("listUrl", (lang) => `/${lang}/places/`);

  // Lean, single-language projection for the homepage map's embedded JSON —
  // the full `places` data (all 3 languages, full photo lists, facts) would
  // otherwise get inlined into every homepage build (~680KB, mostly unused).
  eleventyConfig.addFilter("mapData", (places, lang) =>
    places
      .filter((p) => p.coordinates)
      .map((p) => ({
        slug: p.slug,
        lat: p.coordinates.lat,
        lng: p.coordinates.lng,
        name: p.name[lang],
        shortDescription: p.shortDescription[lang],
        highlightPhoto: p.highlightPhoto || null,
      }))
  );

  // Usage in templates: {{ "nav.map" | t(lang) }}
  eleventyConfig.addFilter("t", (keyPath, lang) => {
    const parts = keyPath.split(".");
    let node = i18nStrings[lang] || i18nStrings.lt;
    for (const part of parts) {
      node = node && node[part];
    }
    if (node === undefined) {
      let fallback = i18nStrings.lt;
      for (const part of parts) fallback = fallback && fallback[part];
      return fallback !== undefined ? fallback : keyPath;
    }
    return node;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
