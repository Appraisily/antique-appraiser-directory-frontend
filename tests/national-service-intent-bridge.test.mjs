import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(repoRoot, 'scripts/check-national-service-intent-bridge.mjs');
const manifestPath = path.join(repoRoot, 'data/national-service-intent-cohort.json');
const publicDir = path.join(repoRoot, 'public_site');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function copyCohort() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'directory-intent-bridge-'));
  const sourceAsset = path.join(publicDir, 'assets/national-service-intent-bridge.js');
  const targetAsset = path.join(temporaryRoot, 'assets/national-service-intent-bridge.js');
  fs.mkdirSync(path.dirname(targetAsset), { recursive: true });
  fs.copyFileSync(sourceAsset, targetAsset);
  for (const page of manifest.pages) {
    const source = path.join(publicDir, page.path);
    const target = path.join(temporaryRoot, page.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return temporaryRoot;
}

function runChecker(candidateRoot) {
  return spawnSync(
    process.execPath,
    [checker, '--public-dir', candidateRoot, '--cohort', manifestPath],
    { encoding: 'utf8' },
  );
}

test('checker rejects a missing bridge', () => {
  const candidateRoot = copyCohort();
  try {
    const target = path.join(candidateRoot, 'location/seattle/index.html');
    const html = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, html.replace('data-appraisily-national-service-bridge="1"', 'data-removed-bridge="1"'));

    const result = runChecker(candidateRoot);
    assert.notEqual(result.status, 0);
    assert.ok(
      result.stderr.includes('location/seattle/index.html: expected one complete national-service bridge'),
      result.stderr,
    );
  } finally {
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('checker rejects a wrong destination', () => {
  const candidateRoot = copyCohort();
  try {
    const target = path.join(candidateRoot, 'location/seattle/index.html');
    const html = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, html.replace('https://appraisily.com/art', 'https://appraisily.com/insurance'));

    const result = runChecker(candidateRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /insurance is linked before its readiness gate is enabled|targets must be/);
  } finally {
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});
