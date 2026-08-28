#!/usr/bin/env node
/**
 * Inject a near-me hub bridge into published location pages.
 *
 * Why: the appraisily.com near-me decision hubs (/art-appraiser-near-me,
 * /online-appraiser-near-me, /insurance-appraiser-near-me,
 * /antique-appraiser-near-me) are the main-domain surfaces meant to win the
 * head "appraiser near me" queries, but as of 2026-08-25 they have almost no
 * inbound links: URL Inspection shows /antique-appraiser-near-me
 * "Discovered - currently not indexed" with zero referring URLs, and the
 * art/online/insurance hubs have zero links from this directory. City hubs
 * already link /antique-appraiser-near-me from the hero, so the city-page
 * bridge carries the other three; appraisal-guide subpages (87 in the
 * sitemap) carried no hub links at all, so their bridge carries
 * antique + art + online. The two national leftover pages
 * `/art-appraisers-near-me/` and `/antique-appraisers-near-me/` already
 * rank for the head queries and previously had zero hub votes.
 *
 * This operates on `public_site`, not `src/` — same convention as
 * inject-donation-purpose-bridge.mjs. The block is static-only (the hydrating
 * pages drop it after mount, like the existing "Learn more" section); its job
 * is crawlable link equity, not UI.
 *
 * Idempotent: re-running replaces the existing block rather than stacking.
 *
 *   node scripts/inject-near-me-hub-bridge.mjs --check
 *   node scripts/inject-near-me-hub-bridge.mjs --write
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MARKER = 'data-appraisily-near-me-hub-bridge="1"';
const BLOCK_RE = /<section\s+data-appraisily-near-me-hub-bridge=["']1["'][\s\S]*?<\/section>\s*/i;
const CITY_ANCHOR_RES = [
  /<section[^>]*>\s*<h2[^>]*>\s*Learn more before you contact an appraiser/i,
  /<section[^>]*>\s*<h2[^>]*>\s*Frequently asked questions/i,
];
const GUIDE_ANCHOR_RE = /<section[^>]*>\s*<h2[^>]*>\s*Related city guides/i;
const NATIONAL_ANCHOR_RE =
  /<section class="card section">\s*<h2[^>]*>\s*What to compare before you book/i;

const HUBS = {
  antique: {
    href: 'https://appraisily.com/antique-appraiser-near-me',
    label: 'Antique appraiser near me',
    detail: 'Furniture, silver, ceramics, and decorative arts — when photos are enough and when a local visit wins.',
  },
  art: {
    href: 'https://appraisily.com/art-appraiser-near-me',
    label: 'Art appraiser near me',
    detail: 'Paintings, prints, and works on paper — remote signed reports vs booking a local inspection.',
  },
  online: {
    href: 'https://appraisily.com/online-appraiser-near-me',
    label: 'Online appraiser near me',
    detail: 'How a remote photo-based signed report compares with waiting for a local appointment.',
  },
  insurance: {
    href: 'https://appraisily.com/insurance-appraiser-near-me',
    label: 'Insurance appraiser near me',
    detail: 'Replacement-value documentation for coverage, claims, and scheduled items.',
  },
};

const CITY_HUB_KEYS = ['art', 'online', 'insurance'];
const GUIDE_HUB_KEYS = ['antique', 'art', 'online'];
const NATIONAL_PAGES = [
  {
    relPath: ['art-appraisers-near-me', 'index.html'],
    slug: 'art-appraisers-near-me',
    hubKeys: CITY_HUB_KEYS,
    content: 'national-art',
  },
  {
    relPath: ['antique-appraisers-near-me', 'index.html'],
    slug: 'antique-appraisers-near-me',
    hubKeys: GUIDE_HUB_KEYS,
    content: 'national-antique',
  },
];

function hubLink(key, citySlug, content) {
  const hub = HUBS[key];
  const href =
    `${hub.href}?utm_source=directory&amp;utm_medium=near_me_bridge` +
    `&amp;utm_campaign=${encodeURIComponent(citySlug)}&amp;utm_content=${content}`;
  return (
    '<a class="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow" ' +
    `href="${href}" data-analytics-event="directory_near_me_bridge_click" data-analytics-destination="${key}" ` +
    'data-analytics-location="near-me-hub-bridge">' +
    `<span class="block text-sm font-semibold text-gray-900">${hub.label}</span>` +
    `<span class="mt-1 block text-sm text-gray-700 leading-relaxed">${hub.detail}</span>` +
    '</a>'
  );
}

