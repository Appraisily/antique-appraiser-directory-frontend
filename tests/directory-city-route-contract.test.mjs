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

test('canonical static entry pages load the current route-safe application bundle', () => {
  const publicRoot = path.join(repoRoot, 'public_site');
  const pending = [publicRoot];
  const stale = [];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile() && entry.name === 'index.html') {
        const html = fs.readFileSync(absolute, 'utf8');
        if (html.includes('/assets/index-BkPB_7cp.js')) stale.push(path.relative(repoRoot, absolute));
      }
    }
  }

  assert.deepEqual(stale, []);
  const losAngeles = fs.readFileSync(
    path.join(publicRoot, 'location/los-angeles/index.html'),
    'utf8'
  );
  assert.match(losAngeles, /\/assets\/index-Lwn3tpy2\.js/);
});
