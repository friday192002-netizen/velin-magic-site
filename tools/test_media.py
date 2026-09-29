"""Exercise the image manager against an isolated copy, never the owner's photos."""
from pathlib import Path
from tempfile import TemporaryDirectory, gettempdir
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import base64
import io
import json
import shutil
import threading
from PIL import Image
import build as builder
import media_server as manager


def test():
    project = builder.ROOT
    with TemporaryDirectory(prefix='velin-media-test-') as temp:
        root = Path(temp).resolve()
        assert root.is_relative_to(Path(gettempdir()).resolve())
        for folder in ['content', 'photos', 'src']:
            shutil.copytree(project / folder, root / folder)
        builder.ROOT = root
        builder.CONTENT = root / 'content'
        builder.PHOTOS = root / 'photos'
        builder.SRC = root / 'src'
        builder.OUT = root / 'public'
        manager.ROOT = root
        manager.PHOTOS = builder.PHOTOS
        manager.OUT = builder.OUT
        builder.build()
        server = ThreadingHTTPServer(('127.0.0.1', 0), manager.MediaServer)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'

        def call(path, data, authorized=True):
            headers = {'Content-Type': 'application/json', 'Origin': base}
            if authorized:
                headers['X-Media-Token'] = manager.TOKEN
            request = Request(base + '/__media/' + path, data=json.dumps(data).encode(), headers=headers)
            try:
                with urlopen(request) as response:
                    return response.status, json.load(response)
            except HTTPError as response:
                return response.code, json.load(response)

        def stage():
            manifest = json.loads((root / 'content/shows.json').read_text(encoding='utf-8'))
            return next(s for s in manifest['shows'] if s['slug'] == 'stage')

        def page():
            return (root / 'public/shows/stage/index.html').read_text(encoding='utf-8')

        def data():
            return json.load(urlopen(base + '/__media/data'))

        try:
            raw = io.BytesIO()
            Image.new('RGB', (120, 80), 'brown').save(raw, 'PNG')
            body = {'show': 'stage', 'kind': 'gallery', 'alt': 'ภาพทดสอบในสำเนาโปรเจกต์',
                    'file': base64.b64encode(raw.getvalue()).decode()}

            # security and validation
            assert call('upload', body, False)[0] == 403
            assert call('upload', {**body, 'file': 'not-an-image'})[0] == 400
            assert call('upload', {**body, 'show': '../../outside'})[0] == 400
            assert call('delete', {'show': 'stage', 'file': '../../content/site.json'})[0] == 400

            # upload joins the end of the gallery
            status, result = call('upload', body)
            assert status == 200, result
            uploaded = result['file']
            assert stage()['photoAlts'][uploaded] == 'ภาพทดสอบในสำเนาโปรเจกต์'
            assert stage()['photoOrder'][-1] == uploaded
            assert 'ภาพทดสอบในสำเนาโปรเจกต์' in page()

            # edit a description
            assert call('alt', {'show': 'stage', 'file': uploaded, 'alt': 'คำอธิบายที่แก้แล้ว'})[0] == 200
            assert 'คำอธิบายที่แก้แล้ว' in page()
            assert call('alt', {'show': 'stage', 'file': uploaded, 'alt': 'x'})[0] == 400

            # reorder: move the upload to the front
            order = stage()['photoOrder']
            new_order = [uploaded] + [f for f in order if f != uploaded]
            assert call('order', {'show': 'stage', 'order': new_order})[0] == 200
            assert data()['shows'][2]['gallery'][0]['file'] == uploaded
            assert call('order', {'show': 'stage', 'order': new_order[:-1]})[0] == 400

            # set as cover: the old cover moves into the gallery, keeping its description
            old_cover = (root / 'photos/shows/stage/cover.webp').read_bytes()
            old_alt = stage()['coverAlt']
            assert call('cover', {'show': 'stage', 'file': uploaded})[0] == 200
            assert stage()['coverAlt'] == 'คำอธิบายที่แก้แล้ว'
            demoted = stage()['photoOrder'][0]
            assert (root / 'photos/shows/stage' / demoted).read_bytes() == old_cover
            assert stage()['photoAlts'][demoted] == old_alt
            assert call('delete', {'show': 'stage', 'file': 'cover.webp'})[0] == 400

            # delete moves to uploads/, never removes
            assert call('delete', {'show': 'stage', 'file': demoted})[0] == 200
            assert not (root / 'photos/shows/stage' / demoted).exists()
            assert any(p.read_bytes() == old_cover for p in (root / 'uploads/stage').glob('deleted-*'))
            assert demoted not in stage()['photoOrder']

            # replacing the cover by upload keeps the old one in uploads/
            before = (root / 'photos/shows/stage/cover.webp').read_bytes()
            other = io.BytesIO()
            Image.new('RGB', (120, 80), 'navy').save(other, 'PNG')
            cover_body = {**body, 'kind': 'cover', 'alt': 'ภาพปกทดสอบในสำเนา',
                          'file': base64.b64encode(other.getvalue()).decode()}
            assert call('upload', cover_body)[0] == 200
            assert (root / 'photos/shows/stage/cover.webp').read_bytes() != before
            assert any(p.read_bytes() == before for p in (root / 'uploads/stage').glob('*-cover.webp'))

            # clips: validation, edit, delete (adding needs YouTube, so only the rejection is tested)
            assert call('reel-add', {'url': 'https://example.com/video', 'title': 'ทดสอบ'})[0] == 400
            reel = data()['reels'][0]
            assert call('reel-update', {'id': reel['id'], 'title': 'ชื่อคลิปที่แก้แล้ว', 'shows': ['bubble']})[0] == 200
            assert 'ชื่อคลิปที่แก้แล้ว' in (root / 'public/shows/bubble/index.html').read_text(encoding='utf-8')
            assert call('reel-delete', {'id': reel['id']})[0] == 200
            assert all(r['id'] != reel['id'] for r in data()['reels'])
            assert (root / 'uploads/reels' / f'deleted-reel-{reel["id"]}.jpg').exists()

            # publishing refuses outside a Git checkout (this copy has none)
            status, result = call('publish', {})
            assert status == 400 and 'Git' in result['error'], result

            # nothing private is served
            assert len(data()['shows']) == 7
            for leaked in ['/content/site.json', '/tools/media_server.py', '/photos/shows/stage/cover.webp']:
                try:
                    urlopen(base + leaked)
                except HTTPError as error:
                    assert error.code == 404
                else:
                    raise AssertionError('Private file served: ' + leaked)
            print('PASS: upload, description edit, reorder, set cover, delete-to-archive, cover backup, '
                  'clip edit/delete, publish guard, input validation, CSRF protection and private-file isolation.')
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    test()
