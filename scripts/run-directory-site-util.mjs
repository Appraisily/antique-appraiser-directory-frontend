#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_ROOT = '/srv/repos/tools/directory-site-utils';

export function runDirectorySiteUtil(scriptName, defaultArgs = []) {
  const scriptPath = path.join(TOOL_ROOT, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...defaultArgs, ...process.argv.slice(2)], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DIRECTORY_SITE_REPO_ROOT: REPO_ROOT,
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  process.exit(typeof result.status === 'number' ? result.status : 1);
}
