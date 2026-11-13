#!/usr/bin/env node
/**
 * Repeated template text, step 2 (13 Nov 2026), section A.
 *
 * 1. City appraisal guides with 0 Search Console impressions in 90 days and no
 *    linked appraiser (data/zero-impression-guides-20261113.json) get
 *    `noindex, follow` in the served HTML. `npm run seo:indexing-manifest`
 *    then drops them from sitemap.xml. URLs, titles, canonicals and links stay.
 * 2. City pages: the generic "Learn more" card grid becomes one line of the
 *    same three article links, and the four-question FAQ keeps two questions:
 *    a page-specific one (what this page lists, nearest published cities) and
 *    the Appraisily one-photo answer (owner copy, 12 Nov). The FAQPage JSON-LD
 *    follows the visible FAQ through scripts/repair-faq-schema.mjs --write.
 *    The chooser, donation and near-me blocks are shortened in their own
 *    injectors.
 *
 * Held pages keep their body: Chicago and Baltimore (choice pilot,
 * cp-2026-09-28-directory-choice-pilot) and Houston (held state check).
 * Titles, meta descriptions and URLs are never touched.
 *
 * Operates on public_site (the served HTML), like the other injectors.
 *
 *   node scripts/apply-texto-repetido-20261113.mjs --check
 *   node scripts/apply-texto-repetido-20261113.mjs --write
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cityPageFacts, readSitemapProfiles } from './lib/city-page-facts.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BODY_HELD_SLUGS = new Set(['chicago', 'baltimore', 'houston']);
export const ROBOTS_META = '<meta name="robots" content="noindex, follow">';
export const ZERO_GUIDES = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data/zero-impression-guides-20261113.json'), 'utf8'),
).guides.map((entry) => entry.slug);

const LEARN_HEADING = 'Learn more before you contact an appraiser';
const LEARN_MARKER = 'data-appraisily-learn-more="compact"';
const FAQ_HEADING = 'Frequently asked questions';
export const FAQ_KEEP_QUESTION = 'Can Appraisily help if there is no local appraiser available?';

function decode(value) {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sectionAround(html, marker) {
  const at = html.indexOf(marker);
  if (at === -1) return null;
  const start = html.lastIndexOf('<section', at);
  const end = html.indexOf('</section>', at);
  if (start === -1 || end === -1) return null;
  return { start, end: end + '</section>'.length, text: html.slice(start, end + '</section>'.length) };
}

/** First three "Related locations" names on the page, e.g. "Providence, RI". */
export function nearestPlaces(html) {
  const match = html.match(/Related locations<\/h3>\s*<div[^>]*>([\s\S]*?)<\/div>/);
  if (!match) return [];
  return [...match[1].matchAll(/<a[^>]*href="(\/location\/[^"]+\/)"[^>]*>([\s\S]*?)<\/a>/g)]
    .slice(0, 3)
    .map((link) => ({ href: link[1], name: decode(link[2]).replace(/^Antique & Art Appraisers in /, '') }));
}

