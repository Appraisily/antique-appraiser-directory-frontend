// Unsourced provider claims gate (integrator order 18 Nov 2026, legal risk; audit:
// /srv/manager/projects/coordination/seo/antique-directory-claims-audit-20261118.md).
//
// The publication manifest is the source field: `sourceUrl`, `sourceType` and `claimScope` per provider.
// No provider has review/rating provenance, so no rating, star, review or review count may be published.
// - Every published HTML page and every JS asset: no rating/review markup, text or data.
// - under_review / rejected / retired profiles: no credential, years, licence, phone, email or street claim,
//   and no contact or credential keys in JSON-LD.
// - limited / verified profiles: a credential, years or licence statement must be attributed to the provider's
//   own website (the page links it as its source) unless `claimScope` records `qualification`; no phone, email
//   or street outside "Source:" lines; no contact or credential keys in JSON-LD.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public_site');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/provider-publication-manifest.json'), 'utf8'));
const records = new Map(manifest.providers.map((record) => [record.slug, record]));

export const RATING = /[★☆]|\b[0-5](\.\d)?\s*(\/\s*5|out of 5|stars?)\b|\brated\s+[0-5](\.\d)?\b|\b\d+\s+(google\s+|customer\s+|client\s+)?reviews\b/i;
export const CRED = /\b(ISA|ASA|AAA|AFAA|CAPP|NAJA|USPAP|GIA)\b|\bcertified\b|\baccredited\b|\bmember of\b|society of appraisers|appraisers association of america|\bcourt[- ]accepted\b|\baccepted by\b|\bIRS[- ]qualified\b|\bqualified appraisers?\b|\bcomplian(t|ce)\b/i;
export const YEARS = /\b\d+\+?\s+years?\b|years in business|years of experience|\bsince (18|19|20)\d\d\b|\bestablished in\b|\bfounded in\b/i;
export const LICENCE = /\blicensed\b|\binsured\b|\bbonded\b/i;
const PHONE = /(?<![\d/-])\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d-])/;
const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const STREET = /\b\d{2,5}\s+[A-Z][A-Za-z]+(\s+[A-Z][A-Za-z]+)*\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pkwy|Parkway|Suite|Ste|Hwy|Highway|Pike|Plaza)\b/;
const VERBS = '(says|say|states|state|lists|list|describes|describe|identifies|identify|supports|support|references|reference|shows|show|notes|note|noting|reports|report|presents|present|names|name|credits)';
const ATTRIBUTION = [
  new RegExp(`\\b(official\\s+(site|website|page|appraisals page)|its\\s+(own\\s+)?website|the\\s+(firm|provider|business|practice)['’]s\\s+website|the\\s+source(\\s+site)?|source\\s+site)\\b[^.]{0,80}?\\b${VERBS}\\b`, 'i'),
  /\baccording to (its|the) (official\s+)?(site|website)\b/i,
  new RegExp(`\\bofficial\\s+([\\w&’'-]+\\s+){0,3}(site|website|page|source|sources|materials|copy|biography)\\b[^.]{0,60}?\\b${VERBS}\\b`, 'i'),
  /\b(by|from|on)\s+the\s+official\s+([\w-]+\s+){0,2}(site|website|page|biography)\b/i,
  /\bthe\s+(firm|provider|business|company|practice)['’]s\s+([\w-]+\s+)?(site|website|page)\s+(says|states|lists|describes)\b/i,
  /\bthe\s+(firm|business|company|practice)\s+(reports|states|says)\b/i,
  /^[A-Z][^.]{0,60}?\b(states|says|reports)\s+that\b/i,
  /\b(identified|listed)\s+by\s+[A-Z][\w&]+/,
  /\bNAME\s+(also\s+)?(says|states|lists|describes|reports|notes)\b/i,
  /\b(it|she|he|they)\s+(also\s+)?(says|states|lists|describes|notes)\b/i,
];
const ASSOC_LINK = /href="https?:\/\/(www\.)?(isa-appraisers\.org|appraisersassociation\.org|appraisers\.org|najaappraisers\.com|gia\.edu)\/[^"]+"/i;
const CLAIM_KEYS = new Set(['aggregateRating', 'review', 'ratingValue', 'reviewCount', 'bestRating']);
const CONTACT_KEYS = new Set(['telephone', 'email', 'streetAddress', 'postalCode', 'memberOf', 'hasCredential', 'foundingDate', 'award']);

