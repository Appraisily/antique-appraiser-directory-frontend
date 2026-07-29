import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_site');

const ROUTES = {
  atlanta: {
    sourceHosts: ['www.atlantaga.gov'],
    profileCount: 0,
  },
  edmonton: {
    sourceHosts: ['www.edmonton.ca', 'www.canada.ca'],
    profileCount: 0,
  },
  richmond: {
    sourceHosts: ['www.rva.gov', 'www.lva.virginia.gov'],
    profileCount: 0,
  },
  'los-angeles': {
    sourceHosts: ['emergency.lacity.gov'],
    profileCount: 1,
  },
  louisville: {
    sourceHosts: ['louisvilleky.gov'],
    profileCount: 0,
  },
  toronto: {
    sourceHosts: ['www.toronto.ca', 'www.canada.ca'],
    profileCount: 0,
  },
  vancouver: {
    sourceHosts: ['vancouver.ca', 'www.canada.ca'],
    profileCount: 0,
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

test('second GSC city wave exposes unique official-source utility without changing provider truth', async () => {
  const headings = new Set();
  for (const [slug, contract] of Object.entries(ROUTES)) {
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
    assert.equal(
      utility.getAttribute('data-reviewed-date'),
      '2026-07-28',
      `${route}: review date mismatch`
    );
    assert.equal(
      utility.getAttribute('data-directory-static-authoritative'),
      'true',
      `${route}: utility is not protected from SPA replacement`
    );
    assert.equal(
      utility.getAttribute('data-city-slug'),
      slug,
      `${route}: authoritative city binding mismatch`
    );

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
    const externalHosts = new Set(
      externalLinks.map((link) => new URL(link.href).hostname)
    );
    for (const hostname of contract.sourceHosts) {
      assert.ok(externalHosts.has(hostname), `${route}: missing source ${hostname}`);
    }
    for (const link of externalLinks) {
      assert.equal(link.target, '_blank', `${route}: external source must open safely`);
      assert.match(
        link.rel,
        /\bnoopener\b/,
        `${route}: external source is missing noopener`
      );
      assert.match(
        link.rel,
        /\bnoreferrer\b/,
        `${route}: external source is missing noreferrer`
      );
    }

    assert.doesNotMatch(
      document.querySelector('meta[name="robots" i]')?.content ?? '',
      /\bnoindex\b/i,
      `${route}: ranking route was unexpectedly noindexed`
    );
    assert.equal(
      document.querySelectorAll(
        'script[type="module"][src="/assets/index-Cd3ca0aQ.js"]'
      ).length,
      1,
      `${route}: reviewed static shell bundle mismatch`
    );
    assert.equal(
      document.querySelectorAll(
        'link[rel="preload"][href="/assets/index-Cd3ca0aQ.js"]'
      ).length,
      1,
      `${route}: reviewed static shell preload mismatch`
    );

    const profileCount = document.querySelectorAll(
      '#local-appraisers a[href^="/appraiser/"]'
    ).length;
    const schema = countSchemaProviders(document);
    assert.equal(profileCount, contract.profileCount, `${route}: profile count changed`);
    assert.equal(
      schema.itemListCount,
      contract.profileCount,
      `${route}: ItemList provider count changed`
    );
    assert.equal(
      schema.serviceCount,
      contract.profileCount,
      `${route}: Service provider count changed`
    );
    dom.window.close();
  }
});
