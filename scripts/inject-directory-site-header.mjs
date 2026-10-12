#!/usr/bin/env node
/**
 * Inject the static directory site header into published sitemap documents
 * that have no site header of their own.
 *
 * Why: the legacy client app used to draw the only header on profile and city
 * pages. Published pages now ship reviewed static HTML, so this plain
 * HTML/CSS header (logo + "Antique Directory", Browse cities, Start) restores
 * site navigation with and without JavaScript. Clicks are recorded only by
 * the static telemetry bootstrap through the directory_cta annotations.
 *
 * Marked-block patch, same convention as inject-directory-intent-chooser.mjs:
 * idempotent (re-running replaces the block), never touches page content.
 *
 *   node scripts/inject-directory-site-header.mjs --check
 *   node scripts/inject-directory-site-header.mjs --write
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MARKER = 'data-appraisily-directory-site-header="1"';
const STYLE_RE = /<style data-appraisily-directory-site-header="1">[\s\S]*?<\/style>/g;
const HEADER_RE = /<header data-appraisily-directory-site-header="1"[\s\S]*?<\/header>\n?/g;
const ROOT = '<div id="root">';
const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';

// Pages with their own reviewed site header (topbar) keep it.
const OWN_HEADER = new Set(['/location/', '/methodology/', '/get-listed/', '/antique-appraisers-near-me/', '/art-appraisers-near-me/']);
// Measured Chicago/Baltimore choice pilot: add the header after the Oct 26/30
// read (todo directory-choice-day28-20261026), not during it.
const PILOT_HOLD = new Set(['/location/chicago/', '/location/baltimore/']);

const STYLE =
  '<style data-appraisily-directory-site-header="1">' +
  'html{scroll-padding-top:72px}' +
  '.adh{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #e6e2d8;' +
  'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
  '.adh-skip{position:absolute;left:8px;top:-60px;padding:8px 12px;border-radius:6px;background:#292521;color:#fff;z-index:50}' +
  '.adh-skip:focus{top:8px}' +
  '.adh-inner{box-sizing:border-box;max-width:80rem;height:64px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}' +
  '.adh-brand{display:flex;align-items:center;gap:8px;min-width:0;color:#292521;text-decoration:none}' +
  '.adh-brand img{display:block;flex:none;width:32px;height:32px}' +
  '.adh-brand span{font-family:Fraunces,Georgia,"Times New Roman",serif;font-size:18px;font-weight:600;line-height:1.15}' +
  '.adh-nav{display:flex;flex:none;align-items:center;gap:12px}' +
  '.adh-browse{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;color:#554e42;font-size:14px;font-weight:500;text-decoration:none}' +
  '.adh-browse:hover{color:#7c551b;text-decoration:underline}' +
  '.adh-start{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border-radius:6px;' +
  'background:#292521;color:#fff;font-size:14px;font-weight:500;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,.08)}' +
  '.adh-start:hover{background:#44403c}' +
  '.adh+#root>.mt-16:first-child{margin-top:0}' +
  '@media (min-width:640px){.adh-inner{padding:0 24px}}' +
  '@media (min-width:1024px){.adh-inner{padding:0 32px}}' +
  '@media (max-width:380px){.adh-inner{gap:8px}.adh-nav{gap:6px}.adh-brand span{max-width:5.5em;font-size:15px}.adh-start{padding:0 12px}}' +
  '</style>';

function startHref(campaign) {
  return 'https://appraisily.com/start?utm_source=directory&amp;utm_medium=header' +
    (campaign ? `&amp;utm_campaign=${encodeURIComponent(campaign)}` : '') + '&amp;utm_content=start';
}

export function buildHeader(campaign) {
  return (
    `<header ${MARKER} class="adh">` +
    '<a class="adh-skip" href="#root">Skip to main content</a>' +
    '<div class="adh-inner">' +
    '<a class="adh-brand" href="/"><img src="/assets/appraisily-logo-monogram-64.png" alt="Appraisily" width="32" height="32"><span>Antique Directory</span></a>' +
    '<nav class="adh-nav" aria-label="Directory">' +
    '<a class="adh-browse" href="/location/" data-gtm-event="directory_cta" data-cta-kind="navigation" data-gtm-placement="header">Browse cities</a>' +
    `<a class="adh-start" href="${startHref(campaign)}" data-gtm-event="directory_cta" data-cta-kind="signed_report" data-gtm-placement="header">Start</a>` +
    '</nav></div></header>\n'
  );
}

function strip(html) {
  return html.replace(STYLE_RE, '').replace(HEADER_RE, '');
}

// The page's own campaign slug: the most common utm_campaign on its existing
// appraisily.com links (city/profile slugs, "antique-directory" on home).
export function pageCampaign(html) {
  const counts = new Map();
  for (const match of html.matchAll(/href="https:\/\/appraisily\.com\/[^"]*?[?&](?:amp;)?utm_campaign=([^"&]+)/g)) {
    counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  }
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || '';
}

export function injectHeader(html) {
  const base = strip(html);
  if (!base.includes(ROOT) || base.split('<head>').length !== 2) return null;
  const campaign = decodeURIComponent(pageCampaign(base));
  // Right after the charset declaration (which must stay in the first 1024
  // bytes); other gates own the end of head (the visible-FAQ schema stays last).
  const charset = base.match(/<meta charset="[^"]*">/i);
  if (!charset) return null;
  return base.replace(charset[0], `${charset[0]}${STYLE}`).replace(ROOT, `${buildHeader(campaign)}${ROOT}`);
}

export function headerTargets(sitemapXml) {
  return [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]))
    .filter((url) => url.origin === ORIGIN && !OWN_HEADER.has(url.pathname) && !PILOT_HOLD.has(url.pathname))
    .map((url) => url.pathname);
}

async function main() {
  const options = { publicDir: path.resolve('public_site'), write: false, check: false };
  const args = process.argv.slice(2);
  while (args.length) {
    const flag = args.shift();
    if (flag === '--public-dir') options.publicDir = path.resolve(args.shift() || '');
    else if (flag === '--write') options.write = true;
    else if (flag === '--check') options.check = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  const targets = headerTargets(await fs.readFile(path.join(options.publicDir, 'sitemap.xml'), 'utf8'));
  const stale = [];
  const unsupported = [];
  let changed = 0;
  for (const route of targets) {
    const file = path.join(options.publicDir, route, 'index.html');
    const html = await fs.readFile(file, 'utf8');
    const next = injectHeader(html);
    if (next == null) { unsupported.push(route); continue; }
    if (next === html) continue;
    changed += 1;
    stale.push(route);
    if (options.write) await fs.writeFile(file, next);
  }
  for (const route of [...OWN_HEADER, ...PILOT_HOLD]) {
    const html = await fs.readFile(path.join(options.publicDir, route, 'index.html'), 'utf8');
    if (html.includes(MARKER)) unsupported.push(`${route} (must not carry the injected header)`);
  }
  console.log(JSON.stringify({ action: options.write ? 'injected-directory-site-header' : 'planned-directory-site-header',
    targets: targets.length, changed, unsupported }, null, 2));
  if (unsupported.length || (options.check && stale.length)) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
