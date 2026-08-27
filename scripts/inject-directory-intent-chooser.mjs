#!/usr/bin/env node
/**
 * Inject a job-language intent chooser above published city listings.
 *
 * Why: city pages rank for generic "near me" queries. The honest move is a
 * chooser (signed remote report vs local listing vs first look), plus
 * inherited / insurance / donation paths and a sample-report proof block.
 * Do not add Appraisily as a fake featured local listing.
 *
 * Operates on `public_site`, not `src/`. Same convention as
 * inject-donation-purpose-bridge.mjs. Idempotent: re-running replaces the
 * existing block rather than stacking.
 *
 *   node scripts/inject-directory-intent-chooser.mjs --check
 *   node scripts/inject-directory-intent-chooser.mjs --write
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MARKER = 'data-appraisily-directory-intent-chooser="1"';
const BLOCK_RE =
  /<section\s+data-appraisily-directory-intent-chooser=["']1["'][\s\S]*?<\/section>\s*/gi;
const DONATION_RE = /<section\s+data-appraisily-donation-purpose-bridge=["']1["'][\s\S]*?<\/section>\s*/i;
const LOCAL_RE = /<section id="local-appraisers"/i;
const HOME_BRIDGE_CLOSE_RE =
  /(<section data-appraisily-directory-online-conversion-bridge="1"[\s\S]*?<\/section>)/i;
const LOCATION_INDEX_BRIDGE_CLOSE_RE =
  /(<section class="card" data-appraisily-national-service-bridge="1"[\s\S]*?<\/section>)/i;
const CITY_NAME_OVERRIDES = new Map([
  ['st-john-s', "St. John's"],
  ['st-louis', 'St. Louis'],
  ['st-paul', 'St. Paul'],
  ['washington-dc', 'Washington, DC'],
]);
const REVIEWED_ZERO_LOCAL_ROUTES = new Set(['indianapolis']);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleCaseSlug(slug) {
  if (CITY_NAME_OVERRIDES.has(slug)) return CITY_NAME_OVERRIDES.get(slug);
  return slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function taggedUrl(pathname, campaign, content, extra = '') {
  return (
    `https://appraisily.com${pathname}` +
    `?utm_source=directory&amp;utm_medium=intent_chooser` +
    `&amp;utm_campaign=${encodeURIComponent(campaign)}` +
    `&amp;utm_content=${content}${extra}`
  );
}

function cityCard(title, copy, href, kind, cta) {
  return (
    '<a class="block rounded-lg border border-slate-200 bg-white p-4 text-inherit no-underline shadow-sm hover:shadow-md" ' +
    `href="${href}" data-gtm-event="directory_cta" data-cta-kind="${kind}" data-gtm-placement="intent_chooser">` +
    `<p class="font-bold text-slate-950">${title}</p>` +
    `<p class="mt-2 text-sm leading-relaxed text-slate-600">${copy}</p>` +
    `<span class="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">${cta}</span>` +
    '</a>'
  );
}

function occasionLink(label, detail, href, kind) {
  return (
    '<a class="block rounded-lg border border-slate-200 bg-slate-50 p-4 text-inherit no-underline hover:bg-white" ' +
    `href="${href}" data-gtm-event="directory_cta" data-cta-kind="${kind}" data-gtm-placement="intent_occasion">` +
    `<p class="font-bold text-slate-950">${label}</p>` +
    `<p class="mt-1 text-sm leading-relaxed text-slate-600">${detail}</p>` +
    '</a>'
  );
}

function buildCityBlock(cityName, citySlug) {
  const city = escapeHtml(cityName);
  const campaign = citySlug;
  const localHref = REVIEWED_ZERO_LOCAL_ROUTES.has(citySlug) ? '/location/' : '#local-appraisers';
  const localTitle = REVIEWED_ZERO_LOCAL_ROUTES.has(citySlug)
    ? 'Need someone nearby'
    : `Need someone in ${city}`;
  const localCopy = REVIEWED_ZERO_LOCAL_ROUTES.has(citySlug)
    ? 'No local profile is currently published here. Browse published cities, or use a signed online report when photos are enough.'
    : `Compare current ${city} listings. Confirm credentials, scope, fees, and availability directly.`;
  const localCta = REVIEWED_ZERO_LOCAL_ROUTES.has(citySlug)
    ? 'Browse published locations'
    : 'Jump to local listings';
  const signedHref = taggedUrl('/start', campaign, 'signed_report', '&amp;service=regular');
  const screenerHref = taggedUrl('/screener', campaign, 'screener');
  const sampleHref = taggedUrl('/sample-reports/professional', campaign, 'sample_report');

  return (
    `<section ${MARKER} aria-labelledby="intent-chooser-heading" class="mb-8 rounded-xl border border-slate-200 bg-white p-6">` +
    '<p class="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Choose the next step</p>' +
    '<h2 id="intent-chooser-heading" class="mt-2 text-2xl font-bold text-slate-950">What do you need from this page?</h2>' +
    '<p class="mt-3 text-slate-700">Use local listings when an in-person inspection or local expertise matters. Use Appraisily when photos and documentation are sufficient for a signed written valuation report.</p>' +
    '<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">' +
    cityCard(
      'Need a signed report without a visit',
      'Start a paid online appraisal when photos, marks, and notes can support a signed written valuation report.',
      signedHref,
      'signed_report',
      'Start a paid online appraisal',
    ) +
    cityCard(localTitle, localCopy, localHref, 'local_specialist', localCta) +
    cityCard(
      'Not sure which report you need',
      'Use a first look for category, evidence, and the next step. This is not a signed appraisal.',
      screenerHref,
      'screener',
      'Try a first look',
    ) +
    '</div>' +
    '<div class="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">' +
    occasionLink(
      'Inherited an object',
      'Get a usable signed report without a house visit.',
      taggedUrl('/inherited-objects', campaign, 'inherited'),
      'inherited',
    ) +
    occasionLink(
      'Need it for insurance',
      'Replacement-value documentation for coverage or claims.',
      taggedUrl('/insurance', campaign, 'insurance'),
      'insurance',
    ) +
    occasionLink(
      'Donating an item',
      'See the donation report and what it covers.',
      taggedUrl('/qualified-appraisals', campaign, 'donation'),
      'donation',
    ) +
    '</div>' +
    '<p class="mt-5 text-slate-700"><a class="font-semibold text-blue-700 underline underline-offset-2" ' +
    `href="${sampleHref}" data-gtm-event="directory_cta" data-cta-kind="sample_report" data-gtm-placement="sample_proof">` +
    'See a sample signed report</a> before you choose a local listing or an online report.</p>' +
    '</section>\n      '
  );
}

function buildHomeSupplement(campaign) {
  return (
    `<section ${MARKER} aria-labelledby="intent-chooser-heading" class="mt-5 max-w-3xl rounded-lg border border-slate-200 bg-white p-5">` +
    '<h2 id="intent-chooser-heading" class="text-xl font-semibold text-gray-900">What do you need from this directory?</h2>' +
    '<p class="mt-2 text-gray-700">Browse local listings when an in-person inspection or local expertise matters. Start a paid online appraisal when photos and documentation are sufficient for a signed written valuation report.</p>' +
    '<div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">' +
    occasionLink(
      'Inherited an object',
      'Get a usable signed report without a house visit.',
      taggedUrl('/inherited-objects', campaign, 'inherited'),
      'inherited',
    ) +
    occasionLink(
      'Need it for insurance',
      'Replacement-value documentation for coverage or claims.',
      taggedUrl('/insurance', campaign, 'insurance'),
      'insurance',
    ) +
    occasionLink(
      'Donating an item',
      'See the donation report and what it covers.',
      taggedUrl('/qualified-appraisals', campaign, 'donation'),
      'donation',
    ) +
    '</div>' +
    '<p class="mt-4 text-sm text-gray-700"><a class="font-semibold text-blue-700 underline" ' +
    `href="${taggedUrl('/sample-reports/professional', campaign, 'sample_report')}" ` +
    'data-gtm-event="directory_cta" data-cta-kind="sample_report" data-gtm-placement="sample_proof">' +
    'See a sample signed report</a>.</p>' +
    '</section>'
  );
}

function buildLocationIndexSupplement(campaign) {
  return (
    `<section ${MARKER} class="card" aria-labelledby="intent-chooser-heading" style="margin-top:16px;">` +
    '<h2 id="intent-chooser-heading" style="margin:0 0 10px;font-size:18px;">What do you need from this directory?</h2>' +
    '<p style="margin:0 0 12px;">Pick a city when you need a local specialist. Use Appraisily when photos and documentation are sufficient for a signed written report.</p>' +
    '<p style="display:flex;flex-wrap:wrap;gap:12px;margin:0;">' +
    `<a href="${taggedUrl('/inherited-objects', campaign, 'inherited')}">Inherited an object</a>` +
    `<a href="${taggedUrl('/insurance', campaign, 'insurance')}">Need it for insurance</a>` +
    `<a href="${taggedUrl('/qualified-appraisals', campaign, 'donation')}">Donating an item</a>` +
    `<a href="${taggedUrl('/sample-reports/professional', campaign, 'sample_report')}">See a sample signed report</a>` +
    `<a href="${taggedUrl('/start', campaign, 'signed_report', '&amp;service=regular')}">Start a paid online appraisal</a>` +
    '</p>' +
    '</section>'
  );
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

function stripChooser(html) {
  BLOCK_RE.lastIndex = 0;
  return html.replace(BLOCK_RE, '');
}

function injectCityHtml(html, citySlug) {
  const stripped = stripChooser(html);
  const block = buildCityBlock(titleCaseSlug(citySlug), citySlug);
  if (DONATION_RE.test(stripped)) {
    return stripped.replace(DONATION_RE, `${block}$&`);
  }
  if (LOCAL_RE.test(stripped)) {
    return stripped.replace(LOCAL_RE, `${block}<section id="local-appraisers"`);
  }
  return null;
}

function injectAfterMatch(html, expression, supplement) {
  const stripped = stripChooser(html);
  if (!expression.test(stripped)) return null;
  return stripped.replace(expression, `$1${supplement}`);
}

async function maybeWrite(filePath, nextHtml, currentHtml, write) {
  if (nextHtml == null) return { skipped: true, changed: false };
  if (nextHtml === currentHtml) return { skipped: false, changed: false };
  if (write) await fs.writeFile(filePath, nextHtml);
  return { skipped: false, changed: true };
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
    const result = await maybeWrite(filePath, injectCityHtml(html, entry.name), html, options.write);
    if (result.skipped) {
      skippedNoAnchor += 1;
      missing.push(entry.name);
      continue;
    }
    if (result.changed) changed += 1;
  }

  const extraPages = [
    {
      relative: 'index.html',
      inject: (html) => injectAfterMatch(html, HOME_BRIDGE_CLOSE_RE, buildHomeSupplement('antique-directory')),
    },
    {
      relative: 'location/index.html',
      inject: (html) => injectAfterMatch(html, LOCATION_INDEX_BRIDGE_CLOSE_RE, buildLocationIndexSupplement('location-index')),
    },
  ];

  for (const page of extraPages) {
    const filePath = path.join(options.publicDir, page.relative);
    const html = await fs.readFile(filePath, 'utf8');
    const result = await maybeWrite(filePath, page.inject(html), html, options.write);
    total += 1;
    if (result.skipped) {
      skippedNoAnchor += 1;
      missing.push(page.relative);
      continue;
    }
    if (result.changed) changed += 1;
  }

  const result = {
    action: options.write ? 'directory-intent-chooser-applied' : 'directory-intent-chooser-planned',
    publicDir: options.publicDir,
    pages: total,
    changedFiles: changed,
    skippedNoAnchor,
    ...(missing.length ? { pagesWithoutAnchor: missing } : {}),
  };
  console.log(JSON.stringify(result, null, 2));

  if (options.check && changed > 0) {
    console.error(`[directory-intent-chooser] ${changed} page(s) are missing the intent chooser; run --write.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
