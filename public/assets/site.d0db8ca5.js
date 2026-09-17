/* ════════════════════════════════════════════════════════════════
   Velin Magic — behaviour
   Every feature is progressive: links, prices and content work
   without JS. Motion respects prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const SHOWS = JSON.parse($('#show-data')?.textContent || '[]');
  const bySlug = Object.fromEntries(SHOWS.map((s) => [s.slug, s]));
  const baht = (n) => '฿' + Number(n).toLocaleString('en-US');
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const icon = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const body = document.body;

  /* ─────────────────────────── header: glass when scrolled, tucks away on the way down */

  const header = $('[data-header]');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    header?.classList.toggle('is-scrolled', y > 24);
    const busy = body.classList.contains('menu-open') || body.classList.contains('sheet-open');
    const hide = !busy && y > 420 && y > lastY + 4;
    const show = y < lastY - 4 || y < 420;
    if (hide) { header?.classList.add('is-hidden'); body.classList.add('header-hidden'); }
    else if (show) { header?.classList.remove('is-hidden'); body.classList.remove('header-hidden'); }
    if (Math.abs(y - lastY) > 4) lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // on the home page the hero already carries the main button — the dock arrives once it scrolls away
  const dock = $('[data-dock]');
  const heroActions = $('.hero-actions');
  if (dock && heroActions && 'IntersectionObserver' in window) {
    dock.classList.add('is-away');
    new IntersectionObserver(([en]) => dock.classList.toggle('is-away', en.isIntersecting || en.boundingClientRect.top > 0))
      .observe(heroActions);
  }

  const menuButton = $('[data-menu-button]');
  const nav = $('[data-nav]');
  const setMenu = (open) => {
    menuButton?.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('is-open', open);
    body.classList.toggle('menu-open', open);
    if (open) header?.classList.remove('is-hidden');
  };
  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  $$('[data-submenu]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.setAttribute('aria-expanded', String(btn.getAttribute('aria-expanded') !== 'true'));
  }));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-menu')) $$('[data-submenu]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  });

  /* ─────────────────────────── shortlist store
     The visitor's choices survive page changes so the journey can go
     finder → show page → occasion page → contact without losing anything. */

  const KEY = 'velin:shortlist';
  let memory = [];
  const readList = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter((s) => bySlug[s]); }
    catch { return memory.filter((s) => bySlug[s]); }
  };
  const writeList = (list) => {
    memory = [...new Set(list)];
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* private mode — memory only */ }
  };

  // a ?shows=a,b link (e.g. shared in chat) seeds the list
  const seeded = new URLSearchParams(location.search).get('shows');
  if (seeded) writeList([...readList(), ...seeded.split(',').filter((s) => bySlug[s])]);

  const toast = $('[data-toast]');
  let toastTimer;
  const showToast = (html) => {
    if (!toast) return;
    toast.innerHTML = icon('i-check') + html;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  const summary = (list) => {
    const items = list.map((s) => bySlug[s]);
    return { items, total: items.reduce((n, s) => n + s.price, 0), approx: items.some((s) => s.from) };
  };

  let lastCount = null;
  const paint = () => {
    const list = readList();
    $$('[data-pick]').forEach((btn) => {
      const on = list.includes(btn.dataset.pick);
      btn.setAttribute('aria-pressed', String(on));
      const label = $('[data-pick-label]', btn);
      if (label) label.textContent = on ? 'เลือกแล้ว' : (btn.classList.contains('pick-lg') ? 'เลือกโชว์นี้' : 'เลือก');
      btn.closest('.show-card')?.classList.toggle('is-picked', on);
    });
    $$('[data-pick-set]').forEach((btn) => {
      const set = btn.dataset.pickSet.split(',');
      const done = set.every((s) => list.includes(s));
      btn.classList.toggle('is-done', done);
      const label = $('[data-set-label]', btn);
      if (label) label.textContent = done ? 'เลือกแล้ว · ดูรายการ' : 'เลือกทั้งชุด';
      const use = $('use', btn);
      use?.setAttribute('href', done ? '#i-check' : '#i-plus');
    });
    $$('[data-shortlist-count]').forEach((el) => {
      el.textContent = list.length;
      el.hidden = list.length === 0;
      if (lastCount !== null && list.length > lastCount) {
        el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
      }
    });
    $$('[data-dock-label]').forEach((el) => { el.textContent = list.length ? 'รายการที่เลือก' : 'ขอใบเสนอราคา'; });
    lastCount = list.length;
    renderSheet(list);
    renderPanel(list);
  };

  /* a small gold dot travels from the button to the bag — the eye learns where choices go */
  const fly = (from) => {
    if (calm.matches || !from || !Element.prototype.animate) return;
    const target = $$('[data-fly-target]').find((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
      && el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < innerHeight);
    if (!target) return;
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const dot = document.createElement('span');
    dot.className = 'fly-dot';
    dot.style.left = x0 + 'px'; dot.style.top = y0 + 'px';
    body.append(dot);
    const dx = x1 - x0, dy = y1 - y0, lift = Math.min(-80, dy / 2 - 90);
    dot.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${lift}px) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0.3 },
    ], { duration: 720, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    setTimeout(() => dot.remove(), 740);
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (btn) {
      const slug = btn.dataset.pick;
      const list = readList();
      const on = !list.includes(slug);
      writeList(on ? [...list, slug] : list.filter((s) => s !== slug));
      paint();
      if (on) {
        fly(btn);
        if (!location.pathname.startsWith('/contact')) {
          const n = readList().length;
          showToast(`<span>เพิ่ม <b>${esc(bySlug[slug].th)}</b> · ${n} รายการ</span>`);
        }
      }
      return;
    }
    const set = e.target.closest('[data-pick-set]');
    if (set) {
      const slugs = set.dataset.pickSet.split(',').filter((s) => bySlug[s]);
      const list = readList();
      if (slugs.every((s) => list.includes(s))) { openSheet(set); return; }
      writeList([...list, ...slugs]);
      paint();
      fly(set);
      showToast(`<span>เพิ่มทั้งชุด ${slugs.length} โชว์แล้ว · รวม ${readList().length} รายการ</span>`);
    }
  });

  addEventListener('storage', (e) => { if (e.key === KEY) paint(); });

  /* ─────────────────────────── shortlist sheet (bottom sheet on phones, drawer on desktop) */

  const sheet = $('[data-sheet]');
  const sheetBody = $('[data-sheet-body]');
  const backdrop = $('[data-sheet-backdrop]');
  let sheetOpener = null;
  let sheetTimer;

  const itemRows = (items) => '<ul class="sl-list">' + items.map((s, i) => `
    <li class="sl-item" style="animation-delay:${i * 40}ms">
      <img class="sl-thumb" src="${s.thumb}" alt="" width="64" height="64" loading="lazy">
      <span class="sl-name"><small>${esc(s.en)}</small><a href="${s.url}">${esc(s.th)}</a></span>
      <span class="sl-price">${s.from ? '<small>เริ่มต้น</small>' : ''}${baht(s.price)}</span>
      <button type="button" class="sl-remove" data-remove="${s.slug}" aria-label="เอา ${esc(s.th)} ออก">${icon('i-close')}</button>
    </li>`).join('') + '</ul>';

  const totalRow = ({ total, approx }) => `
    <div class="sl-total">
      <div><span class="fine">รวมประมาณ</span><strong>${baht(total)}</strong>
        <span class="fine">${approx ? 'บางรายการเป็นราคาเริ่มต้น — ราคาจริงสรุปในใบเสนอราคา' : 'ราคาจริงสรุปในใบเสนอราคา'}</span></div>
      <button type="button" class="sl-clear" data-clear>ล้างรายการ</button>
    </div>`;

  function renderSheet(list) {
    if (!sheetBody) return;
    if (!list.length) {
      sheetBody.innerHTML = `
        <div class="sheet-empty">
          ${icon('i-bag')}
          <p>ยังไม่ได้เลือกโชว์<br>กด “เลือก” ที่โชว์ที่สนใจ แล้วส่งให้เราทีเดียว</p>
          <a class="btn btn-dark" href="/shows/">ดูรูปแบบโชว์ &amp; ราคา</a>
        </div>`;
      return;
    }
    sheetBody.innerHTML = itemRows(summary(list).items) + totalRow(summary(list));
  }

  const focusables = () => $$('a[href], button:not([disabled]), input, select, textarea', sheet).filter((el) => el.getClientRects().length);

  function openSheet(opener) {
    if (!sheet) return;
    clearTimeout(sheetTimer);
    sheetOpener = opener || document.activeElement;
    setMenu(false);
    sheet.hidden = false; backdrop.hidden = false;
    sheet.style.transform = '';
    void sheet.offsetWidth;
    sheet.classList.add('is-open'); backdrop.classList.add('is-open');
    body.classList.add('sheet-open');
    $('[data-sheet-close]', sheet)?.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('is-open'); backdrop.classList.remove('is-open');
    sheet.style.transform = '';
    body.classList.remove('sheet-open');
    sheetTimer = setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, calm.matches ? 0 : 520);
    sheetOpener?.focus?.({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-sheet-open]');
    if (opener) { e.preventDefault(); openSheet(opener); }
  });
  $('[data-sheet-close]')?.addEventListener('click', closeSheet);
  backdrop?.addEventListener('click', closeSheet);
  sheet?.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const row = rm.closest('.sl-item');
      const done = () => { writeList(readList().filter((s) => s !== rm.dataset.remove)); paint(); };
      if (row && row.animate && !calm.matches) {
        row.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 200, fill: 'forwards' });
        setTimeout(done, 200);
      } else done();
    }
    if (e.target.closest('[data-clear]')) { writeList([]); paint(); }
    if (e.target.closest('a[href]')) closeSheet();
  });
  sheet?.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // drag the sheet down to dismiss (phones)
  if (sheet) {
    let startY = null, dy = 0;
    const handle = (e) => e.target.closest('[data-sheet-grip], .sheet-head');
    sheet.addEventListener('touchstart', (e) => {
      if (!handle(e) || innerWidth > 767) return;
      startY = e.touches[0].clientY; dy = 0;
      sheet.style.transition = 'none';
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (startY === null) return;
      startY = null;
      sheet.style.transition = '';
      if (dy > 90) closeSheet(); else sheet.style.transform = '';
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (sheet && !sheet.hidden) { closeSheet(); return; }
    $$('[data-submenu][aria-expanded="true"]').forEach((b) => { b.setAttribute('aria-expanded', 'false'); b.focus(); });
    if (nav?.classList.contains('is-open')) { setMenu(false); menuButton.focus(); }
  });

  /* ─────────────────────────── show finder (home) */

  const finder = $('[data-finder]');
  if (finder) {
    const result = $('[data-finder-result]', finder);
    const empty = result.innerHTML;
    const state = { occasion: null, mood: null };
    const occLabel = (slug) => $(`[data-finder-occasion="${slug}"]`, finder)?.textContent.trim() || '';
    const moodLabel = (slug) => $(`[data-finder-mood="${slug}"] b`, finder)?.textContent.trim() || '';

    const render = () => {
      $$('[data-finder-occasion]', finder).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.finderOccasion === state.occasion)));
      $$('[data-finder-mood]', finder).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.finderMood === state.mood)));
      if (!state.occasion && !state.mood) { result.innerHTML = empty; return; }

      const scored = SHOWS.map((s) => {
        const occ = state.occasion ? s.occasions.includes(state.occasion) : null;
        const mood = state.mood ? s.moods.includes(state.mood) : null;
        const score = (occ ? 2 : 0) + (mood ? 2 : 0) + (s.velin ? 0.5 : 0);
        return { s, occ, mood, both: occ !== false && mood !== false && (occ || mood), score };
      }).filter((x) => x.occ || x.mood)
        .sort((a, b) => b.score - a.score || a.s.price - b.s.price);

      const perfect = scored.filter((x) => x.both);
      const picks = (perfect.length ? perfect : scored).slice(0, 3);
      const title = [state.occasion && occLabel(state.occasion), state.mood && moodLabel(state.mood)].filter(Boolean).join(' · ');
      const lead = perfect.length || !(state.occasion && state.mood)
        ? `โชว์ที่แนะนำสำหรับ ${esc(title)}`
        : `ยังไม่มีโชว์ที่ตรงทั้ง 2 ข้อ — นี่คือตัวเลือกที่ใกล้ที่สุด`;

      result.innerHTML = `
        <div class="finder-head"><h3>${lead}</h3><span class="fine">${picks.length} จาก ${SHOWS.length} รูปแบบ</span></div>
        <ul class="finder-list">${picks.map((x, i) => `
          <li class="fr-item" style="--i:${i}">
            <img class="fr-thumb" src="${x.s.thumb}" alt="" width="96" height="96" loading="lazy">
            <div class="fr-body">
              ${x.both && state.occasion && state.mood ? '<span class="fr-match">ตรงทั้ง 2 ข้อ</span>' : ''}
              <a href="${x.s.url}">${esc(x.s.th)}</a>
              <small>${esc(x.s.tagline)}</small>
              <div class="fr-foot">
                <span class="fr-price">${x.s.from ? '<small>เริ่มต้น</small>' : ''}${baht(x.s.price)}</span>
                <button type="button" class="pick pick-sm" data-pick="${x.s.slug}" aria-pressed="false" aria-label="เลือก ${esc(x.s.th)}">
                  <span class="pick-icon" aria-hidden="true">${icon('i-plus', 'icon icon-plus')}${icon('i-check', 'icon icon-check')}</span>
                  <span data-pick-label>เลือก</span>
                </button>
              </div>
            </div>
          </li>`).join('')}</ul>
        <div class="finder-actions">
          ${picks.length > 1 ? `<button type="button" class="btn btn-gold" data-pick-set="${picks.map((x) => x.s.slug).join(',')}">${icon('i-plus')}<span data-set-label>เลือกทั้งชุด</span></button>` : ''}
          ${state.occasion ? `<a class="link-arrow" href="/occasions/${state.occasion}/">ไอเดียจัดโชว์สำหรับ${esc(occLabel(state.occasion))}</a>` : '<a class="link-arrow" href="/shows/">ดูทุกรูปแบบ</a>'}
        </div>`;
      paint();
    };

    finder.addEventListener('click', (e) => {
      const o = e.target.closest('[data-finder-occasion]');
      const m = e.target.closest('[data-finder-mood]');
      if (o) state.occasion = state.occasion === o.dataset.finderOccasion ? null : o.dataset.finderOccasion;
      else if (m) state.mood = state.mood === m.dataset.finderMood ? null : m.dataset.finderMood;
      else return;
      render();
      // on phones the answer sits below the fold — bring it into view once both answers are in
      if (state.occasion && state.mood && innerWidth < 960) {
        const r = result.getBoundingClientRect();
        if (r.top > innerHeight * 0.6) scrollBy({ top: r.top - innerHeight * 0.25, behavior: calm.matches ? 'auto' : 'smooth' });
      }
    });
  }

  /* ─────────────────────────── tabs */

  $$('[data-tabs]').forEach((wrap) => {
    const tabs = $$('[role="tab"]', wrap);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: calm.matches ? 'auto' : 'smooth' });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t, false));
      t.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  });

  /* ─────────────────────────── swipe rails: progress bar under each row */

  $$('[data-rail]').forEach((rail) => {
    const bar = rail.nextElementSibling?.querySelector('[data-rail-bar]');
    if (!bar) return;
    const update = () => {
      const w = rail.scrollWidth;
      if (w <= rail.clientWidth + 2) { bar.parentElement.style.visibility = 'hidden'; return; }
      bar.parentElement.style.visibility = '';
      const size = rail.clientWidth / w;
      bar.style.width = size * 100 + '%';
      bar.style.transform = `translateX(${(rail.scrollLeft / w / size) * 100}%)`;
    };
    rail.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  });

  /* ─────────────────────────── show page carousel */

  $$('[data-carousel]').forEach((wrap) => {
    const track = $('[data-carousel-track]', wrap);
    const slides = $$('.slide', track);
    const thumbs = $$('[data-slide]', wrap);
    const counter = $('[data-car-index]', wrap);
    let index = 0;
    const go = (i) => {
      index = (i + slides.length) % slides.length;
      track.scrollTo({ left: index * track.clientWidth, behavior: calm.matches ? 'auto' : 'smooth' });
    };
    const sync = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i === index && counter.textContent === String(i + 1)) return;
      index = Math.max(0, Math.min(slides.length - 1, i));
      counter.textContent = index + 1;
      thumbs.forEach((t, n) => {
        if (n === index) { t.setAttribute('aria-current', 'true'); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        else t.removeAttribute('aria-current');
      });
    };
    track.addEventListener('scroll', sync, { passive: true });
    $('[data-car-prev]', wrap)?.addEventListener('click', () => go(index - 1));
    $('[data-car-next]', wrap)?.addEventListener('click', () => go(index + 1));
    thumbs.forEach((t) => t.addEventListener('click', () => go(Number(t.dataset.slide))));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });
  });

  /* ─────────────────────────── reveal on scroll, count-up, parallax */

  const counters = $$('[data-count]');
  const countUp = (el) => {
    const end = Number(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    if (!end || calm.matches) return;
    const t0 = performance.now();
    const dur = 1400;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + Math.round(end * eased).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('[data-reveal]').forEach((el) => io.observe(el));

    const cio = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countUp(en.target);
      cio.unobserve(en.target);
    }), { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
  } else {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  }

  const parallax = $$('[data-parallax]');
  if (parallax.length && !calm.matches) {
    let ticking = false;
    const move = () => {
      ticking = false;
      const y = scrollY;
      if (y > innerHeight * 1.2) return;
      parallax.forEach((el) => { el.style.translate = `0 ${Math.round(y * 0.18)}px`; });
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(move); } }, { passive: true });
  }

  /* sticky chooser bars get a hairline once they stick */
  $$('[data-sticky-bar]').forEach((bar) => {
    const check = () => {
      const top = parseFloat(getComputedStyle(bar).top) || 0;
      bar.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= top + 1 && scrollY > 200);
    };
    addEventListener('scroll', check, { passive: true });
    check();
  });

  /* ─────────────────────────── catalogue filter (synced to ?occasion=) */

  const scope = $('[data-filter-scope]');
  if (scope) {
    const grid = $('[data-filter-grid]', scope);
    const count = $('[data-filter-count]', scope);
    const chipEls = $$('[data-filter]', scope);
    const cards = $$('.show-card', grid);
    const apply = (tag, push) => {
      let shown = 0;
      cards.forEach((c) => {
        const ok = tag === 'all' || c.dataset.tags.split(' ').includes(tag);
        const was = !c.hidden;
        c.hidden = !ok;
        if (ok) {
          shown += 1;
          if (!was && c.animate && !calm.matches) c.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      });
      chipEls.forEach((ch) => {
        const on = ch.dataset.filter === tag;
        ch.setAttribute('aria-pressed', String(on));
        if (on && push) ch.scrollIntoView({ block: 'nearest', inline: 'center', behavior: calm.matches ? 'auto' : 'smooth' });
      });
      count.textContent = shown === cards.length ? `ทั้งหมด ${cards.length} รูปแบบการแสดง` : `แสดง ${shown} จาก ${cards.length} รูปแบบ`;
      if (push) {
        const url = new URL(location.href);
        tag === 'all' ? url.searchParams.delete('occasion') : url.searchParams.set('occasion', tag);
        history.replaceState(null, '', url);
        const bar = $('[data-sticky-bar]', scope);
        if (bar?.classList.contains('is-stuck')) {
          scrollTo({ top: scope.getBoundingClientRect().top + scrollY - 20, behavior: calm.matches ? 'auto' : 'smooth' });
        }
      }
    };
    chipEls.forEach((ch) => ch.addEventListener('click', () => apply(ch.dataset.filter, true)));
    const initial = new URLSearchParams(location.search).get('occasion');
    if (initial && chipEls.some((c) => c.dataset.filter === initial)) apply(initial, false);
  }

  /* ─────────────────────────── gallery page filter */

  const galleryChips = $$('[data-gallery-filter]');
  galleryChips.forEach((chip) => chip.addEventListener('click', () => {
    const tag = chip.dataset.galleryFilter;
    galleryChips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    $$('[data-group]').forEach((g) => { g.hidden = tag !== 'all' && g.dataset.group !== tag; });
    const first = $('[data-gallery]');
    if (first && first.getBoundingClientRect().top < 0) scrollTo({ top: first.getBoundingClientRect().top + scrollY - 140, behavior: calm.matches ? 'auto' : 'smooth' });
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
      if (img.animate && !calm.matches) img.animate([{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
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
    const closeLightbox = () => { if (lb.open) lb.close(); img.removeAttribute('src'); opener?.focus({ preventScroll: true }); };
    $('[data-lb-close]', lb).addEventListener('click', closeLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-figure')) closeLightbox(); });
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
      <button type="button" class="video-close" aria-label="ปิดวิดีโอ">${icon('i-close')}</button>
      <div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="วิดีโอไฮไลต์การแสดง"
        allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
      <a class="video-fallback" href="${watch}" target="_blank" rel="noopener">เปิดดูบน YouTube ↗</a>`;
    body.append(dlg);
    // tear down synchronously: the dialog's own "close" event is async, and an
    // iframe left in the DOM keeps the audio playing
    let gone = false;
    const teardown = () => {
      if (gone) return;
      gone = true;
      if (dlg.open) dlg.close();
      dlg.remove();
      btn.focus({ preventScroll: true });
    };
    $('.video-close', dlg).addEventListener('click', teardown);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) teardown(); });
    dlg.addEventListener('close', teardown);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else window.open(watch, '_blank', 'noopener');
  }));

  /* ─────────────────────────── contact page: shortlist panel */

  const panel = $('[data-shortlist-panel]');
  function renderPanel(list) {
    if (!panel) return;
    if (!list.length) {
      panel.innerHTML = '<p class="empty">ยังไม่ได้เลือกโชว์ — <a href="/shows/">ดูรูปแบบการแสดง</a> แล้วกด “เลือก” หรือข้ามขั้นนี้ไปเล่ารายละเอียดงานได้เลย</p>';
      return;
    }
    panel.innerHTML = itemRows(summary(list).items) + totalRow(summary(list));
  }
  panel?.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { writeList(readList().filter((s) => s !== rm.dataset.remove)); paint(); }
    if (e.target.closest('[data-clear]')) { writeList([]); paint(); }
  });

  /* ─────────────────────────── contact page: message composer & stepper */

  const form = $('[data-quote-form]');
  const output = $('[data-quote-output]');
  const message = $('[data-quote-message]');
  const stepper = $('[data-stepper]');

  const setStep = (n) => {
    if (!stepper) return;
    $$('li', stepper).forEach((li, i) => {
      li.classList.toggle('is-active', i + 1 === n);
      li.classList.toggle('is-done', i + 1 < n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  };
  $$('[data-step]').forEach((p) => {
    p.addEventListener('focusin', () => {
      $$('[data-step]').forEach((x) => x.classList.toggle('is-focus', x === p));
      setStep(Number(p.dataset.step));
    });
  });

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    try {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  };

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    return isNaN(d) ? value : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const composeMessage = (data) => {
    const { items, total, approx } = summary(readList());
    const lines = ['สวัสดีครับ สนใจจองการแสดงของ Velin Magic', ''];
    if (items.length) {
      lines.push('โชว์ที่สนใจ:');
      items.forEach((s) => lines.push(`• ${s.th} — ${s.from ? 'เริ่มต้น ' : ''}${baht(s.price)}`));
      lines.push(`รวมประมาณ ${baht(total)}${approx ? ' (ราคาประเมิน)' : ''}`, '');
    }
    const rows = [
      ['ชื่อ', data.get('name')], ['เบอร์โทร', data.get('phone')], ['วันที่จัดงาน', formatDate(data.get('date'))],
      ['ประเภทงาน', data.get('occasion')], ['สถานที่', data.get('place')], ['จำนวนผู้ชม', data.get('guests') && data.get('guests') + ' คน'],
      ['รายละเอียด', data.get('details')],
    ];
    rows.forEach(([k, v]) => { if (v && String(v).trim()) lines.push(`${k}: ${String(v).trim()}`); });
    return lines.join('\n');
  };

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
    setStep(3);
    output.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' });
    output.focus({ preventScroll: true });
  });

  // editing after generating means the message on screen is stale
  form?.addEventListener('input', (e) => {
    if (e.target.closest('.field')?.classList.contains('has-error')) setError(e.target, '');
    if (output && !output.hidden) { output.hidden = true; setStep(2); }
  });

  $('[data-copy]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ok = await copyText(message.value);
    btn.textContent = ok ? 'คัดลอกแล้ว ✓' : 'คัดลอกไม่สำเร็จ — กดค้างที่ข้อความเพื่อคัดลอก';
  });
  $('[data-copy-open]')?.addEventListener('click', async () => {
    // the link still opens LINE even if copying is refused
    const ok = await copyText(message.value);
    showToast(ok ? '<span>คัดลอกข้อความแล้ว วางในแชท LINE ได้เลย</span>' : '<span>คัดลอกไม่สำเร็จ — คัดลอกข้อความด้วยตนเอง</span>');
  });

  paint();
})();