function listWords(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join('; ')} and ${items[items.length - 1]}`;
}

export function listingSentence(place, facts, nearest) {
  const n = facts?.listings;
  const m = facts?.specialists || 0;
  const specialistText = `${m} fine-art specialist${m === 1 ? '' : 's'}`;
  let lead;
  if (!Number.isInteger(n)) lead = `See the listings on this page for ${place}.`;
  else if (n > 0) {
    lead = `${n} provider profile${n === 1 ? ' is' : 's are'} listed on this page for ${place}` +
      (m > 0 ? `, plus ${specialistText}.` : '.');
  } else if (m > 0) lead = `No antique provider profile is listed for ${place} yet; ${specialistText} ${m === 1 ? 'is' : 'are'} listed.`;
  else lead = `No provider profile is listed for ${place} yet.`;
  const near = nearest.length ? ` Nearest published cities: ${listWords(nearest.map((item) => item.name))}.` : '';
  return `${lead}${near} Confirm credentials, fees and availability directly.`;
}

function compactLearnMore(section, slug) {
  const links = [...section.matchAll(/<a\b[^>]*href="(https:\/\/articles\.appraisily\.com\/[^"]+)"[^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>/g)]
    .map((match) => `<a class="text-blue-700 underline underline-offset-2" href="${match[1]}" target="_blank" rel="noopener noreferrer">${escapeHtml(decode(match[2]).replace(/\s*\([^)]*\)$/, ''))}</a>`);
  if (!links.length) throw new Error(`${slug}: learn-more section has no article links`);
  return (
    `<section class="py-6 border-t border-gray-200" ${LEARN_MARKER}>` +
    `<h2 class="text-lg font-semibold text-gray-900 mb-2">${LEARN_HEADING}</h2>` +
    `<p class="text-gray-700">Read first: ${links.join(' · ')}</p>` +
    '</section>'
  );
}

function faqCard(question, answer) {
  return (
    '\n            <div class="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">\n' +
    `              <h3 class="text-lg font-medium text-gray-900 mb-2">${question}</h3>\n` +
    `              <p class="text-gray-700 leading-relaxed">${answer}</p>\n` +
    '            </div>\n'
  );
}

export function transformCityHtml(html, slug, profiles) {
  if (BODY_HELD_SLUGS.has(slug)) return html;
  let out = html;

  const learn = sectionAround(out, LEARN_HEADING);
  if (learn && !learn.text.includes(LEARN_MARKER)) {
    out = out.slice(0, learn.start) + compactLearnMore(learn.text, slug) + out.slice(learn.end);
  }

  const faq = sectionAround(out, `>${FAQ_HEADING}</h2>`);
  if (faq) {
    const cards = [...faq.text.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g)];
    const keep = cards.find((card) => decode(card[1]) === FAQ_KEEP_QUESTION);
    const first = cards[0];
    // A generic first question ("How do antique and art appraisals work in <place>?") becomes the
    // page's own listing question; a page-specific first question (GSC refresh pages) stays as written.
    const genericMatch = first && decode(first[1]).match(/^How do antique and art appraisals work in (.+)\?$/);
    if (keep && first && first !== keep && cards.length !== 2) {
      let firstCard = faqCard(first[1], first[2]);
      if (genericMatch) {
        const place = genericMatch[1];
        const facts = cityPageFacts(out, profiles, `/location/${slug}/`);
        const answer = escapeHtml(listingSentence(place, facts, nearestPlaces(out)));
        firstCard = faqCard(`Which appraisers are listed for ${escapeHtml(place)}?`, answer);
      }
      const body =
        faq.text.slice(0, faq.text.indexOf('<div class="space-y-6">') + '<div class="space-y-6">'.length) +
        '\n' + firstCard +
        faqCard(keep[1], keep[2]) +
        '\n        </div>\n      </section>';
      out = out.slice(0, faq.start) + body + out.slice(faq.end);
    }
  }
  // "How to choose an appraiser in <state>": the generic opening paragraph and the generic
  // "Ask about turnaround…" sentence go; the page-specific paragraphs (GSC refresh pages), the
  // one-photo advice (owner copy, 12 Nov), the specialty and service lists and the related
  // locations stay.
  out = out.replace(GENERIC_CHOOSE_PARAGRAPH, '').replace(GENERIC_ASK_SENTENCE, '</p>');
  return out;
}

export const GENERIC_CHOOSE_PARAGRAPH =
  /\s*<p class="text-gray-700 leading-relaxed">Hiring the right antique and art appraisers in [^<]* depends on your goal \(insurance, estate settlement, donation, or resale\)\. Look for clear fees, a written report when needed, and evidence of comparable research for your item type\.<\/p>/;
export const GENERIC_ASK_SENTENCE =
  / Ask about turnaround time, what kind of value the report uses \(fair market vs replacement\), and whether the fee includes a written report\.<\/p>/;

export function noindexGuideHtml(html) {
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
    return html.replace(/<meta\s+name=["']robots["'][^>]*>/i, ROBOTS_META);
  }
  return html.replace('</head>', `${ROBOTS_META}\n</head>`);
}

function parseArgs(argv) {
  const options = { publicDir: path.join(repoRoot, 'public_site'), write: false, check: false };
  const args = [...argv];
  while (args.length) {
    const [flag, inline] = String(args.shift() || '').split('=');
    const value = () => inline ?? args.shift();
    if (flag === '--public-dir') options.publicDir = path.resolve(process.cwd(), String(value() || ''));
    else if (flag === '--write') options.write = true;
    else if (flag === '--check') options.check = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  return options;
}

export function run({ publicDir, write }) {
  const profiles = readSitemapProfiles(publicDir);
  const changed = [];
  const locationRoot = path.join(publicDir, 'location');
  for (const slug of fs.readdirSync(locationRoot).sort()) {
    const file = path.join(locationRoot, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const next = transformCityHtml(html, slug, profiles);
    if (next !== html) {
      changed.push(`location/${slug}/`);
      if (write) fs.writeFileSync(file, next);
    }
  }
  for (const slug of ZERO_GUIDES) {
    const file = path.join(locationRoot, slug, 'appraisal-guide', 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    const next = noindexGuideHtml(html);
    if (next !== html) {
      changed.push(`location/${slug}/appraisal-guide/`);
      if (write) fs.writeFileSync(file, next);
    }
  }
  return changed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const changed = run(options);
  console.log(JSON.stringify({ action: options.write ? 'texto-repetido-applied' : 'texto-repetido-planned', changed: changed.length, sample: changed.slice(0, 5) }, null, 2));
  if (options.check && changed.length) {
    console.error(`[texto-repetido-20261113] ${changed.length} page(s) not current; run --write.`);
    process.exit(1);
  }
}
