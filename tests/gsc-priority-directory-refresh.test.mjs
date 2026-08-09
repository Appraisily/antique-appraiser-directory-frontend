import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'public_site');
const appSource = fs.readFileSync(path.join(repoRoot, 'src/App.tsx'), 'utf8');
const locationSource = fs.readFileSync(
  path.join(repoRoot, 'src/pages/StandardizedLocationPage.tsx'),
  'utf8',
);
const hydrationPreservationAsset = fs.readFileSync(
  path.join(publicRoot, 'assets/gsc-priority-directory-refresh-20260809.js'),
  'utf8',
);

const cities = [
  {
    slug: 'philadelphia',
    title: 'Philadelphia, PA Antique Appraisers | Local & Online Reports',
    description:
      'Compare Philadelphia antique and art appraisers for estates, insurance, donation, furniture, and personal property—or start a paid online report from photos.',
  },
  {
    slug: 'wichita',
    title: 'Wichita Antique Appraisers | Vintage Items & Online Reports',
    description:
      'Compare Wichita antique appraisers for antiques, vintage items, estates, insurance, and donations. Free screening is a first look; written reports are paid.',
  },
  {
    slug: 'new-orleans',
    title: 'New Orleans, LA Antique Appraisers | Local & Online Reports',
    description:
      'Compare New Orleans and Metairie antique-appraisal options for art, estates, and insurance, or start a paid signed online report from photos.',
  },
  {
    slug: 'raleigh',
    title: 'Raleigh, NC Antique Appraisers | Local & Online Options',
    description:
      'Review Raleigh antique-appraiser availability and nearby published city pages for estate, furniture, insurance, or personal-property needs, or start a paid online report.',
  },
  {
    slug: 'baltimore',
    title: 'Baltimore Antique Appraisers | Maryland Furniture Appraisal',
    description:
      'Compare Baltimore and Maryland antique-furniture appraisers for estates, insurance, and donations, or start a paid signed online report from photos.',
  },
  {
    slug: 'pittsburgh',
    title: 'Pittsburgh Antique Appraisers Near You | Online Reports',
    description:
      'Compare Pittsburgh antique and art appraisers near you for estates, insurance, donations, and personal property—or start a paid online report from photos.',
  },
  {
    slug: 'chicago',
    title: 'Chicago Antique Appraisers Near You | Signed Online Reports',
    description:
      'Compare Chicago antique and art appraisers near you for estates, insurance, and donations, or upload photos for a paid signed online report.',
  },
];

function readDocument(relativePath) {
  const html = fs.readFileSync(path.join(publicRoot, relativePath), 'utf8');
  return { html, document: new JSDOM(html).window.document };
}

test('directory home routes near-me visitors to the measured city cohort and paid intake', () => {
  const { document } = readDocument('index.html');
  const bodyText = document.body.textContent.replace(/\s+/g, ' ').trim();
  const homeLinks = new Set([...document.querySelectorAll('a[href]')].map(link => link.getAttribute('href')));

  assert.equal(document.title, 'Antique Appraisers Near Me | Local & Online Appraisal Options');
  assert.match(bodyText, /antiques, furniture, art, and estates/i);
  assert.match(bodyText, /paid online appraisal provides a signed written valuation report/i);
  assert.ok([...homeLinks].some(href => href.startsWith('https://appraisily.com/start?')));
  assert.equal(
    document.querySelector('script[type="module"][src*="/assets/index-"]'),
    null,
    'the canonical static home must not be replaced by a stale SPA bundle',
  );

  for (const city of cities) {
    assert.ok(homeLinks.has(`/location/${city.slug}/`), `home is missing the ${city.slug} contextual link`);
  }

  const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map(script =>
    JSON.parse(script.textContent),
  );
  const collectionPage = schemas.find(schema => schema['@type'] === 'CollectionPage');
  assert.ok(collectionPage);
  assert.equal(collectionPage.mainEntity.itemListElement.length, cities.length);
});

