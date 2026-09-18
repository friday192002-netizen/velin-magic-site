"""Check generated SEO, internal links, images and that every show page shows its price."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags=[]
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag,dict(attrs)))


def check():
    files=list(PUBLIC.rglob('*.html'))
    errors=[]
    titles=[]
    for file in files:
        text=file.read_text(encoding='utf-8')
        page=Page(text)
        name=file.relative_to(PUBLIC).as_posix()
        def require(value, message):
            if not value: errors.append(f'{name}: {message}')
        require(len([t for t,a in page.tags if t=='h1'])==1,'one H1 required')
        ids=[a['id'] for t,a in page.tags if 'id' in a]
        require(len(ids)==len(set(ids)),'duplicate IDs')
        if re.fullmatch(r'shows/[a-z-]+/index\.html', name):
            require(bool(re.search(r'฿\s*\d', text)), 'show page without a price')
        require('{{' not in text,'unresolved template token')
        title=re.search(r'<title>(.*?)</title>',text,re.S)
        require(bool(title),'missing title')
        if title: titles.append(title[1])
        require(any(t=='meta' and a.get('name')=='description' and a.get('content') for t,a in page.tags),'missing description')
        require(any(t=='link' and a.get('rel')=='canonical' for t,a in page.tags),'missing canonical')
        for block in re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',text,re.S):
            try: json.loads(block)
            except ValueError: errors.append(name+': invalid structured data')
        for tag,attrs in page.tags:
            if tag=='img' and attrs.get('src'):
                require('alt' in attrs and bool(attrs.get('width')) and bool(attrs.get('height')),'image alt/dimensions missing')
            urls=[]
            if tag in ['a','link']: urls.append(attrs.get('href',''))
            if tag in ['img','script','source']: urls.append(attrs.get('src',''))
            if tag in ['img','source'] and 'srcset' in attrs:
                urls += [part.strip().split(' ')[0] for part in attrs['srcset'].split(',')]
            for url in urls:
                parsed=urlparse(url)
                if not url or parsed.scheme or parsed.netloc: continue
                if not parsed.path:
                    require(not parsed.fragment or unquote(parsed.fragment) in ids,'missing anchor '+url)
                    continue
                target=PUBLIC/unquote(parsed.path.lstrip('/')) if parsed.path.startswith('/') else file.parent/unquote(parsed.path)
                if target.is_dir(): target=target/'index.html'
                require(target.is_file(),'missing local file '+url)
    if len(titles)!=len(set(titles)): errors.append('Duplicate page titles')
    sitemap=ET.parse(PUBLIC/'sitemap.xml')
    locs=[node.text for node in sitemap.findall('.//{*}loc')]
    if len(locs)!=19: errors.append(f'Expected 19 sitemap pages, found {len(locs)}')
    if errors: raise AssertionError('\n'.join(errors))
    print(f'PASS: {len(files)} pages; H1, IDs, titles, descriptions, canonical, JSON-LD, local links, images, sitemap and show prices.')


if __name__=='__main__':
    check()
