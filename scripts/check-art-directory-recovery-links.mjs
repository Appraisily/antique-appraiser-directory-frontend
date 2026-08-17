#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_site');
const NGINX_PATH = path.join(ROOT, 'nginx.conf');
const ART_ORIGIN = 'art-appraisers-directory.appraisily.com';
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
const obsoleteModules = [];
for (const filename of await walk(PUBLIC_DIR)) {
  const contents = await fs.readFile(filename, 'utf8');
  const relative = path.relative(PUBLIC_DIR, filename);
  if (
    contents.includes('data-directory-crosslink="antique-to-art"') ||
    contents.includes("data-directory-crosslink='antique-to-art'") ||
    contents.includes('data-art-directory-recovery-links=')
  ) {
    obsoleteModules.push(relative);
  }
}
if (obsoleteModules.length) failures.push(`obsolete crosslink module remains in ${obsoleteModules.length} public file(s)`);

const sitemap = await fs.readFile(path.join(PUBLIC_DIR, 'sitemap.xml'), 'utf8');
const appraiserIndex = await fs.readFile(path.join(PUBLIC_DIR, 'appraiser/index.html'), 'utf8');
const nginx = await fs.readFile(NGINX_PATH, 'utf8');
for (const slug of MIGRATED_SLUGS) {
  const antiqueRoute = `/appraiser/${slug}/`;
  if (sitemap.includes(antiqueRoute)) failures.push(`Art-canonical profile still in antique sitemap: ${antiqueRoute}`);
  if (appraiserIndex.includes(`href="${antiqueRoute}"`)) {
    failures.push(`Art-canonical profile still listed as an antique profile: ${antiqueRoute}`);
  }
  if (!nginx.includes(slug)) failures.push(`missing antique nginx 301 for ${slug}`);
}
if (!appraiserIndex.includes(`https://${ART_ORIGIN}/`)) {
  failures.push('appraiser index is missing the restored Art directory handoff');
}
if (appraiserIndex.includes('retired Art Appraisers Directory')) {
  failures.push('appraiser index still describes the Art host as retired');
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  artOrigin: ART_ORIGIN,
  scannedFiles: (await walk(PUBLIC_DIR)).length,
  migratedProfiles: MIGRATED_SLUGS.length,
  obsoleteModules,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