const decode = (value) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
const text = (value) => decode(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const masked = (value, name) => [name, name.replace(/,?\s+(LLC|Inc\.?|Ltd\.?)$/, '')].filter(Boolean).reduce((acc, n) => acc.split(n).join(' NAME '), value);
const attributed = (value, name) => ATTRIBUTION.some((rx) => rx.test(value) || rx.test(masked(value, name)));
const ABBR = /(\b[A-Z]|\bInc|\bCo|\bLtd|\bSt|\bSte|\bDr|\bMr|\bMrs|\bMs|\bJr|\bSr|\bNo|\bU\.S|\bMt|\bFt|\bAve|\bBlvd|\bRd)\.$/;
function sentences(value) {
  const out = [];
  for (const piece of value.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
    if (out.length && ABBR.test(out.at(-1))) out[out.length - 1] += ` ${piece}`;
    else out.push(piece);
  }
  return out;
}
function jsonLdKeys(html) {
  const keys = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { keys.add(key); walk(child); }
  };
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { walk(JSON.parse(match[1])); } catch { /* the indexing contract owns parse errors */ }
  }
  return keys;
}
function bodyElements(html) {
  const regions = [...html.matchAll(/<(main|aside)\b[\s\S]*?<\/\1>/g)].map((m) => m[0]);
  const items = [];
  for (const region of regions) {
    for (const m of region.matchAll(/<(p|li|span|h[2-4]|dd|dt)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      if (/<(p|li)\b/.test(m[3])) continue;
      if (/data-provider-publication-status/.test(m[2]) || /data-provider-correction-link/.test(m[3])) continue;
      items.push({ attrs: m[2], inner: m[3], text: text(m[3]) });
    }
  }
  return items;
}
function htmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'assets') out.push(...htmlFiles(full)); }
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
const profileName = (html) => text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '');

test('no rating, star, review or review count on any published page', () => {
  const failures = [];
  for (const file of htmlFiles(PUB)) {
    const html = fs.readFileSync(file, 'utf8');
    for (const key of jsonLdKeys(html)) if (CLAIM_KEYS.has(key)) failures.push(`${path.relative(PUB, file)}: JSON-LD ${key}`);
    const body = text((html.match(/<body[\s\S]*<\/body>/)?.[0] || '').replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' '));
    if (RATING.test(body)) failures.push(`${path.relative(PUB, file)}: rating text "${body.match(RATING)[0]}"`);
  }
  assert.deepEqual(failures, []);
});

test('no provider records with ratings, reviews, credentials or contacts in served JS assets', () => {
  const dir = path.join(PUB, 'assets');
  const failures = fs.readdirSync(dir).filter((name) => name.endsWith('.js')).filter((name) => {
    const js = fs.readFileSync(path.join(dir, name), 'utf8');
    return /\{id:"[^"]+",name:"[^"]+",slug:"/.test(js) && /\b(rating|reviewCount):\s*[1-9]|reviews:\[\{author:|certifications:\[\s*"|phone:"[^"]|email:"[^"]|street:"[^"]/.test(js);
  });
  assert.deepEqual(failures, []);
});

