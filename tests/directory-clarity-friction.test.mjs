import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function readDocument(...parts) {
  return new JSDOM(read(...parts)).window.document;
}

test('Baltimore exposes one working provider card without a one-pixel image or stale count', () => {
  const document = readDocument('public_site', 'location', 'baltimore', 'index.html');
  const localSection = document.querySelector('#local-appraisers');
  const providerCard = localSection.querySelector('a[href="/appraiser/mayflower-estate-buyers/"]');

  assert.ok(providerCard);
  assert.equal(
    providerCard.querySelector('img')?.getAttribute('src'),
    '/assets/generated-appraiser-profiles/mayflower-estate-buyers.svg',
  );
  assert.match(providerCard.textContent, /Directory illustration; not a provider likeness/);
  assert.match(document.body.textContent, /This page currently lists 1 provider/);
  assert.doesNotMatch(document.body.textContent, /This page lists 3 providers/);
});

test('Indianapolis states zero local profiles before users click and does not hydrate stale promises', () => {
  const document = readDocument('public_site', 'location', 'indianapolis', 'index.html');
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
  const nearbyLink = document.querySelector('a[href="/location/"]');

  assert.equal(
    document.title,
    'Indianapolis Appraisal Options | No Local Profile Currently Listed',
  );
  assert.match(description, /No local appraiser profile is currently published/);
  assert.equal(document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex, follow');
  assert.equal(document.querySelector('script[type="module"]'), null);
  assert.equal(document.querySelector('h1')?.textContent.trim(), 'Indianapolis appraisal options');
  assert.ok(document.querySelector('h1')?.closest('section')?.classList.contains('bg-blue-600'));
  assert.match(document.body.textContent, /This page currently lists 0 providers/);
  assert.doesNotMatch(document.body.textContent, /This page lists 9 providers/);
  assert.doesNotMatch(document.body.textContent, /Jump to local providers/);
  assert.doesNotMatch(document.body.textContent, /contact an Indianapolis appraiser/);
  assert.match(nearbyLink?.textContent, /Browse all locations/);
});

test('Virginia Beach repairs the tiny provider image and missing city after SPA hydration', () => {
  const document = readDocument('public_site', 'location', 'virginia-beach', 'index.html');
  const localSection = document.querySelector('#local-appraisers');
  const providerCard = localSection.querySelector(
    'a[href="/appraiser/barrett-street-auction-center-antique-mall/"]',
  );

  assert.ok(providerCard);
  assert.equal(
    providerCard.querySelector('img')?.getAttribute('src'),
    '/assets/generated-appraiser-profiles/barrett-street-auction-center-antique-mall.svg',
  );
  assert.match(providerCard.textContent, /Directory illustration; not a provider likeness/);
  assert.ok(
    document.querySelector('script[src="/assets/location-card-clarity-fix-20260813.js"]'),
  );

  const dom = new JSDOM(
    `<!doctype html><html><body>
      <article data-clarity-action="location_appraiser_card">
        <div><span>B</span><img src="tiny.jpg"></div>
        <div><svg class="lucide-map-pin"></svg><span></span></div>
      </article>
    </body></html>`,
    {
      runScripts: 'outside-only',
      url: 'https://antique-appraiser-directory.appraisily.com/location/virginia-beach/',
    },
  );
  const image = dom.window.document.querySelector('img');
  Object.defineProperty(image, 'complete', { value: true, configurable: true });
  Object.defineProperty(image, 'naturalWidth', { value: 1, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: 1, configurable: true });
  dom.window.setTimeout = (callback) => {
    callback();
    return 0;
  };
  dom.window.eval(read('public_site', 'assets', 'location-card-clarity-fix-20260813.js'));

  assert.equal(image.style.display, 'none');
  assert.equal(image.dataset.tinyPlaceholderHidden, 'true');
  assert.equal(
    dom.window.document.querySelector('.lucide-map-pin + span')?.textContent,
    'Virginia Beach, Virginia',
  );
  dom.window.close();
});

test('Milwaukee replaces the one-pixel provider image with a disclosed directory illustration', () => {
  const document = readDocument('public_site', 'location', 'milwaukee', 'index.html');
  const providerCard = document.querySelector(
    '#local-appraisers a[href="/appraiser/cedarburg-auction-appraisals-llc/"]',
  );

  assert.ok(providerCard);
  assert.equal(
    providerCard.querySelector('img')?.getAttribute('src'),
    '/assets/generated-appraiser-profiles/cedarburg-auction-appraisals-llc.svg',
  );
  assert.match(providerCard.textContent, /Directory illustration; not a provider likeness/);
  assert.doesNotMatch(
    providerCard.innerHTML,
    /appraiser_milwaukee-cedarburg-auction-appraisals-llc_1742202773948_e95lPwg3L\.jpg/,
  );
  assert.ok(
    document.querySelector('script[src="/assets/location-card-clarity-fix-20260813.js"]'),
  );
});

test('Milwaukee reapplies the reviewed illustration after SPA hydration', () => {
  const brokenImage =
    'https://assets.appraisily.com/assets/directory/appraiser-images/' +
    'appraiser_milwaukee-cedarburg-auction-appraisals-llc_1742202773948_e95lPwg3L.jpg';
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <article data-clarity-action="location_appraiser_card">
        <a href="https://antique-appraiser-directory.appraisily.com/appraiser/cedarburg-auction-appraisals-llc/"></a>
        <div class="relative h-48"><img src="${brokenImage}" alt="Provider"></div>
        <div class="p-4"><h2>Cedarburg Auction & Appraisals LLC</h2></div>
      </article>
    </body></html>`,
    {
      runScripts: 'outside-only',
      url: 'https://antique-appraiser-directory.appraisily.com/location/milwaukee/',
    },
  );
  dom.window.setTimeout = (callback) => {
    callback();
    return 0;
  };
  dom.window.eval(read('public_site', 'assets', 'location-card-clarity-fix-20260813.js'));

  const card = dom.window.document.querySelector(
    'article[data-clarity-action="location_appraiser_card"]',
  );
  assert.equal(
    card.querySelector('img')?.getAttribute('src'),
    '/assets/generated-appraiser-profiles/cedarburg-auction-appraisals-llc.svg',
  );
  assert.equal(
    card.querySelectorAll('[data-directory-illustration-disclosure]').length,
    1,
  );
  assert.match(card.textContent, /Directory illustration; not a provider likeness/);
  dom.window.close();
});

test('location card source keeps the whole card navigable and hides tiny loaded placeholders', () => {
  const source = read('src', 'pages', 'StandardizedLocationPage.tsx');

  assert.match(source, /data-clarity-action="location_appraiser_card"/);
  assert.match(source, /className="absolute inset-0 z-10 rounded-lg/);
  assert.match(source, /onClick=\{\(event\) => navigateToAppraiserCard/);
  assert.match(source, /hideTinyPlaceholderImage\(e\.currentTarget\)/);
  assert.match(source, /appraiser\.address\.formatted \|\|/);
});
