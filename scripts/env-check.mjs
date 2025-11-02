#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skipEnvCheck = process.env.SKIP_ENV_CHECK === '1';
const envGovernanceScript = path.resolve(__dirname, '../../../env-governance/run-check.mjs');
const args = ['--schema', 'frontends/antique-appraiser-directory-frontend'];

if (skipEnvCheck) {
  console.log('Skipping env governance check because SKIP_ENV_CHECK=1');
  process.exit(0);
}

if (!fs.existsSync(envGovernanceScript)) {
  console.warn('Env governance script not found; skipping env check for build context.');
  process.exit(0);
}

const result = spawnSync('node', [envGovernanceScript, ...args], {
  stdio: 'inherit',
  env: process.env
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
