#!/usr/bin/env node
/**
 * Inject a donation-purpose bridge into published location pages.
 *
 * Why: GSC shows these city pages drawing ~2,500 impressions/90d on
 * "<city> donation appraiser(s)" queries while offering donors no donation
 * path — every CTA routes to the generic screener/regular flow. This also
 * gives appraisily.com/qualified-appraisals topically relevant inbound links,
 * which it otherwise lacks almost entirely.
 *
 * Note this operates on `public_site`, not `src/`. The React component
 * `src/pages/StandardizedLocationPage.tsx` does NOT drive the published
 * directory pages — `npm run build` is only `check:static`, and the live
 * titles do not appear in the component source. Editing src/ there ships
 * nothing. Follow the same convention as the other repair/injector scripts.
 *
 * Idempotent: re-running replaces the existing block rather than stacking.
 *
 *   node scripts/inject-donation-purpose-bridge.mjs --check
 *   node scripts/inject-donation-purpose-bridge.mjs --write
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MARKER = 'data-appraisily-donation-purpose-bridge="1"';
const BLOCK_RE = /<section\s+data-appraisily-donation-purpose-bridge=["']1["'][\s\S]*?<\/section>\s*/i;
const ANCHOR_RE = /<section id="local-appraisers"/i;
const CITY_NAME_OVERRIDES = new Map([
  ['st-john-s', "St. John's"],
  ['st-louis', 'St. Louis'],
  ['st-paul', 'St. Paul'],
  ['washington-dc', 'Washington, DC'],
]);

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildBlock(cityName, citySlug) {
  const city = escapeHtml(cityName);
  const indefiniteArticle = /^[aeiou]/i.test(cityName) ? 'an' : 'a';
  const href =
    'https://appraisily.com/qualified-appraisals' +
    `?utm_source=directory&amp;utm_medium=donation_purpose&amp;utm_campaign=${encodeURIComponent(citySlug)}` +
    '&amp;utm_content=donation_report';
  return (
    `<section ${MARKER} aria-labelledby="donation-purpose-heading" class="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-5">` +
    `<h2 id="donation-purpose-heading" class="text-lg font-semibold text-gray-900">Donating an item from ${city}?</h2>` +
    '<p class="mt-2 text-gray-700">Charitable donation valuations are a different assignment from insurance or resale work: they use ' +
    'fair-market-value concepts, and the receiving organization and your tax adviser set the documentation requirements. Some ' +
    'contributions require a federal qualified appraisal, which is a specific instrument with its own signer and inspection rules — ' +
    'confirm what yours needs before commissioning any report.</p>' +
    `<p class="mt-3 text-gray-700"><a href="${href}" class="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800">` +
    'See Appraisily&rsquo;s donation appraisal report and what it covers</a> for the online option, or contact ' +
    `${indefiniteArticle} ${city} appraiser from the listings below when an in-person inspection or specific credentials are required.</p>` +
    '</section>\n      '
  );
}

function titleCaseSlug(slug) {
  if (CITY_NAME_OVERRIDES.has(slug)) return CITY_NAME_OVERRIDES.get(slug);
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function cityNameFrom(_html, slug) {
  // Titles are deliberately optimized and inconsistent (for example, the
  // Honolulu page starts with "Oahu"). The route slug is the stable city
  // identity and avoids leaking title copy or encoded HTML into the bridge.
  return titleCaseSlug(slug);
}

function parseArgs(argv) {
  const options = { publicDir: path.resolve(process.cwd(), 'public_site'), write: false, check: false };
  const args = [...argv];
  while (args.length) {
    const [flag, inline] = String(args.shift() || '').split('=');
    const value = () => inline ?? args.shift();
    if (flag === '--public-dir') options.publicDir = path.resolve(process.cwd(), String(value() || ''));
    else if (flag === '--write') options.write = true;
    else if (flag === '--dry-run') options.write = false;
    else if (flag === '--check') options.check = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const locationRoot = path.join(options.publicDir, 'location');
  const entries = await fs.readdir(locationRoot, { withFileTypes: true });

  let changed = 0;
  let skippedNoAnchor = 0;
  let total = 0;
  const missing = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(locationRoot, entry.name, 'index.html');
    let html;
    try {
      html = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    total += 1;

    const stripped = html.replace(BLOCK_RE, '');
    if (!ANCHOR_RE.test(stripped)) {
      skippedNoAnchor += 1;
      missing.push(entry.name);
      continue;
    }
    const block = buildBlock(cityNameFrom(stripped, entry.name), entry.name);
    const rewritten = stripped.replace(ANCHOR_RE, `${block}<section id="local-appraisers"`);
    if (rewritten === html) continue;
    changed += 1;
    if (options.write) await fs.writeFile(filePath, rewritten);
  }

  const result = {
    action: options.write ? 'donation-purpose-bridge-applied' : 'donation-purpose-bridge-planned',
    publicDir: options.publicDir,
    locationPages: total,
    changedFiles: changed,
    skippedNoAnchor,
    ...(missing.length ? { pagesWithoutAnchor: missing } : {}),
  };
  console.log(JSON.stringify(result, null, 2));

  // --check is a CI guard: every location page must already carry the bridge.
  if (options.check && changed > 0) {
    console.error(`[donation-purpose-bridge] ${changed} location page(s) are missing the donation bridge; run --write.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
