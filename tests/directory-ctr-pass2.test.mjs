import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { applyMetadata, loadExclusions, planPages, sitemapCitySlugs } from '../scripts/apply-directory-metadata-pass2.mjs';
import { CITY_TITLE_PREFIX, CUSTOM_TITLE_KEEP_MAX, DESCRIPTION_MAX, TITLE_MAX } from '../scripts/lib/directory-metadata.mjs';
import { cityPageFacts, readSitemapProfiles } from '../scripts/lib/city-page-facts.mjs';
import { HELD_CITY_SLUGS, injectCityHtml, localCardState } from '../scripts/inject-directory-intent-chooser.mjs';

// CTR pass 2 (2026-11-11): city and hub metadata from the builder, held pages
// untouched, and the two dead-click fixes.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(repoRoot, 'public_site');
const read = (relative) => fs.readFileSync(path.join(publicDir, relative), 'utf8');
const doc = (relative) => new JSDOM(read(relative)).window.document;
const pages = planPages(publicDir);
const profiles = readSitemapProfiles(publicDir);

test('every in-scope page carries the builder metadata in all its copies', () => {
  const inScope = pages.filter((page) => !page.excluded);
  assert.ok(inScope.length >= 70, `only ${inScope.length} pages in scope`);
  const failures = [];
  for (const page of inScope) {
    const html = fs.readFileSync(page.file, 'utf8');
    if (applyMetadata(html, page.next) !== html) failures.push(`${page.route}: differs from the builder`);
    const document = new JSDOM(html).window.document;
    const meta = (selector) => document.querySelector(selector)?.getAttribute('content');
    if (document.title !== page.next.title) failures.push(`${page.route}: title`);
    if (meta('meta[name="description"]') !== page.next.description) failures.push(`${page.route}: description`);
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[property="twitter:title"]']) {
      const value = meta(selector);
      if (value != null && value !== page.next.title) failures.push(`${page.route}: ${selector}`);
    }
    for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]', 'meta[property="twitter:description"]']) {
      const value = meta(selector);
      if (value != null && value !== page.next.description) failures.push(`${page.route}: ${selector}`);
    }
  }
  assert.deepEqual(failures, [], failures.slice(0, 15).join('\n'));
});

