#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadVerifiedProviders } from './utils/verified-providers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const CITIES_PATH = path.join(REPO_ROOT, 'src', 'data', 'cities.json');

const TRUST_FIRST_LOCATION_SLUGS = new Set(['kelowna', 'calgary', 'san-antonio']);
const TRUST_FIRST_MIN_VERIFIED = 3;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    baseUrl: 'https://antique-appraiser-directory.appraisily.com',
    timeoutMs: 15_000,
    concurrency: 8,
    outputDir: '/srv/temp/directory-verify',
    slugs: [],
  };

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    switch (flag) {
      case '--base-url':
        options.baseUrl = String(readValue() || '').trim();
        break;
      case '--timeout-ms':
        options.timeoutMs = Number.parseInt(String(readValue() || '').trim(), 10);
        break;
      case '--concurrency':
        options.concurrency = Number.parseInt(String(readValue() || '').trim(), 10);
        break;
      case '--output-dir':
        options.outputDir = path.resolve(process.cwd(), String(readValue() || '').trim());
        break;
      case '--slugs':
        options.slugs = String(readValue() || '')
          .split(',')
          .map((slug) => slug.trim())
          .filter(Boolean);
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1_000) options.timeoutMs = 15_000;
  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) options.concurrency = 4;
  if (options.concurrency > 20) options.concurrency = 20;
  options.baseUrl = options.baseUrl.replace(/\/+$/, '');

  return options;
}

async function fetchText(url, { timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await res.text();
    return { status: res.status, ok: res.ok, text };
  } finally {
    clearTimeout(timer);
  }
}

async function loadCitySlugs() {
  const raw = await fs.readFile(CITIES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const cities = Array.isArray(parsed?.cities) ? parsed.cities : [];
  return cities.map((city) => String(city.slug || '').trim()).filter(Boolean);
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function hasAllNeedles(haystack, needles) {
  for (const needle of needles) {
    if (!needle) continue;
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) break;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const slugsAll = await loadCitySlugs();
  const slugs = options.slugs.length ? options.slugs : slugsAll;

  const { providers } = await loadVerifiedProviders({ repoRoot: REPO_ROOT });
  const providersByLocation = new Map();
  for (const provider of providers) {
    const key = String(provider.locationSlug || '').trim();
    if (!key) continue;
    const list = providersByLocation.get(key) || [];
    list.push(provider);
    providersByLocation.set(key, list);
  }

  const runId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const outDir = path.join(options.outputDir, runId);
  await fs.mkdir(outDir, { recursive: true });

  const results = await mapWithConcurrency(slugs, options.concurrency, async (slug) => {
    const url = `${options.baseUrl}/location/${encodeURIComponent(slug)}/`;
    const expected = providersByLocation.get(slug) || [];
    const expectedVerified = expected.filter((p) => p?.verified === true);
    const expectedListed = expected.filter((p) => p?.verified !== true && p?.listed === true);

    const trustFirst = TRUST_FIRST_LOCATION_SLUGS.has(slug) || expectedVerified.length >= TRUST_FIRST_MIN_VERIFIED;
    const displayExpected = trustFirst && expectedVerified.length ? expectedVerified : expectedVerified.length ? [...expectedVerified, ...expectedListed] : expectedListed;

    const slugsToCheck = displayExpected
      .map((p) => String(p.slug || '').trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((s) => `/appraiser/${encodeURIComponent(s)}/`);

    const expectedBadges = displayExpected.length ? [expectedVerified.length ? 'Verified' : 'Listed'] : [];

    let fetched;
    try {
      fetched = await fetchText(url, { timeoutMs: options.timeoutMs });
    } catch (error) {
      return {
        slug,
        url,
        status: 0,
        ok: false,
        expectedCount: displayExpected.length,
        verifiedExpected: expectedVerified.length,
        listedExpected: expectedListed.length,
        missing: slugsToCheck.join(' '),
        error: error?.message || String(error),
      };
    }

    const html = fetched.text || '';
    const canonicalNeedle = `<link rel=\"canonical\" href=\"${options.baseUrl}/location/${slug}/\">`;
    const hasCanonical = html.includes(canonicalNeedle);
    const hasBadges = expectedBadges.length ? expectedBadges.some((badge) => html.includes(`>${badge}<`)) : true;
    const hasExpectedProviders = slugsToCheck.length ? slugsToCheck.some((needle) => html.includes(needle)) : true;
    const ok = fetched.ok && hasCanonical && hasBadges && hasExpectedProviders;

    return {
      slug,
      url,
      status: fetched.status,
      ok,
      expectedCount: displayExpected.length,
      verifiedExpected: expectedVerified.length,
      listedExpected: expectedListed.length,
      hasCanonical,
      hasBadges,
      hasExpectedProviders,
      sampleExpectedProviderLinks: slugsToCheck.join(' '),
    };
  });

  const jsonPath = path.join(outDir, 'verify-location-pages.json');
  await fs.writeFile(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), options, results }, null, 2)}\n`, 'utf8');

  const csvCols = [
    'slug',
    'url',
    'status',
    'ok',
    'expectedCount',
    'verifiedExpected',
    'listedExpected',
    'hasCanonical',
    'hasBadges',
    'hasExpectedProviders',
    'sampleExpectedProviderLinks',
  ];
  const csv = [
    csvCols.join(','),
    ...results.map((row) =>
      [
        row.slug,
        row.url,
        row.status,
        row.ok,
        row.expectedCount,
        row.verifiedExpected,
        row.listedExpected,
        row.hasCanonical,
        row.hasBadges,
        row.hasExpectedProviders,
        row.sampleExpectedProviderLinks || row.missing || '',
      ]
        .map(csvEscape)
        .join(','),
    ),
    '',
  ].join('\n');
  const csvPath = path.join(outDir, 'verify-location-pages.csv');
  await fs.writeFile(csvPath, csv, 'utf8');

  const total = results.length;
  const okCount = results.filter((row) => row.ok).length;
  const failed = results.filter((row) => !row.ok).map((row) => ({ slug: row.slug, status: row.status, url: row.url }));

  process.stdout.write(
    `${JSON.stringify({ outDir, total, ok: okCount, failed: failed.slice(0, 20), failedCount: failed.length }, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error('[verify-location-pages] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});

