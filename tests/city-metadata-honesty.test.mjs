import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// City pages may only promise what they show: no fee language without shown
// fees, no comparison language without listed providers, and every stated
// provider count equals the provider profiles the page actually links.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'public_site');
const origin = 'https://antique-appraiser-directory.appraisily.com';
const sitemap = fs.readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
const profiles = new Set(urls.filter((route) => /^\/appraiser\/[^/]+\/$/.test(route)));
const cities = urls.filter((route) => /^\/location\/[^/]+\/$/.test(route));
const guides = urls.filter((route) => /^\/location\/[^/]+\/appraisal-guide\/$/.test(route));
// Measured choice pilot (todo directory-choice-day28-20261026): untouched until its read.
const PILOT_HOLD = new Set(['/location/chicago/', '/location/baltimore/']);
// Comparison wording whose owner is a page script, not the HTML: an open
// editorial decision, listed in the honest-titles README. Nothing else is exempt.
const COMPARE_OWNED_BY_SCRIPT = new Set([
  '/location/new-orleans/', // gsc-priority-directory-refresh-20260809.js, pinned by tests/gsc-priority-directory-refresh.test.mjs
  '/location/des-moines/', // its own inline title script; left alone by request
]);

function load(route) {
  const dom = new JSDOM(fs.readFileSync(path.join(publicRoot, route, 'index.html'), 'utf8'), { url: `${origin}${route}` });
  return dom;
}

function cityFacts(document) {
  const root = document.getElementById('root');
  const linked = new Set([...root.querySelectorAll('a[href]')]
    .map((link) => new URL(link.getAttribute('href'), origin))
    .filter((url) => url.origin === origin && profiles.has(url.pathname))
    .map((url) => url.pathname));
  const specialists = root.querySelectorAll('[data-gtm-surface="fine_art_specialist"]').length;
  const clone = root.cloneNode(true);
  clone.querySelectorAll('script, style').forEach((node) => node.remove());
  const text = clone.textContent.replace(/\s+/g, ' ');
  return { profiles: linked.size, providers: linked.size + specialists, showsFees: /\$\s?\d/.test(text), text };
}

function metadata(document) {
  const values = [document.title];
  for (const node of document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"], meta[property="twitter:title"], meta[property="twitter:description"]')) {
    values.push(node.getAttribute('content'));
  }
  const schema = [];
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    for (const item of [].concat(JSON.parse(node.textContent))) {
      if (['Service', 'ItemList', 'WebPage', 'CollectionPage'].includes(item['@type'])) {
        values.push(item.name, item.description);
        schema.push(item);
      }
    }
  }
  return { text: values.filter(Boolean).join(' \n '), schema };
}

const countOf = (word) => (word === 'no' ? 0 : Number(word));

test('city metadata promises only what the page shows, and stated counts match linked profiles', () => {
  assert.equal(cities.length, 86);
  const failures = [];
  for (const route of cities) {
    if (PILOT_HOLD.has(route)) continue;
    const dom = load(route);
    try {
      const document = dom.window.document;
      const facts = cityFacts(document);
      const meta = metadata(document);
      const fail = (detail) => failures.push(`${route}: ${detail}`);
      if (!facts.showsFees && /\bfees?\b|\bpric(?:e|es|ing)\b|\bcosts?\b/i.test(meta.text)) fail('metadata promises fees the page does not show');
      if (!facts.providers && !COMPARE_OWNED_BY_SCRIPT.has(route) && /\bcompar(?:e|es|ing|ison)\b/i.test(meta.text)) fail('metadata promises comparison with no listed provider');
      if (/\bcertified\b/i.test(meta.text) || meta.schema.some((item) => [].concat(item.keywords || []).some((keyword) => /certified/i.test(keyword)))) fail('metadata claims certification');
      const stated = [
        ...[...meta.text.matchAll(/\b(\d+) (?:antique (?:and art )?appraiser )?listings?\b/gi)].map((match) => Number(match[1])),
        ...[...facts.text.matchAll(/(?:Directory profiles|Listed providers) \((\d+)\)/g)].map((match) => Number(match[1])),
        ...[...facts.text.matchAll(/This page (?:currently )?lists (\d+|no) (?:local )?provider/g)].map((match) => countOf(match[1])),
        ...meta.schema.filter((item) => item['@type'] === 'ItemList' && 'numberOfItems' in item).map((item) => item.numberOfItems),
      ];
      for (const count of stated) if (count !== facts.profiles) fail(`states ${count} providers, links ${facts.profiles}`);
      if (/\(\d+ verified, \d+ listed\)/.test(facts.text)) fail('in-body verified/listed count');
      if (facts.profiles && /\bno local (?:antique )?listings? yet\b/i.test(meta.text)) fail('metadata says no local listing on a page that links one');
    } finally {
      dom.window.close();
    }
  }
  assert.deepEqual(failures, [], `${failures.length} dishonest city statements:\n${failures.slice(0, 15).join('\n')}`);
});

