/* ═══════════════════════════════════════════════════════════
   VELIN MAGIC — behaviour
   Nav · scroll-spy · reveal · stat counters · image slots · form
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─────────────── mobile nav ─────────────── */

  var nav = document.getElementById('nav');
  var burger = document.getElementById('nav-burger');
  var links = document.getElementById('nav-links');

  function closeMenu() {
    links.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'เปิดเมนู');
  }

  burger.addEventListener('click', function () {
    var open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
  });

  links.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && links.classList.contains('is-open')) {
      closeMenu();
      burger.focus();
    }
  });

  /* ───────── nav: night over the hero, paper past it ───────── */

  var hero = document.querySelector('.hero');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      /* switch the moment the hero's dark ground leaves the bar */
      var threshold = hero ? hero.offsetHeight - nav.offsetHeight : 40;
      nav.classList.toggle('is-light', window.scrollY > threshold);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ─────────────── scroll-spy ─────────────── */

  var navAnchors = Array.prototype.slice.call(links.querySelectorAll('a[href^="#"]'));
  var sections = navAnchors
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navAnchors.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ─────────────── reveal on scroll ─────────────── */

  var revealables = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        entry.target.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    revealables.forEach(function (el) { revealer.observe(el); });
  }

  /* ─────────────── stat counters ─────────────── */

  var stats = document.querySelectorAll('[data-count-to]');

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    var suffix = el.getAttribute('data-count-suffix') || '';
    if (isNaN(target)) return;

    var duration = 1100;
    var start = null;

    function step(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var counter = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    stats.forEach(function (el) { counter.observe(el); });
  }

  /* ═══════════════════════════════════════════════════════
     IMAGE SLOTS
     Drop or click to fill; kept per-browser in localStorage.
     Mirrors the <image-slot> behaviour from the design file.
     ═══════════════════════════════════════════════════════ */

  var STORE_PREFIX = 'velin:slot:';
  var MAX_BYTES = 4 * 1024 * 1024;   // 4 MB per image
  var MAX_EDGE = 1600;               // downscale before storing

  function readStore(key) {
    try { return localStorage.getItem(STORE_PREFIX + key); }
    catch (err) { return null; }
  }

  function writeStore(key, value) {
    try {
      if (value === null) localStorage.removeItem(STORE_PREFIX + key);
      else localStorage.setItem(STORE_PREFIX + key, value);
    } catch (err) {
      /* quota or blocked storage — the image still shows for this session */
    }
  }

  /* Downscale to keep localStorage within quota. */
  function toDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read failed')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode failed')); };
        img.onload = function () {
          var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          if (scale === 1 && String(reader.result).length < MAX_BYTES) {
            resolve(String(reader.result));
            return;
          }
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function buildSlot(root) {
    var key = root.getAttribute('data-slot');
    var caption = root.getAttribute('data-placeholder') || 'วางรูปภาพที่นี่';

    var img = document.createElement('img');
    img.className = 'img-slot__img';
    img.alt = caption;

    var empty = document.createElement('div');
    empty.className = 'img-slot__empty';
    empty.innerHTML =
      '<span class="img-slot__icon" aria-hidden="true">✦</span>' +
      '<span class="img-slot__caption"></span>' +
      '<span class="img-slot__hint">คลิกหรือลากรูปมาวาง</span>';
    empty.querySelector('.img-slot__caption').textContent = caption;

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'img-slot__clear';
    clear.textContent = 'ลบรูป';

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;

    root.append(img, empty, clear, input);

    root.setAttribute('role', 'button');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-label', caption + ' — คลิกเพื่อเลือกรูปภาพ');

    function fill(dataURL, persist) {
      img.src = dataURL;
      root.classList.add('is-filled');
      if (persist) writeStore(key, dataURL);
    }

    function empties() {
      img.removeAttribute('src');
      root.classList.remove('is-filled');
      writeStore(key, null);
    }

    function accept(file) {
      if (!file || !/^image\//.test(file.type)) return;
      toDataURL(file).then(function (url) { fill(url, true); }).catch(function () {});
    }

    /* restore */
    var saved = readStore(key);
    if (saved) fill(saved, false);

    /* click / keyboard */
    root.addEventListener('click', function (e) {
      if (e.target === clear) return;
      input.click();
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });

    input.addEventListener('change', function () {
      accept(input.files && input.files[0]);
      input.value = '';
    });

    clear.addEventListener('click', function (e) {
      e.stopPropagation();
      empties();
    });

    /* drag & drop */
    ['dragenter', 'dragover'].forEach(function (type) {
      root.addEventListener(type, function (e) {
        e.preventDefault();
        root.classList.add('is-over');
      });
    });
    ['dragleave', 'dragend'].forEach(function (type) {
      root.addEventListener(type, function () { root.classList.remove('is-over'); });
    });
    root.addEventListener('drop', function (e) {
      e.preventDefault();
      root.classList.remove('is-over');
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) accept(dt.files[0]);
    });
  }

  document.querySelectorAll('.img-slot').forEach(buildSlot);

  /* the page-level default drag handler would otherwise open the file */
  ['dragover', 'drop'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (!e.target.closest || !e.target.closest('.img-slot')) return;
      e.preventDefault();
    });
  });

  /* ═══════════════════════════════════════════════════════
     QUOTE FORM
     ═══════════════════════════════════════════════════════ */

  var form = document.getElementById('quote-form');
  var status = document.getElementById('quote-status');
  var formatsInput = document.getElementById('quote-formats');
  var chips = Array.prototype.slice.call(form.querySelectorAll('.chip'));

  function syncFormats() {
    formatsInput.value = chips
      .filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; })
      .map(function (c) { return c.getAttribute('data-value'); })
      .join(', ');
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!on));
      syncFormats();
    });
  });

  function setError(field, message) {
    var wrap = field.closest('.field');
    var slot = wrap.querySelector('[data-error]');
    wrap.classList.toggle('is-invalid', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (slot) slot.textContent = message || '';
  }

  function validate() {
    var ok = true;
    var name = form.elements.name;
    var phone = form.elements.phone;

    if (!name.value.trim()) {
      setError(name, 'กรุณากรอกชื่อผู้ติดต่อ');
      ok = false;
    } else {
      setError(name, '');
    }

    var digits = phone.value.replace(/\D/g, '');
    if (digits.length < 9) {
      setError(phone, 'กรุณากรอกเบอร์ติดต่อให้ถูกต้อง');
      ok = false;
    } else {
      setError(phone, '');
    }

    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.classList.remove('is-error');

    if (!validate()) {
      status.textContent = 'กรุณาตรวจสอบข้อมูลที่กรอกอีกครั้ง';
      status.classList.add('is-error');
      var firstBad = form.querySelector('.field.is-invalid input');
      if (firstBad) firstBad.focus();
      return;
    }

    syncFormats();

    // Prepare an enquiry locally. The visitor sends it via LINE explicitly.
    var d = new FormData(form);
    var body = [
      'ชื่อผู้ติดต่อ: ' + (d.get('name') || '-'),
      'เบอร์ติดต่อ: ' + (d.get('phone') || '-'),
      'วันที่จัดงาน: ' + (d.get('date') || '-'),
      'จำนวนผู้ชม: ' + (d.get('guests') || '-'),
      'รูปแบบการแสดง: ' + (d.get('formats') || '-'),
      '',
      'รายละเอียดเพิ่มเติม:',
      (d.get('details') || '-')
    ].join('\n');

    var message = document.getElementById('quote-message');
    message.value = 'สนใจจองการแสดงของ Velin Magic\n\n' + body;
    document.getElementById('quote-handoff').hidden = false;
    status.textContent = 'ข้อความพร้อมแล้ว กรุณาคัดลอกและส่งใน LINE — ยังไม่มีการส่งข้อมูล';
    message.focus();
    message.select();
  });

  document.getElementById('quote-copy').addEventListener('click', function () {
    var message = document.getElementById('quote-message');
    function manual() {
      message.focus(); message.select();
      status.textContent = 'เลือกข้อความไว้แล้ว กรุณาคัดลอกด้วยตนเอง แล้วนำไปวางใน LINE';
    }
    if (!navigator.clipboard) { manual(); return; }
    navigator.clipboard.writeText(message.value).then(function () {
      status.textContent = 'คัดลอกแล้ว เปิด LINE แล้ววางข้อความเพื่อส่งให้ Velin';
    }).catch(manual);
  });

  syncFormats();
})();
