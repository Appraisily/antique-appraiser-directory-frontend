import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCATION_DIR = path.join(ROOT, 'public_site', 'location');

test('every indexable city keeps its exact reviewed static page after client startup', async () => {
  let indexableCityCount = 0;
  for (const entry of await fs.readdir(LOCATION_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(LOCATION_DIR, entry.name, 'index.html');
    let html;
    try {
      html = await fs.readFile(filename, 'utf8');
    } catch {
      continue;
    }
    const dom = new JSDOM(html);
    const { document } = dom.window;
    if (/\bnoindex\b/i.test(document.querySelector('meta[name="robots" i]')?.content ?? '')) {
      dom.window.close();
      continue;
    }
    indexableCityCount += 1;
    const route = `/location/${entry.name}/`;
    const reviewedScripts = [...document.querySelectorAll('script[type="module"][src]')].filter(
      (element) => element.getAttribute('src')?.split('?')[0] === '/assets/index-Cd3ca0aQ.js'
    );
    const reviewedPreloads = [...document.querySelectorAll('link[rel="preload"][href]')].filter(
      (element) => element.getAttribute('href')?.split('?')[0] === '/assets/index-Cd3ca0aQ.js'
    );
    assert.equal(
      reviewedScripts.length,
      1,
      `${route}: reviewed module script mismatch`
    );
    assert.equal(
      reviewedPreloads.length,
      1,
      `${route}: reviewed module preload mismatch`
    );
    assert.equal(
      document.querySelectorAll(
        `section[data-directory-static-authoritative="true"][data-city-slug="${entry.name}"]`
      ).length,
      1,
      `${route}: exact authoritative city marker mismatch`
    );
    assert.equal(
      document.querySelectorAll('script[src*="index-BrMmeR5F.js"]').length +
        document.querySelectorAll('link[href*="index-BrMmeR5F.js"]').length,
      0,
      `${route}: legacy shell reference remains`
    );
    dom.window.close();
  }
  assert.equal(indexableCityCount, 85);
});
