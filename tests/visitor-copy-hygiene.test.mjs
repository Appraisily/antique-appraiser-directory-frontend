import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// Visitors see customer copy only: no internal SEO or planning notes, no empty
// "Profile unavailable" provider cards, no do-not-publish provider identities,
// and the profile button that opens Appraisily says so.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'public_site');

function walk(dir, keep) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'assets') found.push(...walk(absolute, keep));
    } else if (keep(entry.name)) {
      found.push(absolute);
    }
  }
  return found;
}

const htmlFiles = walk(publicRoot, (name) => name.endsWith('.html'));
const rel = (file) => path.relative(publicRoot, file);
const isCityPage = (file) => /^location\/[^/]+\/index\.html$/.test(rel(file));

function visibleText(html) {
  const dom = new JSDOM(html);
  try {
    const body = dom.window.document.body;
    if (!body) return '';
    const clone = body.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
    return clone.textContent.replace(/\s+/g, ' ');
  } finally {
    dom.window.close();
  }
}

// Search-console, ranking and indexing vocabulary that belongs in internal notes.
const INTERNAL_WORDING = new RegExp(
  [
    'GSC',
    'Search Console',
    'impressions?',
    'high-impression',
    'high-priority city',
    'keywords?',
    'SEO',
    'CTR',
    'SERP',
    'cohorts?',
    'search demand',
    'demand snapshot',
    'noindex(?:ed)?',
    'indexable',
    'search indexing',
    'indexing',
    'indexed',
    'crawl\\w*',
    'ranking',
    'intents?',
    'quer(?:y|ies)',
    'discovery feeds?',
    'sitemap (?:output|entries)',
    'route (?:continuity|compatibility)',
  ].map((term) => `\\b${term}\\b`).join('|'),
  'i',
);

test('no public page shows internal SEO or planning wording', () => {
  assert.ok(htmlFiles.length > 1000, 'the sweep must cover indexable and noindexed pages');
  const failures = [];
  for (const file of htmlFiles) {
    const text = visibleText(fs.readFileSync(file, 'utf8'));
    const match = text.match(INTERNAL_WORDING);
    if (match) {
      const at = match.index;
      failures.push(`${rel(file)}: "${text.slice(Math.max(0, at - 40), at + 50).trim()}"`);
    }
  }
  assert.deepEqual(failures, [], `${failures.length} pages show internal wording:\n${failures.slice(0, 12).join('\n')}`);
});

test('city pages show no empty provider cards (no profile link, phone, email or website)', () => {
  const failures = [];
  for (const file of htmlFiles.filter(isCityPage)) {
    const dom = new JSDOM(fs.readFileSync(file, 'utf8'));
    try {
      const document = dom.window.document;
      for (const card of document.querySelectorAll('div.block, a.block')) {
        if (!/Profile (?:details )?unavailable/.test(card.textContent)) continue;
        const contact = [...card.querySelectorAll('a[href]')].map((link) => link.getAttribute('href'))
          .some((href) => href.startsWith('/appraiser/') || href.startsWith('tel:') || href.startsWith('mailto:')
            || (/^https?:/.test(href) && !href.includes('/location/')));
        if (!contact && !card.querySelector('div.block, a.block')) {
          failures.push(`${rel(file)}: empty card "${card.querySelector('h3')?.textContent.trim()}"`);
        }
      }
    } finally {
      dom.window.close();
    }
  }
  assert.deepEqual(failures, [], `${failures.length} empty provider cards:\n${failures.slice(0, 12).join('\n')}`);
});

test('do-not-publish provider identities are absent from city pages, hubs, feeds and sitemaps', () => {
  const quarantine = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/provider-source-quarantine.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/provider-publication-manifest.json'), 'utf8'));
  // A quarantined source record can share its name with a reviewed, published
  // provider (for example "Art of Estates"). Those published names stay.
  const publishedNames = manifest.providers
    .filter((provider) => provider.publicationStatus === 'limited')
    .map((provider) => provider.name.toLowerCase());
  const specialistNames = [];
  for (const file of walk(publicRoot, (name) => name === 'index.html')) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/data-gtm-surface="fine_art_specialist"[^>]*data-gtm-appraiser-name="([^"]+)"/g)) {
      specialistNames.push(match[1].replace(/&amp;/g, '&').toLowerCase());
    }
  }
  const allowed = (name) => [...publishedNames, ...specialistNames].some((published) => published.includes(name));
  const blocked = [...new Set(quarantine.quarantine
    .filter((record) => record.identityPublicationStatus === 'not_published')
    .map((record) => record.name.toLowerCase())
    .filter((name) => !allowed(name)))];
  // Misleading names that sat on empty cards; none may come back.
  blocked.push('lacma antique & art services', 'rose bowl flea market appraisals', 'klondike heritage appraisals', 'yukon antique appraisals');
  assert.ok(blocked.length > 300, 'the quarantine list must be loaded');

  const surfaces = [
    ...walk(path.join(publicRoot, 'location'), (name) => name === 'index.html' || name === 'index.json'),
    ...['index.html', 'antique-appraisers-near-me/index.html', 'art-appraisers-near-me/index.html', 'appraisers.json',
      'directory.json', 'locations.json', 'llms.txt', 'sitemap.xml', 'indexing-manifest.json']
      .map((relative) => path.join(publicRoot, relative)),
  ].filter((file) => fs.existsSync(file));
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needles = blocked.map((name) => [name, new RegExp(`(?<![a-z0-9])${escape(name)}(?![a-z0-9])`)]);
  const failures = [];
  for (const file of surfaces) {
    const text = fs.readFileSync(file, 'utf8')
      .replace(/&amp;/g, '&').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/\\u0026/g, '&').toLowerCase();
    for (const [name, pattern] of needles) if (pattern.test(text)) failures.push(`${rel(file)}: ${name}`);
  }
  assert.deepEqual(failures, [], `${failures.length} quarantined names published:\n${failures.slice(0, 12).join('\n')}`);
});

test('profile buttons that open Appraisily say they are Appraisily, and keep their click tags', () => {
  const failures = [];
  let checked = 0;
  for (const file of htmlFiles.filter((item) => rel(item).startsWith('appraiser/'))) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<a\b([^>]*data-gtm-cta="request_appraisal"[^>]*)>([\s\S]*?)<\/a>/g)) {
      checked += 1;
      const label = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!/Appraisily/.test(label)) failures.push(`${rel(file)}: "${label}"`);
      if (!/data-gtm-event="directory_cta"/.test(match[1])) failures.push(`${rel(file)}: untracked "${label}"`);
    }
    if (/>\s*Request an Appraisal\s*</.test(html)) failures.push(`${rel(file)}: "Request an Appraisal" label`);
  }
  assert.ok(checked > 400, 'the check must cover the profile cohort');
  assert.deepEqual(failures, [], `${failures.length} profile buttons:\n${failures.slice(0, 10).join('\n')}`);
});
