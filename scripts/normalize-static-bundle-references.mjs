#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CURRENT_BUNDLE = '/assets/index-DJGWEWy1.js';
const CURRENT_STYLESHEET = '/assets/index-DQEsr2yV.css';
const RETIRED_BUNDLE_PATTERN = /\/assets\/index-BrMmeR5F\.js(?:\?[^"'\s>]*)?/g;
const RETIRED_STYLESHEET_PATTERN = /\/assets\/index-n6ICzsWQ\.css(?:\?[^"'\s>]*)?/g;

function parseArgs(argv) {
  const options = { publicDir: path.join(ROOT, 'public_site'), write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--write') options.write = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

async function listHtml(root) {
  const files = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listHtml(filename));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(filename);
  }
  return files;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const changedFiles = [];
  const missingAssets = [];

  for (const filename of await listHtml(options.publicDir)) {
    const source = await fs.readFile(filename, 'utf8');
    const normalized = source
      .replace(RETIRED_BUNDLE_PATTERN, CURRENT_BUNDLE)
      .replace(RETIRED_STYLESHEET_PATTERN, CURRENT_STYLESHEET);
    if (normalized !== source) {
      changedFiles.push(path.relative(options.publicDir, filename));
      if (options.write) await fs.writeFile(filename, normalized);
    }

    const html = options.write ? normalized : source;
    for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/gi)) {
      const assetPath = match[1].split(/[?#]/, 1)[0];
      try {
        await fs.access(path.join(options.publicDir, assetPath.slice(1)));
      } catch {
        missingAssets.push({
          page: path.relative(options.publicDir, filename),
          asset: assetPath,
        });
      }
    }
  }

  const result = {
    action: options.write ? 'normalized-static-bundle-references' : 'checked-static-bundle-references',
    ok: missingAssets.length === 0 && (options.write || changedFiles.length === 0),
    currentBundle: CURRENT_BUNDLE,
    currentStylesheet: CURRENT_STYLESHEET,
    changedFileCount: changedFiles.length,
    changedFiles,
    missingAssetCount: missingAssets.length,
    missingAssets,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
