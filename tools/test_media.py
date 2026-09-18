"""Exercise image upload against an isolated copy, never the owner's photos."""
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
    project=builder.ROOT
    with TemporaryDirectory(prefix='velin-media-test-') as temp:
        root=Path(temp).resolve()
        assert root.is_relative_to(Path(gettempdir()).resolve())
        for folder in ['content','photos','src']:
            shutil.copytree(project/folder,root/folder)
        builder.ROOT=root
        builder.CONTENT=root/'content'
        builder.PHOTOS=root/'photos'
        builder.SRC=root/'src'
        builder.OUT=root/'public'
        manager.ROOT=root
        manager.PHOTOS=builder.PHOTOS
        manager.OUT=builder.OUT
        builder.build()
        server=ThreadingHTTPServer(('127.0.0.1',0),manager.MediaServer)
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        base=f'http://127.0.0.1:{server.server_port}'
        def upload(data, authorized=True):
            headers={'Content-Type':'application/json','Origin':base}
            if authorized: headers['X-Media-Token']=manager.TOKEN
            request=Request(base+'/__media/upload',data=json.dumps(data).encode(),headers=headers)
            try:
                with urlopen(request) as response: return response.status,json.load(response)
            except HTTPError as response: return response.code,json.load(response)
        try:
            raw=io.BytesIO()
            Image.new('RGB',(120,80),'brown').save(raw,'PNG')
            body={'show':'stage','kind':'gallery','alt':'ภาพทดสอบในสำเนาโปรเจกต์','file':base64.b64encode(raw.getvalue()).decode()}
            assert upload(body,False)[0]==403
            assert upload({**body,'file':'not-an-image'})[0]==400
            assert upload({**body,'show':'../../outside'})[0]==400
            assert upload(body)[0]==200
            manifest=json.loads((root/'content/shows.json').read_text(encoding='utf-8'))
            stage=next(s for s in manifest['shows'] if s['slug']=='stage')
            assert 'ภาพทดสอบในสำเนาโปรเจกต์' in stage['photoAlts'].values()
            assert 'ภาพทดสอบในสำเนาโปรเจกต์' in (root/'public/shows/stage/index.html').read_text(encoding='utf-8')
            old=(root/'photos/shows/stage/cover.webp').read_bytes()
            assert upload({**body,'kind':'cover','alt':'ภาพปกทดสอบในสำเนา'})[0]==200
            assert (root/'photos/shows/stage/cover.webp').read_bytes()!=old
            assert any(p.read_bytes()==old for p in (root/'uploads/stage').glob('*-cover.webp'))
            assert len(json.load(urlopen(base+'/__media/data')))==7
            try: urlopen(base+'/content/site.json')
            except HTTPError as error: assert error.code==404
            else: raise AssertionError('Private content leaked')
            print('PASS: gallery upload, cover replacement, original backup, generated alt text, invalid input rejection, CSRF protection and private-file isolation.')
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__=='__main__':
    test()
