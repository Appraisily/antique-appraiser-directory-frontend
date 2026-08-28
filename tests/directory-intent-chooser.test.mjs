import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const injector = path.join(repoRoot, 'scripts/inject-directory-intent-chooser.mjs');
const routerSource = fs.readFileSync(path.join(repoRoot, 'src/components/DecisionRouter.tsx'), 'utf8');

function runInjector(publicDir, mode) {
  return spawnSync(process.execPath, [injector, '--public-dir', publicDir, mode], { encoding: 'utf8' });
}

function writePage(root, relative, html) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

test('injector places a job-language chooser above listings and stays idempotent', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'directory-intent-chooser-'));
  try {
    writePage(
      publicDir,
      'location/wichita/index.html',
      '<!doctype html><title>Wichita</title><main><section data-appraisily-donation-purpose-bridge="1"></section><section id="local-appraisers"></section></main>',
    );
    writePage(
      publicDir,
      'location/indianapolis/index.html',
      '<!doctype html><title>Indianapolis</title><main><section data-appraisily-donation-purpose-bridge="1"></section><section id="local-appraisers"></section></main>',
    );
    writePage(
      publicDir,
      'index.html',
      '<main data-static-home-intro="1"><a href="/location/">Browse local appraiser listings</a><section data-appraisily-directory-online-conversion-bridge="1"><p>Need an in-person inspection or local expertise? When photos and documentation are sufficient, paid online appraisal signed written valuation report.</p></section></main>',
    );
    writePage(
      publicDir,
      'location/index.html',
      '<section class="card" data-appraisily-national-service-bridge="1"><h2>Choose a local provider or an online appraisal service</h2></section>',
    );

    const write = runInjector(publicDir, '--write');
    assert.equal(write.status, 0, write.stderr);
    const planned = JSON.parse(write.stdout);
    assert.equal(planned.changedFiles, 4);

    const wichita = fs.readFileSync(path.join(publicDir, 'location/wichita/index.html'), 'utf8');
    const wichitaChooser = wichita.indexOf('data-appraisily-directory-intent-chooser="1"');
    const wichitaDonation = wichita.indexOf('data-appraisily-donation-purpose-bridge="1"');
    const wichitaListings = wichita.indexOf('id="local-appraisers"');
    assert.ok(wichitaChooser !== -1 && wichitaChooser < wichitaDonation);
    assert.ok(wichitaDonation < wichitaListings);
    assert.match(wichita, /Need a signed report without a visit/);
    assert.match(wichita, /Need someone in Wichita/);
    assert.match(wichita, /inherited-objects/);
    assert.match(wichita, /\/insurance\?/);
    assert.match(wichita, /qualified-appraisals/);
    assert.match(wichita, /sample-reports\/professional/);
    assert.doesNotMatch(wichita, /Featured/);
    assert.doesNotMatch(wichita, /Top rated/);
    assert.doesNotMatch(wichita, /free appraisal/i);

    const indianapolis = fs.readFileSync(path.join(publicDir, 'location/indianapolis/index.html'), 'utf8');
    assert.match(indianapolis, /href="\/location\/"/);
    assert.match(indianapolis, /Browse published locations/);

    const locationIndex = fs.readFileSync(path.join(publicDir, 'location/index.html'), 'utf8');
    assert.match(locationIndex, /data-gtm-event="directory_cta"/);
    assert.match(locationIndex, /data-cta-kind="inherited"/);
    assert.match(locationIndex, /data-cta-kind="signed_report"/);
    assert.match(locationIndex, /data-gtm-placement="intent_occasion"/);

    const check = runInjector(publicDir, '--check');
    assert.equal(check.status, 0, check.stderr);
    assert.equal(JSON.parse(check.stdout).changedFiles, 0);
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});

test('hydrated router keeps the job-language fork and sample proof', () => {
  assert.match(routerSource, /Need a signed report without a visit/);
  assert.match(routerSource, /requires an in-person inspection or local expertise/);
  assert.match(routerSource, /Start a paid online appraisal/);
  assert.match(routerSource, /See a sample signed report/);
  assert.match(routerSource, /inheritedUrl/);
  assert.doesNotMatch(routerSource, /Featured Appraisily/);
});

test('live home keeps local listings first and adds occasion paths', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'public_site/index.html'), 'utf8');
  const document = new JSDOM(html).window.document;
  const localLink = document.querySelector('main[data-static-home-intro="1"] a[href="/location/"]');
  const chooser = document.querySelector('[data-appraisily-directory-intent-chooser="1"]');
  assert.ok(localLink);
  assert.ok(chooser);
  assert.ok(
    (localLink.compareDocumentPosition(chooser) & document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );
  const text = chooser.textContent?.replace(/\s+/g, ' ') ?? '';
  assert.match(text, /Inherited an object/);
  assert.match(text, /Need it for insurance/);
  assert.match(text, /Donating an item/);
  assert.match(text, /See a sample signed report/);
});

test('live location index chooser links carry directory_cta attributes', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'public_site/location/index.html'), 'utf8');
  const document = new JSDOM(html).window.document;
  const chooser = document.querySelector('[data-appraisily-directory-intent-chooser="1"]');
  assert.ok(chooser);
  const links = [...chooser.querySelectorAll('a[data-gtm-event="directory_cta"]')];
  assert.equal(links.length, 5);
  assert.deepEqual(
    links.map((link) => link.getAttribute('data-cta-kind')),
    ['inherited', 'insurance', 'donation', 'sample_report', 'signed_report'],
  );
});
