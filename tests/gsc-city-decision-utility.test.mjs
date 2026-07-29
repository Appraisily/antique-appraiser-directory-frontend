import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_site');

const ROUTES = {
  'des-moines': {
    sourceHosts: ['history.iowa.gov'],
    heldIdentities: ['Elizabeth Krambeer'],
  },
  'new-orleans': {
    sourceHosts: ['ready.nola.gov'],
    heldIdentities: ['John C. Abajian', 'John Abajian'],
  },
  'kansas-city': {
    sourceHosts: ['www.kcmo.gov'],
    heldIdentities: ['Justin Rogers', 'Rogers Fine Art'],
  },
  columbus: {
    sourceHosts: ['www.ohiohistory.org'],
    heldIdentities: ['Allyssa Hixenbaugh'],
  },
  tucson: {
    sourceHosts: ['www.tucsonaz.gov', 'statemuseum.arizona.edu'],
    heldIdentities: ['Lynn Roberts'],
  },
  'st-louis': {
    sourceHosts: ['www.stlouis-mo.gov'],
    heldIdentities: ['Sylvia Fraley'],
  },
  raleigh: {
    sourceHosts: ['archives.ncdcr.gov', 'archaeology.ncdcr.gov'],
    heldIdentities: ['Dana Summitt'],
  },
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
    const records = Array.isArray(payload) ? payload : [payload];
    for (const record of records) {
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

test('GSC-prioritized held-provider cities expose sourced local utility without publishing held identities', async () => {
  const headings = new Set();
  for (const [slug, contract] of Object.entries(ROUTES)) {
    const filename = path.join(PUBLIC_DIR, 'location', slug, 'index.html');
    const html = await fs.readFile(filename, 'utf8');
    const dom = new JSDOM(html);
    const { document } = dom.window;
    const route = `/location/${slug}/`;
    const utility = document.querySelector(
      'section[data-directory-city-utility="official-local-context"]'
    );

    assert.ok(utility, `${route}: missing official local-context utility`);
    assert.equal(
      document.querySelectorAll(
        'section[data-directory-city-utility="official-local-context"]'
      ).length,
      1,
      `${route}: utility must appear exactly once`
    );
    assert.equal(
      utility.getAttribute('data-reviewed-date'),
      '2026-07-28',
      `${route}: missing review date`
    );

    const heading = clean(utility.querySelector('h2')?.textContent);
    assert.ok(heading.length >= 40, `${route}: utility heading is too weak`);
    assert.equal(headings.has(heading), false, `${route}: duplicate utility heading`);
    headings.add(heading);

    const utilityText = clean(utility.textContent);
    assert.ok(utilityText.length >= 700, `${route}: utility lacks decision detail`);
    assert.ok(
      utility.querySelector('a[href="/methodology/#preparation-checklist"]') ||
        utilityText.includes('preparation checklist'),
      `${route}: missing canonical preparation guidance`
    );

    const externalHosts = new Set(
      [...utility.querySelectorAll('a[href^="http"]')].map(
        (link) => new URL(link.href).hostname
      )
    );
    for (const hostname of contract.sourceHosts) {
      assert.ok(externalHosts.has(hostname), `${route}: missing source ${hostname}`);
    }

    for (const identity of contract.heldIdentities) {
      assert.doesNotMatch(
        clean(document.body.textContent),
        new RegExp(identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        `${route}: held provider identity leaked into public content`
      );
    }

    assert.doesNotMatch(
      clean(document.body.textContent),
      /This page lists \d+ providers?/i,
      `${route}: stale provider count remains`
    );
    assert.doesNotMatch(
      document.querySelector('meta[name="robots" i]')?.content ?? '',
      /\bnoindex\b/i,
      `${route}: ranking route was unexpectedly noindexed`
    );
    const clientBundles = document.querySelectorAll(
      'script[type="module"][src="/assets/index-Cd3ca0aQ.js"]'
    );
    assert.equal(clientBundles.length, 1, `${route}: reviewed static shell bundle mismatch`);
    assert.equal(
      utility.getAttribute('data-directory-static-authoritative'),
      'true',
      `${route}: utility is not protected from SPA replacement`
    );
    assert.equal(
      utility.getAttribute('data-city-slug'),
      slug,
      `${route}: static-authoritative city binding mismatch`
    );

    const profileLinks = document.querySelectorAll(
      '#local-appraisers a[href^="/appraiser/"]'
    ).length;
    const schema = countSchemaProviders(document);
    assert.equal(profileLinks, 0, `${route}: unapproved profile link published`);
    assert.equal(schema.itemListCount, 0, `${route}: ItemList provider mismatch`);
    assert.equal(schema.serviceCount, 0, `${route}: Service provider mismatch`);
    dom.window.close();
  }
});
