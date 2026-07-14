#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'coverage']);
const providerName = ['image', 'kit'].join('');
const forbiddenTokens = [
  ['retired image host', ['ik', providerName, 'io'].join('.')],
  ['retired provider name', providerName],
  ['provider-branded asset path', `/${providerName}/`],
];
const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(filePath);
      continue;
    }
    if (!entry.isFile()) continue;
    const buffer = fs.readFileSync(filePath);
    if (buffer.includes(0)) continue;
    const contents = buffer.toString('utf8').toLowerCase();
    for (const [label, token] of forbiddenTokens) {
      if (contents.includes(token)) failures.push(`${path.relative(ROOT, filePath)}: contains ${label}`);
    }
  }
}

walk(ROOT);
if (failures.length) {
  console.error('[retired-image-provider] failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('[retired-image-provider] no retired provider references found.');
