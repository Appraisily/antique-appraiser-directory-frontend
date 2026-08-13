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
