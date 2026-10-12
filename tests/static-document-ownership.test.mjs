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
  const appraisily = state.anchors.find((anchor) => anchor.text === 'Request an Appraisal');
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
