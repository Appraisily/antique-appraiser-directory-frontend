import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('../scripts/remediate-art-directory-links.mjs', import.meta.url).pathname;
const RETIRED_ART_LOCATION =
  '<a href="https://art-appraisers-directory.appraisily.com/location/atlanta/">Atlanta art appraisers</a>';

async function runFixture({ candidate, baseline, receipt }) {
  return spawnSync(process.execPath, [
    SCRIPT,
    '--public-dir', candidate,
    '--baseline-dir', baseline,
    '--receipt', receipt,
    '--write',
  ], { encoding: 'utf8' });
}

test('write mode detaches a hard-linked candidate before replacing it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'antique-art-links-hardlink-'));
  const baseline = path.join(root, 'baseline');
  const candidate = path.join(root, 'candidate');
  const relative = 'fixture/index.html';
  const baselineFile = path.join(baseline, relative);
  const candidateFile = path.join(candidate, relative);
  const receipt = path.join(root, 'receipt.json');
  await fs.mkdir(path.dirname(baselineFile), { recursive: true });
  await fs.mkdir(path.dirname(candidateFile), { recursive: true });
  await fs.writeFile(baselineFile, RETIRED_ART_LOCATION);
  await fs.link(baselineFile, candidateFile);
  assert.equal((await fs.stat(baselineFile)).ino, (await fs.stat(candidateFile)).ino);

  const result = await runFixture({ candidate, baseline, receipt });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(await fs.readFile(baselineFile, 'utf8'), RETIRED_ART_LOCATION);
  assert.notEqual((await fs.stat(baselineFile)).ino, (await fs.stat(candidateFile)).ino);
  assert.match(
    await fs.readFile(candidateFile, 'utf8'),
    /art-appraisers-directory\.appraisily\.com\/location\/"/,
  );
});

test('baseline mismatch is recorded and the candidate remains unchanged', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'antique-art-links-conflict-'));
  const baseline = path.join(root, 'baseline');
  const candidate = path.join(root, 'candidate');
  const relative = 'fixture/index.html';
  const baselineFile = path.join(baseline, relative);
  const candidateFile = path.join(candidate, relative);
  const receipt = path.join(root, 'receipt.json');
  await fs.mkdir(path.dirname(baselineFile), { recursive: true });
  await fs.mkdir(path.dirname(candidateFile), { recursive: true });
  await fs.writeFile(baselineFile, RETIRED_ART_LOCATION);
  const changedCandidate = `${RETIRED_ART_LOCATION}<p>Unreviewed local edit</p>`;
  await fs.writeFile(candidateFile, changedCandidate);

  const result = await runFixture({ candidate, baseline, receipt });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.equal(await fs.readFile(candidateFile, 'utf8'), changedCandidate);
  const report = JSON.parse(await fs.readFile(receipt, 'utf8'));
  assert.equal(report.conflicts, 1);
  assert.deepEqual(report.conflictRecords.map((record) => record.reason), [
    'candidate_differs_from_baseline',
  ]);
});
