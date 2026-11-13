import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { cityPageFacts, readSitemapProfiles } from '../scripts/lib/city-page-facts.mjs';
import {
  BODY_HELD_SLUGS,
  FAQ_KEEP_QUESTION,
  ROBOTS_META,
  ZERO_GUIDES,
  listingSentence,
  noindexGuideHtml,
  run,
} from '../scripts/apply-texto-repetido-20261113.mjs';

// Repeated template text, step 2 (13 Nov 2026), section A.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(repoRoot, 'public_site');
const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
const profiles = readSitemapProfiles(publicDir);
const citySlugs = fs
  .readdirSync(path.join(publicDir, 'location'))
  .filter((slug) => fs.existsSync(path.join(publicDir, 'location', slug, 'index.html')));

function load(relative) {
  return new JSDOM(fs.readFileSync(path.join(publicDir, relative), 'utf8')).window.document;
}

function faqSchemaQuestions(document) {
  const names = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    for (const item of [].concat(parsed)) {
      if (item?.['@type'] === 'FAQPage') names.push(...item.mainEntity.map((entry) => entry.name));
    }
  }
  return names;
}

function visibleFaqQuestions(document) {
  const heading = [...document.querySelectorAll('h2')].find((h2) => h2.textContent.trim() === 'Frequently asked questions');
  if (!heading) return [];
  return [...heading.closest('section').querySelectorAll('h3')].map((h3) => h3.textContent.replace(/\s+/g, ' ').trim());
}

test('the list is the 18 zero-impression guides, and none links an appraiser profile', () => {
  assert.equal(ZERO_GUIDES.length, 18);
  for (const slug of ZERO_GUIDES) {
    const document = load(`location/${slug}/appraisal-guide/index.html`);
    const appraiserLinks = [...document.querySelectorAll('a[href*="/appraiser/"]')].filter(
      (link) => !link.closest('header, nav, footer'),
    );
    assert.equal(appraiserLinks.length, 0, `${slug} guide links an appraiser`);
  }
});

