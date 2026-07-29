#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const publicDirIndex = args.indexOf('--public-dir');
const publicDir = path.resolve(
  publicDirIndex >= 0 ? args[publicDirIndex + 1] : 'public_site',
);
const write = args.includes('--write');
const routeMap = JSON.parse(
  await fs.readFile(
    path.resolve(import.meta.dirname, '../data/canonical-article-route-map.json'),
    'utf8',
  ),
);
const changedFiles = [];
let rewrittenLinks = 0;

function rewrite(rawUrl) {
  const suffixIndex = rawUrl.search(/[?#]/);
  const base = suffixIndex === -1 ? rawUrl : rawUrl.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : rawUrl.slice(suffixIndex);
  const source = new URL(base);
  const canonicalPath = routeMap.routes[source.pathname];
  if (!canonicalPath) {
    throw new Error(`No reviewed canonical mapping for ${source.pathname}`);
  }
  rewrittenLinks += 1;
  return `${routeMap.canonicalOrigin}${canonicalPath}${suffix}`;
}

async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(filename);
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const before = await fs.readFile(filename, 'utf8');
      const after = before.replace(
        /https:\/\/articles\.appraisily\.com[^"'<> ]*/g,
        rewrite,
      );
      if (after === before) continue;
      changedFiles.push(path.relative(publicDir, filename));
      if (write) await fs.writeFile(filename, after, 'utf8');
    }
  }
}
await walk(publicDir);

console.log(
  JSON.stringify(
    {
      action: write
        ? 'rewrote-canonical-article-links'
        : 'planned-canonical-article-link-rewrite',
      publicDir,
      write,
      changedFileCount: changedFiles.length,
      rewrittenLinks,
      changedFiles: changedFiles.sort(),
    },
    null,
    2,
  ),
);
if (!write && changedFiles.length > 0) process.exitCode = 1;
