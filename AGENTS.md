# AGENTS.md — working on the Velin Magic site

This file is the handbook for any AI assistant (Claude, Codex, GPT, Gemini…) and
for people. `CLAUDE.md` just points here. Read it fully before changing anything.

## What this is

A static, multi-page marketing site for **Velin Magic** (magic shows for
corporate events, launches, weddings, kids' events and festivals), written in
Thai. A Python script builds plain HTML into `public/`; Vercel serves that
folder. There is no framework, no npm, and no build on Vercel.

- Production: https://velin-magic-site.vercel.app
- Repo: https://github.com/friday192002-netizen/velin-magic-site (branch `main`)
- Every push to `main` deploys to production automatically.

## Layout

```
content/          ✏️  ALL text, prices, contact details, SEO copy (JSON)
  site.json         brand, phone/LINE/socials, stats, process, performer copy,
                    finder moods, "why us" points
  shows.json        the 7 show formats: price, copy, occasions, moods, prep notes
  occasions.json    the 5 event types → one landing page each, plus a run-of-show `flow`
  faq.json          questions (also emitted as FAQPage structured data)
photos/           📷  ORIGINAL images, any size (jpg/png/webp)
  shows/<slug>/     cover.* = card/hero image; every other file = gallery, sorted by filename
  velin/            hero-cutout.png (transparent), portrait-card.webp
  site/             atmosphere photos (e.g. the film poster)
src/              🎨  design
  templates/        layout.html + page-*.html + partials (see "Templates")
  css/site.css      all styles; design tokens at the top
  js/site.js        shortlist + sheet, finder, tabs, carousel, filters, lightbox,
                    video, reveal/parallax motion, quote composer
  static/           copied to public/ as-is (favicon.svg)
tools/build.py    ⚙️  content + photos + src → public/
tools/serve.py    local preview server (use this, not `python -m http.server`)
public/           🚫  GENERATED. Never edit by hand. Committed so Vercel can serve it.
docs/             decisions and handoff notes
archive/          old versions, read-only history — ignore unless asked
update-site.cmd   double-click on Windows: build + open local preview
```

## Commands

```bash
python -m pip install --user Pillow   # once per machine
python tools/build.py                 # rebuild public/ (fast: only new photos are encoded)
python tools/serve.py                 # preview at http://localhost:4321
```

Always run the build after changing `content/`, `photos/` or `src/`, and commit
the resulting `public/` changes together with the source change.

## Rules

1. **Edit sources, never `public/`.** The build deletes anything in `public/`
   it did not produce.
2. **One source of truth.** Prices, phone, LINE, socials live only in `content/`.
   Templates read them; JS reads prices from the `#show-data` JSON the build
   embeds. Never hard-code a price or phone number in a template or script.
3. **No invented facts.** Do not add reviews, client names, awards, statistics,
   show durations, discounts or guarantees unless the owner supplies them.
   Unknown operational details belong in the quote ("สิ่งที่เราสรุปให้ในใบเสนอราคา").
4. **Honest photos.** Show photos are sample photos from the team's past work;
   alt text describes the scene and never claims a photo is of Velin unless it is.
5. **Performer truth.** `performedBy: "velin"` only for formats Velin performs
   personally (currently close-up and stage). Everything else is `"team"`.
6. **Thai first.** Copy is Thai; English is only for small uppercase kickers.
7. **Don't publish without being asked.** Commit locally; push to `main` only
   when the owner asks to deploy.

## Common tasks

**Add or replace photos for a show** — drop files into `photos/shows/<slug>/`.
Name the main one `cover.jpg` (or .png/.webp). Gallery order = filename order
(`01.jpg`, `02.jpg`…). Run the build. Nothing else to edit.

**Change a price** — `content/shows.json` → `price` (number) and `priceFrom`
(`true` shows "เริ่มต้น"). Rebuild. The cards, price table, show page, quote
total, structured data and meta description all update.

**Add a show format** — add an object to `content/shows.json` (copy an existing
one; `slug` is the URL, lowercase a–z and hyphens), create
`photos/shows/<slug>/cover.jpg`, rebuild. It gets its own page, card, price-table
row, sitemap entry and occasion listings automatically.

**Add an event type** — add to `content/occasions.json`, reference its `slug` in
the `occasions` array of the relevant shows, rebuild.

**Change contact details** — `content/site.json` → `contact` / `social`.

**Tune the show finder** (home page, "หาโชว์ที่ใช่ใน 2 ขั้นตอน") — step 1 lists
the occasions; step 2 lists `site.json` → `finder.moods`. A show appears for a
mood when its `moods` array in `shows.json` contains that mood's `slug`. The
build stops with a Thai error if a show names a mood that doesn't exist.

**Change a run-of-show idea** — `occasions.json` → `flow`: ordered
`{moment, show, note}` steps. It renders as a timeline with the total price and
a "เลือกทั้งชุด" button on the occasion page, in the tabs on the home and
catalogue pages, and on each show page that appears in a flow.

**Text tokens** — `{showCount}` and `{minPrice}` inside `site.json` → `stats`
and `why` are replaced at build time, so counts and prices never go stale.

**Change the look** — tokens at the top of `src/css/site.css` (espresso scale,
champagne gradients, ivory/linen surfaces; `--gold-ink` for gold text on light
backgrounds); page structure in
`src/templates/`.

## Templates

Tiny mustache-style syntax implemented in `tools/build.py`:

| Syntax | Meaning |
| --- | --- |
| `{{key}}` / `{{a.b}}` | value, HTML-escaped |
| `{{{key}}}` | raw HTML (only for fragments the build generates) |
| `{{> partial}}` | include `src/templates/partial.html` |
| `{{#key}}…{{/key}}` | render when truthy |
| `{{^key}}…{{/key}}` | render when falsy |

Lists (cards, rows, FAQ) are assembled in `build.py` from partials such as
`show-card.html`, `price-row.html`, `occasion-tile.html`, `help-card.html`.

## Pages and SEO

| URL | Purpose | Structured data |
| --- | --- | --- |
| `/` | hero, show finder, all shows, occasions, why us, run-of-show tabs, performer, film, process, FAQ | EntertainmentBusiness, WebSite, FAQPage |
| `/shows/` | catalogue: filter by occasion, cards, price table (171 Magic Club structure) | ItemList, BreadcrumbList |
| `/shows/<slug>/` | one page per format: price, gallery, prep, related | Service + Offer, BreadcrumbList |
| `/occasions/<slug>/` | landing page per event type | ItemList, BreadcrumbList |
| `/about/`, `/gallery/`, `/faq/`, `/contact/`, `/privacy/` | supporting pages | Person / FAQPage / BreadcrumbList |

Each page gets a unique `<title>`, a meta description trimmed to 155 chars,
canonical URL (trailing slash), Open Graph image (1200×630 JPEG generated from
the cover), and a `sitemap.xml` entry. Images are responsive WebP with
width/height set. Hashed filenames under `/img`, `/og`, `/assets` are cached for
a year (`vercel.json`).

## Customer journey (keep it intact)

Occasion or catalogue → show page → **เลือก** (adds to a shortlist stored in
`localStorage`, shown as a badge and toast on every page) → `/contact/` lists
the shortlist with an estimated total → short form → generated message →
**คัดลอกและเปิด LINE**. Nothing is sent to a server. The bag button (header) and
the dock open the shortlist sheet (bottom sheet on phones, drawer on desktop)
from any page. The home finder and the run-of-show timelines are shortcuts into
the same shortlist. Phones get a sticky bottom
bar (LINE / call / shortlist; on show pages: price / เลือก / bag / LINE; hidden on
`/contact/`, and on the home page until the hero buttons scroll away).

Motion lives in `site.js` and CSS: `[data-reveal]` fades sections in (only when
JS runs, so content never stays hidden), `[data-count]` counts stats up,
`[data-parallax]` drifts the hero portrait. Everything honours
`prefers-reduced-motion`.

## Before you finish

- `python tools/build.py` completes without errors.
- Pages open locally (`python tools/serve.py`); no console errors; no horizontal scroll at 390px wide.
- If you changed copy: no invented facts (rule 3).
- Commit `content/`/`photos/`/`src/` changes **with** the regenerated `public/`.
