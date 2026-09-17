/* ════════════════════════════════════════════════════════════════
   Velin Magic — behaviour
   Every feature is progressive: links and prices work without JS.
   ════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const SHOWS = JSON.parse($('#show-data')?.textContent || '[]');
  const bySlug = Object.fromEntries(SHOWS.map((s) => [s.slug, s]));
  const baht = (n) => '฿' + n.toLocaleString('en-US');

  /* ─────────────────────────── header & menu */

  const header = $('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuButton = $('[data-menu-button]');
  const nav = $('[data-nav]');
  const setMenu = (open) => {
    menuButton?.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  };
  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  $$('[data-submenu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.setAttribute('aria-expanded', String(btn.getAttribute('aria-expanded') !== 'true'));
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-menu')) $$('[data-submenu]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('[data-submenu][aria-expanded="true"]').forEach((b) => { b.setAttribute('aria-expanded', 'false'); b.focus(); });
    if (nav?.classList.contains('is-open')) { setMenu(false); menuButton.focus(); }
  });

  /* ─────────────────────────── shortlist
     The visitor's choices survive page changes so the journey can go
     catalogue → show page → occasion page → contact without losing anything. */

  const KEY = 'velin:shortlist';
  let memory = [];
  const readList = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter((s) => bySlug[s]); }
    catch { return memory; }
  };
  const writeList = (list) => {
    memory = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode — memory only */ }
  };

  // a ?shows=a,b link (e.g. shared in chat) seeds the list
  const seeded = new URLSearchParams(location.search).get('shows');
  if (seeded) writeList([...new Set([...readList(), ...seeded.split(',').filter((s) => bySlug[s])])]);

  const toast = $('[data-toast]');
  let toastTimer;
  const showToast = (html) => {
    if (!toast) return;
    toast.innerHTML = html;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  };

  const paint = () => {
    const list = readList();
    $$('[data-pick]').forEach((btn) => {
      const on = list.includes(btn.dataset.pick);
      btn.setAttribute('aria-pressed', String(on));
      const label = $('[data-pick-label]', btn);
      if (label) label.textContent = on ? 'เลือกแล้ว' : (btn.classList.contains('pick-lg') ? 'เลือกโชว์นี้' : 'เลือก');
      btn.closest('.show-card')?.classList.toggle('is-picked', on);
    });
    $$('[data-shortlist-count]').forEach((el) => { el.textContent = list.length; el.hidden = list.length === 0; });
    renderPanel(list);
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    const slug = btn.dataset.pick;
    const list = readList();
    const on = !list.includes(slug);
    writeList(on ? [...list, slug] : list.filter((s) => s !== slug));
    paint();
    if (on && !location.pathname.startsWith('/contact')) {
      const n = readList().length;
      showToast(`<span>เพิ่ม <b>${bySlug[slug].th}</b> แล้ว · ${n} รายการ</span><a href="/contact/">ขอใบเสนอราคา</a>`);
    }
  });

  addEventListener('storage', (e) => { if (e.key === KEY) paint(); });

  /* ─────────────────────────── contact page: shortlist panel */

  const panel = $('[data-shortlist-panel]');
  function renderPanel(list) {
    if (!panel) return;
    if (!list.length) {
      panel.innerHTML = '<p class="empty">ยังไม่ได้เลือกโชว์ — <a href="/shows/">ดูรูปแบบการแสดง</a> แล้วกด “เลือก” หรือข้ามขั้นนี้ไปเล่ารายละเอียดงานได้เลย</p>';
      return;
    }
    const items = list.map((slug) => bySlug[slug]);
    const total = items.reduce((sum, s) => sum + s.price, 0);
    const approx = items.some((s) => s.from);
    panel.innerHTML =
      '<ul class="sl-list">' + items.map((s) => `
        <li class="sl-item">
          <img class="sl-thumb" src="${s.thumb}" alt="" width="72" height="54" loading="lazy">
          <span class="sl-name"><a href="${s.url}">${s.th}</a><small>${s.en}</small></span>
          <span class="sl-price">${s.from ? '<small>เริ่มต้น</small>' : ''}${baht(s.price)}</span>
          <button type="button" class="sl-remove" data-remove="${s.slug}" aria-label="เอา ${s.th} ออก">
            <svg class="icon" aria-hidden="true"><use href="#i-close"/></svg>
          </button>
        </li>`).join('') + '</ul>' +
      `<div class="sl-total"><span>รวมประมาณ <br><button type="button" class="sl-clear" data-clear>ล้างรายการ</button></span>
         <span style="text-align:right"><strong>${baht(total)}</strong><br><span class="fine">${approx ? 'ราคาประเมิน — บางรายการเป็นราคาเริ่มต้น' : 'ก่อนหักส่วนลดและค่าเดินทาง (ถ้ามี)'}</span></span></div>`;
  }
  panel?.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { writeList(readList().filter((s) => s !== rm.dataset.remove)); paint(); }
    if (e.target.closest('[data-clear]')) { writeList([]); paint(); }
  });

  /* ─────────────────────────── contact page: message composer */

  const form = $('[data-quote-form]');
  const output = $('[data-quote-output]');
  const message = $('[data-quote-message]');

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    try {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  };

  const composeMessage = (data) => {
    const items = readList().map((s) => bySlug[s]);
    const lines = ['สวัสดีครับ สนใจจองการแสดงของ Velin Magic', ''];
    if (items.length) {
      lines.push('โชว์ที่สนใจ:');
      items.forEach((s) => lines.push(`• ${s.th} — ${s.from ? 'เริ่มต้น ' : ''}${baht(s.price)}`));
      const total = items.reduce((sum, s) => sum + s.price, 0);
      lines.push(`รวมประมาณ ${baht(total)}${items.some((s) => s.from) ? ' (ราคาประเมิน)' : ''}`, '');
    }
    const rows = [
      ['ชื่อ', data.get('name')], ['เบอร์โทร', data.get('phone')], ['วันที่จัดงาน', formatDate(data.get('date'))],
      ['ประเภทงาน', data.get('occasion')], ['สถานที่', data.get('place')], ['จำนวนผู้ชม', data.get('guests') && data.get('guests') + ' คน'],
      ['รายละเอียด', data.get('details')],
    ];
    rows.forEach(([k, v]) => { if (v && String(v).trim()) lines.push(`${k}: ${String(v).trim()}`); });
    return lines.join('\n');
  };

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    return isNaN(d) ? value : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const setError = (input, text) => {
    const field = input.closest('.field');
    field.classList.toggle('has-error', Boolean(text));
    const slot = $('[data-error]', field);
    if (slot) slot.textContent = text;
    input.setAttribute('aria-invalid', String(Boolean(text)));
  };

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name;
    const phone = form.elements.phone;
    setError(name, name.value.trim() ? '' : 'กรุณากรอกชื่อผู้ติดต่อ');
    const digits = phone.value.replace(/\D/g, '');
    setError(phone, digits.length >= 9 ? '' : 'กรุณากรอกเบอร์โทรที่ติดต่อได้');
    const firstBad = $('[aria-invalid="true"]', form);
    if (firstBad) { firstBad.focus(); return; }

    message.value = composeMessage(new FormData(form));
    output.hidden = false;
    output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    output.focus({ preventScroll: true });
  });

  // editing after generating means the message on screen is stale
  form?.addEventListener('input', (e) => {
    if (e.target.closest('.field')?.classList.contains('has-error')) setError(e.target, '');
    if (output && !output.hidden) output.hidden = true;
  });

  $('[data-copy]')?.addEventListener('click', async (e) => {
    const ok = await copyText(message.value);
    e.currentTarget.textContent = ok ? 'คัดลอกแล้ว ✓' : 'คัดลอกไม่สำเร็จ — กดค้างที่ข้อความเพื่อคัดลอก';
  });
  $('[data-copy-open]')?.addEventListener('click', async () => {
    // the link still opens LINE even if copying is refused
    const ok = await copyText(message.value);
    showToast(ok ? '<span>คัดลอกข้อความแล้ว วางในแชท LINE ได้เลย</span>' : '<span>คัดลอกไม่สำเร็จ — คัดลอกข้อความด้วยตนเอง</span>');
  });

  /* ─────────────────────────── catalogue filter (synced to ?occasion=) */

  const scope = $('[data-filter-scope]');
  if (scope) {
    const grid = $('[data-filter-grid]', scope);
    const count = $('[data-filter-count]', scope);
    const chips = $$('[data-filter]', scope);
    const cards = $$('.show-card', grid);
    const apply = (tag, push) => {
      let shown = 0;
      cards.forEach((c) => {
        const ok = tag === 'all' || c.dataset.tags.split(' ').includes(tag);
        c.hidden = !ok;
        if (ok) shown += 1;
      });
      chips.forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.filter === tag)));
      count.textContent = shown === cards.length ? `ทั้งหมด ${cards.length} รูปแบบการแสดง` : `แสดง ${shown} จาก ${cards.length} รูปแบบ`;
      if (push) {
        const url = new URL(location.href);
        tag === 'all' ? url.searchParams.delete('occasion') : url.searchParams.set('occasion', tag);
        history.replaceState(null, '', url);
      }
    };
    chips.forEach((ch) => ch.addEventListener('click', () => apply(ch.dataset.filter, true)));
    const initial = new URLSearchParams(location.search).get('occasion');
    if (initial && chips.some((c) => c.dataset.filter === initial)) apply(initial, false);
  }

  /* ─────────────────────────── gallery page filter */

  const galleryChips = $$('[data-gallery-filter]');
  galleryChips.forEach((chip) => chip.addEventListener('click', () => {
    const tag = chip.dataset.galleryFilter;
    galleryChips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    $$('[data-group]').forEach((g) => { g.hidden = tag !== 'all' && g.dataset.group !== tag; });
  }));

  /* ─────────────────────────── lightbox */

  const lb = $('[data-lightbox-dialog]');
  if (lb && typeof lb.showModal === 'function') {
    const img = $('[data-lb-img]', lb);
    const cap = $('[data-lb-caption]', lb);
    let group = [];
    let index = 0;
    let opener = null;
    const show = (i) => {
      index = (i + group.length) % group.length;
      const a = group[index];
      img.src = a.href;
      img.alt = a.dataset.caption || '';
      cap.textContent = `${a.dataset.caption || ''} · ${index + 1}/${group.length}`;
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lightbox]');
      if (!a) return;
      e.preventDefault();
      opener = a;
      group = $$(`[data-lightbox="${a.dataset.lightbox}"]`).filter((x) => !x.closest('[hidden]'));
      show(group.indexOf(a));
      lb.showModal();
    });
    $('[data-lb-next]', lb).addEventListener('click', () => show(index + 1));
    $('[data-lb-prev]', lb).addEventListener('click', () => show(index - 1));
    const closeLightbox = () => { if (lb.open) lb.close(); img.removeAttribute('src'); opener?.focus(); };
    $('[data-lb-close]', lb).addEventListener('click', closeLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });
    lb.addEventListener('close', () => img.removeAttribute('src'));
    let startX = null;
    lb.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* ─────────────────────────── video (YouTube loads only on request) */

  $$('[data-video]').forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.video;
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const dlg = document.createElement('dialog');
    dlg.className = 'video-dialog';
    dlg.setAttribute('aria-label', 'วิดีโอไฮไลต์การแสดง');
    dlg.innerHTML = `
      <button type="button" class="video-close" aria-label="ปิดวิดีโอ"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
      <div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="วิดีโอไฮไลต์การแสดง"
        allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
      <a class="video-fallback" href="${watch}" target="_blank" rel="noopener">เปิดดูบน YouTube ↗</a>`;
    document.body.append(dlg);
    // tear down synchronously: the dialog's own "close" event is async, and an
    // iframe left in the DOM keeps the audio playing
    let gone = false;
    const teardown = () => {
      if (gone) return;
      gone = true;
      if (dlg.open) dlg.close();
      dlg.remove();
      btn.focus();
    };
    $('.video-close', dlg).addEventListener('click', teardown);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) teardown(); });
    dlg.addEventListener('close', teardown);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else window.open(watch, '_blank', 'noopener');
  }));

  paint();
})();