for (const city of cities) {
  test(`${city.slug} keeps local intent, paid-report routing, and trust boundaries aligned`, () => {
    const { html, document } = readDocument(`location/${city.slug}/index.html`);
    const canonical = `https://antique-appraiser-directory.appraisily.com/location/${city.slug}/`;
    const hero = document.querySelector('#root section');
    const heroLinks = [...hero.querySelectorAll('a[href]')].map(link => link.getAttribute('href'));

    assert.equal(document.title, city.title);
    assert.equal(document.querySelector('meta[name="description"]')?.content, city.description);
    assert.equal(document.querySelector('meta[property="og:title"]')?.content, city.title);
    assert.equal(document.querySelector('meta[property="og:description"]')?.content, city.description);
    assert.equal(document.querySelector('meta[name="twitter:title"]')?.content, city.title);
    assert.equal(document.querySelector('meta[name="twitter:description"]')?.content, city.description);
    assert.equal(document.querySelector('link[rel="canonical"]')?.href, canonical);
    assert.equal(document.querySelector('meta[name="robots"]')?.content, 'index, follow');
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.equal(
      document.querySelector('script[type="module"][src*="/assets/index-"]'),
      null,
      `${city.slug} must keep its canonical HTML instead of rehydrating from a stale SPA bundle`,
    );
    assert.ok(heroLinks.some(href => href.startsWith('https://appraisily.com/start?')));
    assert.ok(heroLinks.some(href => href.startsWith('https://appraisily.com/screener?')));
    assert.ok(
      heroLinks.findIndex(href => href.startsWith('https://appraisily.com/start?')) <
        heroLinks.findIndex(href => href.startsWith('https://appraisily.com/screener?')),
      `${city.slug} must present paid professional intake before the free first-look option`,
    );
    const regularIntakeLinks = [...document.querySelectorAll('a[href^="https://appraisily.com/start?"]')];
    assert.ok(regularIntakeLinks.length > 0, `${city.slug} is missing regular appraisal intake`);
    assert.ok(
      regularIntakeLinks.every(link => new URL(link.href).searchParams.get('service') === 'regular'),
      `${city.slug} must route every professional CTA to service=regular`,
    );
    assert.ok(
      [...document.querySelectorAll('a[href]')].some(link =>
        link.href.startsWith('https://appraisily.com/antique-appraiser-near-me'),
      ),
      `${city.slug} is missing the near-me decision hub`,
    );
    assert.doesNotMatch(html, />Search demand snapshot</);
    assert.doesNotMatch(html, /Appraisily[^<]{0,80}(office|local office)/i);
    assert.match(
      html,
      /<script defer src="\/assets\/gsc-priority-directory-refresh-20260809\.js"><\/script>/,
      `${city.slug} must preserve the reviewed metadata and intake route after SPA hydration`,
    );

    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(script => {
      const parsed = JSON.parse(script.textContent);
      return Array.isArray(parsed) ? parsed : [parsed];
    });
    const service = schemas.find(schema => schema['@type'] === 'Service');
    assert.ok(service, `${city.slug} is missing Service structured data`);
    assert.equal(service.mainEntityOfPage['@id'], canonical);
    const servedAreas = Array.isArray(service.areaServed) ? service.areaServed : [service.areaServed];
    assert.ok(servedAreas.length >= 1, `${city.slug} must declare at least one served city`);
    assert.ok(
      servedAreas.every(area => area?.['@type'] === 'City'),
      `${city.slug} areaServed entries must remain City objects`,
    );
    assert.match(service.description, /paid online appraisal from photos/i);
    assert.ok(locationSource.includes(`title: '${city.title}'`), `${city.slug} hydrated title drifted`);
    assert.ok(locationSource.includes(city.description), `${city.slug} hydrated description drifted`);
  });
}

