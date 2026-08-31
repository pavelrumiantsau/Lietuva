const locales = require("./locales.js");
const getPlaces = require("./places.js");
const urlSlugs = require("./urlSlugs.js");

const PHOTOS_PER_PAGE = 48;

module.exports = () => {
  const places = getPlaces();
  const entries = [];

  for (const lang of locales) {
    const slug = urlSlugs[lang] || lang;
    for (const place of places) {
      const photos = place.photos || [];
      const totalPages = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE));

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        const start = (pageNumber - 1) * PHOTOS_PER_PAGE;
        const pagePhotos = photos.slice(start, start + PHOTOS_PER_PAGE);
        const permalink =
          pageNumber === 1
            ? `/${slug}/places/${place.slug}/`
            : `/${slug}/places/${place.slug}/photos/${pageNumber}/`;

        entries.push({
          lang,
          place,
          pageNumber,
          totalPages,
          pagePhotos,
          permalink,
          prevPermalink:
            pageNumber === 1
              ? null
              : pageNumber === 2
              ? `/${slug}/places/${place.slug}/`
              : `/${slug}/places/${place.slug}/photos/${pageNumber - 1}/`,
          nextPermalink:
            pageNumber === totalPages
              ? null
              : `/${slug}/places/${place.slug}/photos/${pageNumber + 1}/`,
        });
      }
    }
  }

  return entries;
};