test('city guides state the provider count their city page actually links', () => {
  assert.equal(guides.length, 87);
  // Some guides belong to city documents outside the sitemap; count those too.
  const cityCount = (route) => {
    const dom = load(route);
    try { return cityFacts(dom.window.document).profiles; } finally { dom.window.close(); }
  };
  const failures = [];
  for (const route of guides) {
    const html = fs.readFileSync(path.join(publicRoot, route, 'index.html'), 'utf8');
    const city = route.replace(/appraisal-guide\/$/, '');
    for (const match of html.matchAll(/currently lists <a [^>]*>(\d+|no) provider[^<]*<\/a>/g)) {
      const linked = cityCount(city);
      if (countOf(match[1]) !== linked) failures.push(`${route}: states ${match[1]}, city links ${linked}`);
    }
    if (/currently lists <a [^>]*>\d+ providers?<\/a> with \d+ verified profiles/.test(html)) failures.push(`${route}: verified-profile claim`);
  }
  assert.deepEqual(failures, [], `${failures.length} guide count mismatches:\n${failures.slice(0, 10).join('\n')}`);
});

// Visible copy follows the same rules: the city hero may not promise fees the
// page does not show, or comparison without at least two listed options.
const HERO_OWNED_ELSEWHERE = new Set(['/location/denver/', '/location/des-moines/']); // left alone by request

test('city heroes promise only what the page shows', () => {
  const failures = [];
  for (const route of cities) {
    if (PILOT_HOLD.has(route) || HERO_OWNED_ELSEWHERE.has(route)) continue;
    const dom = load(route);
    try {
      const document = dom.window.document;
      const facts = cityFacts(document);
      const hero = document.querySelector('#root h1')?.nextElementSibling;
      const text = hero?.tagName === 'P' ? hero.textContent.replace(/\s+/g, ' ').trim() : '';
      if (!facts.showsFees && /\bfees?\b/i.test(text)) failures.push(`${route}: hero promises fees`);
      if (facts.providers < 2 && /\bcompar(?:e|es|ing|ison)\b/i.test(text)) failures.push(`${route}: hero promises comparison with ${facts.providers} listed`);
      if (/…$/.test(text)) failures.push(`${route}: hero is truncated`);
    } finally {
      dom.window.close();
    }
  }
  assert.deepEqual(failures, [], `${failures.length} hero promises:\n${failures.slice(0, 12).join('\n')}`);
});

test('guides for cities with no listing do not promise providers to compare', () => {
  const failures = [];
  for (const route of guides) {
    const city = route.replace(/appraisal-guide\/$/, '');
    const dom = load(city);
    let profilesLinked;
    try { profilesLinked = cityFacts(dom.window.document).profiles; } finally { dom.window.close(); }
    if (profilesLinked) continue;
    const html = fs.readFileSync(path.join(publicRoot, route, 'index.html'), 'utf8');
    if (/<h2[^>]*>\d+\) Compare providers in /.test(html)) failures.push(`${route}: "Compare providers" heading`);
    if (/Ask each provider about/.test(html)) failures.push(`${route}: "Ask each provider" with no provider listed`);
  }
  assert.deepEqual(failures, [], `${failures.length} guide promises:\n${failures.slice(0, 10).join('\n')}`);
});

test('no published page shows raw snake_case data codes as visible text', () => {
  const failures = [];
  for (const route of urls) {
    const dom = load(route);
    try {
      const root = dom.window.document.body.cloneNode(true);
      root.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
      for (const link of root.querySelectorAll('a[href]')) if (/^https?:/.test(link.textContent.trim())) link.remove();
      const codes = root.textContent.match(/(?<![\w/.@?&=%-])[a-z0-9]+(?:_[a-z0-9]+){1,}(?![\w/.@])/g) || [];
      if (codes.length) failures.push(`${route}: ${[...new Set(codes)].join(', ')}`);
    } finally {
      dom.window.close();
    }
  }
  assert.deepEqual(failures, [], `${failures.length} pages show raw codes:\n${failures.slice(0, 10).join('\n')}`);
});

test('no published guide promises a comparison heading', () => {
  const failures = guides.filter((route) =>
    /<h2[^>]*>\d+\) Compare providers in /.test(fs.readFileSync(path.join(publicRoot, route, 'index.html'), 'utf8')));
  assert.deepEqual(failures, [], `${failures.length} guides still say "Compare providers": ${failures.slice(0, 6).join(', ')}`);
});
