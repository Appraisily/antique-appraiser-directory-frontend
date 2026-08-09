import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const homeHtml = fs.readFileSync(path.join(repoRoot, 'public_site/index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(repoRoot, 'src/App.tsx'), 'utf8');
const routerSource = fs.readFileSync(path.join(repoRoot, 'src/components/DecisionRouter.tsx'), 'utf8');
const document = new JSDOM(homeHtml).window.document;
const bridge = document.querySelector('[data-appraisily-directory-online-conversion-bridge="1"]');
const priorityPages = [
  'index.html',
  'location/philadelphia/index.html',
  'location/wichita/index.html',
  'location/new-orleans/index.html',
  'location/raleigh/index.html',
  'location/baltimore/index.html',
  'location/pittsburgh/index.html',
  'location/chicago/index.html',
];

test('home preserves the local-directory job before presenting the online route', () => {
  assert.ok(bridge, 'expected one home online-conversion bridge');
  assert.equal(document.querySelectorAll('[data-appraisily-directory-online-conversion-bridge="1"]').length, 1);

  const localLink = document.querySelector('main[data-static-home-intro="1"] a[href="/location/"]');
  assert.ok(localLink, 'expected a visible local-directory link');
  assert.match(localLink.textContent ?? '', /browse local appraiser listings/i);
  assert.ok(
    (localLink.compareDocumentPosition(bridge) & document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    'the local-directory route must appear before the online offer',
  );

  const pageText = document.querySelector('main[data-static-home-intro="1"]')?.textContent ?? '';
  assert.match(pageText, /confirm provider credentials, scope, fees, service area, and availability directly/i);
});

test('online bridge describes fit and deliverable without degrading local options', () => {
  const text = bridge?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  assert.match(text, /in-person inspection or local expertise/i);
  assert.match(text, /when photos and documentation are sufficient/i);
  assert.match(text, /paid online appraisal/i);
  assert.match(text, /signed written valuation report/i);

  for (const unsupportedClaim of [
    /no local appraisers/i,
    /certified apprais/i,
    /same[- ]day/i,
    /\b24[- ]?hour/i,
    /best price/i,
    /five[- ]star/i,
    /free appraisal/i,
  ]) {
    assert.doesNotMatch(text, unsupportedClaim);
  }
});

test('paid CTA points to canonical regular intake and uses supported directory telemetry', () => {
  const paidLink = bridge?.querySelector('a[data-cta-kind="signed_report"]');
  assert.ok(paidLink, 'expected one paid appraisal CTA');

  const destination = new URL(paidLink.getAttribute('href'));
  assert.equal(destination.origin, 'https://appraisily.com');
  assert.equal(destination.pathname, '/start');
  assert.equal(destination.searchParams.get('service'), 'regular');
  assert.equal(destination.searchParams.get('utm_source'), 'antique_directory');
  assert.equal(destination.searchParams.get('utm_campaign'), 'directory_to_start');
  assert.equal(paidLink.getAttribute('data-gtm-event'), 'directory_cta');
  assert.equal(paidLink.getAttribute('data-gtm-placement'), 'home_online_conversion_bridge');
  assert.match(paidLink.textContent ?? '', /start a paid online appraisal/i);
});

test('hydrated home retains the same claims, destination builder, and event convention', () => {
  for (const snippet of [
    'data-appraisily-directory-online-conversion-bridge="1"',
    'Need an in-person inspection or local expertise?',
    'signed written valuation report',
    "utm_content: 'home_online_conversion_bridge'",
    'href={homeOnlineAppraisalUrl}',
    'data-gtm-event="directory_cta"',
    "'home_online_conversion_bridge'",
  ]) {
    assert.ok(appSource.includes(snippet), `missing hydrated-home contract: ${snippet}`);
  }

  assert.match(routerSource, /Online signed report/);
  assert.match(routerSource, /requires an in-person inspection or local expertise/);
  assert.match(routerSource, /Start a paid online appraisal/);
});

test('conversion pathway only suggests published internal location routes', () => {
  for (const relativePage of priorityPages) {
    const html = fs.readFileSync(path.join(repoRoot, 'public_site', relativePage), 'utf8');
    const pageDocument = new JSDOM(html).window.document;

    if (relativePage.startsWith('location/')) {
      const hero = pageDocument.querySelector('#root section');
      assert.ok(hero?.classList.contains('bg-blue-600'), `${relativePage} needs a compiled contrast-safe hero background`);
      const stylesheetHref = pageDocument.querySelector('link[rel="stylesheet"]')?.getAttribute('href');
      assert.ok(stylesheetHref?.startsWith('/assets/'), `${relativePage} is missing its static stylesheet`);
      const stylesheet = fs.readFileSync(path.join(repoRoot, 'public_site', stylesheetHref.replace(/^\//, '')), 'utf8');
      assert.match(stylesheet, /\.bg-blue-600\{/);
    }

    for (const link of pageDocument.querySelectorAll('a[href^="/location/"]')) {
      const href = link.getAttribute('href');
      const pathname = new URL(href, 'https://antique-appraiser-directory.appraisily.com').pathname;
      const relativeTarget = pathname.replace(/^\//, '');
      const target = path.join(
        repoRoot,
        'public_site',
        relativeTarget.endsWith('/') ? `${relativeTarget}index.html` : relativeTarget,
      );

      assert.ok(
        fs.existsSync(target),
        `${relativePage} suggests unpublished location route ${pathname}`,
      );
    }
  }
});