test('under_review, rejected and retired profiles publish no credential, years or contact claim', () => {
  const failures = [];
  for (const record of records.values()) {
    if (['limited', 'verified'].includes(record.publicationStatus)) continue;
    const file = path.join(PUB, 'appraiser', record.slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const name = profileName(html);
    for (const key of jsonLdKeys(html)) if (CONTACT_KEYS.has(key)) failures.push(`${record.slug}: JSON-LD ${key}`);
    for (const item of bodyElements(html)) {
      if (/^(Source|Sources)\s*:/.test(item.text)) continue; // a citation, not a claim
      const value = masked(item.text, name);
      for (const [label, rx] of [['credential', CRED], ['years', YEARS], ['licence', LICENCE], ['phone', PHONE], ['email', EMAIL], ['street', STREET]]) {
        if (rx.test(value)) failures.push(`${record.slug}: ${label} "${item.text.slice(0, 90)}"`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

// A credential (ISA/ASA/AAA/CAPP/USPAP, certified, accredited, member of, ...) may appear on a limited/verified
// profile only as a member listing: a "Member listing:" (or "Source:"/"Sources:") line that links the
// association's own public entry for that appraiser. Attribution to the business's own website is not enough
// (seo decision 18 Nov 2026). Business names and URLs are exempt.
const MEMBER_ASSOC_LINK = /href="https?:\/\/([a-z0-9-]+\.)?(isa-appraisers\.org|appraisersassociation\.org|appraisers\.org|najaappraisers\.com)\/[^"]+"/i;
const memberListing = (item) => /^(Member listing|Source|Sources)\s*:/i.test(item.text) && MEMBER_ASSOC_LINK.test(item.inner);
const noUrls = (value) => value.replace(/https?:\/\/\S+/g, ' ');
const businessMasked = (value, names) => names.filter(Boolean).sort((a, b) => b.length - a.length)
  .reduce((acc, n) => masked(acc, n), noUrls(value));
const JSONLD_TEXT_SKIP = new Set(['name', 'url', 'sameAs', 'image', 'item', '@type', '@context', '@id', 'logo']);
function jsonLdTexts(html) {
  const out = [];
  const walk = (value, key) => {
    if (Array.isArray(value)) value.forEach((child) => walk(child, key));
    else if (value && typeof value === 'object') for (const [k, child] of Object.entries(value)) walk(child, k);
    else if (typeof value === 'string' && !JSONLD_TEXT_SKIP.has(key)) out.push({ key, value });
  };
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { walk(JSON.parse(match[1]), ''); } catch { /* the indexing contract owns parse errors */ }
  }
  return out;
}

test('limited and verified profiles: credentials only as member listings; years and licence attributed to their source', () => {
  const failures = [];
  for (const record of records.values()) {
    if (!['limited', 'verified'].includes(record.publicationStatus)) continue;
    const file = path.join(PUB, 'appraiser', record.slug, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    const name = profileName(html);
    const names = [name, record.name];
    const qualification = (record.claimScope || []).includes('qualification');
    for (const key of jsonLdKeys(html)) if (CONTACT_KEYS.has(key)) failures.push(`${record.slug}: JSON-LD ${key}`);
    for (const { key, value } of jsonLdTexts(html)) {
      if (CRED.test(businessMasked(value, names))) failures.push(`${record.slug}: credential in JSON-LD ${key} "${value.slice(0, 90)}"`);
    }
    // Titles and descriptions (incl. og/twitter copies) may name a credential only when the page carries its member listing.
    const hasMemberListing = bodyElements(html).some(memberListing);
    const heads = [html.match(/<title>([^<]*)<\/title>/)?.[1] || '',
      ...[...html.matchAll(/<meta (?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)" content="([^"]*)"/g)].map((m) => m[1])];
    for (const head of heads) {
      if (!hasMemberListing && CRED.test(businessMasked(decode(head), names))) failures.push(`${record.slug}: credential in title/description "${decode(head).slice(0, 90)}"`);
    }
    for (const item of bodyElements(html)) {
      if (!memberListing(item) && CRED.test(businessMasked(item.text, names))) {
        failures.push(`${record.slug}: credential outside a member listing "${item.text.slice(0, 90)}"`);
      }
      if (/^(Member listing|Source|Sources|Official website|Website)\s*:/i.test(item.text) || ASSOC_LINK.test(item.inner)) continue;
      for (const sentence of sentences(item.text)) {
        const value = businessMasked(sentence, names);
        for (const [label, rx] of [['phone', PHONE], ['email', EMAIL], ['street', STREET]]) {
          if (rx.test(value)) failures.push(`${record.slug}: ${label} "${sentence.slice(0, 90)}"`);
        }
        if (qualification) continue;
        for (const [label, rx] of [['years', YEARS], ['licence', LICENCE]]) {
          if (rx.test(value) && !attributed(sentence, name)) failures.push(`${record.slug}: unattributed ${label} "${sentence.slice(0, 90)}"`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});
