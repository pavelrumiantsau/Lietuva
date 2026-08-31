# Lithuania Travels

A personal map of places visited around Lithuania — click a dot for a photo and short story, then explore the full gallery and some interesting facts. Available in Lithuanian, English and Ukrainian.

Built with [Eleventy](https://www.11ty.dev/), [Leaflet](https://leafletjs.com/), and deployed to GitHub Pages via GitHub Actions.

## Project structure

```
Photos/                     raw source photos (NOT committed — 21GB, gitignored)
tools/                      local build tooling (image pipeline, content helpers)
  process-photos.js         resizes/compresses Photos/ -> src/assets/photos/
  folder-to-place-map.json  maps each Photos/ subfolder to a place slug
  klaipeda-trakai-split.json  per-photo split for the one folder covering 3 places
  slug-to-name.json         canonical Lithuanian name per slug
  validate-coordinates.js   sanity-checks src/content/places/*.json
  wire-photos.js            fills in `photos`/`highlightPhoto` from the manifest
src/
  content/places/*.json     one file per place: names, descriptions, facts, coords, photos
  _data/                    i18n strings, locale list, place-page pagination logic
  assets/photos/<slug>/     processed images actually served by the site (committed)
  *.njk                     page templates (home map, places list, place page)
```

## Local development

```
npm install
npm run serve      # http://localhost:8080
```

## Updating photos or adding a new place

1. Drop a new dated folder into `Photos/` (e.g. `New Place (month year)`), or add photos to an existing one.
2. Add/confirm its entry in `tools/folder-to-place-map.json` (folder name -> place slug).
3. Run `node tools/process-photos.js --only=<slug>` to (re)process just that place.
4. Run `node tools/wire-photos.js` to refresh `photos`/`highlightPhoto` in its content file.
5. If it's a brand-new place, create `src/content/places/<slug>.json` (copy an existing file as a template) with real coordinates and lt/en/uk content, then run `node tools/validate-coordinates.js`.
6. `npm run serve` to preview, then commit.

## Content review

Every place file has a `reviewed: { lt, en, uk }` flag — all content was drafted as a first pass and defaults to `false`. Flip a language to `true` once you've checked it over.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and publishes it via GitHub Pages. In the repo's Settings → Pages, the source must be set to **GitHub Actions** (not "Deploy from a branch").
