import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(repoRoot, 'src/data/cities.json'), 'utf8');
const { cities } = JSON.parse(source);
const publishedCities = cities.filter(
  city => Number.isFinite(city.latitude) && Number.isFinite(city.longitude)
);

test('every published city has a generated public location route', () => {
  const missingRoutes = publishedCities
    .map(city => city.slug)
    .filter(slug => !fs.existsSync(path.join(repoRoot, 'public_site/location', slug, 'index.html')));

  assert.deepEqual(missingRoutes, []);
});

test('customer browse and search surfaces use the route-backed city list', () => {
  const app = fs.readFileSync(path.join(repoRoot, 'src/App.tsx'), 'utf8');
  const citySearch = fs.readFileSync(path.join(repoRoot, 'src/components/CitySearch.tsx'), 'utf8');
  const locationPage = fs.readFileSync(path.join(repoRoot, 'src/pages/StandardizedLocationPage.tsx'), 'utf8');

  assert.match(app, /publishedCities as cities/);
  assert.match(citySearch, /publishedCities as cities/);
  assert.match(locationPage, /\$\{locationData\.appraisers\.length\} \$\{expertLabel\}/);
  assert.equal(publishedCities.length, 101);
});
