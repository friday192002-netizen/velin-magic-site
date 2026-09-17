# Velin artist portfolio — redesign

## Boundaries
Untitled Magic source was read only. Its source, Git remotes, hosting and domain were not modified. No production push/deployment was made during this redesign.

## Brand
Velin is the personal artist/magician. Untitled Magic is the broader event/organizer business. Shared contact channels were explicitly authorized. Past footage/photos are labelled as the Untitled archive, not passed off as a new Velin event.

## Active site
- index.html: semantic Thai artist portfolio, English display headlines.
- assets/css/site.css: design tokens, desktop/mobile layouts, reduced-motion support.
- assets/js/site.js: navigation, gallery/film dialog, booking text preparation.
- assets/images/: locally stored WebP copies from the old project.
- assets/velin-hero*: existing Velin cutout.
- docs/asset-sources.json: provenance and dimensions.
- archive/previous-site/: snapshot of previous implementation, excluded from deployment.

## Publishing
The existing GitHub → Vercel integration remains the delivery path. No dependency install or build is needed. Push main only when deployment is requested. Static asset cache must revalidate because filenames are not hashed.

## Booking
The form validates input and produces a message locally. It does not submit data, send messages, store personal data, or claim a booking has been received. The visitor copies it and sends via LINE. Phone, LINE, Facebook, Instagram and TikTok are taken from the owner’s existing site. No invented email, awards, clients, reviews, pricing or statistics.

## Content
Artist voice is newly written editorial copy, not a verbatim personal quotation. Existing reference rates are deliberately not presented as Velin rates. Selected photos are limited in source resolution (640×480); retain their natural size when replacing them with higher-resolution originals.

## Video
Uses existing YouTube video only after explicit play. Playback can depend on YouTube restrictions; an external fallback link is always visible. Closing the modal removes the iframe.

## Preview
Run a static HTTP server from the project root. Current local preview port: 4322.
