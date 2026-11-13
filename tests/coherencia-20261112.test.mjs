import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  FA1_OLD_COPY,
  FA2_NEW,
  FA2_OLD,
  FA4_ADVICE_NEW,
  FA4_ADVICE_OLD,
  FA4_FAQ_NEW,
  FA4_FAQ_OLD,
  FA5_NEW,
  FA5_OLD,
  HELD_LOCATION_SLUGS,
  run,
  transformDocument,
} from '../scripts/apply-coherencia-20261112.mjs';

// Consistency audit 12 Nov 2026, class-A rows FA1, FA2, FA4, FA5.
// Owner rule (12 Nov): one clear photo of the front is all we need to start;
// back, signature or label close-up, size and what the customer knows are optional.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(repoRoot, 'public_site');

function listIndexFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listIndexFiles(p));
    else if (entry.name === 'index.html') out.push(p);
  }
  return out;
}
const routeOf = (file) => '/' + path.relative(publicDir, path.dirname(file)).split(path.sep).join('/') + '/';
const isHeld = (route) => {
  const m = /^\/location\/([^/]+)\//.exec(route);
  return Boolean(m && HELD_LOCATION_SLUGS.has(m[1]));
};
const appraiserFiles = listIndexFiles(path.join(publicDir, 'appraiser'));
const locationFiles = listIndexFiles(path.join(publicDir, 'location'));

test('the apply script has nothing left to change (idempotent, public_site is current)', async () => {
  const totals = await run({ publicDir, write: false });
  assert.equal(totals.files, 0, JSON.stringify(totals));
});

test('FA1: every profile decision router names the $59 and routes insurance and donation to their own pages', () => {
  let routers = 0;
  const failures = [];
  for (const file of appraiserFiles) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('data-appraisily-directory-decision-router="1"')) continue;
    routers += 1;
    const route = routeOf(file);
    if (html.includes(FA1_OLD_COPY)) failures.push(`${route}: old one-for-all copy`);
    const dom = new JSDOM(html);
    try {
      const router = dom.window.document.querySelector('[data-appraisily-directory-decision-router="1"]');
      const signed = router.querySelector('a[data-cta-kind="signed_report"]');
      const insurance = router.querySelector('a[data-cta-kind="insurance"]');
      const donation = router.querySelector('a[data-cta-kind="donation"]');
      if (!signed || !insurance || !donation) {
        failures.push(`${route}: missing signed/insurance/donation link`);
        continue;
      }
      if (!/^https:\/\/appraisily\.com\/start\?/.test(signed.getAttribute('href'))) failures.push(`${route}: signed report not /start`);
      if (!signed.textContent.includes('$59')) failures.push(`${route}: signed report button without $59`);
      if (!/^https:\/\/appraisily\.com\/insurance\?.*utm_content=insurance/.test(insurance.getAttribute('href'))) failures.push(`${route}: insurance href`);
      if (!/^https:\/\/appraisily\.com\/qualified-appraisals\?.*utm_content=donation/.test(donation.getAttribute('href'))) failures.push(`${route}: donation href`);
      if (!insurance.textContent.includes('$99')) failures.push(`${route}: insurance price`);
      if (!donation.textContent.includes('from $399')) failures.push(`${route}: donation price`);
      for (const link of [signed, insurance, donation]) {
        if (link.getAttribute('data-gtm-event') !== 'directory_cta') failures.push(`${route}: ${link.dataset.ctaKind} untracked`);
        if (link.getAttribute('data-gtm-placement') !== 'decision_router') failures.push(`${route}: ${link.dataset.ctaKind} placement`);
        if (link.parentElement.closest('a')) failures.push(`${route}: ${link.dataset.ctaKind} nested inside another link`);
      }
      // Same campaign on the three links, copied from the page's own button.
      const campaign = (a) => new URL(a.getAttribute('href')).searchParams.get('utm_campaign');
      if (campaign(insurance) !== campaign(signed) || campaign(donation) !== campaign(signed)) failures.push(`${route}: campaign mismatch`);
      // G8 belongs to ingresos: no qualified / not-qualified claim in this copy.
      const cardText = signed.closest('article').textContent;
      if (/qualified/i.test(cardText)) failures.push(`${route}: qualified wording in the card`);
      if (/\binsurance\b[^.;]*\$59|\$59[^.;]*\binsurance\b/i.test(cardText)) failures.push(`${route}: $59 offered for insurance`);
    } finally {
      dom.window.close();
    }
  }
  assert.equal(routers, 358, `decision routers found: ${routers}`);
  assert.deepEqual(failures.slice(0, 10), []);
});

