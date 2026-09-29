/* Local filtering only. Click collection belongs to directory_static_bootstrap. */
(() => {
  const root = document.querySelector('[data-directory-browse]');
  if (!root) return;
  const query = root.querySelector('[data-browse-query]');
  const facet = root.querySelector('[data-browse-facet]');
  const reset = root.querySelector('[data-browse-reset]');
  const count = root.querySelector('[data-browse-count]');
  const empty = root.querySelector('[data-browse-empty]');
  const items = [...root.querySelectorAll('[data-browse-item]')];
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function apply() {
    const terms = normalize(query.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const haystack = normalize(item.dataset.browseSearch);
      const match = terms.every((term) => haystack.includes(term)) &&
        (!facet || !facet.value || item.dataset.browseFacet === facet.value);
      item.hidden = !match;
      if (match) shown += 1;
    }
    for (const group of root.querySelectorAll('[data-browse-group]')) {
      group.hidden = ![...group.querySelectorAll('[data-browse-item]')].some((item) => !item.hidden);
    }
    count.textContent = 'Showing ' + shown + ' of ' + items.length + ' ' + root.dataset.directoryBrowse;
    empty.hidden = shown > 0;
  }
  query.addEventListener('input', apply);
  facet?.addEventListener('change', apply);
  reset.addEventListener('click', () => {
    query.value = '';
    if (facet) facet.value = '';
    apply();
    query.focus();
  });
  root.querySelector('[data-browse-controls]').hidden = false;
  apply();
})();