test('priority-route preservation keeps reviewed metadata and regular intake after stale hydration', () => {
  for (const city of cities) {
    const dom = new JSDOM(
      `<!doctype html><html><head>
        <title>Stale title</title>
        <meta name="description" content="Stale description">
        <meta property="og:title" content="Stale title">
        <meta property="og:description" content="Stale description">
        <meta name="twitter:title" content="Stale title">
        <meta name="twitter:description" content="Stale description">
      </head><body>
        <h1>Stale heading</h1>
        <p>Start with a free online photo check, or compare providers in a nearby city. We do not show unverified profiles as local options.</p>
        <a href="https://appraisily.com/start?utm_source=antique_directory">Start Appraisal</a>
        <a href="/location/durham/">Durham</a>
      </body></html>`,
      {
        runScripts: 'outside-only',
        url: `https://antique-appraiser-directory.appraisily.com/location/${city.slug}/`,
      },
    );

    Object.defineProperty(dom.window, 'MutationObserver', { value: undefined, configurable: true });
    dom.window.setTimeout = () => 0;
    dom.window.eval(hydrationPreservationAsset);
    const runtimeDocument = dom.window.document;
    assert.equal(runtimeDocument.title, city.title);
    assert.equal(runtimeDocument.querySelector('meta[name="description"]')?.content, city.description);
    assert.equal(runtimeDocument.querySelector('meta[property="og:title"]')?.content, city.title);
    assert.equal(runtimeDocument.querySelector('meta[property="og:description"]')?.content, city.description);
    assert.equal(runtimeDocument.querySelector('meta[name="twitter:title"]')?.content, city.title);
    assert.equal(runtimeDocument.querySelector('meta[name="twitter:description"]')?.content, city.description);
    assert.equal(
      new URL(runtimeDocument.querySelector('a[href*="appraisily.com/start"]')?.href).searchParams.get('service'),
      'regular',
    );
    assert.equal(runtimeDocument.querySelector('a[href*="/location/durham"]'), null);
    if (city.slug === 'new-orleans' || city.slug === 'raleigh') {
      assert.match(runtimeDocument.body.textContent, /free photo screener for an initial look/i);
      assert.match(runtimeDocument.body.textContent, /professional written appraisal is a separate paid service/i);
    }
    dom.window.close();
  }
});

test('Wichita distinguishes a free first look from a professional report', () => {
  const { document } = readDocument('location/wichita/index.html');
  const heroText = document.querySelector('#root section').textContent.replace(/\s+/g, ' ').trim();
  assert.match(heroText, /free photo screener gives a first look/i);
  assert.match(heroText, /professional written appraisal is a separate paid service/i);
});

test('Raleigh does not imply an available local provider or unsupported Durham route', () => {
  const { html, document } = readDocument('location/raleigh/index.html');
  const heroText = document.querySelector('#root section').textContent.replace(/\s+/g, ' ').trim();
  const metadata = [
    document.title,
    document.querySelector('meta[name="description"]')?.content,
    document.querySelector('meta[property="og:title"]')?.content,
    document.querySelector('meta[property="og:description"]')?.content,
    document.querySelector('meta[name="twitter:title"]')?.content,
    document.querySelector('meta[name="twitter:description"]')?.content,
  ].join(' ');
  const hrefs = [...document.querySelectorAll('a[href]')].map(link => link.getAttribute('href'));
  assert.match(heroText, /No source-labeled local profile is currently published for Raleigh/i);
  assert.match(heroText, /nearby published city pages/i);
  assert.doesNotMatch(metadata, /Durham/i);
  assert.doesNotMatch(document.body.textContent, /Durham/i);
  assert.ok(hrefs.every(href => !/\/location\/durham\/?/i.test(href)));
  assert.doesNotMatch(html, /Raleigh.{0,120}Durham|Durham.{0,120}Raleigh/is);
  assert.doesNotMatch(appSource, /Raleigh and Durham|Durham directory|Durham-area/i);
  assert.doesNotMatch(
    locationSource,
    /raleigh:\s*\[[^\]]*['"]durham|Durham NC antique appraisers|Raleigh.{0,120}Durham|Durham.{0,120}Raleigh/is,
  );
});
