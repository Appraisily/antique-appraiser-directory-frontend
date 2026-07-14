#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const providerName = ['image', 'kit'].join('');
const providerHost = ['ik', providerName, 'io'].join('.');
const checker = path.resolve('scripts/check-retired-image-provider.mjs');

function runFixture(setup) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retired-provider-gate-'));
  try {
    setup(root);
    return spawnSync(process.execPath, [checker, '--root', root], { encoding: 'utf8' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const valid = runFixture((root) => {
  fs.mkdirSync(path.join(root, 'images'));
  fs.writeFileSync(path.join(root, 'images', 'first-party.bin'), Buffer.from([0, 1, 2, 3]));
  fs.writeFileSync(path.join(root, 'policy.txt'), 'https://assets.appraisily.com/assets/example.avif');
});
assert.equal(valid.status, 0, valid.stderr);

const binaryName = runFixture((root) => {
  fs.writeFileSync(path.join(root, `${providerName}-legacy.bin`), Buffer.from([0, 1, 2, 3]));
});
assert.notEqual(binaryName.status, 0);
assert.match(binaryName.stderr, /provider-branded path name/);

const directoryName = runFixture((root) => {
  const directory = path.join(root, `legacy-${providerName}`);
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'asset.bin'), Buffer.from([0, 1, 2, 3]));
});
assert.notEqual(directoryName.status, 0);
assert.match(directoryName.stderr, /provider-branded path name/);

const textualHost = runFixture((root) => {
  fs.writeFileSync(path.join(root, 'policy.txt'), `img-src https://${providerHost}`);
});
assert.notEqual(textualHost.status, 0);
assert.match(textualHost.stderr, /retired image host/);

const brandedPath = runFixture((root) => {
  fs.writeFileSync(path.join(root, 'policy.txt'), `https://assets.example.test/${providerName}/asset.jpg`);
});
assert.notEqual(brandedPath.status, 0);
assert.match(brandedPath.stderr, /provider-branded asset path/);

console.log('[retired-image-provider-negative-test] filename, directory, content, host, and CSP-style fixtures behaved as expected.');
