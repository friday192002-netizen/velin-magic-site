/* Filter progressively enhanced HTML; persist show IDs only, never customer data. */
(() => {
  'use strict';
  const catalog = document.querySelector('#show-catalog');
  if (!catalog) return;
  const cards = [...catalog.querySelectorAll('.catalog-card')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const choices = [...catalog.querySelectorAll('[name="shortlist"]')];
  const key = 'velin-show-shortlist-v1';
  const valid = new Set(choices.map(input => input.value));
  let selection = new Set();
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) selection = new Set(saved.filter(id => valid.has(id)));
  } catch { /* Private mode or disabled storage: this page still works. */ }

  function filter(value, updateURL = false) {
    const active = filters.some(button => button.dataset.filter === value) ? value : 'all';
    let count = 0;
    cards.forEach(card => {
      card.hidden = active !== 'all' && !card.dataset.tags.split(' ').includes(active);
      if (!card.hidden) count++;
    });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === active)));
    document.querySelector('#filter-status').textContent = `${active === 'all' ? 'ทั้งหมด' : 'พบ'} ${count} รูปแบบการแสดง`;
    if (updateURL) {
      const url = new URL(location.href);
      if (active === 'all') url.searchParams.delete('occasion');
      else url.searchParams.set('occasion', active);
      history.replaceState(null, '', url);
    }
  }

  function sync() {
    choices.forEach(input => { input.checked = selection.has(input.value); });
    const names = choices.filter(input => selection.has(input.value)).map(input => input.dataset.name);
    document.querySelector('#shortlist-bar').hidden = !selection.size;
    document.body.classList.toggle('has-shortlist', !!selection.size);
    document.querySelector('#shortlist-count').textContent = `เลือกแล้ว ${selection.size} โชว์`;
    document.querySelector('#shortlist-names').textContent = names.join(' · ');
    document.querySelector('#shortlist-contact').href = '/contact/?shows=' + [...selection].join(',');
    try { sessionStorage.setItem(key, JSON.stringify([...selection])); } catch { /* Optional. */ }
  }
  filters.forEach(button => button.addEventListener('click', () => filter(button.dataset.filter, true)));
  choices.forEach(input => input.addEventListener('change', () => {
    if (input.checked) selection.add(input.value);
    else selection.delete(input.value);
    sync();
  }));
  document.querySelector('#clear-shortlist').addEventListener('click', () => { selection.clear(); sync(); });
  window.addEventListener('pageshow', () => { filter(new URLSearchParams(location.search).get('occasion')); sync(); });
  window.addEventListener('popstate', () => filter(new URLSearchParams(location.search).get('occasion')));
  filter(new URLSearchParams(location.search).get('occasion'));
  sync();
})();
