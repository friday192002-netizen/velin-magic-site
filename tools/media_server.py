"""Local-only image and clip manager + preview.

Runs on 127.0.0.1 only. Every change goes through one lock, rebuilds public/
and is rolled back if the build fails. Nothing is deleted outright: removed
photos, replaced covers and clip posters are moved to uploads/ (ignored by
Git). "Publish" commits content/, photos/ and public/ and pushes main, which
Vercel deploys — it only runs when the owner presses the button.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen
import argparse
import base64
import io
import json
import re
import secrets
import shutil
import subprocess
import sys
import threading
import uuid
import webbrowser

from PIL import Image, ImageOps

import build as builder
from build import build, ROOT, OUT, PHOTOS

Image.MAX_IMAGE_PIXELS = 25_000_000
LOCK = threading.Lock()
TOKEN = secrets.token_urlsafe(32)
IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.webp'}
PUBLISH_PATHS = ['content', 'photos', 'public']
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


class UserError(ValueError):
    """A problem the owner can fix; the message is shown as-is."""


# ─────────────────────────────────────────────── undoable changes

class Change:
    """Records every file write and move so a failed build can be undone."""

    def __init__(self):
        self.snapshots = {}
        self.moves = []

    def snapshot(self, path):
        if path not in self.snapshots:
            self.snapshots[path] = path.read_bytes() if path.exists() else None

    def write(self, path, data):
        self.snapshot(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def move(self, src, dst):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        self.moves.append((src, dst))

    def rollback(self):
        for src, dst in reversed(self.moves):
            if dst.exists():
                shutil.move(str(dst), str(src))
        for path, data in self.snapshots.items():
            if data is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(data)


def apply(action):
    """Run one change under the lock, rebuild, and undo it if anything fails."""
    with LOCK:
        change = Change()
        try:
            result = action(change)
            build()
            return result
        except Exception:
            change.rollback()
            build()
            raise


# ─────────────────────────────────────────────── content helpers

def root():
    return ROOT


def shows_path():
    return root() / 'content' / 'shows.json'


def site_path():
    return root() / 'content' / 'site.json'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(change, path, data):
    change.write(path, (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))


def find_show(shows, slug):
    show = next((s for s in shows['shows'] if s['slug'] == slug), None)
    if not show:
        raise UserError('ไม่พบประเภทโชว์')
    return show


def show_folder(slug):
    return PHOTOS / 'shows' / slug


def photo_files(slug):
    folder = show_folder(slug)
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXT) if folder.exists() else []


def cover_file(slug):
    files = photo_files(slug)
    return next((p for p in files if p.stem.lower() == 'cover'), files[0] if files else None)


def gallery_files(show):
    """Gallery in display order: photoOrder first, then anything new by name."""
    cover = cover_file(show['slug'])
    rest = [p for p in photo_files(show['slug']) if p != cover]
    order = {name: i for i, name in enumerate(show.get('photoOrder', []))}
    return sorted(rest, key=lambda p: (order.get(p.name, len(order)), p.name))


def pick_file(show, name, allow_cover=False):
    if not isinstance(name, str) or name != Path(name).name:
        raise UserError('ชื่อไฟล์ไม่ถูกต้อง')
    path = show_folder(show['slug']) / name
    if not path.is_file() or path.suffix.lower() not in IMAGE_EXT:
        raise UserError('ไม่พบภาพนี้แล้ว กรุณารีเฟรชหน้า')
    if not allow_cover and path == cover_file(show['slug']):
        raise UserError('ภาพนี้เป็นภาพปกอยู่ ให้ตั้งภาพอื่นเป็นปกก่อน')
    return path


def check_alt(value):
    alt = str(value or '').strip()
    if not 3 <= len(alt) <= 250:
        raise UserError('ใส่คำอธิบายภาพ 3–250 ตัวอักษร')
    return alt


def archive_dir(slug):
    return root() / 'uploads' / slug


# ─────────────────────────────────────────────── actions

def do_upload(data):
    kind = data.get('kind')
    if kind not in ['cover', 'gallery']:
        raise UserError('เลือกตำแหน่งภาพให้ถูกต้อง')
    alt = check_alt(data.get('alt'))
    try:
        raw = base64.b64decode(data['file'], validate=True)
    except Exception:
        raise UserError('อ่านภาพไม่ได้ กรุณาใช้ JPG, PNG หรือ WebP ที่สมบูรณ์')
    if len(raw) > 12_000_000:
        raise UserError('ไฟล์ใหญ่เกินไป จำกัดภาพละ 12 MB')
    try:
        image = Image.open(io.BytesIO(raw))
        if image.format not in ['JPEG', 'PNG', 'WEBP']:
            raise UserError('รองรับเฉพาะ JPG, PNG และ WebP')
        image = ImageOps.exif_transpose(image)
        image.thumbnail((1600, 1600))
        image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
    except UserError:
        raise
    except Exception:
        raise UserError('อ่านภาพไม่ได้ กรุณาใช้ JPG, PNG หรือ WebP ที่สมบูรณ์')
    encoded = io.BytesIO()
    image.save(encoded, 'WEBP', quality=86, method=6)

    def action(change):
        shows = read_json(shows_path())
        show = find_show(shows, data.get('show'))
        folder = show_folder(show['slug'])
        order = [p.name for p in gallery_files(show)]
        if kind == 'cover':
            old = cover_file(show['slug'])
            if old and old.stem.lower() == 'cover':
                change.move(old, archive_dir(show['slug']) / f'{uuid.uuid4().hex[:12]}-{old.name}')
            name = 'cover.webp'
            show['coverAlt'] = alt
        else:
            name = uuid.uuid4().hex[:12] + '.webp'
            show.setdefault('photoAlts', {})[name] = alt
            order.append(name)
        change.write(folder / name, encoded.getvalue())
        change.write(archive_dir(show['slug']) / f'{uuid.uuid4().hex[:12]}.original', raw)
        show['photoOrder'] = order
        write_json(change, shows_path(), shows)
        return {'file': name}

    return apply(action)


def do_alt(data):
    alt = check_alt(data.get('alt'))

    def action(change):
        shows = read_json(shows_path())
        show = find_show(shows, data.get('show'))
        path = pick_file(show, data.get('file'), allow_cover=True)
        if path == cover_file(show['slug']):
            show['coverAlt'] = alt
        else:
            show.setdefault('photoAlts', {})[path.name] = alt
        write_json(change, shows_path(), shows)

    return apply(action)


def do_cover(data):
    def action(change):
        shows = read_json(shows_path())
        show = find_show(shows, data.get('show'))
        chosen = pick_file(show, data.get('file'))
        old = cover_file(show['slug'])
        alts = show.setdefault('photoAlts', {})
        order = [p.name for p in gallery_files(show)]
        position = order.index(chosen.name)
        # the old cover joins the gallery where the new cover used to be
        demoted = f'c{uuid.uuid4().hex[:10]}{old.suffix.lower()}'
        change.move(old, old.with_name(demoted))
        alts[demoted] = show.get('coverAlt', show['th'])
        new_cover = chosen.with_name('cover' + chosen.suffix.lower())
        change.move(chosen, new_cover)
        show['coverAlt'] = alts.pop(chosen.name, show['th'])
        order[position] = demoted
        show['photoOrder'] = order
        write_json(change, shows_path(), shows)

    return apply(action)


def do_delete(data):
    def action(change):
        shows = read_json(shows_path())
        show = find_show(shows, data.get('show'))
        path = pick_file(show, data.get('file'))
        change.move(path, archive_dir(show['slug']) / f'deleted-{uuid.uuid4().hex[:8]}-{path.name}')
        show.get('photoAlts', {}).pop(path.name, None)
        show['photoOrder'] = [p.name for p in gallery_files(show)]
        write_json(change, shows_path(), shows)

    return apply(action)


def do_order(data):
    def action(change):
        shows = read_json(shows_path())
        show = find_show(shows, data.get('show'))
        wanted = data.get('order')
        current = [p.name for p in gallery_files(show)]
        if not isinstance(wanted, list) or sorted(wanted) != sorted(current):
            raise UserError('ลำดับภาพไม่ตรงกับภาพที่มีอยู่ กรุณารีเฟรชหน้า')
        show['photoOrder'] = wanted
        write_json(change, shows_path(), shows)

    return apply(action)


YOUTUBE_ID = re.compile(r'(?:shorts/|watch\?v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})')


def do_reel_add(data):
    match = YOUTUBE_ID.search(str(data.get('url', '')))
    if not match:
        raise UserError('ลิงก์ YouTube ไม่ถูกต้อง ใช้ลิงก์แบบ youtube.com/shorts/... หรือ youtu.be/...')
    reel_id = match.group(1)
    title = str(data.get('title', '')).strip()
    if not 3 <= len(title) <= 120:
        raise UserError('ใส่ชื่อคลิป 3–120 ตัวอักษร')
    alt = str(data.get('alt', '')).strip() or title
    poster = None
    for variant in ['oardefault', 'hqdefault']:
        try:
            request = Request(f'https://i.ytimg.com/vi/{reel_id}/{variant}.jpg', headers={'User-Agent': 'velin-media'})
            with urlopen(request, timeout=15) as response:
                poster = response.read()
            Image.open(io.BytesIO(poster)).verify()
            break
        except Exception:
            poster = None
    if not poster:
        raise UserError('ดึงภาพปกคลิปจาก YouTube ไม่ได้ ตรวจลิงก์หรืออินเทอร์เน็ตแล้วลองใหม่')

    def action(change):
        site = read_json(site_path())
        shows = read_json(shows_path())
        occasions = read_json(root() / 'content' / 'occasions.json')
        show_slugs = {s['slug'] for s in shows['shows']}
        occ_slugs = {o['slug'] for o in occasions['occasions']}
        chosen_shows = [s for s in data.get('shows', []) if s in show_slugs]
        chosen_occ = [o for o in data.get('occasions', []) if o in occ_slugs]
        items = site.setdefault('reels', {'title': 'คลิปจากงานจริง', 'items': []}).setdefault('items', [])
        if any(r['id'] == reel_id for r in items):
            raise UserError('คลิปนี้มีอยู่แล้ว')
        change.write(PHOTOS / 'site' / f'reel-{reel_id}.jpg', poster)
        items.append({'id': reel_id, 'title': title, 'alt': alt, 'shows': chosen_shows, 'occasions': chosen_occ})
        write_json(change, site_path(), site)
        return {'id': reel_id}

    return apply(action)


def do_reel_update(data):
    def action(change):
        site = read_json(site_path())
        reel = next((r for r in site.get('reels', {}).get('items', []) if r['id'] == data.get('id')), None)
        if not reel:
            raise UserError('ไม่พบคลิปนี้แล้ว กรุณารีเฟรชหน้า')
        title = str(data.get('title', reel['title'])).strip()
        if not 3 <= len(title) <= 120:
            raise UserError('ใส่ชื่อคลิป 3–120 ตัวอักษร')
        reel['title'] = title
        reel['alt'] = str(data.get('alt', reel.get('alt', ''))).strip() or title
        shows = {s['slug'] for s in read_json(shows_path())['shows']}
        occasions = {o['slug'] for o in read_json(root() / 'content' / 'occasions.json')['occasions']}
        if 'shows' in data:
            reel['shows'] = [s for s in data['shows'] if s in shows]
        if 'occasions' in data:
            reel['occasions'] = [o for o in data['occasions'] if o in occasions]
        write_json(change, site_path(), site)

    return apply(action)


def do_reel_delete(data):
    def action(change):
        site = read_json(site_path())
        items = site.get('reels', {}).get('items', [])
        reel = next((r for r in items if r['id'] == data.get('id')), None)
        if not reel:
            raise UserError('ไม่พบคลิปนี้แล้ว กรุณารีเฟรชหน้า')
        items.remove(reel)
        poster = PHOTOS / 'site' / f'reel-{reel["id"]}.jpg'
        if poster.exists():
            change.move(poster, root() / 'uploads' / 'reels' / f'deleted-{poster.name}')
        write_json(change, site_path(), site)

    return apply(action)


# ─────────────────────────────────────────────── publish (owner presses the button)

def git(*args, timeout=120):
    return subprocess.run(['git', *args], cwd=root(), capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=timeout)


def pending_changes():
    result = git('status', '--porcelain', '--', *PUBLISH_PATHS, timeout=30)
    if result.returncode != 0:
        return None
    return [line for line in result.stdout.splitlines() if line.strip()]


def do_publish(_data):
    with LOCK:
        if git('rev-parse', '--is-inside-work-tree', timeout=15).returncode != 0:
            raise UserError('โฟลเดอร์นี้ไม่ได้เชื่อมกับ Git จึงเผยแพร่จากที่นี่ไม่ได้')
        branch = git('rev-parse', '--abbrev-ref', 'HEAD', timeout=15).stdout.strip()
        if branch != 'main':
            raise UserError(f'ตอนนี้อยู่ที่ branch "{branch}" ต้องเป็น main เท่านั้นจึงจะเผยแพร่ได้')
        changes = pending_changes()
        if not changes:
            raise UserError('ยังไม่มีการเปลี่ยนแปลงที่ต้องเผยแพร่')
        check = subprocess.run([sys.executable, str(root() / 'tools' / 'check.py')], cwd=root(),
                               capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
        if check.returncode != 0:
            raise UserError('ตรวจหน้าเว็บไม่ผ่าน จึงยังไม่เผยแพร่:\n' + (check.stdout + check.stderr)[-600:])
        steps = [
            git('add', '--', *PUBLISH_PATHS),
            git('commit', '-m', f'content: update photos and clips from the image manager ({len(changes)} files)'),
            git('push', 'origin', 'main', timeout=180),
        ]
        for step in steps:
            if step.returncode != 0:
                raise UserError('เผยแพร่ไม่สำเร็จ:\n' + (step.stdout + step.stderr)[-600:])
        commit = git('rev-parse', '--short', 'HEAD', timeout=15).stdout.strip()
        return {'files': len(changes), 'commit': commit}


ACTIONS = {
    '/__media/upload': do_upload,
    '/__media/alt': do_alt,
    '/__media/cover': do_cover,
    '/__media/delete': do_delete,
    '/__media/order': do_order,
    '/__media/reel-add': do_reel_add,
    '/__media/reel-update': do_reel_update,
    '/__media/reel-delete': do_reel_delete,
    '/__media/publish': do_publish,
}


# ─────────────────────────────────────────────── data for the page

_prints = {}
_thumbs = {}


def thumbnail(path):
    """Small preview for the manager grid; the site itself is built from the originals."""
    key = (str(path), path.stat().st_mtime_ns)
    if key not in _thumbs:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im).convert('RGB')
            im.thumbnail((520, 520))
            out = io.BytesIO()
            im.save(out, 'WEBP', quality=80)
            _thumbs[key] = out.getvalue()
    return _thumbs[key]


def fingerprint(path):
    """Cached by modification time so the page opens fast after the first load."""
    key = (str(path), path.stat().st_mtime_ns)
    if key not in _prints:
        _prints[key] = builder.fingerprint(path)
    return _prints[key]


def media_data():
    shows = read_json(shows_path())['shows']
    occasions = read_json(root() / 'content' / 'occasions.json')['occasions']
    site = read_json(site_path())
    result = []
    for show in shows:
        cover = cover_file(show['slug'])
        cover_print = fingerprint(cover)
        alts = show.get('photoAlts', {})

        def entry(p, alt):
            return {'file': p.name, 'src': f'/__media/photo/{show["slug"]}/{p.name}?thumb&v={int(p.stat().st_mtime)}', 'alt': alt}

        gallery = []
        for p in gallery_files(show):
            item = entry(p, alts.get(p.name, ''))
            item['duplicate'] = builder.looks_same(fingerprint(p), cover_print)
            gallery.append(item)
        result.append({'slug': show['slug'], 'name': show['th'], 'url': f'/shows/{show["slug"]}/',
                       'cover': entry(cover, show.get('coverAlt', '')), 'gallery': gallery})
    reels = [{**r, 'poster': f'/__media/poster/{r["id"]}'} for r in site.get('reels', {}).get('items', [])]
    changes = pending_changes()
    return {
        'shows': result, 'reels': reels,
        'occasions': [{'slug': o['slug'], 'label': o['label']} for o in occasions],
        'pending': None if changes is None else len(changes),
    }


class MediaServer(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(OUT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def local_request(self):
        return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}'

    def reply(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_bytes(self, body, content_type):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file):
        self.send_bytes(file.read_bytes(), self.guess_type(str(file)))

    def do_GET(self):
        if not self.local_request():
            return self.send_error(403)
        path = urlparse(self.path).path
        if path == '/__media/':
            html = (root() / 'tools/media.html').read_text(encoding='utf-8').replace('__TOKEN__', TOKEN)
            body = html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        if path == '/__media/data':
            return self.reply(media_data())
        if path.startswith('/__media/photo/'):
            photo_root = (PHOTOS / 'shows').resolve()
            file = (photo_root / unquote(path.removeprefix('/__media/photo/'))).resolve()
            if not file.is_relative_to(photo_root) or file.suffix.lower() not in IMAGE_EXT or not file.is_file():
                return self.send_error(404)
            if 'thumb' in urlparse(self.path).query:
                return self.send_bytes(thumbnail(file), 'image/webp')
            return self.send_file(file)
        if path.startswith('/__media/poster/'):
            reel_id = path.removeprefix('/__media/poster/')
            file = PHOTOS / 'site' / f'reel-{reel_id}.jpg'
            if not re.fullmatch(r'[A-Za-z0-9_-]{11}', reel_id) or not file.is_file():
                return self.send_error(404)
            return self.send_file(file)
        # Preview only generated public pages and assets. Never expose local source files.
        candidate = (OUT / unquote(path).lstrip('/')).resolve()
        if not candidate.is_relative_to(OUT.resolve()) or '..' in path:
            return self.send_error(404)
        if candidate.is_file() or (candidate.is_dir() and (candidate / 'index.html').is_file()):
            return super().do_GET()
        return self.send_error(404)

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return self.reply({'error': 'ขนาดคำขอไม่ถูกต้อง'}, 400)
        if not 0 < length <= 18_000_000:
            return self.reply({'error': 'ไฟล์ใหญ่เกินไป จำกัดภาพละ 12 MB'}, 413)
        payload = self.rfile.read(length)
        origin = f'http://127.0.0.1:{self.server.server_port}'
        if not self.local_request() or self.headers.get('Origin') != origin or self.headers.get('X-Media-Token') != TOKEN:
            return self.reply({'error': 'คำขอไม่ถูกต้อง กรุณาเปิดหน้าจัดการภาพใหม่'}, 403)
        action = ACTIONS.get(self.path)
        if not action:
            return self.send_error(404)
        try:
            data = json.loads(payload)
            if not isinstance(data, dict):
                raise UserError('ข้อมูลไม่ถูกต้อง')
            result = action(data) or {}
            self.reply({'ok': True, **result})
        except UserError as exc:
            self.reply({'error': str(exc)}, 400)
        except json.JSONDecodeError:
            self.reply({'error': 'ข้อมูลไม่ถูกต้อง'}, 400)
        except Exception as exc:
            print('media manager error:', repr(exc), flush=True)
            self.reply({'error': 'ทำรายการไม่สำเร็จ ข้อมูลเดิมถูกคืนค่าแล้ว'}, 500)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4323)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), MediaServer)
    build()
    url = f'http://127.0.0.1:{args.port}/__media/'
    # compute fingerprints and thumbnails now, so the first page load is instant
    def warm():
        media_data()
        for p in sorted((PHOTOS / 'shows').rglob('*')):
            if p.suffix.lower() in IMAGE_EXT:
                thumbnail(p)
    threading.Thread(target=warm, daemon=True).start()
    print('Local image manager:', url, flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    server.serve_forever()