function buildBlock(citySlug, hubKeys, content) {
  return (
    `<section ${MARKER} aria-labelledby="near-me-hub-bridge-heading" class="py-8 border-t border-gray-200">` +
    '<h2 id="near-me-hub-bridge-heading" class="text-2xl font-semibold text-gray-900 mb-2">Deciding between a local visit and an online report?</h2>' +
    '<p class="text-gray-700 leading-relaxed mb-5">These short decision guides explain when photos are enough for a signed appraisal and when an in-person specialist is the better path.</p>' +
    `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">${hubKeys.map((key) => hubLink(key, citySlug, content)).join('')}</div>` +
    '</section>\n\n    '
  );
}

function nationalHubCard(key, citySlug, content) {
  const hub = HUBS[key];
  const href =
    `${hub.href}?utm_source=directory&amp;utm_medium=near_me_bridge` +
    `&amp;utm_campaign=${encodeURIComponent(citySlug)}&amp;utm_content=${content}`;
  return (
    '<article class="city-card">' +
    `<h3>${hub.label}</h3>` +
    `<p>${hub.detail}</p>` +
    `<a href="${href}" data-analytics-event="directory_near_me_bridge_click" data-analytics-destination="${key}" ` +
    'data-analytics-location="near-me-hub-bridge">Open the decision guide</a>' +
    '</article>'
  );
}

function buildNationalBlock(citySlug, hubKeys, content) {
  return (
    `<section ${MARKER} class="card section" aria-labelledby="near-me-hub-bridge-heading">` +
    '<h2 id="near-me-hub-bridge-heading" style="margin-top: 0;">Deciding between a local visit and an online report?</h2>' +
    '<p style="margin: 0 0 16px; color: #1c1917; line-height: 1.7;">These short decision guides explain when photos are enough for a signed appraisal and when an in-person specialist is the better path.</p>' +
    `<div class="grid">${hubKeys.map((key) => nationalHubCard(key, citySlug, content)).join('')}</div>` +
    '</section>\n\n      '
  );
}

function injectInto(html, citySlug, anchorRes, hubKeys, content, blockBuilder = buildBlock) {
  const stripped = html.replace(BLOCK_RE, '');
  for (const anchorRe of anchorRes) {
    const match = stripped.match(anchorRe);
    if (!match) continue;
    const block = blockBuilder(citySlug, hubKeys, content);
    return { html: stripped.replace(anchorRe, `${block}${match[0]}`), missingAnchor: false };
  }
  return { html, missingAnchor: true };
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
  let total = 0;
  let skippedNoAnchor = 0;
  const missing = [];

  const targets = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    targets.push({
      filePath: path.join(locationRoot, entry.name, 'index.html'),
      slug: entry.name,
      anchorRes: CITY_ANCHOR_RES,
      hubKeys: CITY_HUB_KEYS,
      content: 'hub',
      id: entry.name,
    });
    targets.push({
      filePath: path.join(locationRoot, entry.name, 'appraisal-guide', 'index.html'),
      slug: entry.name,
      anchorRes: [GUIDE_ANCHOR_RE],
      hubKeys: GUIDE_HUB_KEYS,
      content: 'guide',
      id: `${entry.name}/appraisal-guide`,
      blockBuilder: buildBlock,
    });
  }

  for (const page of NATIONAL_PAGES) {
    targets.push({
      filePath: path.join(options.publicDir, ...page.relPath),
      slug: page.slug,
      anchorRes: [NATIONAL_ANCHOR_RE],
      hubKeys: page.hubKeys,
      content: page.content,
      id: page.slug,
      blockBuilder: buildNationalBlock,
    });
  }

  for (const target of targets) {
    let html;
    try {
      html = await fs.readFile(target.filePath, 'utf8');
    } catch {
      continue;
    }
    total += 1;
    const { html: rewritten, missingAnchor } = injectInto(
      html,
      target.slug,
      target.anchorRes,
      target.hubKeys,
      target.content,
      target.blockBuilder || buildBlock,
    );
    if (missingAnchor) {
      skippedNoAnchor += 1;
      missing.push(target.id);
      continue;
    }
    if (rewritten === html) continue;
    changed += 1;
    if (options.write) await fs.writeFile(target.filePath, rewritten);
  }

  const result = {
    action: options.write ? 'near-me-hub-bridge-applied' : 'near-me-hub-bridge-planned',
    publicDir: options.publicDir,
    pagesScanned: total,
    changedFiles: changed,
    skippedNoAnchor,
    ...(missing.length ? { pagesWithoutAnchor: missing } : {}),
  };
  console.log(JSON.stringify(result, null, 2));

  // --check is a CI guard: every page with the anchor must already carry the bridge.
  if (options.check && changed > 0) {
    console.error(`[near-me-hub-bridge] ${changed} page(s) are missing the near-me hub bridge; run --write.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
