/* Velin: progressive enhancement. No customer data is sent or stored here. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const menu = $('.menu-toggle');
  const nav = $('#navigation');
  const desktop = matchMedia('(min-width:701px)');
  const closeMenu = () => {
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.querySelector('span').textContent = 'เมนู';
  };
  menu.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.querySelector('span').textContent = open ? 'ปิด' : 'เมนู';
  });
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('click', (event) => { if (!event.target.closest('#header')) closeMenu(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menu.focus(); }
  });
  nav.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !$('#header').contains(event.relatedTarget)) closeMenu();
  });
  desktop.addEventListener('change', () => { if (desktop.matches) closeMenu(); });

  const dialog = $('#media-dialog');
  const media = $('#media-content');
  let lastTrigger;
  let scrollStyle;
  function openMedia(trigger, title, caption) {
    lastTrigger = trigger;
    $('#media-title').textContent = title;
    $('#media-caption').textContent = caption;
    scrollStyle = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    media.replaceChildren(); // Stops playback and releases the embedded player.
    document.body.style.overflow = scrollStyle || '';
    lastTrigger?.focus({preventScroll: true});
  });
  document.querySelectorAll('.gallery-item').forEach(button => {
    button.addEventListener('click', () => {
      const source = button.querySelector('img');
      const image = new Image();
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      media.replaceChildren(image);
      openMedia(button, 'จากคลังการแสดง', button.dataset.caption);
    });
  });
  document.querySelectorAll('.film-trigger').forEach(button => {
    button.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/xO9P8aOmR5c?autoplay=1';
      iframe.title = 'วิดีโอไฮไลต์การแสดงจาก Untitled Magic';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      const fallback = document.createElement('a');
      fallback.href = 'https://www.youtube.com/watch?v=xO9P8aOmR5c';
      fallback.target = '_blank';
      fallback.rel = 'noopener noreferrer';
      fallback.className = 'video-fallback';
      fallback.textContent = 'หากเล่นไม่ได้ เปิดวิดีโอบน YouTube ↗';
      media.replaceChildren(iframe, fallback);
      openMedia(button, 'The performance / ไฮไลต์การแสดง', 'บันทึกจากผลงานภายใต้ชื่อ Untitled Magic');
    });
  });

  $('#year').textContent = new Date().getFullYear();
  const form = $('#booking-form');
  if (!form) return;
  const show = $('#show-choice');
  const status = $('#form-status');
  const message = $('#booking-message');
  const result = $('#booking-result');
  const name = form.elements.namedItem('name');
  const phone = form.elements.namedItem('phone');
  const date = form.elements.namedItem('date');
  const now = new Date();
  const localDate = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  date.min = localDate;
  const requested = new Set((new URLSearchParams(location.search).get('shows') || '').split(','));
  const selected = Array.from(show.options).filter(option => requested.has(option.dataset.slug));
  if (selected.length === 1) show.value = selected[0].value;
  if (selected.length > 1) {
    $('#selected-shows').hidden = false;
    $('#single-show-label').hidden = true;
    selected.forEach(option => {
      const item = document.createElement('li');
      item.textContent = option.textContent;
      $('#selected-show-list').append(item);
    });
  }
  function invalidateResult() { result.hidden = true; status.textContent = ''; }
  document.querySelectorAll('.show-select').forEach(link => {
    link.addEventListener('click', () => { show.value = link.dataset.show; invalidateResult(); });
  });
  form.addEventListener('input', (event) => {
    if (event.target === message) return;
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    invalidateResult();
  });
  form.addEventListener('change', (event) => { if (event.target !== message) invalidateResult(); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const digits = phone.value.replace(/\D/g, '');
    name.setCustomValidity(name.value.trim() ? '' : 'กรุณากรอกชื่อผู้ติดต่อ');
    phone.setCustomValidity(digits.length >= 9 && digits.length <= 15 ? '' : 'กรุณากรอกเบอร์โทรศัพท์ 9–15 หลัก');
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    let dateLabel = 'ยังไม่กำหนด';
    if (data.get('date')) dateLabel = new Intl.DateTimeFormat('th-TH', {dateStyle:'long'}).format(new Date(data.get('date')+'T12:00:00'));
    message.value = [
      'สนใจจองการแสดงของ Velin Magic',
      '',
      'ชื่อ: '+name.value.trim(),
      'เบอร์โทรศัพท์: '+phone.value.trim(),
      'วันจัดงาน: '+dateLabel,
      'ผู้ชมโดยประมาณ: '+(data.get('guests') || 'ยังไม่กำหนด'),
      'การแสดง: '+(selected.length > 1 ? selected.map(option => option.value).join(', ') : show.value),
      'รายละเอียด: '+(String(data.get('details')).trim() || 'ขอคำแนะนำเพิ่มเติม')
    ].join('\n');
    result.hidden = false;
    status.textContent = 'ข้อความพร้อมแล้ว คัดลอกแล้วนำไปส่งใน LINE เพื่อเริ่มคุยรายละเอียด';
    message.focus();
  });
  $('#copy-message').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'คัดลอกแล้ว เปิด LINE แล้ววางข้อความได้เลย — ยังไม่มีการส่งจากหน้านี้';
    } catch {
      message.focus(); message.select();
      status.textContent = 'กรุณาคัดลอกข้อความที่เลือกไว้ด้วยตนเอง แล้วนำไปวางใน LINE';
    }
  });
})();
