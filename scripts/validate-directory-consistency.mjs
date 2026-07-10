#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const publicDirArgIndex = args.indexOf('--public-dir');
const publicDir = path.resolve(
  publicDirArgIndex >= 0 && args[publicDirArgIndex + 1]
    ? args[publicDirArgIndex + 1]
    : 'public_site'
);
const repoRoot = path.resolve(publicDir, '..');
const baseUrl = 'https://antique-appraiser-directory.appraisily.com';
const errors = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readTextIfExists(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message) {
  errors.push(message);
}

function slugFromUrl(url) {
  const match = String(url || '').match(/\/appraiser\/([^/]+)\/?$/);
  return match ? match[1] : '';
}

function isUnderReviewProfile(slug) {
  if (!slug) return false;
  const filePath = path.join(publicDir, 'appraiser', slug, 'index.html');
  if (!fs.existsSync(filePath)) return false;
  const html = fs.readFileSync(filePath, 'utf8');
  return /Profile Under Review/i.test(html) || /<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
}

const appraisersFeed = readJson('public_site/appraisers.json');
const directoryFeed = readJson('public_site/directory.json');
const sitemap = readText('public_site/sitemap.xml');
const appraisers = Array.isArray(appraisersFeed.appraisers) ? appraisersFeed.appraisers : [];
const directoryAppraisers = Array.isArray(directoryFeed.appraisers) ? directoryFeed.appraisers : [];
const directoryLocations = Array.isArray(directoryFeed.locations) ? directoryFeed.locations : [];
const absoluteGetListedHref = `${baseUrl}/get-listed/`;
const appraisilyHostLocationSlugs = ['boston', 'denver', 'des-moines'];
const blockedProfiles = [
  {
    slug: 'los-angeles-antique-appraisals',
    name: 'Los Angeles Antique Appraisals',
    reason: 'unverified placeholder profile; source website does not resolve',
  },
];
const newYorkBlockedNames = [
  'Anderson Fine Art Appraisals',
  'Escher Associates',
  'Gurr Johns',
  'Mary Peck Art Advisory',
  'Mimesis Gallery',
];

if (appraisersFeed.count !== appraisers.length) {
  fail(`appraisers.json count ${appraisersFeed.count} does not match appraisers length ${appraisers.length}`);
}

if (directoryFeed.counts?.appraisers !== directoryAppraisers.length) {
  fail(`directory.json counts.appraisers ${directoryFeed.counts?.appraisers} does not match appraisers length ${directoryAppraisers.length}`);
}

if (directoryFeed.counts?.locations !== directoryLocations.length) {
  fail(`directory.json counts.locations ${directoryFeed.counts?.locations} does not match locations length ${directoryLocations.length}`);
}

for (const appraiser of appraisers) {
  const slug = appraiser.slug || slugFromUrl(appraiser.url);
  const profilePath = path.join(publicDir, 'appraiser', slug, 'index.html');
  if (!slug || !fs.existsSync(profilePath)) {
    fail(`appraiser feed entry missing profile file: ${appraiser.name || appraiser.url || slug}`);
    continue;
  }
  const canonicalUrl = appraiser.url || `${baseUrl}/appraiser/${slug}/`;
  if (!sitemap.includes(canonicalUrl) && !isUnderReviewProfile(slug)) {
    fail(`profile URL missing from sitemap: ${canonicalUrl}`);
  }
}

