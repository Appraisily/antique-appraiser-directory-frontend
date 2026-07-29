import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  renderComparisonModule,
  run,
} from '../scripts/apply-city-provider-comparison-modules.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('comparison renderer preserves verified facts and limits source-listed claims', () => {
  const html = renderComparisonModule({
    city: { slug: 'example-city', label: 'Example City' },
    providers: [
      {
        route: '/appraiser/verified-provider/',
        name: 'Verified Provider',
        publicationStatus: 'verified',
        reviewDate: 'July 15, 2026',
        facts: {
          specialty: 'Fine art',
          'assignment fit': 'Insurance and estate',
          'inspection mode': 'Confirm requirements directly',
          'primary location': 'Example City',
          'fees and timing': 'Confirm directly',
        },
      },
      {
        route: '/appraiser/limited-provider/',
        name: 'Limited Provider',
        publicationStatus: 'limited',
        reviewDate: 'July 11, 2026',
        facts: {},
      },
    ],
    alternatives: [
      { slug: 'nearby-city', label: 'Nearby City' },
      { slug: 'second-city', label: 'Second City' },
      { slug: 'third-city', label: 'Third City' },
    ],
  });

  assert.match(html, /data-verified-count="1"/);
  assert.match(html, /data-source-listed-count="1"/);
  assert.match(html, />Fine art</);
  assert.match(html, />Insurance and estate</);
  assert.match(html, /Source-listed · identity and official website only/);
  assert.match(html, /Not independently verified — confirm directly/);
  assert.match(html, /data-filter-policy="withheld-provider-count-below-3"/);
  assert.match(html, /style="max-width:100%;overflow-x:auto"/);
  assert.match(html, /Nearby directory alternatives with published profiles/);
  assert.doesNotMatch(html, /Limited Provider[\s\S]*Fine art/);
});

test('renderer fails closed when a city reaches the filter threshold', () => {
  assert.throws(
    () =>
      renderComparisonModule({
        city: { slug: 'filter-city', label: 'Filter City' },
        providers: [1, 2, 3].map((value) => ({
          route: `/appraiser/provider-${value}/`,
          name: `Provider ${value}`,
          publicationStatus: 'limited',
          reviewDate: 'July 11, 2026',
          facts: {},
        })),
        alternatives: [],
      }),
    /requires a separately designed filter control/
  );
});

test('current artifact has one claim-safe comparison row per published city provider', async () => {
  const result = await run({
    publicDir: path.join(ROOT, 'public_site'),
    manifest: path.join(ROOT, 'data', 'provider-publication-manifest.json'),
    write: false,
  });
  assert.equal(result.ok, true, JSON.stringify(result.failures, null, 2));
  assert.equal(result.indexableCityCount, 85);
  assert.equal(result.eligibleCityCount, 32);
  assert.equal(result.providerlessCityCount, 53);
  assert.equal(result.providerRowCount, 37);
  assert.equal(result.moduleCount, 32);
  assert.equal(result.tableRowCount, 37);
});
