"""Local-only image manager + preview. No authentication secrets or public upload API."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import base64
import io
import json
import secrets
import shutil
import sys
import threading
import uuid
import webbrowser
from urllib.parse import urlparse, unquote
from PIL import Image, ImageOps
from build import build, ROOT, OUT, PHOTOS

Image.MAX_IMAGE_PIXELS = 25_000_000
LOCK = threading.Lock()
TOKEN = secrets.token_urlsafe(32)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


class MediaServer(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(OUT), **kwargs)

    def local_request(self):
        expected = f'127.0.0.1:{self.server.server_port}'
        return self.headers.get('Host') == expected

    def reply(self, value, status=200):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.local_request():
            return self.send_error(403)
        path = urlparse(self.path).path
        if path == '/__media/':
            html = (ROOT/'tools/media.html').read_text(encoding='utf-8').replace('__TOKEN__', TOKEN)
            body = html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Frame-Options','DENY')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        if path == '/__media/data':
            shows=json.loads((ROOT/'content/shows.json').read_text(encoding='utf-8'))['shows']
            result=[]
            for show in shows:
                files=sorted(p for p in (PHOTOS/'shows'/show['slug']).iterdir() if p.suffix.lower() in ['.jpg','.jpeg','.png','.webp'])
                cover=next((p for p in files if p.stem.lower()=='cover'),files[0])
                def entry(p):
                    return {'src':'/__media/photo/'+show['slug']+'/'+p.name,'alt':show['coverAlt'] if p==cover else show.get('photoAlts',{}).get(p.name,show['th'])}
                result.append({'slug':show['slug'],'name':show['th'],'cover':entry(cover),'gallery':[entry(p) for p in files if p!=cover]})
            return self.reply(result)
        if path.startswith('/__media/photo/'):
            photo_root=(PHOTOS/'shows').resolve()
            file=(photo_root/unquote(path.removeprefix('/__media/photo/'))).resolve()
            if not file.is_relative_to(photo_root) or file.suffix.lower() not in ['.jpg','.jpeg','.png','.webp'] or not file.is_file():
                return self.send_error(404)
            body=file.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type',self.guess_type(str(file)))
            self.send_header('Cache-Control','no-store')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        # Preview only generated public pages and assets. Never expose local source files.
        candidate=(OUT/unquote(path).lstrip('/')).resolve()
        if not candidate.is_relative_to(OUT.resolve()) or '..' in path:
            return self.send_error(404)
        if candidate.is_file() or (candidate.is_dir() and (candidate/'index.html').is_file()):
            return super().do_GET()
        return self.send_error(404)

    def do_POST(self):
        try:
            length=int(self.headers.get('Content-Length','0'))
        except ValueError:
            return self.reply({'error':'ขนาดคำขอไม่ถูกต้อง'},400)
        if not 0 < length <= 18_000_000:
            return self.reply({'error':'ไฟล์ใหญ่เกินไป จำกัดภาพละ 12 MB'},413)
        payload=self.rfile.read(length)
        origin = f'http://127.0.0.1:{self.server.server_port}'
        if not self.local_request() or self.headers.get('Origin') != origin or self.headers.get('X-Media-Token') != TOKEN:
            return self.reply({'error':'คำขอไม่ถูกต้อง กรุณาเปิดหน้าจัดการภาพใหม่'},403)
        if self.path != '/__media/upload':
            return self.send_error(404)
        try:
            data=json.loads(payload)
            if data.get('kind') not in ['cover','gallery']:
                raise ValueError('เลือกตำแหน่งภาพให้ถูกต้อง')
            alt=str(data.get('alt','')).strip()
            if not 3 <= len(alt) <= 250:
                raise ValueError('ใส่คำอธิบายภาพ 3–250 ตัวอักษร')
            raw=base64.b64decode(data['file'],validate=True)
            if len(raw)>12_000_000:
                raise ValueError('ไฟล์ใหญ่เกินไป จำกัดภาพละ 12 MB')
            with LOCK:
                manifest=ROOT/'content/shows.json'
                original=manifest.read_text(encoding='utf-8')
                shows=json.loads(original)
                show=next((s for s in shows['shows'] if s['slug']==data.get('show')),None)
                if not show:
                    raise ValueError('ไม่พบประเภทโชว์')
                image=Image.open(io.BytesIO(raw))
                if image.format not in ['JPEG','PNG','WEBP']:
                    raise ValueError('รองรับเฉพาะ JPG, PNG และ WebP')
                image=ImageOps.exif_transpose(image)
                image.thumbnail((1600,1600))
                image=image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
                encoded=io.BytesIO()
                image.save(encoded,'WEBP',quality=86,method=6)
                filename=uuid.uuid4().hex[:12]+'.webp'
                folder=PHOTOS/'shows'/show['slug']
                folder.mkdir(parents=True,exist_ok=True)
                originals=ROOT/'uploads'/show['slug']
                originals.mkdir(parents=True,exist_ok=True)
                previous_covers=[]
                if data['kind']=='cover':
                    previous_covers=[(p,p.read_bytes()) for p in folder.iterdir() if p.stem.lower()=='cover' and p.suffix.lower() in ['.jpg','.jpeg','.png','.webp']]
                    for p,blob in previous_covers:
                        shutil.copy2(p, originals/(uuid.uuid4().hex[:12]+'-'+p.name))
                        p.unlink()  # Exact cover files only; copies preserved in uploads/.
                    filename='cover.webp'
                output=folder/filename
                output.write_bytes(encoded.getvalue())
                # Store originals locally, outside the deployment, for future edits.
                (originals/(uuid.uuid4().hex[:12]+'.original')).write_bytes(raw)
                entry={'src':'/'+output.relative_to(ROOT).as_posix(),'width':image.width,'height':image.height,'alt':alt,'credit':'ภาพการแสดงที่เพิ่มโดยเจ้าของเว็บไซต์'}
                if data['kind']=='cover':
                    show['coverAlt']=alt
                else:
                    show.setdefault('photoAlts',{})[filename]=alt
                manifest.write_text(json.dumps(shows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
                try:
                    build()
                except Exception:
                    output.unlink(missing_ok=True)
                    for p,blob in previous_covers:
                        p.write_bytes(blob)
                    manifest.write_text(original,encoding='utf-8')
                    build()
                    raise
            self.reply({'ok':True,'image':entry,'preview':'/shows/'+show['slug']+'/'})
        except (ValueError,KeyError,OSError,Image.DecompressionBombError) as exc:
            self.reply({'error':str(exc) if isinstance(exc,ValueError) else 'อ่านภาพไม่ได้ กรุณาใช้ JPG, PNG หรือ WebP ที่สมบูรณ์'},400)
        except Exception:
            self.reply({'error':'สร้างหน้าเว็บไม่สำเร็จ ข้อมูลโชว์เดิมถูกคืนค่าแล้ว'},500)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=4323)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),MediaServer)
    build()
    url=f'http://127.0.0.1:{args.port}/__media/'
    print('Local image manager:',url,flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    server.serve_forever()
