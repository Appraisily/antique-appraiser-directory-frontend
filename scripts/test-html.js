#!/usr/bin/env node

import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { getAllHtmlFiles, validateHtmlFile } from './utils/html-test-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = [...argv];
  let publicDir = path.join(ROOT_DIR, 'public_site');
  let specificFile = null;
  let strict = false;

  while (args.length) {
    const token = args.shift();
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    if (flag === '--public-dir') {
      publicDir = path.resolve(process.cwd(), readValue());
      continue;
    }

    if (flag === '--strict') {
      strict = true;
      continue;
    }

    if (token.startsWith('--')) {
      throw new Error(`Unknown flag ${flag}`);
    }

    specificFile = token;
  }

  return { publicDir, specificFile, strict };
}

const { publicDir, specificFile, strict } = parseArgs(process.argv.slice(2));

if (!fs.existsSync(publicDir)) {
  console.error(`Static directory not found: ${publicDir}`);
  process.exit(1);
}

const files = specificFile
  ? [path.resolve(publicDir, specificFile)]
  : await getAllHtmlFiles(publicDir);

const results = [];
for (const file of files) {
  if (!fs.existsSync(file)) {
    results.push({
      file,
      valid: false,
      errors: ['File not found'],
      warnings: [],
      missingResources: [],
    });
    continue;
  }

  results.push(await validateHtmlFile(file, publicDir));
}

const invalid = results.filter((result) => !result.valid);
const warnings = results.reduce((count, result) => count + result.warnings.length, 0);

console.log(JSON.stringify({
  action: 'validated-html',
  publicDir,
  strict,
  files: results.length,
  valid: results.length - invalid.length,
  invalid: invalid.length,
  warnings,
  failures: invalid.slice(0, 20).map((result) => ({
    file: path.relative(publicDir, result.file),
    errors: result.errors,
    missingResources: result.missingResources.slice(0, 20),
  })),
}, null, 2));

process.exit(strict && invalid.length > 0 ? 1 : 0);
