# Validation — 18 September 2026 (prices shown)

- Build, tools/check.py (now requires a price on every show page), node --check and tools/test_media.py pass.
- Browser (headless Chrome, 390px mobile): 12 pages with no console errors or horizontal overflow; /contact/?show=stage prefills มายากลเวที; prices visible on cards, show pages and home stats.
- No message sent.

## Previous run — 17 September 2026 (no-price version, superseded)

- Build succeeds: 19 indexable pages plus 404.
- tools/check.py passes: one H1 per page, unique IDs and titles, descriptions, canonical, valid JSON-LD, sitemap, existing internal links/images and no public prices.
- node --check src/js/site.js passes.
- tools/test_media.py passes in an isolated copy: gallery upload, cover replacement, backup of previous cover, generated alt text, invalid file/slug rejection, CSRF checks, and source-file isolation.
- Browser: filter for kids returns stage/bubble/juggling/bozo. Show selection persists into contact. Generated message includes selected show and no price; no message sent.
- Browser: home, catalogue, stage detail and contact checked at 320, 768 and 1440 pixels; no horizontal overflow after fixing the flow links. Hero/detail visually reviewed at 390 pixels.
- Browser: no console errors during main journey checks.
- Image manager UI loads all seven show options and existing photos.
- Actual LINE transmission and live YouTube playback were not exercised. No deployment performed in this update.

Rerun browser checks when changing interactions or layout. Older validation documents describe older versions.
