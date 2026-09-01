# Velin Magic — เว็บโปรไฟล์นักมายากล

Implementation of the Claude Design project
[`Velin Magic.dc.html`](https://claude.ai/design/p/716bba40-38f3-47ea-a709-37c3ba13fd0d?file=Velin+Magic.dc.html).

## Deploy

`main` is wired to Vercel through the GitHub integration, so shipping is just:

```bash
git push
```

Every push to `main` builds a production deploy; any other branch gets its own
preview URL. There is no build step — Vercel serves the repo root as static
files, with `vercel.json` supplying clean URLs, cache headers for `/assets/`,
and a few security headers.

- Repo: <https://github.com/friday192002-netizen/velin-magic-site>
- Vercel project: `velin-magic-site`

Note this is a separate project from the earlier React/Vite `velin-magic` repo
that serves velin-magic.vercel.app — the two are not connected.

## Run

```bash
python -m http.server 4321
```

Then open <http://localhost:4321>. Any static server works — there is no build step.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The site. Content from the design's `DCLogic.renderVals()` is expanded into static markup. |
| `styles.css` | All styling. Design tokens live in `:root`. |
| `main.js` | Nav, scroll-spy, reveals, stat counters, image slots, quote form. |
| `vercel.json` | Clean URLs, cache and security headers for the deploy. |
| `.vercelignore` | Keeps the design reference files in git but off the CDN. |
| `assets/velin-hero.webp` | Hero portrait, 1750px — 90 KB, what browsers actually load. |
| `assets/velin-hero@900.webp` | Same at 900px — 43 KB, for 1x desktop and phones. |
| `assets/velin-hero.png` | 1750px original, 1.73 MB. Kept as the `<picture>` fallback and as the Open Graph image, since some social scrapers still refuse WebP. |
| `Velin Magic.dc.html` | The imported design source — reference only, not served. |
| `image-slot.js`, `support.js` | Claude Design runtime the `.dc.html` depends on — reference only. |
| `screens/`, `uploads/` | Canvas thumbnails and original uploads from the design project. |

## Colour system

The site runs two deliberately separate colour worlds, so the hero reads as its
own cinematic frame rather than the top of a long dark page:

| World | Sections | Ground |
| --- | --- | --- |
| **Night** | hero, testimonials band, footer | `#0A0807` / `#211710` with brass `#C9A47A` |
| **Paper** | about, shows, portfolio, gallery, contact | `#FAF7F2` / `#F1EBE1` with ink `#17110E` and brown `#6B4B31` |

The nav rides on top of both: night styling over the hero, then it crossfades to
a paper bar the moment the hero's dark ground clears it.

Tokens for both worlds are declared together at the top of `styles.css`.

## Notes on the translation

The `.dc.html` is a fixed 1536 × 884 artboard built from the Claude Design DSL
(`<sc-for>`, `{{ bindings }}`, `style-hover`, `<image-slot>`). The production
version keeps the composition but rebuilds it fluidly:

- **Hero** — absolute pixel offsets became percentages, and type uses `clamp()`.
  Below 1024px the grid collapses to one column and the portrait drops back to a
  faded backdrop so the copy stays readable.
- **Icons** — the design used the card-suit characters (♠♣♥♦) and single letters
  for social links. Those are drawn here as a real inline SVG sprite: top hat,
  playing cards, masquerade mask and audience for the show formats, plus proper
  Facebook / Instagram / YouTube / TikTok marks and phone / mail / chat glyphs.
  Paint lives on presentation attributes rather than CSS, because rules written
  against `<symbol>` never reach the shadow tree that `<use>` clones.
- **Image slots** — `<image-slot>` is a Claude Design authoring component backed
  by the design server. It is reimplemented in `main.js` as `.img-slot`: click or
  drag an image in, it is downscaled to 1600px and kept in `localStorage` per
  browser. Placeholder captions are carried over verbatim.
- **Quote form** — the design's form was presentational. It now validates name
  and phone, tracks the show-format chips in a hidden `formats` field, and, with
  no backend wired up, hands the enquiry to the visitor's mail client. Replace
  that block in `main.js` with a `fetch()` to a booking endpoint when one exists.
- **Accessibility** — skip link, focus-visible rings, `aria-expanded` on the
  mobile menu, `aria-pressed` chips, keyboard-operable image slots, and a full
  `prefers-reduced-motion` path that disables the float/glow/twinkle animations.

## Hero image

The hero is served through `<picture>`: two WebP sources with `sizes` matching
the CSS widths (100vw on phones, 74vw to 1024px, 57.3vw above), falling back to
the PNG. Re-encoded at quality 82 the WebP measures 41.5 dB PSNR against the
original across opaque pixels — visually identical — with the alpha channel bit
exact, at 5% of the file size.

To regenerate after replacing the PNG:

```bash
python -c "from PIL import Image; im=Image.open('assets/velin-hero.png').convert('RGBA'); im.save('assets/velin-hero.webp','WEBP',quality=82,method=6); im.resize((900,900),Image.LANCZOS).save('assets/velin-hero@900.webp','WEBP',quality=82,method=6)"
```

## Placeholder content to replace before launch

The design ships with sample data. These are invented and need real values:

- Phone `091-234-5678`, email `velinmagic@gmail.com`, LINE/Instagram `@velinmagic`
- The six portfolio entries, eight client names, and three testimonials
- Social links in the hero rail and footer (all currently `#top`)
- Every image slot except the hero portrait
