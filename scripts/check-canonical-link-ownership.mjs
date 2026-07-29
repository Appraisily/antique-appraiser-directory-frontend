#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const publicDirIndex = args.indexOf('--public-dir');
const publicDir = path.resolve(
  publicDirIndex >= 0 ? args[publicDirIndex + 1] : 'public_site',
);
const failOnOrphans = args.includes('--fail-on-orphans');
const failures = [];
const profileInlinks = new Map();

const appraisers = JSON.parse(
  await fs.readFile(path.join(publicDir, 'appraisers.json'), 'utf8'),
).appraisers;
for (const provider of appraisers) profileInlinks.set(provider.slug, []);

function isIndexable(html) {
  const robots =
    html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']robots["']/i)?.[1] ??
    '';
  return !/\bnoindex\b/i.test(robots);
}

async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(filename);
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = await fs.readFile(filename, 'utf8');
      const relative = path.relative(publicDir, filename);
      if (html.includes('https://articles.appraisily.com')) {
        failures.push(`${relative}: redirect-through articles hostname`);
      }
      if (isIndexable(html)) {
        for (const match of html.matchAll(/href=["']\/appraiser\/([^/#?"']+)\/?["']/g)) {
          if (!profileInlinks.has(match[1])) {
            failures.push(`${relative}: unknown published profile link ${match[1]}`);
            continue;
          }
          profileInlinks.get(match[1]).push(relative);
        }
      }
    }
  }
}
await walk(publicDir);

const hubOnlyProfiles = [];
for (const [slug, inlinks] of profileInlinks) {
  if (inlinks.length === 0) {
    hubOnlyProfiles.push(slug);
    if (failOnOrphans) {
      failures.push(`${slug}: no inlink from an indexable rendered HTML surface`);
    }
  }
}

const result = {
  action: 'check-canonical-link-ownership',
  ok: failures.length === 0,
  publicDir,
  policy:
    'hub-only profiles are reported, not auto-linked; city ownership requires separately reviewed source evidence',
  failOnOrphans,
  profileCount: profileInlinks.size,
  profilesWithIndexableInlinks: profileInlinks.size - hubOnlyProfiles.length,
  orphanProfileCount: hubOnlyProfiles.length,
  hubOnlyProfiles: hubOnlyProfiles.sort(),
  failureCount: failures.length,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
