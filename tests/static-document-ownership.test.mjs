import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { captureDocument, documentParityFailures } from '../scripts/settled-document-contract.mjs';

// Static half of the A01/A02 authored-versus-settled contract. The browser half
// (scripts/test-settled-browser-contract.mjs) proves the settled DOM; this test
// keeps the cause from returning in the build gate.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'public_site');
const origin = 'https://antique-appraiser-directory.appraisily.com';
const sitemap = fs.readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8');
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
const read = (route) => fs.readFileSync(path.join(publicRoot, route, 'index.html'), 'utf8');
const snapshot = (route) => {
  const dom = new JSDOM(read(route), { url: `${origin}${route}` });
  try { return captureDocument(dom.window.document, origin); } finally { dom.window.close(); }
};
const cohort = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests/fixtures/legacy-client-module-cohort.json'), 'utf8')).routes;

test('no published document loads the legacy client app that replaces authored HTML', () => {
  const offenders = routes.filter((route) => /<(?:script|link)\b[^>]*\/assets\/index-[A-Za-z0-9_-]+\.js/.test(read(route)));
  assert.equal(routes.length > 400, true, 'the check must cover the whole sitemap');
  assert.deepEqual(offenders, [], `${offenders.length} documents still mount the legacy client app: ${offenders.slice(0, 5).join(', ')}`);
});

