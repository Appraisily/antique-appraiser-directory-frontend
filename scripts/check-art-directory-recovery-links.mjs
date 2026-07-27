#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_site');
const RETIRED_ORIGIN = 'art-appraisers-directory.appraisily.com';
const MIGRATED_SLUGS = [
  'afp-art-consulting-llc-fine-art-consulting-appraisals-research-writing-and-collections-man',
  'heidi-vaughan-ma-isa-am',
  'open-to-the-public',
  'sarah-ann-wilson-art-services',
  'st-lifer-art-inc-international-art-appraiser',
];

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && /\.(?:html|json|xml|txt)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

const failures = [];
const retiredReferences = [];
const obsoleteModules = [];
for (const filename of await walk(PUBLIC_DIR)) {
  const contents = await fs.readFile(filename, 'utf8');
  const relative = path.relative(PUBLIC_DIR, filename);
  if (contents.includes(RETIRED_ORIGIN)) retiredReferences.push(relative);
  if (
    contents.includes('data-directory-crosslink="antique-to-art"') ||
    contents.includes("data-directory-crosslink='antique-to-art'") ||
    contents.includes('data-art-directory-recovery-links=')
  ) {
    obsoleteModules.push(relative);
  }
}
if (retiredReferences.length) failures.push(`retired Art host remains in ${retiredReferences.length} public file(s)`);
if (obsoleteModules.length) failures.push(`obsolete crosslink module remains in ${obsoleteModules.length} public file(s)`);

const sitemap = await fs.readFile(path.join(PUBLIC_DIR, 'sitemap.xml'), 'utf8');
const appraiserIndex = await fs.readFile(path.join(PUBLIC_DIR, 'appraiser/index.html'), 'utf8');
for (const slug of MIGRATED_SLUGS) {
  const route = `/appraiser/${slug}/`;
  if (!sitemap.includes(route)) failures.push(`migrated profile missing from sitemap: ${route}`);
  if (!appraiserIndex.includes(`href="${route}"`)) failures.push(`migrated profile missing from appraiser index: ${route}`);
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  retiredOrigin: RETIRED_ORIGIN,
  scannedFiles: (await walk(PUBLIC_DIR)).length,
  migratedProfiles: MIGRATED_SLUGS.length,
  retiredReferences,
  obsoleteModules,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