test('robots meta: each listed guide is noindex,follow in the served HTML head, canonical and title kept', () => {
  for (const slug of ZERO_GUIDES) {
    const html = fs.readFileSync(path.join(publicDir, 'location', slug, 'appraisal-guide', 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    assert.equal((head.match(/<meta\s+name=["']robots["'][^>]*>/gi) || []).length, 1, slug);
    assert.ok(head.includes(ROBOTS_META), `${slug}: noindex, follow in <head>`);
    const document = new JSDOM(html).window.document;
    assert.equal(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      `${ORIGIN}/location/${slug}/appraisal-guide/`,
      `${slug}: canonical unchanged`,
    );
    assert.ok(document.title.trim().length > 10, `${slug}: title kept`);
    assert.ok(document.querySelectorAll('a[href^="/location/"]').length > 0, `${slug}: internal links kept (follow)`);
  }
});

test('robots meta: guides not on the list stay indexable', () => {
  const others = citySlugs.filter(
    (slug) => !ZERO_GUIDES.includes(slug) && fs.existsSync(path.join(publicDir, 'location', slug, 'appraisal-guide', 'index.html')),
  );
  assert.ok(others.length >= 69);
  for (const slug of others) {
    if (slug === 'houston') continue; // held state, checked by scripts/check-houston-held-state.mjs
    const html = fs.readFileSync(path.join(publicDir, 'location', slug, 'appraisal-guide', 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<meta\s+name=["']robots["'][^>]*noindex/i, `${slug} guide must stay indexable`);
  }
});

test('sitemap exclusion: the 18 guides leave sitemap.xml; the other guides and city pages stay', () => {
  for (const slug of ZERO_GUIDES) {
    assert.ok(!sitemapUrls.has(`${ORIGIN}/location/${slug}/appraisal-guide/`), `${slug} guide still in sitemap`);
    const cityHtml = fs.readFileSync(path.join(publicDir, 'location', slug, 'index.html'), 'utf8');
    const cityNoindex = /<meta\s+name=["']robots["'][^>]*noindex/i.test(cityHtml); // e.g. Hartford, noindex before this change
    assert.ok(cityNoindex || sitemapUrls.has(`${ORIGIN}/location/${slug}/`), `${slug} city page left the sitemap`);
  }
  const guidesInSitemap = [...sitemapUrls].filter((url) => url.endsWith('/appraisal-guide/'));
  assert.equal(guidesInSitemap.length, 69, '87 guides minus the 18');
  for (const url of sitemapUrls) {
    const html = fs.readFileSync(path.join(publicDir, new URL(url).pathname, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<meta\s+name=["']robots["'][^>]*noindex/i, `${url} is noindex but in the sitemap`);
  }
});

test('noindexGuideHtml adds or replaces one robots meta', () => {
  const plain = '<html><head><title>T</title></head><body></body></html>';
  assert.equal((noindexGuideHtml(plain).match(/name="robots"/g) || []).length, 1);
  const existing = '<html><head><meta name="robots" content="index, follow"></head></html>';
  assert.equal(noindexGuideHtml(existing), `<html><head>${ROBOTS_META}</head></html>`);
  assert.equal(noindexGuideHtml(noindexGuideHtml(plain)), noindexGuideHtml(plain));
});

test('city pages: two FAQ questions, visible FAQ = FAQPage JSON-LD, held pages untouched', () => {
  const failures = [];
  for (const slug of citySlugs) {
    const document = load(`location/${slug}/index.html`);
    const visible = visibleFaqQuestions(document);
    const schema = faqSchemaQuestions(document);
    if (BODY_HELD_SLUGS.has(slug)) {
      if (visible.length !== 4) failures.push(`${slug}: held page FAQ changed (${visible.length})`);
      continue;
    }
    if (visible.length !== 2) failures.push(`${slug}: ${visible.length} FAQ questions`);
    if (visible[1] !== FAQ_KEEP_QUESTION) failures.push(`${slug}: Appraisily answer missing`);
    if (JSON.stringify(visible) !== JSON.stringify(schema)) failures.push(`${slug}: FAQPage JSON-LD differs`);
    if (/What should I prepare before contacting an appraiser\?|How much does an appraisal cost in/.test(visible.join(' '))) {
      failures.push(`${slug}: generic question left`);
    }
  }
  assert.deepEqual(failures, []);
});

test('city pages: the listing answer states the counts the page shows and its nearest cities', () => {
  const failures = [];
  let checked = 0;
  for (const slug of citySlugs) {
    if (BODY_HELD_SLUGS.has(slug)) continue;
    const html = fs.readFileSync(path.join(publicDir, 'location', slug, 'index.html'), 'utf8');
    const document = new JSDOM(html).window.document;
    const h3 = [...document.querySelectorAll('h3')].find((node) => node.textContent.startsWith('Which appraisers are listed for '));
    if (!h3) continue;
    checked += 1;
    const answer = h3.nextElementSibling.textContent.trim();
    const facts = cityPageFacts(html, profiles, `/location/${slug}/`);
    if (facts.listings > 0 && !answer.startsWith(`${facts.listings} provider profile`)) failures.push(`${slug}: ${answer}`);
    if (facts.listings === 0 && !answer.startsWith('No ')) failures.push(`${slug}: ${answer}`);
    if (!/Nearest published cities: /.test(answer)) failures.push(`${slug}: no nearest cities`);
  }
  assert.ok(checked >= 80, `checked ${checked}`);
  assert.deepEqual(failures, []);
});

test('listingSentence covers listings, specialists only, none and unknown', () => {
  const near = [{ name: 'Providence, RI' }, { name: 'New York, NY' }];
  assert.match(listingSentence('Boston, MA', { listings: 2, specialists: 0 }, near), /^2 provider profiles are listed on this page for Boston, MA\. Nearest published cities: Providence, RI and New York, NY\./);
  assert.match(listingSentence('Boston, MA', { listings: 1, specialists: 1 }, near), /^1 provider profile is listed on this page for Boston, MA, plus 1 fine-art specialist\./);
  assert.match(listingSentence('Boston, MA', { listings: 0, specialists: 1 }, near), /^No antique provider profile is listed for Boston, MA yet; 1 fine-art specialist is listed\./);
  assert.match(listingSentence('Boston, MA', { listings: 0, specialists: 0 }, []), /^No provider profile is listed for Boston, MA yet\. Confirm/);
  assert.match(listingSentence('Boston, MA', null, near), /^See the listings on this page/);
});

test('city pages: short blocks keep one link of each kind; generic copy is gone', () => {
  const failures = [];
  for (const slug of citySlugs) {
    if (BODY_HELD_SLUGS.has(slug)) continue;
    const document = load(`location/${slug}/index.html`);
    const chooser = document.querySelector('[data-appraisily-directory-intent-chooser="1"]');
    const kinds = [...chooser.querySelectorAll('a[data-cta-kind]')].map((link) => link.getAttribute('data-cta-kind'));
    for (const kind of ['signed_report', 'local_specialist', 'screener', 'inherited', 'insurance', 'donation', 'sample_report']) {
      if (!kinds.includes(kind)) failures.push(`${slug}: chooser lacks ${kind}`);
    }
    if (/Use local listings when an in-person inspection/.test(chooser.textContent)) failures.push(`${slug}: long chooser copy`);
    const donation = document.querySelector('[data-appraisily-donation-purpose-bridge="1"]');
    if (!donation?.querySelector('a[href*="qualified-appraisals"]')) failures.push(`${slug}: donation link`);
    if (/fair-market-value concepts/.test(donation?.textContent || '')) failures.push(`${slug}: long donation copy`);
    const nearMe = document.querySelector('[data-appraisily-near-me-hub-bridge="1"]');
    if ((nearMe?.querySelectorAll('a[data-analytics-event="directory_near_me_bridge_click"]').length || 0) !== 3) {
      failures.push(`${slug}: near-me links`);
    }
    if (/These short decision guides explain/.test(nearMe?.textContent || '')) failures.push(`${slug}: long near-me copy`);
    const learn = document.querySelector('[data-appraisily-learn-more="compact"]');
    if (learn && learn.querySelectorAll('a[href^="https://articles.appraisily.com/"]').length < 3) failures.push(`${slug}: article links`);
    if (/want to move faster, use this short checklist/.test(document.body.textContent)) failures.push(`${slug}: long learn-more copy`);
  }
  assert.deepEqual(failures, []);
});

test('the apply script has nothing left to change (idempotent, public_site is current)', () => {
  assert.deepEqual(run({ publicDir, write: false }), []);
});
