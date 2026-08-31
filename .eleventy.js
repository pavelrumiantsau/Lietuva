const { HtmlBasePlugin } = require("@11ty/eleventy");

const i18nStrings = {
  lt: require("./src/_data/i18n/lt.json"),
  en: require("./src/_data/i18n/en.json"),
  uk: require("./src/_data/i18n/uk.json"),
};
const urlSlugs = require("./src/_data/urlSlugs.js");

// Note: language routing/hreflang are hand-rolled (see src/_data/placePages.js
// and the base layout) rather than via @11ty/eleventy's EleventyI18nPlugin,
// since our URL scheme is generated through custom pagination (locale x place
// x gallery-page) rather than the plugin's directory-based language convention.
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Rewrites every href/src in the built HTML (link/a/img/script/meta-refresh/
  // etc.) with the --pathprefix passed at build time, so the site works both
  // served from "/" locally and from "/Lietuva/" on GitHub Pages project
  // pages, without hand-prefixing every template path. Doesn't reach URLs
  // embedded outside HTML attributes (JSON blobs, inline <script> strings) —
  // those are prefixed explicitly below via the "url" filter it registers.
  eleventyConfig.addPlugin(HtmlBasePlugin);
  const urlFilter = eleventyConfig.getFilter("url");

  // Escaping "<" prevents a "</script>" (or "<!--") substring inside any
  // place description from prematurely closing the <script> tag this gets
  // embedded in — JSON.stringify alone doesn't escape it.
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value).replace(/</g, "\\u003c"));

  // Display label for the language switcher — "uk" is the correct ISO 639-1
  // code for Ukrainian (and stays "uk" in every URL/lang attribute), but
  // showing "UK" in a language switcher reads as United Kingdom, so the
  // switcher's visible label uses the country-style "UA" instead.
  const LANG_LABELS = { lt: "LT", en: "EN", uk: "UA" };
  eleventyConfig.addFilter("langLabel", (lang) => LANG_LABELS[lang] || lang.toUpperCase());

  eleventyConfig.addFilter("placeUrl", (place, lang) => `/${urlSlugs[lang] || lang}/places/${place.slug}/`);
  eleventyConfig.addFilter("homeUrl", (lang) => `/${urlSlugs[lang] || lang}/`);
  eleventyConfig.addFilter("listUrl", (lang) => `/${urlSlugs[lang] || lang}/places/`);

  // Lean, single-language projection for the homepage map's embedded JSON —
  // the full `places` data (all 3 languages, full photo lists, facts) would
  // otherwise get inlined into every homepage build (~680KB, mostly unused).
  // This JSON lives inside a <script type="application/json"> text node, so
  // HtmlBasePlugin never sees it — the pathPrefix has to be applied by hand
  // via the "url" filter, same as map.js does for the client-built photo URL.
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
        url: urlFilter(`/${urlSlugs[lang] || lang}/places/${p.slug}/`),
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
