import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const injector = path.join(repoRoot, 'scripts/inject-donation-purpose-bridge.mjs');

function runInjector(publicDir, mode) {
  return spawnSync(process.execPath, [injector, '--public-dir', publicDir, mode], { encoding: 'utf8' });
}

test('injector derives safe human city names from route slugs and remains idempotent', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'donation-purpose-bridge-'));
  try {
    const cases = [
      ['albuquerque', 'Antique &amp; Art Appraisers in Albuquerque, NM', 'Albuquerque', 'an Albuquerque'],
      ['st-john-s', "Antique &amp; Art Appraisers in St. John's, NL", "St. John's", "a St. John's"],
      ['washington-dc', 'Antique &amp; Art Appraisers in Washington, DC', 'Washington, DC', 'a Washington, DC'],
      ['indianapolis', 'Indianapolis Appraisal Options', 'Indianapolis', null],
    ];

    for (const [slug, title] of cases) {
      const directory = path.join(publicDir, 'location', slug);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, 'index.html'),
        `<!doctype html><title>${title}</title><main><section id="local-appraisers"></section></main>`,
      );
    }

    const write = runInjector(publicDir, '--write');
    assert.equal(write.status, 0, write.stderr);

    for (const [slug, _title, cityName, phrase] of cases) {
      const html = fs.readFileSync(path.join(publicDir, 'location', slug, 'index.html'), 'utf8');
      assert.ok(html.includes(`Donating an item from ${cityName}?`), html);
      if (phrase) assert.ok(html.includes(`contact ${phrase} appraiser`), html);
      else {
        assert.ok(html.includes('No Indianapolis provider profile is currently listed'), html);
        assert.ok(html.includes('href="/location/"'), html);
        assert.doesNotMatch(html, /contact an Indianapolis appraiser/);
      }
      assert.doesNotMatch(html, /&amp;amp;/);
    }

    const check = runInjector(publicDir, '--check');
    assert.equal(check.status, 0, check.stderr);
    assert.equal(JSON.parse(check.stdout).changedFiles, 0);
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});

test('reviewed local-first page preserves its exact bridge below the provider result', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'donation-local-first-'));
  try {
    const directory = path.join(publicDir, 'location', 'wichita');
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'index.html');
    fs.writeFileSync(file, '<main><section id="local-appraisers">Current result</section></main>');
    assert.equal(runInjector(publicDir, '--write').status, 0);
    const html = fs.readFileSync(file, 'utf8');
    const block = html.match(/<section data-appraisily-donation-purpose-bridge[\s\S]*?<\/section>\s*/)[0];
    assert.match(block, /listings on this page/);
    fs.writeFileSync(file, html.replace(block, '').replace('</main>', `${block}</main>`));
    assert.equal(runInjector(publicDir, '--check').status, 0);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('qualified-appraisals?', 'broken?'));
    assert.equal(runInjector(publicDir, '--check').status, 1, 'malformed bridge must still fail');
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});
