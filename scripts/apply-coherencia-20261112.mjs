#!/usr/bin/env node
/**
 * Site-wide consistency audit, 12 Nov 2026 (class-A rows FA1, FA2, FA4, FA5).
 *
 * Operates on public_site (the canonical published HTML), like the other
 * inject/repair scripts: src/ does not drive the published pages.
 *
 * - FA1: the decision router "Signed report" card on appraiser profiles said
 *   "For insurance, estate, donation, resale, or documented value decisions."
 *   and sent everyone to /start ($59). It now names the $59 and links the
 *   insurance ($99) and donation (from $399) appraisals to their own pages.
 * - FA2: the location FAQ "Can Appraisily help if there is no local appraiser
 *   available?" (visible + FAQPage JSON-LD) asked for "photos and details".
 *   It now uses the owner's one-photo message (12 Nov).
 * - FA4: provider advice ("gather photos, measurements, and any provenance";
 *   FAQ "Bring clear photos (front/back/details/marks), measurements...")
 *   now marks everything beyond one front photo as optional.
 * - FA5: "For a verified online appraisal option" (unsupported credential
 *   claim) becomes "For a signed online appraisal from a photo".
 *
 * Held pages are left untouched: /location/chicago/ and /location/baltimore/
 * (cp-2026-09-28-directory-choice-pilot, day-28 read not written; see
 * data/directory-ctr-pass2-exclusions.json).
 *
 * Idempotent: replacements match the old text only.
 *
 *   node scripts/apply-coherencia-20261112.mjs --check   (exit 1 if a page still needs the change)
 *   node scripts/apply-coherencia-20261112.mjs --write
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const HELD_LOCATION_SLUGS = new Set(['chicago', 'baltimore']);

export const FA1_OLD_COPY =
  '<p class="text-sm text-slate-600 leading-relaxed mt-2">For insurance, estate, donation, resale, or documented value decisions.</p>';
export const FA1_OLD_BUTTON_LABEL = '>Signed report <span aria-hidden="true">›</span></a>';
export const FA1_NEW_BUTTON_LABEL = '>Signed report · $59 <span aria-hidden="true">›</span></a>';

export const FA2_OLD =
  'Yes. You can request an online appraisal from Appraisily. Submit photos and details, and receive a written valuation without an in-person visit.';
export const FA2_NEW =
  'Yes. Appraisily appraises online, without an in-person visit. One clear photo of the front is all we need to start. Optional, but helpful: back, signature or label close-up, size, and anything you know (artist, where it came from). You receive a signed written report.';

export const FA4_ADVICE_OLD = 'Before you contact a provider, gather photos, measurements, and any provenance.';
export const FA4_ADVICE_NEW =
  'Before you contact a provider, have one clear photo of the front ready. Optional, but helpful: measurements and anything you know about its history.';

export const FA4_FAQ_OLD =
  'Bring clear photos (front/back/details/marks), measurements, condition notes, and any provenance (receipts, family history, restoration notes).';
export const FA4_FAQ_NEW =
  'One clear photo of the front is enough to start. Optional, but helpful: back, signature or label close-ups, measurements, condition notes, and anything you know about its history (receipts, family history, restoration notes).';

export const FA5_OLD = 'For a verified online appraisal option, request an appraisal through Appraisily.';
export const FA5_NEW = 'For a signed online appraisal from a photo, request one through Appraisily.';

/**
 * utmCampaign and gtmCampaign are copied verbatim from the page's own
 * signed_report button (already encoded for an href and an attribute).
 */
export function buildFa1Copy(utmCampaign, gtmCampaign) {
  const link = (route, content, kind, label) =>
    `<a href="https://appraisily.com/${route}?utm_source=directory&amp;utm_medium=decision_router&amp;utm_campaign=${utmCampaign}&amp;utm_content=${content}"` +
    ' class="font-semibold text-slate-950 underline underline-offset-2"' +
    ` data-gtm-event="directory_cta" data-cta-kind="${kind}" data-gtm-placement="decision_router" data-gtm-campaign="${gtmCampaign}">${label}</a>`;
  return (
    '<p class="text-sm text-slate-600 leading-relaxed mt-2">$59 for resale or your own records. ' +
    `For insurance, see the ${link('insurance', 'insurance', 'insurance', 'insurance appraisal ($99)')}; ` +
    `for a donation, the ${link('qualified-appraisals', 'donation', 'donation', 'donation appraisal (from $399)')}.</p>`
  );
}

