#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../../art-appraiser-directory-frontend/scripts/publish-patch.mjs');

const args = [
  scriptPath,
  '--release-root',
  '/mnt/srv-storage/antique-appraiser-directory/releases',
  '--container',
  'antique-appraiser-directory',
  ...process.argv.slice(2),
];

const result = spawnSync(process.execPath, args, {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(typeof result.status === 'number' ? result.status : 1);
