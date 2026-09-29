import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('../public_site/', import.meta.url);
const feed = JSON.parse(fs.readFileSync(new URL('appraisers.json', root))).appraisers;
const manifest = JSON.parse(fs.readFileSync(new URL('../data/provider-publication-manifest.json', import.meta.url)));
const art = manifest.summary.verified > 0;
const script = fs.readFileSync(new URL('assets/directory-browse-v1.js', root), 'utf8');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
for (const page of ['appraiser', 'location']) {
  const dom = new JSDOM(fs.readFileSync(new URL(page + '/index.html', root), 'utf8'), { runScripts: 'outside-only' });
  const d = dom.window.document;
  const rows = [...d.querySelectorAll('[data-browse-item]')];
  const expected = page === 'appraiser' ? feed.length : art ? 78 : 101;
  for (const link of d.querySelectorAll('a[data-cta-kind="signed_report"]')) {
    assert.ok(new URL(link.href).searchParams.get('utm_source'), 'Report handoffs retain an explicit source');
  }
  assert.equal(rows.length, expected);
  const urls = rows.map(row => row.querySelector('a').getAttribute('href'));
  assert.equal(new Set(urls).size, expected, 'No duplicate destinations');
  if (art && page === 'location') {
    assert.deepEqual(new Set([...d.querySelectorAll('main a[href^="/appraiser/"]')].map(a => a.getAttribute('href'))), new Set(feed.map(p => '/appraiser/' + p.slug + '/')));
  }
  for (const node of d.querySelectorAll('script[type="application/ld+json"]')) {
    const entity = JSON.parse(node.textContent).mainEntity;
    if (entity?.['@type'] === 'ItemList') assert.equal(entity.numberOfItems, entity.itemListElement.length);
  }
  for (const row of rows) {
    assert.equal(row.hidden, false, 'All results available without JavaScript');
    assert.equal(row.querySelector('a').dataset.gtmEvent, 'directory_cta');
    assert.ok(fs.existsSync(new URL(row.querySelector('a').getAttribute('href').slice(1) + 'index.html', root)));
  }
  if (page === 'appraiser') {
    assert.deepEqual(new Set(urls), new Set(feed.map(p => '/appraiser/' + p.slug + '/')));
    assert.equal(rows.filter(r => r.textContent.includes('Source-reviewed')).length, art ? 5 : 0);
    for (const p of feed) {
      const row = rows.find(r => r.querySelector('a').getAttribute('href') === '/appraiser/' + p.slug + '/');
      assert.ok(row.textContent.includes(p.address?.city || p.address?.region || 'Location not listed'));
      if (p.address?.city) assert.ok(fs.readFileSync(new URL('appraiser/' + p.slug + '/index.html', root), 'utf8').includes(p.address.city));
    }
  }
  assert.equal(d.querySelector('[data-browse-controls]').hidden, true);
  dom.window.eval(script);
  assert.equal(d.querySelector('[data-browse-controls]').hidden, false);
  const query = d.querySelector('[data-browse-query]');
  assert.ok(d.querySelector('label[for="' + query.id + '"]'));
  const search = value => { query.value = value; query.dispatchEvent(new dom.window.Event('input')); };
  const shown = () => rows.filter(r => !r.hidden);
  search('zzzz-no-such-directory-record');
  assert.equal(shown().length, 0);
  assert.equal(d.querySelector('[data-browse-empty]').hidden, false);
  d.querySelector('[data-browse-reset]').click();
  assert.equal(shown().length, expected);
  assert.equal(d.activeElement, query);
  search(page === 'location' ? 'CHICAGO' : 'boston');
  assert.ok(shown().length > 0);
  if (page === 'location') assert.equal(shown().length, 1);
  for (const row of shown()) assert.ok(normalize(row.dataset.browseSearch).includes(page === 'location' ? 'chicago' : 'boston'));
  const facet = d.querySelector('[data-browse-facet]');
  if (facet) {
    search('');
    facet.value = facet.options[1].value;
    facet.dispatchEvent(new dom.window.Event('change'));
    assert.ok(shown().length > 0);
    assert.ok(shown().every(r => r.dataset.browseFacet === facet.value));
    search('zzzz-no-match');
    assert.equal(shown().length, 0);
  }
  d.querySelector('[data-browse-reset]').click();
  assert.equal(shown().length, expected);
  assert.equal(d.querySelector('[data-browse-count]').textContent, 'Showing ' + expected + ' of ' + expected + ' ' + (page === 'location' ? 'locations' : 'profiles'));
  dom.window.close();
}
assert.doesNotMatch(script, /fetch\(|sendBeacon|dataLayer|posthog|pushState/);
console.log('Browse hubs: static inventory, labels, review states, locations, filtering, facet, reset and privacy passed.');
