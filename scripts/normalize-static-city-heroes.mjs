#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const LEGACY_CLASSES =
  'bg-gradient-to-r from-blue-700 to-blue-500 text-white';
const SAFE_CLASSES = 'bg-gray-900 text-white';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function listCityFiles(publicDir) {
  const locationDir = path.join(publicDir, 'location');
  const entries = await fs.readdir(locationDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(locationDir, entry.name, 'index.html'));
}

export async function normalizeStaticCityHeroes({ publicDir, write = false }) {
  const changedFiles = [];
  const failures = [];
  let cityHeroCount = 0;

  for (const filename of await listCityFiles(publicDir)) {
    let source;
    try {
      source = await fs.readFile(filename, 'utf8');
    } catch {
      continue;
    }
    const hasLegacyHero = source.includes(LEGACY_CLASSES);
    const hasSafeHero = source.includes(SAFE_CLASSES);
    if (!hasLegacyHero && !hasSafeHero) continue;
    cityHeroCount += 1;

    const normalized = source.replaceAll(LEGACY_CLASSES, SAFE_CLASSES);
    if (!normalized.includes(SAFE_CLASSES)) {
      failures.push({
        route: `/location/${path.basename(path.dirname(filename))}/`,
        code: 'STATIC_CITY_HERO_CONTRAST_BOUNDARY_MISSING',
      });
      continue;
    }
    if (normalized !== source) {
      const relativePath = path.relative(publicDir, filename);
      changedFiles.push(relativePath);
      if (write) await fs.writeFile(filename, normalized);
    }
  }

  return {
    ok: failures.length === 0 && (write || changedFiles.length === 0),
    mode: write ? 'write' : 'check',
    cityHeroCount,
    changedFileCount: changedFiles.length,
    changedFiles,
    failures,
  };
}

const isCli = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isCli) {
  const result = await normalizeStaticCityHeroes({
    publicDir: path.resolve(readArg('--public-dir', 'public_site')),
    write: process.argv.includes('--write'),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