test('titles and descriptions stay within the length Google shows', () => {
  const failures = [];
  for (const page of pages.filter((entry) => !entry.excluded)) {
    const { title, description } = page.next;
    const max = title.startsWith(CITY_TITLE_PREFIX) || !page.route.startsWith('/location/') ? TITLE_MAX : CUSTOM_TITLE_KEEP_MAX;
    if (title.length > max) failures.push(`${page.route}: title ${title.length} > ${max}`);
    if (description.length > DESCRIPTION_MAX) failures.push(`${page.route}: description ${description.length}`);
    if (/…$/.test(description)) failures.push(`${page.route}: truncated description`);
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('stated counts come from the page: linked profiles and listed specialists', () => {
  const failures = [];
  for (const page of pages.filter((entry) => !entry.excluded && entry.route.startsWith('/location/'))) {
    const facts = cityPageFacts(fs.readFileSync(page.file, 'utf8'), profiles, page.route);
    const text = `${page.next.title} ${page.next.description}`;
    for (const match of text.matchAll(/\b(\d+) (?:Listings?|antique and art appraiser listings?)\b/g)) {
      if (Number(match[1]) !== facts.listings) failures.push(`${page.route}: states ${match[1]} listings, links ${facts.listings}`);
    }
    for (const match of text.matchAll(/\b(\d+) (?:listed )?fine-art specialists?\b/g)) {
      if (Number(match[1]) !== facts.specialists) failures.push(`${page.route}: states ${match[1]} specialists, lists ${facts.specialists}`);
    }
    if (facts.listings > 0 && /no local listings yet/i.test(text)) failures.push(`${page.route}: says no listings but links ${facts.listings}`);
    if (facts.listings === 0 && facts.specialists === 0 && /^\d/.test(page.next.description) && page.next.description !== page.current.description) failures.push(`${page.route}: count lead on a page without listings`);
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('hubs state the counts they show', () => {
  const art = pages.find((page) => page.route === '/art-appraisers-near-me/');
  const shown = doc('art-appraisers-near-me/index.html');
  const reviewed = [...shown.querySelectorAll('section')].find((section) => section.querySelector('h2')?.textContent.trim() === 'Reviewed fine-art specialists');
  const count = reviewed.querySelectorAll('.city-card').length;
  assert.ok(count >= 2);
  assert.equal(shown.title, `Art Appraisers Near Me: ${count} Reviewed Fine-Art Specialists`);
  assert.equal(art.next.title, shown.title);
  assert.match(doc('antique-appraisers-near-me/index.html').title, /^Antique Appraisers Near Me: Local Options & Free Photo Check$/);
});

test('exclusions are data with a source and an end, and those pages are left alone', () => {
  const exclusions = loadExclusions();
  const sitemapSlugs = new Set(sitemapCitySlugs(publicDir));
  for (const [slug, entry] of exclusions) {
    assert.ok(entry.reason && entry.source && entry.until, `${slug} needs reason, source and until`);
    assert.ok(fs.existsSync(path.join(publicDir, 'location', slug, 'index.html')), `${slug} page exists`);
    const page = pages.find((candidate) => candidate.route === `/location/${slug}/`);
    if (sitemapSlugs.has(slug)) assert.ok(page?.excluded, `${slug} is planned as excluded`);
  }
  for (const slug of ['chicago', 'baltimore']) assert.ok(exclusions.has(slug), `${slug} pilot hold`);
  assert.equal(doc('location/chicago/index.html').title, 'Chicago Antique Appraisers Near You | Signed Online Reports');
  assert.equal(doc('location/baltimore/index.html').title, 'Baltimore Antique Appraisers | Maryland Furniture Appraisal');
});

test('dead-click fix 1: each browse card is one link, styled to cover the whole card', () => {
  const css = read('assets/directory-browse-v2.css');
  assert.match(css, /\.browse-list li \{ position:relative;/);
  assert.match(css, /\.browse-list li a::after \{ content:""; position:absolute; inset:0;/);
  assert.ok(read('assets/directory-browse-v1.css').length > 0, 'v1 stays for cached HTML');
  for (const hub of ['location/index.html', 'appraiser/index.html']) {
    const html = read(hub);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/directory-browse-v2\.css">/, `${hub} uses v2`);
    assert.doesNotMatch(html, /directory-browse-v1\.css/, `${hub} drops v1`);
    const items = [...new JSDOM(html).window.document.querySelectorAll('.browse-list li')];
    assert.ok(items.length > 50, `${hub} has browse cards`);
    const bad = items.filter((li) => li.querySelectorAll('a[href], button, input, select').length !== 1);
    assert.deepEqual(bad.map((li) => li.textContent.trim().slice(0, 40)), [], `${hub}: a stretched link needs exactly one control per card`);
  }
});

test('dead-click fix 2: the chooser local card never jumps to an empty listings box', () => {
  const failures = [];
  for (const slug of fs.readdirSync(path.join(publicDir, 'location'))) {
    const file = path.join(publicDir, 'location', slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const document = new JSDOM(html).window.document;
    const card = document.querySelector('[data-appraisily-directory-intent-chooser] a[data-cta-kind="local_specialist"]');
    if (!card) continue;
    const href = card.getAttribute('href');
    if (HELD_CITY_SLUGS.has(slug)) continue; // held pages keep their earlier card
    const facts = cityPageFacts(html, profiles, `/location/${slug}/`);
    const expected = localCardState(slug, facts);
    const target = { none: '/location/', specialists: '#fine-art-specialists', listings: '#local-appraisers' }[expected];
    if (href !== target) failures.push(`${slug}: ${href}, expected ${target}`);
    if (href.startsWith('#') && !document.getElementById(href.slice(1))) failures.push(`${slug}: ${href} has no target`);
    if (facts.listings === 0 && /Compare current/.test(card.textContent)) failures.push(`${slug}: promises listings to compare`);
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('localCardState follows the page counts and keeps held pages unchanged', () => {
  assert.equal(localCardState('kitchener', { listings: 0, specialists: 0 }), 'none');
  assert.equal(localCardState('boston', { listings: 0, specialists: 1 }), 'specialists');
  assert.equal(localCardState('calgary', { listings: 1, specialists: 0 }), 'listings');
  assert.equal(localCardState('anywhere', { listings: null, specialists: null }), 'listings');
  assert.equal(localCardState('indianapolis', { listings: 0, specialists: 0 }), 'none', 'reviewed zero route');
  assert.equal(localCardState('new-orleans', { listings: 0, specialists: 0 }), 'listings', 'held page keeps its card');

  const page = (body) => `<!doctype html><html><head><script type="application/ld+json">{"@type":"Service","name":"Antique & Art Appraisers in Testville, Ohio","areaServed":{"@type":"City","name":"Testville","address":{"addressLocality":"Testville","addressRegion":"OH"}}}</script></head><body><div id="root">${body}</div><section data-appraisily-donation-purpose-bridge="1"></section><section id="local-appraisers"></section></body></html>`;
  const empty = injectCityHtml(page(''), 'testville', new Set());
  assert.match(empty, /href="\/location\/"[^>]*data-cta-kind="local_specialist"/);
  assert.match(empty, /Browse published locations/);
  const listed = injectCityHtml(page('<a href="/appraiser/x/">X</a>'), 'testville', new Set(['/appraiser/x/']));
  assert.match(listed, /href="#local-appraisers"[^>]*data-cta-kind="local_specialist"/);
  assert.match(listed, /Compare current Testville listings/);
});
