# Velin Magic — guide for people and AI assistants

Read this before editing. CLAUDE.md points here.

## Current product decisions
- Velin is the personal magician/artist brand; Untitled Magic is the broader event brand.
- Seven formats follow the owner's 171 reference. Close-up and stage are Velin formats; specialist shows require team coordination.
- **Show prices.** On 18 September 2026 the owner reversed the 17 September no-price request: prices from content/shows.json (price, priceFrom = "เริ่มต้น") appear on cards, show pages, the price table, flows, metadata and Service/Offer schema. Change prices only in shows.json. tools/check.py fails if a show page has no price.
- There is no basket/shortlist. Each show links to /contact/?show=<slug>, which prefills one editable field.
- Customers choose shows, describe the event and request a quotation. No backend booking or automatic message sending exists.
- Never invent reviews, awards, clients, durations, availability or team identities.
- Source photos illustrate show formats; not every performer pictured is Velin.
- Show galleries mix the 171 set (cover, 01…) with photos copied from the Untitled Magic site (u01…, 18 September 2026). Each u* file has a scene description in shows.json -> photoAlts. The build skips any gallery file that looks identical to the cover.
- Typography is minimal sans: Anuphan for headings/accents, IBM Plex Sans Thai for body. No serif or italic faces.
- Show pages: hero carousel plus a photo grid (first 9 tiles, then "ดูภาพทั้งหมด") that opens the lightbox with a thumbnail strip. The "use with other shows" run-of-show section was removed from show pages at the owner's request; flows remain on home, catalogue and occasion pages.
- Never edit the other owner projects (Untitled/171) when adapting assets.
- Thai first; respect reduced motion and keyboard use.
- Do not push/deploy unless the owner asks. Pushing main auto-deploys to Vercel.

## Source map
| Path | Purpose |
| --- | --- |
| content/site.json | Brand, contact, socials, performer, finder, process |
| content/shows.json | Seven shows, prices, copy, tags, SEO, preparation, optional photoAlts |
| content/occasions.json | Five event types and suggested show sequences |
| content/faq.json | FAQ copy |
| photos/shows/<slug>/ | Source images: cover.* = cover; remaining files = gallery |
| photos/velin/, photos/site/ | Hero and supporting imagery |
| src/templates/ | Shared layout and page templates |
| src/css/site.css | Tokens and responsive components |
| src/js/site.js | Finder, filters, shortlist, media, local message composer |
| src/static/ | Assets copied as-is |
| tools/build.py | Python/Pillow static generator |
| tools/media_server.py + media.html | Local-only image upload manager on 4323 |
| tools/serve.py | Public-only preview on 4321 |
| public/ | Generated deployable output: never edit manually |
| uploads/ | Local originals and previous covers; excluded from Git/deployment |
| docs/ | Handoff and verification |
| archive/ | Inactive history |

## Workflow
1. Edit content/, photos/ or src/.
2. Run python tools/build.py.
3. Run python tools/check.py and node --check src/js/site.js.
4. Preview desktop/mobile and test affected interactions.
5. For uploader changes run python tools/test_media.py (isolated project copy).
6. Keep generated public/ changes with source changes. No automatic publication.

Python with Pillow on this machine: %USERPROFILE%/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe. Other machines need Python 3.10+ and Pillow.

## Images
Double-click เปิดจัดการภาพ.cmd or run python tools/media_server.py. Select the show, cover/gallery, files and a truthful description. Upload rebuilds locally. Originals and previous covers are retained in uploads/.

Manual option: put files in photos/shows/<slug>/ and rebuild. Keep exactly one cover.* per show. Gallery sorts by filename. Optional show.photoAlts maps filenames to descriptions; coverAlt describes the cover. The uploader maintains these fields.

The manager binds only to 127.0.0.1, validates Host/Origin and a per-session token, and never ships to public/. Do not convert it into a public upload endpoint.

## Templates and SEO
Templates support escaped {{key}}, trusted generated HTML {{{key}}}, partials {{> name}}, and conditional sections {{#key}} / {{^key}}.

19 indexable pages: home, show catalogue, seven show pages, five occasion pages, about, gallery, FAQ, contact, privacy. A separate real 404 is noindex. The builder emits crawlable HTML, unique titles/descriptions, canonical links, responsive images, OG images, sitemap and structured data. Service schema carries the price as an Offer. Hashed assets use long caching.

Update content/site.json -> url when the canonical domain changes. SEO infrastructure does not guarantee rankings.

## Journey
Finder/occasion -> show -> choose -> shortlist -> contact -> generate text -> copy/open LINE. localStorage stores show IDs only; customer form data remains on the page. Direct links remain usable without JavaScript.

Production: https://velin-magic-site.vercel.app/
Repository: https://github.com/friday192002-netizen/velin-magic-site
