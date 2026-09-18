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
    const busy = body.classList.contains('menu-open');
    const hide = !busy && y > 420 && y > lastY + 4;
    const show = y < lastY - 4 || y < 420;
    if (hide) { header?.classList.add('is-hidden'); body.classList.add('header-hidden'); }
    else if (show) { header?.classList.remove('is-hidden'); body.classList.remove('header-hidden'); }
    if (Math.abs(y - lastY) > 4) lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─────────────────────────── floating contact button (Untitled Magic pattern) */

  const fab = $('[data-fab]');
  const fabToggle = $('[data-fab-toggle]');
  const fabPanel = $('[data-fab-panel]');
  let fabTimer;
  const setFab = (open, focus = true) => {
    if (!fab || fab.classList.contains('is-open') === open) return;
    clearTimeout(fabTimer);
    fabToggle.setAttribute('aria-expanded', String(open));
    fabToggle.setAttribute('aria-label', open ? 'ปิดช่องทางติดต่อ' : 'ติดต่อเรา');
    if (open) {
      fabPanel.hidden = false;
      void fabPanel.offsetWidth;
      fab.classList.add('is-open');
      if (focus) $('a, button', fabPanel)?.focus({ preventScroll: true });
    } else {
      fab.classList.remove('is-open');
      fabTimer = setTimeout(() => { fabPanel.hidden = true; }, calm.matches ? 0 : 420);
      if (focus && fab.contains(document.activeElement)) fabToggle.focus({ preventScroll: true });
    }
  };
  fabToggle?.addEventListener('click', () => setFab(!fab.classList.contains('is-open')));
  fabPanel?.addEventListener('click', (e) => { if (e.target.closest('a')) setFab(false, false); });
  document.addEventListener('click', (e) => { if (fab && !fab.contains(e.target)) setFab(false, false); });

  // on the home page the hero already carries the main buttons — the contact button arrives once they scroll away
  const heroActions = $('.hero-actions');
  if (fab && heroActions && 'IntersectionObserver' in window) {
    fab.classList.add('is-away');
    new IntersectionObserver(([en]) => {
      const away = en.isIntersecting || en.boundingClientRect.top > 0;
      fab.classList.toggle('is-away', away);
      if (away) setFab(false, false);
    }).observe(heroActions);
  }

  const menuButton = $('[data-menu-button]');
  const nav = $('[data-nav]');
  const setMenu = (open) => {
    menuButton?.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('is-open', open);
    body.classList.toggle('menu-open', open);
    if (open) { header?.classList.remove('is-hidden'); setFab(false, false); }
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

  // Retire the old basket; enquiries carry only an optional show in the URL.
  try { localStorage.removeItem('velin:shortlist'); } catch {}

  const toast = $('[data-toast]');
  let toastTimer;
  const showToast = (html) => {
    if (!toast) return;
    toast.innerHTML = icon('i-check') + html;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (fab?.classList.contains('is-open')) { setFab(false); return; }
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
                <a class="btn btn-gold" href="/contact/?show=${x.s.slug}">สอบถามโชว์นี้</a>
              </div>
            </div>
          </li>`).join('')}</ul>
        <div class="finder-actions">
          ${state.occasion ? `<a class="link-arrow" href="/occasions/${state.occasion}/">ไอเดียจัดโชว์สำหรับ${esc(occLabel(state.occasion))}</a>` : '<a class="link-arrow" href="/shows/">ดูทุกรูปแบบ</a>'}
        </div>`;

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

  /* ─────────────────────────── contact page: message composer & stepper */

  const form = $('[data-quote-form]');
  const enquiry = bySlug[new URLSearchParams(location.search).get('show')];
  if (form && enquiry) form.elements.show.value = enquiry.th;
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
    const lines = ['สวัสดีครับ สนใจจองการแสดงของ Velin Magic', ''];
    const rows = [
      ['โชว์ที่สนใจ', data.get('show')],
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
    setStep(2);
    output.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' });
    output.focus({ preventScroll: true });
  });

  // editing after generating means the message on screen is stale
  form?.addEventListener('input', (e) => {
    if (e.target.closest('.field')?.classList.contains('has-error')) setError(e.target, '');
    if (output && !output.hidden) { output.hidden = true; setStep(1); }
  });

  $('[data-copy]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ok = await copyText(message.value);
    btn.textContent = ok ? 'คัดลอกแล้ว' : 'คัดลอกไม่สำเร็จ — กดค้างที่ข้อความเพื่อคัดลอก';
  });
  $('[data-copy-open]')?.addEventListener('click', async () => {
    // the link still opens LINE even if copying is refused
    const ok = await copyText(message.value);
    showToast(ok ? '<span>คัดลอกข้อความแล้ว วางในแชท LINE ได้เลย</span>' : '<span>คัดลอกไม่สำเร็จ — คัดลอกข้อความด้วยตนเอง</span>');
  });

})();
