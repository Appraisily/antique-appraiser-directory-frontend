import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_site');

const ROUTES = {
  saskatoon: ['www.saskatoon.ca', 'www.canada.ca'],
  rochester: ['www.cityofrochester.gov'],
  aspen: ['aspen.gov', 'www.aspen.gov'],
  'baton-rouge': ['www.brla.gov'],
  birmingham: ['www.birminghamal.gov'],
  albuquerque: ['www.cabq.gov'],
  'colorado-springs': ['coloradosprings.gov'],
};

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function countSchemaProviders(document) {
  let itemListCount = null;
  let serviceCount = null;
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let payload;
    try {
      payload = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    for (const record of Array.isArray(payload) ? payload : [payload]) {
      if (record?.['@type'] === 'ItemList') {
        itemListCount = Number(record.numberOfItems ?? record.itemListElement?.length ?? 0);
      }
      if (record?.['@type'] === 'Service') {
        serviceCount = Array.isArray(record.provider)
          ? record.provider.length
          : record.provider
            ? 1
            : 0;
      }
    }
  }
  return { itemListCount, serviceCount };
}

test('fifth GSC city wave adds official-source utility while provider inventory stays empty', async () => {
  const headings = new Set();
  for (const [slug, sourceHosts] of Object.entries(ROUTES)) {
    const filename = path.join(PUBLIC_DIR, 'location', slug, 'index.html');
    const html = await fs.readFile(filename, 'utf8');
    const dom = new JSDOM(html);
    const { document } = dom.window;
    const route = `/location/${slug}/`;
    const utilities = document.querySelectorAll(
      'section[data-directory-city-utility="official-local-context"]'
    );

    assert.equal(utilities.length, 1, `${route}: utility must appear exactly once`);
    const utility = utilities[0];
    assert.equal(utility.getAttribute('data-reviewed-date'), '2026-07-29');
    assert.equal(utility.getAttribute('data-directory-static-authoritative'), 'true');
    assert.equal(utility.getAttribute('data-city-slug'), slug);

    const heading = clean(utility.querySelector('h2')?.textContent);
    assert.ok(heading.length >= 50, `${route}: utility heading is too weak`);
    assert.equal(headings.has(heading), false, `${route}: duplicate utility heading`);
    headings.add(heading);

    const utilityText = clean(utility.textContent);
    assert.ok(utilityText.length >= 900, `${route}: utility lacks decision detail`);
    assert.ok(
      utility.querySelector('a[href="/methodology/#preparation-checklist"]'),
      `${route}: missing canonical preparation checklist`
    );
    assert.equal(
      utility.querySelectorAll('a[href^="/appraiser/"]').length,
      0,
      `${route}: utility must remain provider-neutral`
    );
    assert.doesNotMatch(
      utilityText,
      /\b(?:certified|verified)\s+(?:local\s+)?(?:provider|appraiser)\b/i,
      `${route}: utility implies an unsupported provider state`
    );

    const externalLinks = [...utility.querySelectorAll('a[href^="http"]')];
    const externalHosts = new Set(externalLinks.map((link) => new URL(link.href).hostname));
    for (const hostname of sourceHosts) {
      assert.ok(externalHosts.has(hostname), `${route}: missing source ${hostname}`);
    }
    for (const link of externalLinks) {
      assert.equal(link.target, '_blank', `${route}: external source must open safely`);
      assert.match(link.rel, /\bnoopener\b/, `${route}: source is missing noopener`);
      assert.match(link.rel, /\bnoreferrer\b/, `${route}: source is missing noreferrer`);
    }

    assert.doesNotMatch(
      document.querySelector('meta[name="robots" i]')?.content ?? '',
      /\bnoindex\b/i,
      `${route}: ranking route was unexpectedly noindexed`
    );
    assert.equal(
      document.querySelectorAll('script[type="module"][src="/assets/index-Cd3ca0aQ.js"]').length,
      1,
      `${route}: reviewed static shell bundle mismatch`
    );
    assert.equal(
      document.querySelectorAll('link[rel="preload"][href="/assets/index-Cd3ca0aQ.js"]').length,
      1,
      `${route}: reviewed static shell preload mismatch`
    );

    const profileCount = document.querySelectorAll(
      '#local-appraisers a[href^="/appraiser/"]'
    ).length;
    const schema = countSchemaProviders(document);
    assert.equal(profileCount, 0, `${route}: unapproved profile was published`);
    assert.equal(schema.itemListCount, 0, `${route}: ItemList provider was published`);
    assert.equal(schema.serviceCount, 0, `${route}: Service provider was published`);
    dom.window.close();
  }
});
