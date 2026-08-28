import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const injector = path.join(repoRoot, 'scripts/inject-near-me-hub-bridge.mjs');

function runInjector(publicDir, mode) {
  return spawnSync(process.execPath, [injector, '--public-dir', publicDir, mode], { encoding: 'utf8' });
}

const NATIONAL_FIXTURE = `<!doctype html><title>Art Appraisers Near Me</title>
<main>
      <section class="card hero"><p>Hero</p></section>
      <section class="card section">
        <h2 style="margin-top: 0;">What to compare before you book</h2>
      </section>
</main>`;

test('national leftover near-me pages receive hub bridges and stay idempotent', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'near-me-hub-bridge-'));
  try {
    fs.mkdirSync(path.join(publicDir, 'location', 'chicago', 'appraisal-guide'), { recursive: true });
    fs.mkdirSync(path.join(publicDir, 'art-appraisers-near-me'), { recursive: true });
    fs.mkdirSync(path.join(publicDir, 'antique-appraisers-near-me'), { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'art-appraisers-near-me', 'index.html'), NATIONAL_FIXTURE);
    fs.writeFileSync(
      path.join(publicDir, 'antique-appraisers-near-me', 'index.html'),
      NATIONAL_FIXTURE.replace('Art Appraisers Near Me', 'Antique Appraisers Near Me'),
    );

    const write = runInjector(publicDir, '--write');
    assert.equal(write.status, 0, write.stderr + write.stdout);
    const planned = JSON.parse(write.stdout);
    assert.equal(planned.changedFiles, 2);

    const art = fs.readFileSync(path.join(publicDir, 'art-appraisers-near-me', 'index.html'), 'utf8');
    const antique = fs.readFileSync(
      path.join(publicDir, 'antique-appraisers-near-me', 'index.html'),
      'utf8',
    );
    assert.ok(art.includes('data-appraisily-near-me-hub-bridge="1"'));
    assert.ok(art.includes('https://appraisily.com/art-appraiser-near-me'));
    assert.ok(art.includes('https://appraisily.com/online-appraiser-near-me'));
    assert.ok(art.includes('https://appraisily.com/insurance-appraiser-near-me'));
    assert.ok(!art.includes('https://appraisily.com/antique-appraiser-near-me?'));
    assert.ok(antique.includes('https://appraisily.com/antique-appraiser-near-me'));
    assert.ok(antique.includes('https://appraisily.com/art-appraiser-near-me'));
    assert.equal((art.match(/data-appraisily-near-me-hub-bridge="1"/g) || []).length, 1);

    const check = runInjector(publicDir, '--check');
    assert.equal(check.status, 0, check.stderr + check.stdout);
    assert.equal(JSON.parse(check.stdout).changedFiles, 0);
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});