test('scripts loaded by published documents do not manufacture certification or review claims', () => {
  const scripts = new Set();
  for (const route of routes) {
    for (const match of read(route).matchAll(/<script\b[^>]*\bsrc="(\/assets\/[^"?#]+)/g)) scripts.add(match[1]);
  }
  for (const src of scripts) {
    const source = fs.readFileSync(path.join(publicRoot, src), 'utf8');
    assert.doesNotMatch(source, /Certified expert with verified reviews|verified reviews?\b/i, `${src} contains an unsupported trust claim`);
  }
});

test('the reviewed legacy-module cohort keeps one authored metadata owner and its native content', () => {
  assert.equal(cohort.length, 276);
  for (const route of cohort) {
    assert.ok(routes.includes(route), `${route} left the sitemap`);
    const state = snapshot(route);
    const failures = documentParityFailures(state, state, `${origin}${route}`);
    assert.deepEqual(failures, [], `${route}: ${JSON.stringify(failures)}`);
  }
});

test('every class the authored cohort HTML uses is compiled by a stylesheet it loads', () => {
  const selectors = new Map();
  const compiled = (href) => {
    if (!selectors.has(href)) {
      const css = fs.readFileSync(path.join(publicRoot, href), 'utf8');
      selectors.set(href, new Set([...css.matchAll(/\.((?:\\.|[\w-])+)/g)].map((match) => match[1].replace(/\\/g, ''))));
    }
    return selectors.get(href);
  };
  const missing = [];
  for (const route of cohort) {
    const html = read(route);
    const available = new Set();
    for (const match of html.matchAll(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"/g)) compiled(match[1]).forEach((name) => available.add(name));
    for (const match of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      for (const name of match[1].matchAll(/\.((?:\\.|[\w-])+)/g)) available.add(name[1].replace(/\\/g, ''));
    }
    const body = html.slice(html.indexOf('<body'));
    for (const match of body.matchAll(/class="([^"]*)"/g)) {
      for (const name of match[1].split(/\s+/).filter(Boolean)) if (!available.has(name)) missing.push(`${route} .${name}`);
    }
  }
  assert.deepEqual([...new Set(missing)].slice(0, 10), [], `${missing.length} uncompiled authored classes`);
});

test('fine-art specialist website links carry the provider-contact click kind and placement', () => {
  let checked = 0;
  for (const route of routes) {
    const dom = new JSDOM(read(route));
    try {
      for (const link of dom.window.document.querySelectorAll('a[data-gtm-surface^="fine_art_"]')) {
        checked += 1;
        const surface = link.getAttribute('data-gtm-surface');
        assert.equal(link.getAttribute('data-gtm-event'), 'directory_cta', `${route} ${link.href}`);
        assert.equal(link.getAttribute('data-cta-kind'), 'provider_contact', `${route} ${link.href}: click kind missing`);
        assert.equal(link.getAttribute('data-gtm-placement'), surface, `${route} ${link.href}: placement missing`);
      }
    } finally {
      dom.window.close();
    }
  }
  assert.equal(checked, 24, 'ten city sections plus the fourteen /art-appraisers-near-me/ links');
});

test('pages without their own header carry exactly one static site header; held and topbar pages do not', async () => {
  const { headerTargets } = await import('../scripts/inject-directory-site-header.mjs');
  const targets = headerTargets(sitemap);
  assert.equal(targets.length, 426);
  for (const route of ['/location/chicago/', '/location/baltimore/', '/location/', '/methodology/', '/get-listed/', '/antique-appraisers-near-me/', '/art-appraisers-near-me/']) {
    assert.ok(!targets.includes(route), `${route} must keep its current header state`);
    assert.doesNotMatch(read(route), /data-appraisily-directory-site-header/, `${route} must not carry the injected header`);
  }
  for (const route of targets) {
    // The charset must stay inside the first 1024 bytes (nginx adds ~120 bytes at <head>).
    assert.ok(read(route).search(/<meta charset=/i) < 900, `${route}: charset declaration pushed late`);
    const dom = new JSDOM(read(route), { url: `${origin}${route}` });
    try {
      const document = dom.window.document;
      const headers = document.querySelectorAll('header[data-appraisily-directory-site-header]');
      assert.equal(headers.length, 1, `${route}: one site header`);
      const header = headers[0];
      assert.equal(header.nextElementSibling?.id, 'root', `${route}: header sits directly before #root`);
      assert.equal(header.querySelectorAll('h1,h2,h3,h4,h5,h6').length, 0, `${route}: header has no heading`);
      assert.equal(document.querySelectorAll('h1').length, 1, `${route}: one H1`);
      const logo = header.querySelector('.adh-brand img');
      assert.deepEqual([logo.getAttribute('alt'), logo.getAttribute('width'), logo.getAttribute('height')], ['Appraisily', '32', '32']);
      assert.equal(header.querySelector('.adh-brand').getAttribute('href'), '/');
      const browse = header.querySelector('a.adh-browse');
      const start = header.querySelector('a.adh-start');
      assert.equal(browse.getAttribute('href'), '/location/');
      const target = new URL(start.getAttribute('href'));
      assert.equal(`${target.origin}${target.pathname}`, 'https://appraisily.com/start');
      assert.equal(target.searchParams.get('utm_source'), 'directory');
      assert.equal(target.searchParams.get('utm_medium'), 'header');
      for (const [link, kind] of [[browse, 'navigation'], [start, 'signed_report']]) {
        assert.equal(link.getAttribute('data-gtm-event'), 'directory_cta', `${route}: header link tracked`);
        assert.equal(link.getAttribute('data-cta-kind'), kind);
        assert.equal(link.getAttribute('data-gtm-placement'), 'header');
      }
    } finally {
      dom.window.close();
    }
  }
});

test('A-Coin negative fixture keeps the limited listing and the provider website distinct from Appraisily', () => {
  const route = '/appraiser/a-coin-and-stamp-gallery-estate-appraisal/';
  const html = read(route);
  const state = snapshot(route);
  assert.equal(state.canonicals.length, 1);
  assert.equal(state.descriptions.length, 1);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.deepEqual(state.providerEntities.map((entity) => entity.type), ['ProfessionalService']);
  assert.doesNotMatch(state.trustText, /certified|verified reviews?/i);
  assert.match(state.mainText, /Limited directory listing\. Confirm provider details on the official website before engagement\./);
  const website = state.anchors.filter((anchor) => anchor.destination === 'https://www.a-coin.com/');
  assert.equal(website.length, 2, 'both native provider website links stay in the document');
  assert.ok(website.some((anchor) => anchor.text === 'Visit official website' && anchor.tracking.includes('data-gtm-cta=website')));
  const appraisily = state.anchors.find((anchor) => anchor.text === 'Get an online appraisal from Appraisily');
  assert.equal(appraisily?.destination, 'https://appraisily.com/start');
  assert.ok(appraisily.tracking.includes('data-gtm-cta=request_appraisal'));
  assert.equal(state.moduleScripts.length, 0);
});

test('Albuquerque keeps one authored title, H1, canonical and description', () => {
  const route = '/location/albuquerque/';
  const html = read(route);
  const state = snapshot(route);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal(state.canonicals.length, 1);
  assert.equal(state.descriptions.length, 1);
  assert.equal(state.h1.length, 1);
  assert.equal(state.moduleScripts.length, 0, 'no client app may rewrite the authored title or H1');
});
