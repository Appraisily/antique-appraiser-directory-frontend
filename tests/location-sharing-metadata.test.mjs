import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(repoRoot, 'scripts/generate-location-og-images.py');
const repairer = path.join(repoRoot, 'scripts/repair-location-sharing-metadata.mjs');

function run(command, args, cwd) {
  return spawnSync(command, args, { encoding: 'utf8', cwd });
}

function writePage(root, relative, html) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
}

test('city pages get branded share cards, alt text, and listing dimensions', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'location-sharing-'));
  try {
    writePage(
      publicDir,
      'location/wichita/index.html',
      [
        '<!doctype html><html><head>',
        '<title>Wichita Antique Appraisers | Vintage Items</title>',
        '<link rel="canonical" href="https://antique-appraiser-directory.appraisily.com/location/wichita/">',
        '<meta property="og:image" content="https://assets.appraisily.com/assets/directory/placeholder.jpg">',
        '<meta name="twitter:image" content="https://assets.appraisily.com/assets/directory/placeholder.jpg">',
        '</head><body>',
        '<img src="https://antique-appraiser-directory.appraisily.com/assets/generated-appraiser-profiles/allied-estate-services-wichita.svg" alt="Allied Estate Services - Antique appraiser in Wichita" class="w-full h-full object-cover" loading="lazy">',
        '</body></html>',
      ].join(''),
    );
    writePage(
      publicDir,
      'location/denver/index.html',
      [
        '<!doctype html><html><head>',
        '<title>Denver Antique Appraisers</title>',
        '<link rel="canonical" href="https://antique-appraiser-directory.appraisily.com/location/denver/">',
        '</head><body><p>No listing image</p></body></html>',
      ].join(''),
    );

    const generate = run('python3', [generator, '--public-dir', publicDir, '--write'], repoRoot);
    assert.equal(generate.status, 0, generate.stderr || generate.stdout);
    assert.equal(
      fs.existsSync(path.join(publicDir, 'assets/og/location-wichita.jpg')),
      true,
    );

    const write = run(process.execPath, [repairer, '--public-dir', publicDir, '--write'], repoRoot);
    assert.equal(write.status, 0, write.stderr || write.stdout);
    const planned = JSON.parse(write.stdout);
    assert.equal(planned.changedCityCount, 2);

    const wichita = fs.readFileSync(path.join(publicDir, 'location/wichita/index.html'), 'utf8');
    assert.match(
      wichita,
      /property="og:image" content="https:\/\/antique-appraiser-directory\.appraisily\.com\/assets\/og\/location-wichita\.jpg"/,
    );
    assert.match(wichita, /property="og:image:alt" content="Wichita Antique Appraisers"/);
    assert.match(wichita, /property="og:image:width" content="1200"/);
    assert.doesNotMatch(wichita, /placeholder\.jpg/);
    assert.doesNotMatch(wichita, /appraiser-images\//);
    assert.match(
      wichita,
      /<img height="900" width="1200" src="https:\/\/antique-appraiser-directory\.appraisily\.com\/assets\/generated-appraiser-profiles\//,
    );

    const denver = fs.readFileSync(path.join(publicDir, 'location/denver/index.html'), 'utf8');
    assert.match(denver, /assets\/og\/location-denver\.jpg/);
    assert.match(denver, /og:image:alt" content="Denver Antique Appraisers"/);

    const check = run(process.execPath, [repairer, '--public-dir', publicDir, '--check'], repoRoot);
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});

test('checker fails when a city still uses a listing photo as the share image', () => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'location-sharing-bad-'));
  try {
    writePage(
      publicDir,
      'location/dallas/index.html',
      [
        '<!doctype html><html><head>',
        '<title>Dallas</title>',
        '<link rel="canonical" href="https://antique-appraiser-directory.appraisily.com/location/dallas/">',
        '<meta property="og:image" content="https://assets.appraisily.com/assets/directory/appraiser-images/someone.jpg">',
        '</head><body></body></html>',
      ].join(''),
    );
    fs.mkdirSync(path.join(publicDir, 'assets/og'), { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'assets/og/location-dallas.jpg'), 'not-a-real-jpeg');

    const check = run(process.execPath, [repairer, '--public-dir', publicDir, '--check'], repoRoot);
    assert.equal(check.status, 1);
    assert.match(check.stdout + check.stderr, /dallas/);
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});
