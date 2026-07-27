import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('../scripts/consolidate-art-directory-links.mjs', import.meta.url).pathname;
const SITEMAP = new URL('../public_site/sitemap.xml', import.meta.url).pathname;

async function fixture(html) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'art-consolidation-'));
  const publicDir = path.join(root, 'candidate');
  const receipt = path.join(root, 'receipt.json');
  await fs.mkdir(publicDir);
  await fs.writeFile(path.join(publicDir, 'index.html'), html);
  return { root, publicDir, receipt };
}

function run({ publicDir, receipt, ...extra }) {
  const args = [
    SCRIPT,
    '--public-dir', publicDir,
    '--sitemap', SITEMAP,
    '--receipt', receipt,
    '--write',
  ];
  if (extra.baselineDir) args.push('--baseline-dir', extra.baselineDir);
  if (extra.removeAntiqueCrosslinks) args.push('--remove-antique-crosslinks');
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

test('maps published city routes, falls back safely, and strips tracking', async () => {
  const input = [
    '<a href="https://art-appraisers-directory.appraisily.com/location/boston/?utm_source=x">Boston</a>',
    '<a href="https://art-appraisers-directory.appraisily.com/location/houston/">Houston</a>',
  ].join('');
  const item = await fixture(input);
  const result = run(item);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = await fs.readFile(path.join(item.publicDir, 'index.html'), 'utf8');
  assert.match(output, /antique-appraiser-directory\.appraisily\.com\/location\/boston\//);
  assert.match(output, />Houston<\/a>/);
  assert.doesNotMatch(output, /location\/houston/);
  assert.doesNotMatch(output, /utm_source/);
  const receipt = JSON.parse(await fs.readFile(item.receipt, 'utf8'));
  assert.equal(receipt.linksReplaced, 2);
});

test('deduplicates the known article directory sentence', async () => {
  const input = 'Need a local expert? Browse our <a href="https://art-appraisers-directory.appraisily.com/">Art Appraisers Directory</a> or <a href="https://antique-appraiser-directory.appraisily.com/">Antique Appraisers Directory</a>.';
  const item = await fixture(input);
  const result = run(item);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = await fs.readFile(path.join(item.publicDir, 'index.html'), 'utf8');
  assert.equal((output.match(/antique-appraiser-directory/g) || []).length, 1);
  assert.match(output, /Antique &amp; Art Appraiser Directory/);
  assert.doesNotMatch(output, /href=["']href=/);
});

test('detaches hard-linked candidates and can remove obsolete crosslink sections', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'art-consolidation-hardlink-'));
  const baselineDir = path.join(root, 'baseline');
  const publicDir = path.join(root, 'candidate');
  await fs.mkdir(baselineDir);
  await fs.mkdir(publicDir);
  const input = '<section data-directory-crosslink="antique-to-art"><a href="https://art-appraisers-directory.appraisily.com/">Art</a></section><p>Keep</p>';
  const baseline = path.join(baselineDir, 'index.html');
  const candidate = path.join(publicDir, 'index.html');
  await fs.writeFile(baseline, input);
  await fs.link(baseline, candidate);
  const item = { publicDir, receipt: path.join(root, 'receipt.json'), baselineDir, removeAntiqueCrosslinks: true };
  const result = run(item);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(await fs.readFile(baseline, 'utf8'), input);
  assert.equal(await fs.readFile(candidate, 'utf8'), '<p>Keep</p>');
  assert.notEqual((await fs.stat(baseline)).ino, (await fs.stat(candidate)).ino);
});

test('collapses duplicate directory cards into one truthful combined card', async () => {
  const input = '<section class="article-directory-bridge"><article><a href="https://art-appraisers-directory.appraisily.com/">Art</a></article><article><a href="https://antique-appraiser-directory.appraisily.com/">Antiques</a></article></section>';
  const item = await fixture(input);
  const result = run(item);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = await fs.readFile(path.join(item.publicDir, 'index.html'), 'utf8');
  assert.equal((output.match(/antique-appraiser-directory/g) || []).length, 1);
  assert.match(output, /244 published profiles across 86 public location pages/);
  assert.match(output, /Browse the Antique &amp; Art Appraiser Directory/);
});