const SIGNED_REPORT_CAMPAIGN_RE =
  /utm_medium=decision_router&amp;utm_campaign=([^&"]*)&amp;utm_content=signed_report[^"]*"[^>]*data-cta-kind="signed_report" data-gtm-placement="decision_router" data-gtm-campaign="([^"]*)"/;

// One profile (anchorage-antique-appraisals) draws the signed-report card as a
// whole-card link with a <span> button. Links cannot nest, so that card is
// redrawn as the <article> + button-link markup the other 357 profiles use.
const CARD_LINK_RE =
  /<a (href="https:\/\/appraisily\.com\/start\?[^"]*utm_content=signed_report[^"]*") class="block border border-slate-200 rounded-lg p-4 bg-white shadow-sm text-inherit no-underline" (data-gtm-event="directory_cta" data-cta-kind="signed_report" data-gtm-placement="decision_router" data-gtm-campaign="[^"]*")>([\s\S]*?)<span (class="mt-5 bg-slate-950 text-white rounded-lg hover:bg-black transition-colors" style="[^"]*")>Signed report <span aria-hidden="true">›<\/span><\/span>\s*<\/a>/;

function unwrapCardLink(html) {
  return html.replace(
    CARD_LINK_RE,
    (_m, href, dataAttrs, inner, buttonAttrs) =>
      `<article class="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">${inner}<a ${href} ${buttonAttrs} ${dataAttrs}>Signed report <span aria-hidden="true">›</span></a>\n    </article>`,
  );
}

function replaceAll(html, from, to) {
  if (!html.includes(from)) return { html, count: 0 };
  const parts = html.split(from);
  return { html: parts.join(to), count: parts.length - 1 };
}

/**
 * Apply every row to one document. `route` is the site path ("/appraiser/x/").
 * Returns { html, changes: {fa1, fa2, fa4Advice, fa4Faq, fa5} }.
 */
export function transformDocument(html, route) {
  const changes = { fa1: 0, fa2: 0, fa4Advice: 0, fa4Faq: 0, fa5: 0 };
  const locationMatch = /^\/location\/([^/]+)\//.exec(route);
  if (locationMatch && HELD_LOCATION_SLUGS.has(locationMatch[1])) return { html, changes };

  let next = html;
  if (route.startsWith('/appraiser/')) {
    if (next.includes(FA1_OLD_COPY)) {
      next = unwrapCardLink(next);
      const sectionStart = next.indexOf('data-appraisily-directory-decision-router="1"');
      const campaignMatch = SIGNED_REPORT_CAMPAIGN_RE.exec(next.slice(sectionStart));
      if (sectionStart < 0 || !campaignMatch) {
        throw new Error(`${route}: decision router copy found without its signed_report link`);
      }
      const copyIndex = next.indexOf(FA1_OLD_COPY);
      next =
        next.slice(0, copyIndex) +
        buildFa1Copy(campaignMatch[1], campaignMatch[2]) +
        next.slice(copyIndex + FA1_OLD_COPY.length);
      changes.fa1 += 1;
      // The button label sits in the same card; only the signed_report button carries this exact label.
      const buttonRe = /(data-cta-kind="signed_report" data-gtm-placement="decision_router" data-gtm-campaign="[^"]*")>Signed report <span aria-hidden="true">›<\/span><\/a>/;
      next = next.replace(buttonRe, `$1${FA1_NEW_BUTTON_LABEL}`);
    }
    const fa5 = replaceAll(next, FA5_OLD, FA5_NEW);
    next = fa5.html;
    changes.fa5 += fa5.count;
  }
  if (route.startsWith('/location/')) {
    const fa2 = replaceAll(next, FA2_OLD, FA2_NEW);
    next = fa2.html;
    changes.fa2 += fa2.count;
    const advice = replaceAll(next, FA4_ADVICE_OLD, FA4_ADVICE_NEW);
    next = advice.html;
    changes.fa4Advice += advice.count;
    const faq = replaceAll(next, FA4_FAQ_OLD, FA4_FAQ_NEW);
    next = faq.html;
    changes.fa4Faq += faq.count;
  }
  return { html: next, changes };
}

async function listHtml(root) {
  const files = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listHtml(filePath)));
    else if (entry.isFile() && entry.name === 'index.html') files.push(filePath);
  }
  return files;
}

export async function run({ publicDir, write }) {
  const totals = { files: 0, fa1: 0, fa2: 0, fa4Advice: 0, fa4Faq: 0, fa5: 0 };
  const roots = ['appraiser', 'location'].map((dir) => path.join(publicDir, dir));
  for (const root of roots) {
    for (const file of await listHtml(root)) {
      const route = '/' + path.relative(publicDir, path.dirname(file)).split(path.sep).join('/') + '/';
      const html = await fs.readFile(file, 'utf8');
      const { html: next, changes } = transformDocument(html, route);
      if (next === html) continue;
      totals.files += 1;
      for (const key of Object.keys(changes)) totals[key] += changes[key];
      if (write) await fs.writeFile(file, next);
    }
  }
  return totals;
}

function parseArgs(argv) {
  const options = { publicDir: path.join(REPO_ROOT, 'public_site'), write: false, check: false };
  const args = [...argv];
  while (args.length) {
    const token = args.shift();
    if (token === '--write') options.write = true;
    else if (token === '--check') options.check = true;
    else if (token === '--public-dir') options.publicDir = path.resolve(process.cwd(), String(args.shift() || ''));
    else throw new Error(`Unknown flag ${token}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const totals = await run(options);
  console.log(JSON.stringify({ mode: options.write ? 'write' : options.check ? 'check' : 'dry-run', ...totals }));
  if (options.check && totals.files > 0) {
    console.error(`${totals.files} page(s) still carry pre-12-Nov copy; run with --write`);
    process.exit(1);
  }
}
