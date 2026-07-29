#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_PUBLIC_DIR = path.join(ROOT, 'public_site');
const LEGACY_BUNDLE = '/assets/index-BrMmeR5F.js';
const REVIEWED_BUNDLE = '/assets/index-Cd3ca0aQ.js';

const ROUTES = [
  'anchorage',
  'austin',
  'baltimore',
  'boston',
  'calgary',
  'chicago',
  'cincinnati',
  'denver',
  'fort-lauderdale',
  'fort-worth',
  'halifax',
  'honolulu',
  'jacksonville',
  'kelowna',
  'milwaukee',
  'nashville',
  'new-york',
  'oakland',
  'ottawa',
  'palm-beach',
  'philadelphia',
  'pittsburgh',
  'portland',
  'san-antonio',
  'san-jose',
  'santa-fe',
  'seattle',
  'tampa',
  'virginia-beach',
  'washington-dc',
  'wichita',
];

function parseArgs(argv) {
  const options = { publicDir: DEFAULT_PUBLIC_DIR, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--write') options.write = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function countMatches(value, pattern) {
  return [...String(value).matchAll(pattern)].length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function providerSurfaceFingerprint(html) {
  return {
    profileHrefs: countMatches(html, /href=["'][^"']*\/appraiser\//gi),
    itemLists: countMatches(html, /"@type"\s*:\s*"ItemList"/g),
    services: countMatches(html, /"@type"\s*:\s*"Service"/g),
    professionalServices: countMatches(html, /"@type"\s*:\s*"ProfessionalService"/g),
  };
}

function migrateRoute(html, slug) {
  const originalFingerprint = providerSurfaceFingerprint(html);
  let next = html
    .replaceAll(`${LEGACY_BUNDLE}?v=gsc-ctr-20260703`, REVIEWED_BUNDLE)
    .replaceAll(LEGACY_BUNDLE, REVIEWED_BUNDLE);

  if (!next.includes('data-directory-static-authoritative="true"')) {
    const sectionPattern =
      /<section\b[^>]*(?:data-directory-city-utility|data-verified-migrated-provider)=["'][^"']+["'][^>]*>/i;
    const section = next.match(sectionPattern)?.[0];
    if (!section) {
      throw new Error(
        `/location/${slug}/ has no reviewed city-utility or migrated-provider section`
      );
    }
    const marked = section.replace(
      />$/,
      ` data-directory-static-authoritative="true" data-city-slug="${slug}">`
    );
    next = next.replace(section, marked);
  }

  const nextFingerprint = providerSurfaceFingerprint(next);
  if (JSON.stringify(nextFingerprint) !== JSON.stringify(originalFingerprint)) {
    throw new Error(`/location/${slug}/ provider or schema surface changed during shell migration`);
  }
  return next;
}

function isIndexable(html) {
  return !/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

async function validateIndexableCities(publicDir) {
  const locationDir = path.join(publicDir, 'location');
  const failures = [];
  let indexableCityCount = 0;
  let reviewedShellCount = 0;
  let legacyShellCount = 0;

  for (const entry of await fs.readdir(locationDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(locationDir, entry.name, 'index.html');
    let html;
    try {
      html = await fs.readFile(filename, 'utf8');
    } catch {
      continue;
    }
    if (!isIndexable(html)) continue;
    indexableCityCount += 1;

    const route = `/location/${entry.name}/`;
    const legacyReferences = countMatches(
      html,
      /\/assets\/index-BrMmeR5F\.js(?:\?[^"' ]*)?/g
    );
    const reviewedPreloads = countMatches(
      html,
      /<link\b[^>]*rel=["']preload["'][^>]*href=["']\/assets\/index-Cd3ca0aQ\.js(?:\?[^"']*)?["'][^>]*>/gi
    );
    const reviewedScripts = countMatches(
      html,
      /<script\b[^>]*type=["']module["'][^>]*src=["']\/assets\/index-Cd3ca0aQ\.js(?:\?[^"']*)?["'][^>]*>/gi
    );
    const exactMarkers = countMatches(
      html,
      new RegExp(
        `<section\\b(?=[^>]*data-directory-static-authoritative=["']true["'])(?=[^>]*data-city-slug=["']${escapeRegExp(entry.name)}["'])[^>]*>`,
        'gi'
      )
    );

    if (legacyReferences > 0) {
      legacyShellCount += 1;
      failures.push({ route, code: 'LEGACY_CITY_SHELL', count: legacyReferences });
    } else if (reviewedPreloads === 1 && reviewedScripts === 1 && exactMarkers === 1) {
      reviewedShellCount += 1;
    } else {
      failures.push({
        route,
        code: 'INCOMPLETE_AUTHORITATIVE_CITY_SHELL',
        reviewedPreloads,
        reviewedScripts,
        exactMarkers,
      });
    }
  }

  return {
    indexableCityCount,
    reviewedShellCount,
    legacyShellCount,
    failures,
  };
}

export async function run(options) {
  const changedFiles = [];
  const missingFiles = [];

  for (const slug of ROUTES) {
    const filename = path.join(options.publicDir, 'location', slug, 'index.html');
    let html;
    try {
      html = await fs.readFile(filename, 'utf8');
    } catch {
      missingFiles.push(`/location/${slug}/`);
      continue;
    }
    const next = migrateRoute(html, slug);
    if (next !== html) {
      changedFiles.push(path.relative(ROOT, filename));
      if (options.write) await fs.writeFile(filename, next);
    }
  }

  const validation = await validateIndexableCities(options.publicDir);
  const pendingChanges = options.write ? [] : changedFiles;
  const failures = [
    ...missingFiles.map((route) => ({ route, code: 'MISSING_FROZEN_ROUTE' })),
    ...pendingChanges.map((file) => ({ file, code: 'PENDING_CITY_SHELL_MIGRATION' })),
    ...validation.failures,
  ];

  return {
    ok: failures.length === 0,
    mode: options.write ? 'write' : 'check',
    frozenRouteCount: ROUTES.length,
    changedFileCount: changedFiles.length,
    changedFiles,
    ...validation,
    failures,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const result = await run(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
