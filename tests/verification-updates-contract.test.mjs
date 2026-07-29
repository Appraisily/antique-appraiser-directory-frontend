import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(root, 'public_site');
const route = 'https://antique-appraiser-directory.appraisily.com/verification-updates/';

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function readDocument(filename) {
  const html = await fs.readFile(filename, 'utf8');
  return { html, dom: new JSDOM(html) };
}

async function countIndexableCities() {
  const locationDir = path.join(publicDir, 'location');
  const entries = await fs.readdir(locationDir, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(locationDir, entry.name, 'index.html');
    try {
      const { dom } = await readDocument(filename);
      const robots = normalize(
        dom.window.document
          .querySelector('meta[name="robots" i]')
          ?.getAttribute('content')
      ).toLowerCase();
      dom.window.close();
      if (!robots.includes('noindex')) total += 1;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return total;
}

test('verification updates exposes current publication counts and neutral scope', async () => {
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(root, 'data', 'provider-publication-manifest.json'),
      'utf8'
    )
  );
  const profiles = manifest.providers.filter((provider) =>
    ['verified', 'limited'].includes(provider.publicationStatus)
  );
  const verified = profiles.filter(
    (provider) => provider.publicationStatus === 'verified'
  ).length;
  const limited = profiles.filter(
    (provider) => provider.publicationStatus === 'limited'
  ).length;
  const indexableCities = await countIndexableCities();

  const filename = path.join(
    publicDir,
    'verification-updates',
    'index.html'
  );
  const { html, dom } = await readDocument(filename);
  const { document } = dom.window;
  const body = normalize(document.body.textContent);
  const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((node) => {
      const parsed = JSON.parse(node.textContent);
      return Array.isArray(parsed) ? parsed : [parsed];
    });

  assert.equal(
    document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    route
  );
  assert.equal(
    normalize(document.querySelector('meta[name="robots"]')?.getAttribute('content')),
    'index, follow'
  );
  assert.equal(
    normalize(document.querySelector('h1')?.textContent),
    'Directory Verification Updates'
  );
  assert.match(body, new RegExp(`\\b${profiles.length}\\b public provider profiles`));
  assert.match(body, new RegExp(`\\b${verified}\\b verified profiles`));
  assert.match(body, new RegExp(`\\b${limited}\\b source-listed profiles`));
  assert.match(body, new RegExp(`\\b${indexableCities}\\b indexable city pages`));
  assert.ok(
    schemas.some(
      (schema) =>
        schema['@type'] === 'AboutPage' &&
        schema.url === route &&
        schema.dateModified === '2026-07-28'
    )
  );
  assert.equal(
    document.querySelectorAll('a[href^="/appraiser/"]').length,
    0,
    'The neutral update log must not expose provider-specific disputes or held records.'
  );
  assert.doesNotMatch(html, /art-appraisers-directory\.appraisily\.com/i);
  dom.window.close();
});

test('verification updates is discoverable and represented once in indexing artifacts', async () => {
  const [homepage, methodology, sitemap, indexingManifest] = await Promise.all([
    fs.readFile(path.join(publicDir, 'index.html'), 'utf8'),
    fs.readFile(path.join(publicDir, 'methodology', 'index.html'), 'utf8'),
    fs.readFile(path.join(publicDir, 'sitemap.xml'), 'utf8'),
    fs
      .readFile(path.join(publicDir, 'indexing-manifest.json'), 'utf8')
      .then(JSON.parse),
  ]);
  const routePath = '/verification-updates/';
  assert.match(homepage, /href="\/verification-updates\/"/);
  assert.match(methodology, /href="\/verification-updates\/"/);
  assert.equal(
    (sitemap.match(
      /<loc>https:\/\/antique-appraiser-directory\.appraisily\.com\/verification-updates\/<\/loc>/g
    ) || []).length,
    1
  );
  assert.deepEqual(
    indexingManifest.records.filter((record) => record.url === route),
    [{ url: route, classification: 'keep-indexable', reasons: [] }]
  );
});
