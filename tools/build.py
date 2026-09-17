#!/usr/bin/env python3
"""
Velin Magic — site builder.

    content/  (text, prices, contact)  ┐
    photos/   (original images)        ├──►  public/   (what Vercel serves)
    src/      (templates, css, js)     ┘

Run:   python tools/build.py
Needs: Python 3.9+ and Pillow  (python -m pip install --user Pillow)

Nothing in public/ is edited by hand: every file there is written by this script,
and files this run did not produce are deleted at the end.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    sys.exit("ต้องติดตั้ง Pillow ก่อน:  python -m pip install --user Pillow")

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
PHOTOS = ROOT / "photos"
SRC = ROOT / "src"
OUT = ROOT / "public"

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
WEBP_QUALITY = 80
TODAY = dt.date.today().isoformat()

written: set[Path] = set()


# ─────────────────────────────────────────────────────────────── files

def write(rel: str, data: str | bytes) -> None:
    """Write into public/, touching the disk only when the bytes change."""
    path = OUT / rel
    written.add(path)
    blob = data.encode("utf-8") if isinstance(data, str) else data
    if path.exists() and path.read_bytes() == blob:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(blob)


def short_hash(blob: bytes) -> str:
    return hashlib.sha1(blob).hexdigest()[:8]


def load(name: str):
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


# ─────────────────────────────────────────────────────────────── templates
# {{key}} escaped · {{{key}}} raw HTML · {{> partial}} include
# {{#key}}…{{/key}} shown when truthy · {{^key}}…{{/key}} shown when falsy

SECTION = re.compile(r"\{\{([#^])\s*([\w.]+)\s*\}\}(.*?)\{\{/\s*\2\s*\}\}", re.S)
INCLUDE = re.compile(r"\{\{>\s*([\w-]+)\s*\}\}")
VARIABLE = re.compile(r"\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}")
_templates: dict[str, str] = {}


def template(name: str) -> str:
    if name not in _templates:
        _templates[name] = (SRC / "templates" / f"{name}.html").read_text(encoding="utf-8")
    return _templates[name]


def lookup(ctx: dict, key: str):
    cur = ctx
    for part in key.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def render(tpl: str, ctx: dict) -> str:
    while True:
        out = SECTION.sub(
            lambda m: m.group(3) if bool(lookup(ctx, m.group(2))) == (m.group(1) == "#") else "", tpl)
        if out == tpl:
            break
        tpl = out
    tpl = INCLUDE.sub(lambda m: render(template(m.group(1)), ctx), tpl)

    def var(m):
        raw_key, esc_key = m.group(1), m.group(2)
        value = lookup(ctx, raw_key or esc_key)
        if value is None:
            return ""
        return str(value) if raw_key else html.escape(str(value), quote=True)

    return VARIABLE.sub(var, tpl)  # single pass: inserted values are never re-parsed


def fragment(name: str, ctx: dict, **extra) -> str:
    return render(template(name), {**ctx, **extra})


# ─────────────────────────────────────────────────────────────── images

class Photo:
    """One source image and the responsive WebP files built from it."""

    def __init__(self, source: Path, alt: str, widths=(480, 960, 1600)):
        self.source = source
        self.alt = alt
        blob = source.read_bytes()
        digest = short_hash(blob)
        with Image.open(source) as im:
            im = ImageOps.exif_transpose(im)
            self.width, self.height = im.size
            keep_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
            im = im.convert("RGBA" if keep_alpha else "RGB")

            rel_dir = source.parent.relative_to(PHOTOS).as_posix()
            stem = re.sub(r"[^a-z0-9-]+", "-", source.stem.lower()).strip("-") or "image"
            self.variants: list[tuple[int, str]] = []
            for w in sorted({min(w, self.width) for w in widths}):
                rel = f"img/{rel_dir}/{stem}-{digest}-{w}.webp"
                target = OUT / rel
                written.add(target)
                if not target.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    frame = im if w == self.width else im.resize((w, round(self.height * w / self.width)), Image.LANCZOS)
                    frame.save(target, "WEBP", quality=WEBP_QUALITY, method=5)
                self.variants.append((w, "/" + rel))
        self.digest = digest

    def url(self, target_width: int = 960) -> str:
        fit = [u for w, u in self.variants if w >= target_width]
        return fit[0] if fit else self.variants[-1][1]

    @property
    def largest(self) -> str:
        return self.variants[-1][1]

    def tag(self, sizes: str, cls: str = "", eager: bool = False, alt: str | None = None) -> str:
        srcset = ", ".join(f"{u} {w}w" for w, u in self.variants)
        attrs = [
            f'src="{self.url(960)}"',
            f'srcset="{srcset}"',
            f'sizes="{sizes}"',
            f'width="{self.width}" height="{self.height}"',
            f'alt="{html.escape(alt if alt is not None else self.alt, quote=True)}"',
            'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"',
            'decoding="async"',
        ]
        if cls:
            attrs.insert(0, f'class="{cls}"')
        return "<img " + " ".join(attrs) + ">"

    def og(self, name: str) -> str:
        """1200×630 JPEG for link previews — social platforms still reject WebP."""
        rel = f"og/{name}-{self.digest}.jpg"
        target = OUT / rel
        written.add(target)
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(self.source) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                ImageOps.fit(im, (1200, 630), Image.LANCZOS, centering=(0.5, 0.4)).save(
                    target, "JPEG", quality=84, optimize=True, progressive=True)
        return "/" + rel


def show_photos(slug: str, show_name: str, cover_alt: str) -> tuple[Photo, list[Photo]]:
    folder = PHOTOS / "shows" / slug
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXT) if folder.exists() else []
    if not files:
        sys.exit(f"ไม่พบรูปของโชว์ '{slug}' — วางรูปไว้ที่ photos/shows/{slug}/ (อย่างน้อย cover.jpg)")
    covers = [p for p in files if p.stem.lower() == "cover"]
    cover_file = covers[0] if covers else files[0]
    cover = Photo(cover_file, cover_alt)
    gallery = [
        Photo(p, f"ภาพตัวอย่างการแสดง{show_name} ภาพที่ {i}")
        for i, p in enumerate((p for p in files if p != cover_file), start=1)
    ]
    return cover, gallery


# ─────────────────────────────────────────────────────────────── helpers

def baht(n: int) -> str:
    return "฿" + f"{n:,}"


def fit(text: str, limit: int = 155) -> str:
    """Trim a meta description to what search results show, at a word boundary."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text.rfind(" ", 0, limit - 1)
    return text[: cut if cut > limit * 0.6 else limit - 1].rstrip(" ,") + "…"