test('FA2 and FA4: location FAQs and provider advice ask for one front photo; extras are optional', () => {
  const counts = { fa2: 0, adviceNew: 0, faqNew: 0, held: 0 };
  const failures = [];
  for (const file of locationFiles) {
    const route = routeOf(file);
    const html = fs.readFileSync(file, 'utf8');
    if (isHeld(route)) {
      if (html.includes(FA2_OLD)) counts.held += 1;
      continue;
    }
    for (const old of [FA2_OLD, FA4_ADVICE_OLD, FA4_FAQ_OLD]) {
      if (html.includes(old)) failures.push(`${route}: still "${old.slice(0, 40)}..."`);
    }
    if (html.includes(FA2_NEW)) counts.fa2 += 1;
    if (html.includes(FA4_ADVICE_NEW)) counts.adviceNew += 1;
    if (html.includes(FA4_FAQ_NEW)) counts.faqNew += 1;
    if (!html.includes(FA2_NEW)) continue;
    // Visible FAQ and FAQPage JSON-LD carry the same answers.
    const dom = new JSDOM(html);
    try {
      const document = dom.window.document;
      const visible = [...document.querySelectorAll('p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim());
      const schemaAnswers = [];
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        const walk = (node) => {
          if (Array.isArray(node)) return node.forEach(walk);
          if (!node || typeof node !== 'object') return;
          if (node['@type'] === 'Answer' && typeof node.text === 'string') schemaAnswers.push(node.text);
          Object.values(node).forEach(walk);
        };
        try {
          walk(JSON.parse(script.textContent));
        } catch {
          // non-JSON payloads are checked elsewhere
        }
      }
      // 13 Nov (repeated text, step 2): the generic "What should I prepare" question (FA4 FAQ) was cut
      // from the city FAQs; the Appraisily one-photo answer (FA2) stays.
      for (const answer of [FA2_NEW]) {
        if (!visible.includes(answer)) failures.push(`${route}: visible FAQ missing "${answer.slice(0, 30)}..."`);
        if (!schemaAnswers.includes(answer)) failures.push(`${route}: FAQPage JSON-LD missing "${answer.slice(0, 30)}..."`);
      }
    } finally {
      dom.window.close();
    }
  }
  assert.deepEqual(failures.slice(0, 10), []);
  assert.equal(counts.fa2, 99, 'FA2 FAQ on 99 location pages (101 minus the 2 held pilot pages)');
  assert.equal(counts.faqNew, 1, 'the "What should I prepare" FAQ left the trimmed city pages (texto-repetido 13 Nov); only held Houston keeps it');
  assert.equal(counts.adviceNew, 97);
  assert.equal(counts.held, 2, 'held pilot pages (Chicago, Baltimore) stay untouched until their read is written');
});

test('FA2/FA4 copy follows the owner one-photo message and promises a signed report', () => {
  for (const copy of [FA2_NEW, FA4_FAQ_NEW, FA4_ADVICE_NEW]) {
    assert.match(copy, /one clear photo of the front/i);
    assert.match(copy, /Optional, but helpful:/);
  }
  assert.match(FA2_NEW, /signed written report/);
  assert.doesNotMatch(FA2_NEW, /written valuation|photos and details/);
});

test('FA5: no unsupported "verified" Appraisily claim on profiles', () => {
  let replaced = 0;
  for (const file of appraiserFiles) {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(!html.includes(FA5_OLD), `${routeOf(file)} still says "verified online appraisal option"`);
    if (html.includes(FA5_NEW)) replaced += 1;
  }
  assert.equal(replaced, 10);
});

test('transformDocument leaves held pages and unrelated documents alone', () => {
  const sample = `<p>${FA2_OLD}</p><p>${FA4_FAQ_OLD}</p>`;
  assert.equal(transformDocument(sample, '/location/chicago/').html, sample);
  assert.equal(transformDocument(sample, '/location/baltimore/').html, sample);
  assert.equal(transformDocument(sample, '/methodology/').html, sample);
  const changed = transformDocument(sample, '/location/denver/').html;
  assert.ok(changed.includes(FA2_NEW) && changed.includes(FA4_FAQ_NEW));
  assert.equal(transformDocument(changed, '/location/denver/').html, changed, 'idempotent');
});
