import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'public_site');
const origin = 'https://antique-appraiser-directory.appraisily.com';

test('Chicago hero and provider card use the existing single-owner click contract', () => {
  const dom = new JSDOM(fs.readFileSync(path.join(publicRoot, 'location/chicago/index.html'), 'utf8'));
  try {
    const document = dom.window.document;
    const hero = document.querySelector('a[href*="utm_medium=hero"][href*="appraisily.com/start"]');
    const profile = document.querySelector('a[href="/appraiser/adams-appraisal-llc/"]');
    for (const [label, link] of [['hero', hero], ['provider card', profile]]) {
      assert.ok(link, `Chicago ${label} must remain available`);
      assert.equal(link.getAttribute('data-gtm-event'), 'directory_cta', `Chicago ${label} must record a click`);
    }
  } finally {
    dom.window.close();
  }
});

test('all sitemap-listed online-appraisal and local-profile anchors have click annotations', () => {
  const sitemap = fs.readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  const missing = [];
  let checked = 0;
  for (const url of urls) {
    assert.equal(url.origin, origin, 'coverage must stay on this directory');
    const filename = path.join(publicRoot, url.pathname, 'index.html');
    const html = fs.readFileSync(filename, 'utf8');
    if (!html.includes('appraisily.com/start') && !html.includes('href="/appraiser/')) continue;
    const dom = new JSDOM(html);
    try {
      for (const link of dom.window.document.querySelectorAll('a[href]')) {
        // Same-page fragments (the header skip link, in-page jumps) are not profile navigations.
        if (link.getAttribute('href').startsWith('#')) continue;
        const destination = new URL(link.getAttribute('href'), url);
        const isOnlineAppraisal = destination.origin === 'https://appraisily.com' && destination.pathname === '/start';
        const isLocalProfile = destination.origin === origin && /^\/appraiser\/[^/]+\/$/.test(destination.pathname);
        if (!isOnlineAppraisal && !isLocalProfile) continue;
        checked += 1;
        if (link.getAttribute('data-gtm-event') !== 'directory_cta') {
          missing.push(`${url.pathname} -> ${destination.pathname}`);
        }
      }
    } finally {
      dom.window.close();
    }
  }
  assert.ok(checked > 200, 'the check must cover the published link cohort, not only Chicago');
  assert.equal(missing.length, 0, `${missing.length} untracked links: ${missing.slice(0, 8).join('; ')}`);
});

// Screener handoffs and provider links were the untracked remainder after the
// 2026-10-05 repair (cp-2026-10-29-directory-cleanup-and-link-tags). Same
// single-owner bootstrap: HTML annotations only, no second emitter.
const PROVIDER_KINDS = new Set(['provider_website', 'provider_source', 'provider_contact']);

test('every sitemap Appraisily start/screener link and every profile provider link carries a kind and placement', () => {
  const sitemap = fs.readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
  const missing = [];
  const counts = { start: 0, screener: 0, provider: 0 };
  for (const url of urls) {
    const isProfile = /^\/appraiser\/[^/]+\/$/.test(url.pathname);
    const dom = new JSDOM(fs.readFileSync(path.join(publicRoot, url.pathname, 'index.html'), 'utf8'));
    try {
      for (const link of dom.window.document.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href');
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
        const destination = new URL(href, url);
        const appraisily = destination.hostname === 'appraisily.com' || destination.hostname.endsWith('.appraisily.com');
        const route = destination.pathname.replace(/\/$/, '');
        let kind;
        if (destination.hostname === 'appraisily.com' && route === '/start') kind = 'start';
        else if (destination.hostname === 'appraisily.com' && route === '/screener') kind = 'screener';
        else if (isProfile && !appraisily && /^https?:$/.test(destination.protocol)) kind = 'provider';
        else continue;
        counts[kind] += 1;
        const label = `${url.pathname} -> ${destination.host}${destination.pathname}`;
        if (link.getAttribute('data-gtm-event') !== 'directory_cta') missing.push(`${label} (no directory_cta)`);
        if (kind === 'start') continue;
        if (!link.getAttribute('data-gtm-placement')) missing.push(`${label} (no placement)`);
        const ctaKind = link.getAttribute('data-cta-kind');
        if (kind === 'screener' && ctaKind !== 'screener') missing.push(`${label} (kind ${ctaKind})`);
        if (kind === 'provider' && !PROVIDER_KINDS.has(ctaKind)) missing.push(`${label} (kind ${ctaKind})`);
      }
    } finally {
      dom.window.close();
    }
  }
  assert.ok(counts.screener > 400, `screener links checked: ${counts.screener}`);
  assert.ok(counts.provider > 800, `provider links checked: ${counts.provider}`);
  assert.ok(counts.start > 900, `start links checked: ${counts.start}`);
  assert.equal(missing.length, 0, `${missing.length} untagged links: ${missing.slice(0, 8).join('; ')}`);
});
