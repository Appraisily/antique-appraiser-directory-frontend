import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

test('homepage source and canonical HTML avoid unsupported certification and scale claims', () => {
  const source = read('src', 'App.tsx');
  const footer = read('src', 'components', 'Footer.tsx');
  const html = read('public_site', 'index.html');

  for (const content of [source, html]) {
    assert.doesNotMatch(content, /Trusted antique valuation network/);
    assert.doesNotMatch(content, /Find certified antique appraisers/);
    assert.doesNotMatch(content, /Verified local specialists and online reports/);
  }

  assert.match(source, /Independent appraisal directory/);
  assert.match(source, /Appraisily is not affiliated with, sponsored by, or endorsing these firms/);
  assert.doesNotMatch(source, /Average appraisal turnaround/);
  assert.doesNotMatch(footer, /certified experts within 48 hours/);
  assert.match(footer, /Confirm provider credentials, scope, fees, availability, and report timing directly/);
  assert.match(html, /Check Local Availability by City/);
  assert.match(html, /appraisily-directory-trust-v1\.js\?v=20260803b/);
});

test('thin and empty city pages state their actual listing depth', () => {
  const chicago = read('public_site', 'location', 'chicago', 'index.html');
  const milwaukee = read('public_site', 'location', 'milwaukee', 'index.html');
  const desMoines = read('public_site', 'location', 'des-moines', 'index.html');

  assert.match(chicago, /currently listed Chicago-area option/);
  assert.match(chicago, /This page currently lists 1 provider/);
  assert.doesNotMatch(chicago, /This page lists 4 providers/);

  assert.match(milwaukee, /Options Serving Milwaukee and Nearby Areas/);
  assert.match(milwaukee, /including its Brown Deer location/);
  assert.doesNotMatch(milwaukee, /Compare Milwaukee antique and art appraisers near you/);

  assert.match(desMoines, /No local appraiser profiles are currently listed/);
  assert.match(desMoines, /This page currently lists 0 providers/);
  assert.doesNotMatch(desMoines, /Use the local provider profiles above/);
  assert.doesNotMatch(desMoines, /This page lists 3 providers/);
});

test('location source avoids comparison promises when listings are thin', () => {
  const source = read('src', 'pages', 'StandardizedLocationPage.tsx');

  assert.match(source, /Check local availability or start online/);
  assert.match(source, /Current listings by city and niche/);
  assert.match(source, /confirm location, credentials, scope, fees, and availability directly/);
  assert.match(source, /No local profiles are currently listed for Des Moines/);
  assert.match(source, /No local listings currently published/);
  assert.doesNotMatch(source, /No verified local listings yet/);
  assert.doesNotMatch(source, /No verified antique appraiser is currently listed/);
  assert.match(source, /including its Brown Deer location/);
  assert.doesNotMatch(source, /Compare local appraisers or start online/);
  assert.doesNotMatch(source, /Local specialists by city and niche/);
  assert.doesNotMatch(source, /Use this list to contact in-person providers or compare them/);
  assert.doesNotMatch(source, /Compare providers in \$\{nearbyCity\.name\}/);
});

test('runtime trust patch preserves corrections after SPA hydration', () => {
  const patch = read('public_site', 'assets', 'appraisily-directory-trust-v1.js');

  assert.match(patch, /Editorial examples only\. Appraisily is not affiliated/);
  assert.match(patch, /No local provider profiles are currently listed for Des Moines/);
  assert.match(patch, /Antique Appraisal Options Serving Milwaukee and Nearby Areas/);
  assert.match(patch, /Check local availability or start online/);
  assert.match(patch, /confirm its Brown Deer location, service area, and specialty directly/);
  assert.match(patch, /querySelectorAll\('h1, h2, h3, p, span, a, figcaption'\)/);
  assert.match(patch, /MutationObserver/);
});
