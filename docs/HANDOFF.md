> ข้อกำหนดล่าสุด (18 ก.ย. 2026): **แสดงราคาบนเว็บ** เจ้าของยกเลิกคำสั่งไม่แสดงราคาของวันที่ 17 ก.ย. ดู [RELEASE-2026-09-18](RELEASE-2026-09-18.md) และ [AGENTS.md](../AGENTS.md) ก่อนทำงาน

# Handoff — Velin Magic site

Last major change: 17 September 2026 — premium redesign (espresso & champagne
design system, show finder, run-of-show timelines, shortlist sheet, motion) on
top of the 171 Magic Club show structure and the content/photos/src → public build. Conventions for future work
are in [AGENTS.md](../AGENTS.md); this file records *why* things are the way they are.

## History

| When | What | Where it lives now |
| --- | --- | --- |
| Sep 1 | Single-page site implemented from the Claude Design artboard; full-screen hero | `archive/previous-site/`, git history |
| Sep 17 (Codex) | Multi-page editorial redesign, real contact channels and photos | `archive/codex-multipage/`, commit `a4b8fe0` |
| Sep 17 | 171-style catalogue, occasion landing pages, shortlist → LINE quote | commit `a20f34d` (live) |
| Sep 17 | Premium redesign: new design system, finder, flows, sheet, carousel, motion, mobile-first polish | current |

Untitled Magic, 171 Magic Club and the earlier React `velin-magic` repo are
separate projects and were only read, never modified.

## Decisions made with the owner

- **Prices are shown**, matching 171 Magic Club (฿8,000–฿40,000; opening and
  illusion are "เริ่มต้น"). The Codex version had deliberately hidden them; the
  owner chose to show them.
- **Contact channels are Untitled Magic's** (062-092-5274, LINE @untitled.magic),
  not 171 Magic Club's.
- **Velin is presented as the performer.** 171's placeholder performer cards
  ("ชื่อนักแสดง · ตัวอย่าง") were not copied. Velin performs close-up and stage
  personally; other formats are "Velin ร่วมกับทีมผู้เชี่ยวชาญ", and the team is
  confirmed before booking (from Codex's content).

- **Keep the brown-black palette, raise its quality** (owner, Sep 17): the
  redesign keeps white + brown-black but moves to a tonal espresso scale,
  champagne gradients, ivory/linen reading sections and Noto Serif Thai
  headings; the goal is a site a visitor chooses without needing to call first.

## Content provenance

- Show names, prices, taglines, descriptions, highlights and "เหมาะสำหรับ" lists:
  copied from `Web 171 Magic Club/deploy/magic-show.html` (`SHOWS`).
- Occasion tags per show: 171's `data-tags`. Stage also lists `wedding`, based on
  its own "งานฉลองและปาร์ตี้" fit.
- "สิ่งที่ควรเตรียม" per show and the Velin performer copy: Codex's content.
- Show photos: the 57 files from 171 (`assets/shows/`), byte-identical to what
  Codex had imported; cover alt texts from 171.
- Finder moods, "ทำไมผู้จัดงานเลือกเรา" points and run-of-show flows are new copy
  built only from facts already on the site (prices, formats, who performs,
  LINE workflow). Flow order is a suggestion, not a promise of timing.
- Occasion intros, FAQ answers and the 3-step process are new copy, written to
  avoid unverified claims: no durations, discounts, reviews, awards or client
  names. Travel cost and "เริ่มต้น" wording follow 171's own notes.

## Architecture notes

- **Why a Python build and not a framework:** zero dependencies beyond Pillow,
  nothing to install on Vercel, and any assistant can read the whole generator
  in one file. The output is plain HTML that loads fast and indexes well.
- **Why `public/` is committed:** Vercel runs no build (no package.json), so it
  serves what is in git. `vercel.json` sets `outputDirectory: public`.
- **Why hashed filenames:** images, OG images, CSS and JS carry a content hash,
  so they can be cached for a year without serving stale files after an edit.
- **Why the shortlist uses localStorage:** the journey crosses pages
  (occasion → show → contact); only show slugs are stored, never personal data.
- **Why no form backend:** the owner works through LINE. The contact page
  composes a message the visitor copies into LINE; nothing is transmitted or stored.
- **Grid without orphans:** `show_grid()` in `build.py` picks 2/3/4 columns and
  adds the "ยังไม่แน่ใจ?" help card only when it evens the rows.

- **Why `tools/serve.py`:** on this Windows machine `python -m http.server`
  (HTTP/1.0, Python 3.14) intermittently cut responses off at 65,280 bytes, so
  larger pages lost their stylesheet or script. The HTTP/1.1 server fixes that.
  Vercel is unaffected. `update-site.cmd` and `.claude/launch.json` use it; the
  launcher also had a broken `toolsuild.py` path (a backspace byte), now fixed.
- **Motion is progressive:** `.js [data-reveal]` hides content only when JS has
  run, and `prefers-reduced-motion` turns animation off.

## Known limitations / next steps

- A LINE deep link that pre-fills the message (`line.me/R/oaMessage/<id>/?text`)
  needs the official account's basic ID; with it, the copy step could be removed.
- Some archive photos in `photos/site/` are only 640×480.
- No analytics yet. If added, track: เลือก clicks, contact form completion,
  "คัดลอกและเปิด LINE" clicks, and phone taps.
- A custom domain would replace `velin-magic-site.vercel.app`; update
  `content/site.json` → `url` and rebuild so canonicals and the sitemap follow.