for (const blocked of blockedProfiles) {
  const profilePath = path.join(publicDir, 'appraiser', blocked.slug, 'index.html');
  if (fs.existsSync(profilePath)) {
    fail(`blocked profile still has a public profile page: ${blocked.slug} (${blocked.reason})`);
  }
  if (sitemap.includes(`/appraiser/${blocked.slug}/`)) {
    fail(`blocked profile appears in sitemap: ${blocked.slug} (${blocked.reason})`);
  }

  for (const [feedName, feedAppraisers] of Object.entries({ appraisers, directoryAppraisers })) {
    for (const appraiser of feedAppraisers) {
      const slug = appraiser.slug || slugFromUrl(appraiser.url);
      if (slug === blocked.slug || appraiser.name === blocked.name || String(appraiser.url || '').includes(`/appraiser/${blocked.slug}/`)) {
        fail(`blocked profile appears in ${feedName}: ${blocked.slug} (${blocked.reason})`);
      }
    }
  }

  for (const location of directoryLocations) {
    const locationSlug = location.slug || slugFromUrl(location.url);
    const listed = Array.isArray(location.listedAppraisers) ? location.listedAppraisers : [];
    for (const listedAppraiser of listed) {
      const appraiserSlug = listedAppraiser.slug || slugFromUrl(listedAppraiser.url);
      if (appraiserSlug === blocked.slug || listedAppraiser.name === blocked.name) {
        fail(`location ${locationSlug} links blocked profile: ${blocked.slug} (${blocked.reason})`);
      }
    }
  }

  const locationDir = path.join(publicDir, 'location');
  if (fs.existsSync(locationDir)) {
    for (const locationSlug of fs.readdirSync(locationDir)) {
      const html = readTextIfExists(`public_site/location/${locationSlug}/index.html`);
      if (html.includes(`/appraiser/${blocked.slug}/`) || html.includes(blocked.name)) {
        fail(`rendered location ${locationSlug} links blocked profile: ${blocked.slug} (${blocked.reason})`);
      }
    }
  }
}

for (const location of directoryLocations) {
  const slug = location.slug || slugFromUrl(location.url);
  if (!slug) continue;
  if (slug !== 'los-angeles') continue;
  const listed = Array.isArray(location.listedAppraisers) ? location.listedAppraisers : [];
  for (const listedAppraiser of listed) {
    const appraiserSlug = listedAppraiser.slug || slugFromUrl(listedAppraiser.url);
    if (isUnderReviewProfile(appraiserSlug)) {
      fail(`location ${slug} links under-review profile: ${appraiserSlug}`);
    }
  }
}

const newYorkHtml = readTextIfExists('public_site/location/new-york/index.html');
const newYorkJson = readTextIfExists('public_site/location/new-york/index.json');
for (const blockedName of newYorkBlockedNames) {
  if (newYorkHtml.includes(blockedName) || newYorkJson.includes(blockedName)) {
    fail(`New York rendered location still contains out-of-city appraiser: ${blockedName}`);
  }
}

const cityExpectations = {
  'new-york': { cities: ['New York'], states: ['NY'] },
  'los-angeles': { cities: ['Los Angeles', 'Pasadena'], states: ['CA'] },
};

for (const [slug, expected] of Object.entries(cityExpectations)) {
  for (const dataDir of ['src/data/standardized', 'src/data/standardized_verified']) {
    const file = path.join(dataDir, `${slug}.json`);
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) continue;
    const locationData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const locationAppraisers = Array.isArray(locationData.appraisers) ? locationData.appraisers : [];
    for (const appraiser of locationAppraisers) {
      const address = appraiser.address || {};
      const city = address.city || appraiser.city || '';
      const state = address.state || address.region || appraiser.state || '';
      if (city && !expected.cities.includes(city)) {
        fail(`${file} contains out-of-city appraiser ${appraiser.name}: ${city}, ${state}`);
      }
      if (state && !expected.states.includes(state)) {
        fail(`${file} contains out-of-state appraiser ${appraiser.name}: ${city}, ${state}`);
      }
    }
  }
}

for (const slug of appraisilyHostLocationSlugs) {
  const html = readTextIfExists(`public_site/location/${slug}/index.html`);
  if (!html) {
    fail(`appraisily-hosted location page missing: ${slug}`);
    continue;
  }

  const relativeGetListedMatches = html.match(/href=["']\/get-listed\/["']/g) || [];
  if (relativeGetListedMatches.length > 0) {
    fail(`appraisily-hosted location ${slug} has relative /get-listed/ links that resolve to appraisily.com 404s`);
  }

  if (!html.includes(`href="${absoluteGetListedHref}"`)) {
    fail(`appraisily-hosted location ${slug} is missing absolute directory get-listed link: ${absoluteGetListedHref}`);
  }
}

if (errors.length) {
  console.error(JSON.stringify({ action: 'validated-directory-consistency', ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  action: 'validated-directory-consistency',
  ok: true,
  publicDir,
  appraisers: appraisers.length,
  locations: directoryLocations.length,
}, null, 2));
