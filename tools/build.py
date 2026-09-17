"""Build crawlable static pages from content/ and templates/. Standard library only."""
from pathlib import Path
from html import escape
import json
import re
from datetime import date

ROOT = Path(__file__).resolve().parents[1]


def build():
    site = json.loads((ROOT / 'content/site.json').read_text(encoding='utf-8'))
    shows = json.loads((ROOT / 'content/shows.json').read_text(encoding='utf-8'))
    base = site['url'].rstrip('/')
    e = lambda value: escape(str(value), quote=True)
    pages = []

    def template(name):
        return (ROOT / f'templates/{name}.html').read_text(encoding='utf-8')

    def photo(p, eager=False, css=''):
        return f'<img class="{css}" src="{e(p["src"])}" width="{p["width"]}" height="{p["height"]}" alt="{e(p["alt"])}" loading="{"eager" if eager else "lazy"}" decoding="async"{chr(32)+"fetchpriority=\"high\"" if eager else ""}>'

    def cta(text='คุยเรื่องงานของคุณ', selected=''):
        return f'<a class="button button--dark" href="/contact/{"?shows="+e(selected) if selected else ""}">{text}<span aria-hidden="true">↗</span></a>'

    def card(s, select=False):
        url = '/shows/' + s['slug'] + '/'
        selection = f'<label class="select-show"><input type="checkbox" name="shortlist" value="{s["slug"]}" data-name="{e(s["name"])}"> เพิ่มในรายการที่สนใจ</label>' if select else ''
        return f'''<article class="catalog-card" data-tags="{' '.join(s['tags'])}" data-slug="{s['slug']}">
          <a class="card-photo" href="{url}" aria-label="ดูรายละเอียด {e(s['name'])}">{photo(s['cover'])}<span class="photo-arrow" aria-hidden="true">↗</span></a>
          <div class="card-copy"><p class="eyebrow">{e(s['english'])}</p><h3><a href="{url}">{e(s['name'])}</a></h3><p>{e(s['tagline'])}</p>
          <a class="card-details" href="{url}">ดูรูปแบบและรายละเอียด <span aria-hidden="true">→</span></a>{selection}</div></article>'''

    def steps():
        return '''<div class="journey"><div><span>01</span><h3>เลือกความรู้สึกที่อยากสร้าง</h3><p>ดูโชว์ตามประเภทงาน หรือให้เราช่วยแนะนำ</p></div><div><span>02</span><h3>เล่ารายละเอียดให้ฟัง</h3><p>วันงาน สถานที่ และจำนวนผู้ชมโดยประมาณ</p></div><div><span>03</span><h3>ออกแบบแล้วค่อยยืนยัน</h3><p>คุยรูปแบบ ทีม และใบเสนอราคาก่อนจอง</p></div></div>'''

    def invite():
        return f'''<section class="invitation section"><p class="eyebrow">LET’S MAKE IT YOURS</p><h2>ยังไม่แน่ใจว่าโชว์ไหน<br><em>เหมาะกับงานของคุณ?</em></h2><p>เริ่มจากบรรยากาศที่คุณอยากให้เกิดขึ้น แล้วเราจะช่วยเลือกรูปแบบให้</p>{cta('ให้เราช่วยแนะนำ')}<a class="quiet-link" href="tel:{site['telephone']}">หรือโทร {site['phone']}</a></section>'''

    def faq(items):
        return '<div class="questions">'+''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q,a in items)+'</div>'

    def render(path, title, description, content, section='', image='/assets/velin-hero.png', schema=None, noindex=False):
        url = base + path
        home = path == '/'
        nav = ''.join(f'<a href="{href}"'+(' aria-current="page"' if section==key else '')+f'>{label}</a>' for href,label,key in [('/shows/','รูปแบบโชว์','shows'),('/about/','รู้จัก Velin','about'),('/gallery/','ภาพการแสดง','gallery')])
        structured = [{'@context':'https://schema.org','@type':'WebPage','name':title,'description':description,'url':url,'inLanguage':'th','isPartOf':{'@id':base+'/#website'}}]
        if home:
            structured += [{'@context':'https://schema.org','@type':'WebSite','@id':base+'/#website','url':base+'/','name':'Velin Magic','inLanguage':'th'}, {'@context':'https://schema.org','@type':'Organization','@id':base+'/#organization','name':'Velin Magic','url':base+'/','telephone':site['phone'],'sameAs':[site['instagram'],site['facebook'],site['tiktok']]}]
        else:
            crumbs=[{'@type':'ListItem','position':1,'name':'หน้าหลัก','item':base+'/'}]
            if path.startswith('/shows/') and path != '/shows/':
                crumbs.append({'@type':'ListItem','position':2,'name':'รูปแบบโชว์','item':base+'/shows/'})
            crumbs.append({'@type':'ListItem','position':len(crumbs)+1,'name':title.split(' | ')[0],'item':url})
            structured.append({'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':crumbs})
        if schema:
            structured.append(schema)
        footer_links=''.join(f'<a href="/shows/{s["slug"]}/">{e(s["name"])}</a>' for s in shows)
        html=f'''<!doctype html>
<html lang="th"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#211b17"><title>{e(title)}</title><meta name="description" content="{e(description)}">
<meta name="robots" content="{'noindex,follow' if noindex else 'index,follow,max-image-preview:large'}"><link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:locale" content="th_TH"><meta property="og:site_name" content="Velin Magic"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{base+image}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&amp;family=IBM+Plex+Sans+Thai:wght@300;400;500;600&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css"><link rel="stylesheet" href="/assets/css/pages.css"><script src="/assets/js/site.js" defer></script><script src="/assets/js/catalog.js" defer></script>
<script type="application/ld+json">{json.dumps(structured,ensure_ascii=False).replace('<', chr(92)+'u003c')}</script>
</head><body class="{'home-page' if home else 'inner-page'}" id="top">
<a class="skip" href="#main">ข้ามไปยังเนื้อหา</a>
<header class="header" id="header"><a class="brand" href="/" aria-label="Velin — หน้าหลัก">velin<span class="brand-star" aria-hidden="true">✳</span></a><nav class="nav" id="navigation" aria-label="เมนูหลัก">{nav}<a class="nav-book" href="/contact/" {'aria-current="page"' if section=='contact' else ''}>คุยเรื่องงานของคุณ <span aria-hidden="true">↗</span></a></nav><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="navigation"><span>เมนู</span><span class="menu-lines" aria-hidden="true"></span></button></header>
<main id="main">{content}</main>
<footer class="footer"><div class="footer-top"><a class="brand" href="/">velin<span class="brand-star" aria-hidden="true">✳</span></a><p>Make room for <em>wonder.</em></p><a class="back-top" href="#top" aria-label="กลับด้านบน">↑</a></div><div class="footer-sitemap"><div><p class="eyebrow">EXPLORE THE MAGIC</p><nav aria-label="รูปแบบการแสดง">{footer_links}</nav></div><div><p class="eyebrow">START A CONVERSATION</p><a href="tel:{site['telephone']}">{site['phone']}</a><a href="{site['line']}" target="_blank" rel="noopener noreferrer">LINE {site['lineName']} ↗</a><a href="/contact/">สอบถามวันว่างและรายละเอียดงาน →</a></div></div><div class="footer-bottom"><span>© <span id="year">{date.today().year}</span> VELIN MAGIC</span><nav aria-label="โซเชียลมีเดีย"><a href="{site['instagram']}" target="_blank" rel="noopener noreferrer">INSTAGRAM ↗</a><a href="{site['facebook']}" target="_blank" rel="noopener noreferrer">FACEBOOK ↗</a><a href="{site['tiktok']}" target="_blank" rel="noopener noreferrer">TIKTOK ↗</a></nav><a href="/privacy/">ความเป็นส่วนตัว</a></div></footer>
<dialog id="media-dialog" class="media-dialog" aria-labelledby="media-title"><div class="media-shell"><button class="dialog-close" type="button" aria-label="ปิดหน้าต่าง" autofocus>×</button><h2 id="media-title">ภาพการแสดง</h2><div id="media-content"></div><p id="media-caption"></p></div></dialog>
</body></html>'''
        dest=ROOT/('index.html' if home else path.strip('/')+'/index.html')
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(html,encoding='utf-8')
        if not noindex: pages.append(path)

    def intro(eyebrow,title,description):
        return f'<section class="page-intro section"><p class="eyebrow">{eyebrow}</p><h1>{title}</h1><p class="intro-description">{description}</p></section>'

    hero=template('hero').replace('id="top"','id="hero"')
    hero=hero.replace('ค้นพบการแสดง','ค้นหาโชว์ที่ใช่').replace('Stage magic. Close-up. Your moment.','YOUR OCCASION. YOUR KIND OF MAGIC.')
    home=hero+f'''<section class="section home-discover"><div class="section-kicker"><span>01 / FIND YOUR MAGIC</span><span>YOUR MOMENT STARTS HERE</span></div><div class="section-title"><div><p class="eyebrow">การแสดงที่เข้ากับงานของคุณ</p><h2>One occasion.<br><em>Many possibilities.</em></h2></div><p>จากความมหัศจรรย์ใกล้แค่ปลายนิ้ว<br>ถึงช่วงเวลาที่สะกดทั้งเวที</p></div><div class="occasion-links">{''.join(f'<a href="/shows/?occasion={key}">{label}<span>↗</span></a>' for key,label in site['categories'].items())}</div><div class="catalog-grid home-grid">{''.join(card(next(s for s in shows if s['slug']==slug)) for slug in ['stage','closeup','opening'])}</div><div class="section-end"><p>7 รูปแบบการแสดง · เลือกให้ตรงกับผู้ชมและบรรยากาศ</p><a class="line-link" href="/shows/">สำรวจการแสดงทั้งหมด ↗</a></div></section>'''
    home+=template('artist').replace('01 / THE ARTIST','02 / THE ARTIST').replace('</div></div></div>','<a class="line-link" href="/about/">รู้จักตัวตนของ Velin ↗</a></div></div></div>')
    home+=template('film')+f'<section class="section planning"><p class="eyebrow">SIMPLE FROM THE FIRST HELLO</p><h2>จากไอเดียของคุณ<br>สู่ช่วงเวลาที่น่าจดจำ</h2>{steps()}</section>'+invite()
    render('/','Velin Magic | นักมายากลและการแสดงสำหรับงานพิเศษ','ค้นพบการแสดงมายากลของ Velin ทั้งมายากลเวที โคลสอัพ และรูปแบบโชว์สำหรับงานบริษัท งานแต่ง เปิดตัวสินค้า และครอบครัว พร้อมคุยรายละเอียดงานโดยตรง',home)

    filters='<div class="filter-bar" role="group" aria-label="เลือกตามประเภทงาน"><button type="button" class="filter-chip" data-filter="all" aria-pressed="true">ทั้งหมด</button>'+''.join(f'<button type="button" class="filter-chip" data-filter="{k}" aria-pressed="false">{v}</button>' for k,v in site['categories'].items())+'</div>'
    catalog=intro('THE PERFORMANCE COLLECTION','เลือกโชว์ที่ใช่<br><em>สำหรับช่วงเวลาของคุณ</em>','ไม่ต้องรู้จักมายากลทุกแบบ เริ่มจากประเภทงาน แล้วค่อยค้นหาการแสดงที่เข้ากับคุณ')
    catalog+=f'''<section class="section catalog-section" aria-label="รายการการแสดง"><div class="catalog-toolbar"><p>งานของคุณเป็นแบบไหน?</p><a href="/contact/">ยังไม่แน่ใจ ให้เราช่วยเลือก ↗</a></div>{filters}<p id="filter-status" class="result-count" role="status">ทั้งหมด 7 รูปแบบการแสดง</p><div class="catalog-grid" id="show-catalog">{''.join(card(s,True) for s in shows)}</div><p class="image-note">ภาพประกอบรูปแบบการแสดงจากคลัง 171 Magic Club · ทีมและรายละเอียดของแต่ละงานจะยืนยันก่อนจอง</p></section>
    <section class="section planning"><p class="eyebrow">A LITTLE GUIDANCE</p><h2>เลือกง่ายขึ้น<br>เมื่อเริ่มจากบรรยากาศ</h2><div class="guidance-grid"><article><span>01 / CONNECTION</span><h3>อยากให้แขกได้คุยและมีส่วนร่วม</h3><p>โคลสอัพเข้าไปสร้างความสนุกถึงวงสนทนา เหมาะกับช่วงต้อนรับหรืองานที่แขกอยู่หลายโต๊ะ</p><a class="line-link" href="/shows/closeup/">ดูมายากลโคลสอัพ →</a></article><article><span>02 / ATTENTION</span><h3>อยากให้ทุกสายตาหันมาที่เวที</h3><p>เลือกมายากลเวทีหรือโชว์เปิดตัว เพื่อสร้างจังหวะสำคัญที่ทุกคนรับชมพร้อมกัน</p><a class="line-link" href="/shows/stage/">ดูมายากลเวที →</a></article><article><span>03 / PLAYFULNESS</span><h3>อยากให้เด็กและครอบครัวสนุกด้วยกัน</h3><p>บับเบิ้ล จั๊กกลิ้ง และลูกโป่ง เพิ่มสีสันให้พื้นที่กิจกรรมด้วยทีมที่เหมาะกับรูปแบบงาน</p><a class="line-link" href="/shows/?occasion=kids">ดูโชว์สำหรับครอบครัว →</a></article></div></section>{invite()}
    <aside class="shortlist-bar" id="shortlist-bar" aria-label="รายการที่สนใจ" hidden><div><strong id="shortlist-count">เลือกแล้ว 0 โชว์</strong><p id="shortlist-names"></p></div><button type="button" id="clear-shortlist">ล้างรายการ</button><a class="button button--dark" id="shortlist-contact" href="/contact/">คุยรายละเอียด <span>↗</span></a></aside>'''
    render('/shows/','รูปแบบการแสดงมายากล 7 ประเภท | Velin Magic','เลือกโชว์ตามลักษณะงาน: มายากลเปิดตัว โคลสอัพ มายากลเวที บับเบิ้ล จั๊กกลิ้ง โบโซ่และลูกโป่ง หรืออิลลูชัน ดูภาพและรายละเอียดก่อนคุยเรื่องงาน',catalog,'shows',shows[0]['cover']['src'],{'@context':'https://schema.org','@type':'ItemList','itemListElement':[{'@type':'ListItem','position':i+1,'url':base+'/shows/'+s['slug']+'/','name':s['name']} for i,s in enumerate(shows)]})

    for s in shows:
        credit='การแสดงในแนวทางของ Velin · ยืนยันรายละเอียดตามงาน' if s['delivery']=='velin' else 'รูปแบบที่ประสานทีมร่วมแสดง · ยืนยันนักแสดงและความพร้อมตามงาน'
        questions=[('โชว์นี้เหมาะกับงานแบบไหน?', 'เหมาะกับ'+ ' / '.join(s['occasions'])+' โดยจะปรับรูปแบบร่วมกันตามสถานที่และผู้ชม'),('ใช้เวลาและพื้นที่เท่าไร?', 'ระยะเวลา พื้นที่ อุปกรณ์ และเวลาติดตั้งจะสรุปให้เหมาะกับสถานที่จริง กรุณาแจ้งกำหนดการและข้อจำกัดของงานก่อนยืนยัน'),('ขอรายละเอียดและจองอย่างไร?', 'เลือกการแสดงนี้แล้วแจ้งวันจัดงาน สถานที่ และจำนวนผู้ชม เราจะตรวจสอบวันว่างและส่งรายละเอียดพร้อมใบเสนอราคาให้พิจารณา')]
        gallery=''.join(f'<button class="gallery-item detail-photo" type="button" aria-label="ขยายภาพ {e(s["name"])} {i+1}" data-caption="{e(p["credit"])}">{photo(p)}</button>' for i,p in enumerate(s['gallery']))
        detail=f'''<div class="breadcrumbs"><a href="/">หน้าหลัก</a><span>/</span><a href="/shows/">รูปแบบโชว์</a><span>/</span><span>{e(s['name'])}</span></div>
        <section class="detail-hero"><div class="detail-copy"><p class="eyebrow">{e(s['english'])}</p><h1>{e(s['name'])}</h1><p class="detail-tagline">{e(s['tagline'])}</p><div class="detail-tags">{''.join(f'<span>{site["categories"][t]}</span>' for t in s['tags'])}</div>{cta('สนใจการแสดงนี้',s['slug'])}<a class="quiet-link" href="#show-details">อ่านรายละเอียด ↓</a><p class="delivery-note">{credit}</p></div><figure class="detail-cover">{photo(s['cover'],True)}<figcaption>ภาพประกอบรูปแบบการแสดง · 171 Magic Club</figcaption></figure></section>
        <section class="section detail-body" id="show-details"><div><p class="eyebrow">THE EXPERIENCE</p><h2>{e(s['highlight'])}</h2>{''.join('<p>'+e(p)+'</p>' for p in s['description'])}<h3>เหมาะกับโอกาสแบบไหน</h3><ul class="fits-list">{''.join('<li>'+e(p)+'</li>' for p in s['occasions'])}</ul></div><aside class="planning-note"><p class="eyebrow">BEFORE THE SHOW</p><h3>เตรียมข้อมูลเท่านี้<br>ก็เริ่มคุยกันได้</h3><ul>{''.join('<li>'+e(p)+'</li>' for p in s['preparation'])}</ul><p>รูปแบบ นักแสดง อุปกรณ์ และรายละเอียดงานจะสรุปร่วมกันก่อนยืนยันการจอง</p>{cta('เช็กวันว่างและคุยรายละเอียด',s['slug'])}</aside></section>
        <section class="section detail-gallery"><div class="section-title"><h2>A closer <em>look.</em></h2><p>ภาพประกอบการแสดงจากคลัง 171 Magic Club<br>กดที่ภาพเพื่อดูขนาดใหญ่</p></div><div class="photo-grid">{gallery}</div></section>
        <section class="section detail-faq"><div><p class="eyebrow">GOOD TO KNOW</p><h2>คำถามก่อนจอง</h2></div>{faq(questions)}</section>
        <section class="section related"><div class="section-title"><h2>You may <em>also like.</em></h2><a class="line-link" href="/shows/">กลับไปดูทั้งหมด →</a></div><div class="catalog-grid">{''.join(card(other) for other in sorted([x for x in shows if x['slug']!=s['slug']],key=lambda x:-len(set(x['tags'])&set(s['tags'])))[:3])}</div></section>{invite()}'''
        render('/shows/'+s['slug']+'/',s['name']+' สำหรับงานอีเวนต์และโอกาสพิเศษ | Velin Magic',s['tagline']+' ดูภาพ รูปแบบงานที่เหมาะสม และข้อมูลที่ควรเตรียมก่อนสอบถามการแสดงกับ Velin',detail,'shows',s['cover']['src'],{'@context':'https://schema.org','@type':'Service','name':s['name'],'description':s['tagline'],'url':base+'/shows/'+s['slug']+'/','serviceType':s['english']})

    about=intro('THE PERSON BEHIND THE MAGIC','ผมเชื่อในความรู้สึก<br><em>หลังจากกลจบลง</em>','Velin — นักมายากล ผู้ถ่ายทอดตัวตนผ่านการแสดง และเรื่องราวที่เกิดขึ้นระหว่างเรากับผู้ชม')+template('artist')
    about+=f'<section class="section artist-values"><p class="eyebrow">A PERSONAL APPROACH</p><h2>ให้การแสดงเข้ากับงาน<br>และยังคงเป็นตัวเอง</h2>{steps()}<p class="brand-note">Velin คือพื้นที่ของผลงานส่วนตัวในฐานะศิลปินและนักมายากล ส่วนรูปแบบโชว์ที่ต้องใช้ผู้เชี่ยวชาญเฉพาะทาง จะคุยเรื่องทีมร่วมแสดงให้ชัดเจนก่อนจอง โดยใช้ช่องทางติดต่อร่วมกับ Untitled Magic</p></section>'+invite()
    render('/about/','รู้จัก Velin | ตัวตนและแนวคิดของนักมายากล','รู้จักแนวคิดการแสดงของ Velin นักมายากลที่ให้ความสำคัญกับประสบการณ์ผู้ชมและการออกแบบการแสดงให้เข้ากับโอกาสของคุณ',about,'about')

    gallery=intro('THE MOMENTS COLLECTION','ภาพที่เล่าเรื่อง<br><em>แทนคำอธิบาย</em>','สำรวจบรรยากาศและรูปแบบการแสดง แล้วค้นหาความรู้สึกที่คุณอยากให้เกิดขึ้นในงาน')
    gallery+='<section class="section gallery-overview"><div class="photo-grid">'+''.join(f'<figure>{photo(s["cover"])}<figcaption><a href="/shows/{s["slug"]}/">{e(s["name"])} ↗</a><span>ภาพจากคลัง 171 Magic Club</span></figcaption></figure>' for s in shows)+'</div></section>'+template('moments')+invite()
    render('/gallery/','ภาพการแสดงมายากลและไอเดียสำหรับงาน | Velin Magic','ดูภาพรูปแบบการแสดงมายากลเวที โคลสอัพ เปิดตัว บับเบิ้ล จั๊กกลิ้ง ลูกโป่ง และอิลลูชัน เพื่อเลือกบรรยากาศที่เหมาะกับงาน',gallery,'gallery')

    booking=template('booking').replace('<h2 id="booking-title">','<h1 id="booking-title">').replace('your magic.</em></h2>','your magic.</em></h1>')
    options='<option value="ยังไม่แน่ใจ อยากขอคำแนะนำ">ยังไม่แน่ใจ อยากขอคำแนะนำ</option>'+''.join(f'<option value="{e(s["name"])}" data-slug="{s["slug"]}">{e(s["name"])}</option>' for s in shows)
    booking=re.sub(r'(<select name="show" id="show-choice">).*?(</select>)',lambda m:m[1]+options+m[2],booking,flags=re.S)
    booking=booking.replace('<label>การแสดงที่สนใจ','<div id="selected-shows" class="selected-summary" hidden><p>รายการที่คุณสนใจ</p><ul id="selected-show-list"></ul><a href="/shows/">กลับไปเลือกใหม่ →</a></div><label id="single-show-label">การแสดงที่สนใจ')
    booking=booking.replace('<form id="booking-form"','<noscript><p>แบบฟอร์มเตรียมข้อความต้องใช้ JavaScript คุณสามารถโทรหรือติดต่อผ่าน LINE ด้านข้างได้โดยตรง</p></noscript><form id="booking-form"')
    booking=booking.replace('</form>','<p class="form-note"><a href="/privacy/">การใช้ข้อมูลและความเป็นส่วนตัว →</a></p></form>')
    booking=booking.replace('05 / YOUR NEXT MOMENT','YOUR NEXT MOMENT').replace('LET’S CREATE SOMETHING MEMORABLE','LET’S CREATE SOMETHING MEMORABLE')
    for old,new in [('062–092–5274',site['phone']),('tel:0620925274','tel:'+site['telephone']),('https://lin.ee/gEOLM00',site['line']),('@untitled.magic',site['lineName'])]: booking=booking.replace(old,new)
    render('/contact/','ติดต่อและสอบถามการแสดง | Velin Magic','สอบถามวันว่างและรายละเอียดการแสดง Velin แจ้งวันที่ สถานที่ และจำนวนผู้ชม เพื่อรับคำแนะนำรูปแบบโชว์และใบเสนอราคา',booking,'contact')
    privacy=intro('YOUR INFORMATION','ข้อมูลของคุณ<br><em>อยู่ในการตัดสินใจของคุณ</em>','หน้านี้อธิบายการทำงานของแบบฟอร์มและบริการภายนอกที่เว็บไซต์ใช้')+'''<section class="section prose"><h2>แบบฟอร์มเตรียมข้อความ</h2><p>ชื่อ เบอร์โทร และรายละเอียดงานที่กรอกจะใช้สร้างข้อความในเบราว์เซอร์ของคุณ เว็บไซต์ไม่มีระบบส่งแบบฟอร์มหรือฐานข้อมูลรับคำขอ คุณต้องคัดลอกข้อความและนำไปส่งใน LINE ด้วยตนเอง</p><h2>รายการโชว์ที่สนใจ</h2><p>เว็บไซต์จดจำเฉพาะรหัสโชว์ที่เลือกใน sessionStorage ของแท็บนี้ เพื่อให้คุณกลับมาเลือกต่อได้ รายการนี้ไม่มีชื่อหรือเบอร์โทร หากเบราว์เซอร์ไม่อนุญาตให้จัดเก็บ คุณยังเลือกโชว์ในหน้าปัจจุบันและส่งต่อไปหน้าติดต่อได้</p><h2>บริการภายนอก</h2><p>เว็บไซต์โหลดแบบอักษรจาก Google Fonts และจะเชื่อมต่อ YouTube เมื่อคุณกดชมวิดีโอ การเปิด LINE หรือโซเชียลมีเดียจะพาคุณไปยังบริการนั้น ซึ่งมีนโยบายความเป็นส่วนตัวของตนเอง ผู้ให้บริการโฮสติ้งอาจประมวลผลข้อมูลการเชื่อมต่อเพื่อให้บริการเว็บไซต์</p><h2>ติดต่อเรื่องข้อมูล</h2><p>สอบถามได้ผ่านช่องทางใน <a href="/contact/">หน้าติดต่อ</a> โดยแจ้งว่าเป็นคำถามเกี่ยวกับเว็บไซต์ Velin</p></section>'''
    render('/privacy/','การใช้ข้อมูลและความเป็นส่วนตัว | Velin Magic','การใช้ข้อมูลในแบบฟอร์ม รายการโชว์ที่สนใจ และบริการภายนอกของเว็บไซต์ Velin Magic',privacy)
    render('/404/','ไม่พบหน้านี้ | Velin Magic','กลับไปเลือกการแสดงหรือหน้าหลักของ Velin',intro('A SMALL DETOUR','หน้านี้อาจย้ายไปแล้ว','กลับไปค้นหาโชว์ที่ใช่สำหรับคุณ')+'<div class="section"><a class="button button--dark" href="/shows/">ดูรูปแบบโชว์ →</a></div>',noindex=True)
    (ROOT/'404.html').write_text((ROOT/'404/index.html').read_text(encoding='utf-8'),encoding='utf-8')
    (ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url><loc>{base+p}</loc></url>\n' for p in pages)+'</urlset>\n',encoding='utf-8')
    (ROOT/'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /archive/\nDisallow: /tools/\nDisallow: /docs/\nSitemap: {base}/sitemap.xml\n',encoding='utf-8')
    print(f'Built {len(pages)} indexable pages + 404. No prices or automatic publication.')


if __name__ == '__main__':
    build()
