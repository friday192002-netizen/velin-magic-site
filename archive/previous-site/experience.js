(function () {
  'use strict';
  var play = document.querySelector('.film-play');
  if (play) play.addEventListener('click', function () {
    var frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/xO9P8aOmR5c?autoplay=1';
    frame.title = 'ไฮไลต์การแสดงจาก Untitled Magic';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    document.getElementById('film-player').replaceChildren(frame);
    frame.focus();
  });
  var dialog = document.getElementById('show-dialog');
  var selected = '';
  var trigger;
  var previousOverflow;
  var preparation = [
    'ขนาดเวที จำนวนผู้ชม เวลาแสดง และระบบแสงเสียงของสถานที่ เพื่อจัดจังหวะโชว์ให้เหมาะกับงาน',
    'จำนวนแขก รูปแบบโต๊ะ และช่วงเวลาที่ต้องการให้เข้าถึงผู้ชม เพื่อจัดลำดับการเดินแสดง',
    'ธีมงาน สิ่งที่อยากสื่อสาร และช่วงสำคัญของกิจกรรม เพื่อร่วมออกแบบแนวทางการแสดง',
    'ประเภทงาน สถานที่ กำหนดการ และผู้ประสานงาน เพื่อวางการแสดงให้เข้ากับภาพรวม'
  ];
  document.querySelectorAll('.show-card').forEach(function (card, index) {
    var button = card.querySelector('.show-details-button');
    button.addEventListener('click', function () {
      selected = card.querySelector('.show-card__th').textContent;
      trigger = button;
      document.getElementById('show-dialog-title').textContent = selected;
      document.getElementById('show-dialog-category').textContent = card.querySelector('.show-card__en').textContent;
      document.getElementById('show-dialog-description').textContent = card.querySelector('.show-card__desc').textContent;
      document.getElementById('show-dialog-preparation').textContent = preparation[index];
      previousOverflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
  });
  dialog.querySelector('.show-dialog__close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) { var r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close(); } });
  dialog.addEventListener('close', function () {
    document.body.style.overflow = previousOverflow || '';
    if (trigger) trigger.focus({preventScroll:true});
  });
  dialog.querySelector('.show-dialog__book').addEventListener('click', function () {
    document.querySelectorAll('#quote-form .chip').forEach(function (chip) {
      if (chip.getAttribute('data-value') === selected && chip.getAttribute('aria-pressed') !== 'true') chip.click();
    });
    dialog.close();
    requestAnimationFrame(function () {
      document.getElementById('contact').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      document.querySelector('#quote-form input[name="name"]').focus({preventScroll:true});
    });
  });
})();