def jsonld(*objects) -> str:
    blocks = []
    for obj in objects:
        data = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        blocks.append(f'<script type="application/ld+json">{data}</script>')
    return "".join(blocks)


def breadcrumb(site: dict, trail: list[tuple[str, str]]) -> tuple[str, dict]:
    items = [("หน้าแรก", "/")] + trail
    crumbs = "".join(
        (f'<li><a href="{u}">{html.escape(t)}</a></li>' if i < len(items) - 1
         else f'<li aria-current="page">{html.escape(t)}</li>')
        for i, (t, u) in enumerate(items))
    nav = f'<nav class="crumbs" aria-label="เส้นทาง"><ol>{crumbs}</ol></nav>'
    data = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": t, "item": site["url"] + u}
            for i, (t, u) in enumerate(items)],
    }
    return nav, data


# ─────────────────────────────────────────────────────────────── build

def build() -> None:
    site = load("site.json")
    shows = load("shows.json")["shows"]
    occasions = load("occasions.json")["occasions"]
    faqs = load("faq.json")["faq"]
    base = site["url"].rstrip("/")
    OUT.mkdir(exist_ok=True)

    # ── static assets, fingerprinted so they can be cached for a year
    css = (SRC / "css" / "site.css").read_bytes()
    js = (SRC / "js" / "site.js").read_bytes()
    css_url = f"/assets/site.{short_hash(css)}.css"
    js_url = f"/assets/site.{short_hash(js)}.js"
    write(css_url[1:], css)
    write(js_url[1:], js)
    for f in (SRC / "static").iterdir():
        if f.is_file():
            write(f.name, f.read_bytes())

    # ── photos
    hero = Photo(PHOTOS / "velin" / "hero-cutout.png",
                 "Velin นักมายากลในสูทสีน้ำตาลและหน้ากากครึ่งใบ พร้อมนกพิราบขาวสองตัว",
                 widths=(640, 1000, 1750))
    portrait = Photo(PHOTOS / "velin" / "portrait-card.webp",
                     "ภาพวาด Velin บนไพ่แจ็กโพดำ", widths=(480, 1005))
    film_poster = Photo(PHOTOS / "site" / "opening.webp", "นักมายากลบนเวทีและผู้ชมในงาน", widths=(640, 1200))

    occ_by_slug = {o["slug"]: o for o in occasions}
    for i, s in enumerate(shows, start=1):
        s["num"] = f"{i:02d}"
        s["url"] = f"/shows/{s['slug']}/"
        s["priceText"] = baht(s["price"])
        s["tags"] = " ".join(s["occasions"])
        s["performedLabel"] = "แสดงโดย Velin" if s["performedBy"] == "velin" else "Velin ร่วมกับทีมผู้เชี่ยวชาญ"
        s["cover"], s["gallery"] = show_photos(s["slug"], s["th"], s["coverAlt"])
        unknown = [o for o in s["occasions"] if o not in occ_by_slug]
        if unknown:
            sys.exit(f"shows.json: โชว์ '{s['slug']}' อ้างถึงประเภทงานที่ไม่มีใน occasions.json: {unknown}")

    for o in occasions:
        o["url"] = f"/occasions/{o['slug']}/"
        o["shows"] = [s for s in shows if o["slug"] in s["occasions"]]
        o["count"] = len(o["shows"])
        cover_show = next((s for s in shows if s["slug"] == o.get("coverShow")), None) or (o["shows"] or shows)[0]
        o["cover"] = cover_show["cover"]

    min_price = min(s["price"] for s in shows)

    # data the browser needs for the shortlist (prices live in one place: content/)
    show_data = json.dumps(
        [{"slug": s["slug"], "th": s["th"], "en": s["en"], "price": s["price"],
          "from": s["priceFrom"], "url": s["url"], "thumb": s["cover"].url(480)} for s in shows],
        ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    organization = {
        "@context": "https://schema.org", "@type": "EntertainmentBusiness",
        "@id": base + "/#business", "name": site["name"], "url": base + "/",
        "description": site["description"], "telephone": site["contact"]["telephone"],
        "areaServed": {"@type": "Country", "name": site["areaServed"]},
        "priceRange": f"{baht(min_price)}+", "image": base + shows[0]["cover"].og("home"),
        "sameAs": list(site["social"].values()),
    }

    common = {
        "site": site, "cssUrl": css_url, "jsUrl": js_url, "showData": show_data, "year": dt.date.today().year,
        "navOccasions": "".join(f'<li><a href="{o["url"]}">{html.escape(o["label"])}</a></li>' for o in occasions),
        "footerShows": "".join(f'<li><a href="{s["url"]}">{html.escape(s["th"])}</a></li>' for s in shows),
        "footerOccasions": "".join(f'<li><a href="{o["url"]}">{html.escape(o["label"])}</a></li>' for o in occasions),
        "minPrice": baht(min_price), "showCount": len(shows),
    }

    sitemap: list[str] = []

    def card(s: dict, heading: str = "h3") -> str:
        return fragment("show-card", common, show={**s, "coverImg": s["cover"].tag(
            "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 380px", cls="card-img")}, heading=heading)

    def cards(items: list[dict], heading: str = "h3") -> str:
        return "".join(card(s, heading) for s in items)

    def show_grid(items: list[dict], heading: str = "h3", attrs: str = "") -> str:
        """Pick the column count that leaves no orphan card, adding the
        'not sure yet?' card when one extra tile is what evens the rows."""
        n = len(items)
        cols, help_card = 3, False
        for c, extra in ((4, False), (3, False), (4, True), (3, True), (2, False), (2, True)):
            if (n + extra) % c == 0 and (n + extra) >= c:
                cols, help_card = c, extra
                break
        inner = cards(items, heading) + (fragment("help-card", common) if help_card else "")
        return f'<div class="card-grid card-grid-{cols}"{attrs}>{inner}</div>'

    def chips(active: str = "all") -> str:
        out = [f'<button type="button" class="chip" data-filter="all" aria-pressed="{str(active == "all").lower()}">ทั้งหมด</button>']
        out += [f'<button type="button" class="chip" data-filter="{o["slug"]}" aria-pressed="false">{html.escape(o["label"])}</button>'
                for o in occasions]
        return "".join(out)

    def faq_html(items: list[dict]) -> str:
        return "".join(
            f'<details class="faq-item"><summary><span>{html.escape(f["q"])}</span><span class="faq-icon" aria-hidden="true"></span></summary>'
            f'<div class="faq-answer"><p>{html.escape(f["a"])}</p></div></details>' for f in items)

    def faq_ld(items: list[dict]) -> dict:
        return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in items]}

    process_html = "".join(
        f'<li class="step"><span class="step-n">{i:02d}</span><h3>{html.escape(p["title"])}</h3><p>{html.escape(p["text"])}</p></li>'
        for i, p in enumerate(site["process"], start=1))
    stats_html = "".join(
        f'<div class="stat"><dt>{html.escape(x["label"])}</dt><dd>{html.escape(x["value"])}</dd></div>' for x in site["stats"])
    common.update(processHtml=process_html, statsHtml=stats_html,
                  performerParagraphs="".join(f"<p>{html.escape(p)}</p>" for p in site["performer"]["paragraphs"]),
                  portraitImg=portrait.tag("(max-width: 800px) 70vw, 420px", cls="portrait-img"))

    def page(path: str, title: str, description: str, body: str, *, og_image: str,
             ld: list | None = None, body_class: str = "", mobile_bar: str = "default",
             index: bool = True, full_title: bool = False) -> None:
        canonical = base + path
        ctx = {
            **common,
            "page": {
                "title": title if full_title else f"{title} | {site['name']}",
                "description": description, "canonical": canonical,
                "ogImage": base + og_image, "bodyClass": body_class,
                "robots": "index,follow,max-image-preview:large" if index else "noindex,follow",
                "jsonld": jsonld(*(ld or [])),
            },
            "content": body,
            "mobileBarDefault": mobile_bar == "default",
        }
        rel = "index.html" if path == "/" else path.strip("/") + "/index.html"
        if path == "/404.html":
            rel = "404.html"
        write(rel, render(template("layout"), ctx))
        if index:
            sitemap.append(canonical)

    # ── home
    home_occ = "".join(fragment("occasion-tile", common, occ={
        **o, "img": o["cover"].tag("(max-width: 640px) 46vw, 240px", cls="tile-img")}) for o in occasions)
    home = fragment("page-home", common,
                    heroImg=hero.tag("(max-width: 720px) 130vw, (max-width: 1100px) 70vw, 58vw", cls="hero-portrait", eager=True),
                    heroPreload=hero.url(1000),
                    occasionTiles=home_occ, showGrid=show_grid(shows),
                    faqHtml=faq_html([f for f in faqs if f.get("home")]),
                    filmPoster=film_poster.tag("(max-width: 900px) 92vw, 560px", cls="film-img"))
    page("/", f"{site['name']} — รับแสดงมายากล งานบริษัท งานเปิดตัว งานแต่ง และงานเด็ก",
         fit(site["description"]), home, og_image=shows[0]["cover"].og("home"),
         ld=[organization, {"@context": "https://schema.org", "@type": "WebSite", "name": site["name"], "url": base + "/"},
             faq_ld([f for f in faqs if f.get("home")])],
         body_class="has-dark-hero", full_title=True)

    # ── catalogue (the 171 Magic Club structure)
    crumbs, crumbs_ld = breadcrumb(site, [("รูปแบบการแสดง", "/shows/")])
    price_rows = "".join(fragment("price-row", common, show=s) for s in shows)
    catalogue = fragment("page-shows", common, crumbs=crumbs, chips=chips(), showGrid=show_grid(shows, "h2", " data-filter-grid"),
                         priceRows=price_rows)
    item_list = {"@context": "https://schema.org", "@type": "ItemList", "name": "รูปแบบการแสดงมายากล",
                 "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": base + s["url"], "name": s["th"]}
                                     for i, s in enumerate(shows)]}
    page("/shows/", f"รูปแบบการแสดงมายากล {len(shows)} แบบ พร้อมราคา",
         f"เปรียบเทียบการแสดงมายากล {len(shows)} รูปแบบ ตั้งแต่มายากลโคลสอัพ มายากลเวที บับเบิ้ลโชว์ ไปจนถึงอิลลูชัน ราคาเริ่มต้น {baht(min_price)} เลือกตามประเภทงานได้ทันที",
         catalogue, og_image=shows[2]["cover"].og("shows"), ld=[item_list, crumbs_ld])

    # ── one page per show
    for s in shows:
        crumbs, crumbs_ld = breadcrumb(site, [("รูปแบบการแสดง", "/shows/"), (s["th"], s["url"])])
        related = sorted((x for x in shows if x is not s),
                         key=lambda x: -len(set(x["occasions"]) & set(s["occasions"])))[:3]
        gallery = "".join(
            f'<a class="gallery-item" href="{p.largest}" data-lightbox="{s["slug"]}" data-caption="{html.escape(p.alt, quote=True)}">'
            f'{p.tag("(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 300px", alt=p.alt)}</a>'
            for p in [s["cover"], *s["gallery"]])
        body = fragment("page-show", common, crumbs=crumbs, show={
            **s,
            "coverImg": s["cover"].tag("(max-width: 900px) 100vw, 640px", cls="show-hero-img", eager=True),
            "bodyHtml": "".join(f"<p>{html.escape(t)}</p>" for t in s["body"]),
            "fitsHtml": "".join(f"<li>{html.escape(t)}</li>" for t in s["fits"]),
            "occasionLinks": "".join(f'<li><a href="{occ_by_slug[o]["url"]}">{html.escape(occ_by_slug[o]["label"])}</a></li>'
                                     for o in s["occasions"]),
            "prepareHtml": "".join(f"<li>{html.escape(t)}</li>" for t in s["prepare"]),
            "galleryHtml": gallery, "photoCount": len(s["gallery"]) + 1,
            "isVelin": s["performedBy"] == "velin",
        }, quoteIncludes="".join(f"<li>{html.escape(t)}</li>" for t in site["quoteIncludes"]),
            relatedGrid=show_grid(related))
        price_spec = {"@type": "PriceSpecification", "priceCurrency": "THB",
                      **({"minPrice": s["price"]} if s["priceFrom"] else {"price": s["price"]})}
        service = {
            "@context": "https://schema.org", "@type": "Service",
            "name": f'{s["th"]} ({s["en"].title()})', "serviceType": "การแสดงมายากล",
            "description": " ".join([s["tagline"], *s["body"]]),
            "image": base + s["cover"].og(s["slug"]), "url": base + s["url"],
            "provider": {"@id": base + "/#business"}, "areaServed": {"@type": "Country", "name": site["areaServed"]},
            "offers": {"@type": "Offer", "priceCurrency": "THB", "price": s["price"], "priceSpecification": price_spec,
                       "url": base + s["url"]},
        }
        price_label = "ราคาเริ่มต้น" if s["priceFrom"] else "ราคา"
        page(s["url"], f'{s["th"]} ({s["en"].title()}) {price_label} {s["priceText"]}',
             fit(f'{s["th"]} {price_label} {s["priceText"]} — {s["tagline"]} {s["body"][0]}'),
             body, og_image=s["cover"].og(s["slug"]), ld=[service, crumbs_ld, organization], mobile_bar="show")

    # ── one page per occasion
    for o in occasions:
        crumbs, crumbs_ld = breadcrumb(site, [("เลือกตามประเภทงาน", "/shows/"), (o["label"], o["url"])])
        others = "".join(f'<li><a href="{x["url"]}">{html.escape(x["label"])}</a></li>' for x in occasions if x is not o)
        body = fragment("page-occasion", common, crumbs=crumbs, occ={
            **o, "coverImg": o["cover"].tag("(max-width: 900px) 100vw, 560px", cls="occ-hero-img", eager=True),
            "pointsHtml": "".join(f'<li><h3>{html.escape(p["title"])}</h3><p>{html.escape(p["text"])}</p></li>' for p in o["points"]),
            "showGrid": show_grid(o["shows"]), "otherLinks": others,
            "fromPrice": baht(min(s["price"] for s in o["shows"])),
        }, faqHtml=faq_html([f for f in faqs if f.get("home")][:3]))
        page(o["url"], o["seoTitle"], fit(o["seoDescription"]), body, og_image=o["cover"].og("occasion-" + o["slug"]),
             ld=[crumbs_ld, {"@context": "https://schema.org", "@type": "ItemList", "name": o["seoTitle"],
                             "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": base + s["url"], "name": s["th"]}
                                                 for i, s in enumerate(o["shows"])]}])

    # ── about
    crumbs, crumbs_ld = breadcrumb(site, [("เกี่ยวกับ Velin", "/about/")])
    person = {"@context": "https://schema.org", "@type": "Person", "name": site["performer"]["name"],
              "jobTitle": "Magician", "worksFor": {"@id": base + "/#business"},
              "image": base + portrait.og("velin"), "sameAs": [site["social"]["tiktok"]]}
    velin_shows = [s for s in shows if s["performedBy"] == "velin"]
    page("/about/", "เกี่ยวกับ Velin นักมายากล", "รู้จัก Velin นักมายากลผู้เชื่อว่ามายากลที่ดีอยู่ในความรู้สึกหลังกลจบลง พร้อมรูปแบบการแสดงที่ Velin แสดงด้วยตัวเอง",
         fragment("page-about", common, crumbs=crumbs, velinGrid=show_grid(velin_shows)),
         og_image=portrait.og("velin"), ld=[person, crumbs_ld])

    # ── gallery
    crumbs, crumbs_ld = breadcrumb(site, [("ภาพการแสดง", "/gallery/")])
    groups = "".join(
        f'<section class="gallery-group" data-group="{s["slug"]}" aria-labelledby="g-{s["slug"]}">'
        f'<div class="gallery-head"><h2 id="g-{s["slug"]}">{html.escape(s["th"])}</h2>'
        f'<a class="link-arrow" href="{s["url"]}">ดูรายละเอียดและราคา</a></div><div class="gallery-grid">'
        + "".join(f'<a class="gallery-item" href="{p.largest}" data-lightbox="all" data-caption="{html.escape(p.alt, quote=True)}">'
                  f'{p.tag("(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 280px")}</a>' for p in [s["cover"], *s["gallery"]])
        + "</div></section>" for s in shows)
    gallery_chips = '<button type="button" class="chip" data-gallery-filter="all" aria-pressed="true">ทั้งหมด</button>' + "".join(
        f'<button type="button" class="chip" data-gallery-filter="{s["slug"]}" aria-pressed="false">{html.escape(s["th"])}</button>' for s in shows)
    total_photos = sum(len(s["gallery"]) + 1 for s in shows)
    page("/gallery/", "ภาพการแสดงมายากล", f"รวม {total_photos} ภาพตัวอย่างการแสดงมายากล บับเบิ้ลโชว์ จั๊กกลิ้ง และอิลลูชัน แยกตามรูปแบบการแสดง",
         fragment("page-gallery", common, crumbs=crumbs, groups=groups, galleryChips=gallery_chips, totalPhotos=total_photos),
         og_image=shows[6]["cover"].og("gallery"), ld=[crumbs_ld])

    # ── faq
    crumbs, crumbs_ld = breadcrumb(site, [("คำถามที่พบบ่อย", "/faq/")])
    page("/faq/", "คำถามที่พบบ่อยเรื่องการจ้างนักมายากล", "ราคา ค่าเดินทาง การเลือกหลายโชว์ และขั้นตอนการจองการแสดงมายากลกับ Velin Magic",
         fragment("page-faq", common, crumbs=crumbs, faqHtml=faq_html(faqs)),
         og_image=shows[1]["cover"].og("faq"), ld=[faq_ld(faqs), crumbs_ld])

    # ── contact
    crumbs, crumbs_ld = breadcrumb(site, [("ขอใบเสนอราคา", "/contact/")])
    occ_options = "".join(f'<option value="{html.escape(o["label"])}">{html.escape(o["label"])}</option>' for o in occasions)
    page("/contact/", "ขอใบเสนอราคาการแสดงมายากล", f"ส่งรายละเอียดงานและโชว์ที่สนใจทาง LINE หรือโทร {site['contact']['phone']} เพื่อรับใบเสนอราคาการแสดงมายากล",
         fragment("page-contact", common, crumbs=crumbs, occasionOptions=occ_options),
         og_image=shows[0]["cover"].og("contact"), ld=[crumbs_ld], mobile_bar="contact")

    # ── privacy, 404
    crumbs, crumbs_ld = breadcrumb(site, [("ความเป็นส่วนตัว", "/privacy/")])
    page("/privacy/", "การใช้ข้อมูลและความเป็นส่วนตัว",
         "วิธีที่เว็บไซต์ Velin Magic ใช้ข้อมูลในแบบฟอร์มขอใบเสนอราคา รายการโชว์ที่เลือก และบริการภายนอกอย่าง Google Fonts และ YouTube",
         fragment("page-privacy", common, crumbs=crumbs), og_image=shows[0]["cover"].og("home"), ld=[crumbs_ld])
    page("/404.html", "ไม่พบหน้านี้", "หน้าที่คุณหาอาจถูกย้ายไปแล้ว", fragment("page-404", common, showGrid=show_grid(shows[:3])),
         og_image=shows[0]["cover"].og("home"), index=False)

    # ── sitemap, robots
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "".join(f"  <url><loc>{u}</loc><lastmod>{TODAY}</lastmod></url>\n" for u in sitemap) + "</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {base}/sitemap.xml\n")

    # ── remove anything this run did not produce (old photos, old hashed assets)
    removed = 0
    for path in sorted(OUT.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if path.is_file() and path not in written:
            path.unlink()
            removed += 1
        elif path.is_dir() and not any(path.iterdir()):
            path.rmdir()

    photos = sum(1 for p in written if "/img/" in p.as_posix())
    print(f"✓ สร้างเว็บเสร็จ: {len(sitemap)} หน้า · {len(shows)} โชว์ · {photos} ไฟล์ภาพ · ลบไฟล์เก่า {removed} ไฟล์")
    print(f"  ผลลัพธ์อยู่ที่ {OUT.relative_to(ROOT)}/")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    build()
