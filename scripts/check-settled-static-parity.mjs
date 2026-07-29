#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public_site');
const failures = [];

const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const appraisers = JSON.parse(read('public_site/appraisers.json'));
const locations = JSON.parse(read('public_site/locations.json'));
const homepage = read('public_site/index.html');
const mainSource = read('src/main.tsx');
const appSource = read('src/App.tsx');
const locationSource = read('src/pages/StandardizedLocationPage.tsx');

const statusCounts = (appraisers.appraisers || []).reduce((counts, entry) => {
  const status = entry.publication?.status || 'unknown';
  counts[status] = (counts[status] || 0) + 1;
  return counts;
}, {});

const expectedCountSentence = `${appraisers.count} public provider profiles</strong>: ${statusCounts.verified || 0} verified profiles and ${statusCounts.limited || 0} source-listed profiles. It also contains ${locations.count} indexable city pages.`;
if (!homepage.includes(expectedCountSentence)) {
  failures.push(`Homepage publication counts do not match the feeds: ${expectedCountSentence}`);
}

for (const required of [
  "if (hasPreRenderedContent)",
  "rootElement.setAttribute('data-static-authoritative-preserved', 'true')",
  'window.__APPRAISILY_CLIENT_RENDER_ONLY__ = false',
]) {
  if (!mainSource.includes(required)) {
    failures.push(`Static preservation contract is missing ${JSON.stringify(required)}.`);
  }
}
for (const prohibited of [
  "preRenderRoot.remove()",
  "createRoot(renderTarget)",
  "spaRoot.setAttribute('data-spa-root'",
]) {
  if (mainSource.includes(prohibited)) {
    failures.push(`Static pages must not retain ${JSON.stringify(prohibited)}.`);
  }
}

for (const prohibited of [
  'Find <span className="italic text-primary">certified antique appraisers</span>',
  'Verified local specialists and online reports, city by city.',
  'Every submission is matched with a certified specialist',
  '/appraiser/sothebys-new-york',
  '/appraiser/heritage-auctions',
]) {
  if (appSource.includes(prohibited)) {
    failures.push(`Fallback homepage retains stale or unsafe content ${JSON.stringify(prohibited)}.`);
  }
}

if (locationSource.includes('art-appraisers-directory.appraisily.com')) {
  failures.push('Hydrated location source still links to the retired Art Appraisers Directory host.');
}
if (!locationSource.includes("buildSiteUrl('/appraiser/#reviewed-fine-art-heading')")) {
  failures.push('Hydrated location source lacks the canonical reviewed fine-art recovery link.');
}

const featuredSlugs = [
  'st-lifer-art-inc-international-art-appraiser',
  'afp-art-consulting-llc-fine-art-consulting-appraisals-research-writing-and-collections-man',
  'sarah-ann-wilson-art-services',
];
const feedBySlug = new Map((appraisers.appraisers || []).map(entry => [entry.slug, entry]));
for (const slug of featuredSlugs) {
  const entry = feedBySlug.get(slug);
  if (!entry || entry.publication?.status !== 'verified') {
    failures.push(`${slug}: featured fallback profile must be verified and present in appraisers.json.`);
  }
  const profilePath = path.join(publicDir, 'appraiser', slug, 'index.html');
  if (!fs.existsSync(profilePath)) {
    failures.push(`${slug}: featured fallback profile route is missing.`);
  } else {
    const profile = fs.readFileSync(profilePath, 'utf8');
    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(profile)) {
      failures.push(`${slug}: featured fallback profile route is noindex.`);
    }
  }
}

const bundleMatch = homepage.match(/<script[^>]+type=["']module["'][^>]+src=["']\/assets\/(index-[^"'?]+\.js)/i);
if (!bundleMatch) {
  failures.push('Homepage does not reference the shared module bundle.');
} else {
  const bundlePath = path.join(publicDir, 'assets', bundleMatch[1]);
  if (!fs.existsSync(bundlePath)) {
    failures.push(`Referenced bundle is missing: ${bundleMatch[1]}`);
  } else {
    const bundle = fs.readFileSync(bundlePath, 'utf8');
    if (!bundle.includes('data-static-authoritative-preserved')) {
      failures.push('Published bundle does not contain the static-authoritative preservation marker.');
    }
    if (bundle.includes('art-appraisers-directory.appraisily.com/location/')) {
      failures.push('Published bundle retains the retired location-host link.');
    }
  }
}

if (failures.length > 0) {
  console.error('Settled static parity contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Settled static parity passed (${appraisers.count} profiles, ${locations.count} locations, ${featuredSlugs.length} safe featured routes).`);
