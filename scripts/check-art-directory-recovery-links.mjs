#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const file = path.resolve(import.meta.dirname, '../public_site/index.html');
const html = await fs.readFile(file, 'utf8');
const registryPath =
  '/srv/repos/tools/directory-site-utils/references/art-route-registry.json';
const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
const allowed = new Set(
  registry.routes
    .filter((route) => route.publicationStatus === 'published')
    .map((route) => route.canonicalUrl),
);
const destinations = [
  [registry.routes.find((route) => route.kind === 'home')?.canonicalUrl, 'Browse the reviewed fine-art appraiser directory'],
  [registry.routes.find((route) => route.kind === 'location_hub')?.canonicalUrl, 'Compare reviewed art appraisers by primary location'],
];
const failures = [];
if (!html.includes('data-art-directory-recovery-links="1"')) failures.push('missing server-rendered recovery module');
for (const [href, label] of destinations) {
  if (!href) {
    failures.push(`registry is missing the destination for ${label}`);
    continue;
  }
  if (!html.includes(`href="${href}"`)) failures.push(`missing direct link: ${href}`);
  if (!html.includes(`>${label}</a>`)) failures.push(`missing descriptive anchor: ${label}`);
}

async function walkHtml(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(absolute));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(absolute);
  }
  return files;
}

let scannedLinks = 0;
let genericHubCrosslinks = 0;
for (const documentPath of await walkHtml(path.resolve(import.meta.dirname, '../public_site'))) {
  const documentHtml = await fs.readFile(documentPath, 'utf8');
  for (const match of documentHtml.matchAll(/href=["'](https:\/\/art-appraisers-directory\.appraisily\.com\/[^"']*)["']/g)) {
    scannedLinks += 1;
    const target = new URL(match[1]);
    if (target.search || target.hash) failures.push(`tracked or fragmented crawl link in ${documentPath}: ${match[1]}`);
    if (!allowed.has(target.href)) failures.push(`unregistered Art route in ${documentPath}: ${target.href}`);
  }
  for (const match of documentHtml.matchAll(
    /<section\b(?=[^>]*\bdata-directory-crosslink=["']antique-to-art["'])[\s\S]*?<\/section>/gi,
  )) {
    const section = match[0];
    if (!section.includes(`href="${destinations[1][0]}"`) && !section.includes(`href='${destinations[1][0]}'`)) {
      continue;
    }
    genericHubCrosslinks += 1;
    if (
      /Looking for fine-art appraisal in|See art appraisers in|art-only city guide/i.test(section)
    ) {
      failures.push(`generic Art location hub carries a city-specific promise in ${documentPath}`);
    }
    for (const copy of [
      'Looking for a fine-art appraiser?',
      'browse the current source-reviewed art directory.',
      'Browse reviewed art appraisers by location',
    ]) {
      if (!section.includes(copy)) {
        failures.push(`generic Art location hub is missing ${JSON.stringify(copy)} in ${documentPath}`);
      }
    }
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  file,
  registryPath,
  registryArtifactSha256: registry.generatedFrom.artifactSha256,
  destinations: destinations.length,
  scannedLinks,
  genericHubCrosslinks,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
