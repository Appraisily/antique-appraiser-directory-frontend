#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    publicDir: path.join(REPO_ROOT, 'public_site'),
  };

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    switch (flag) {
      case '--public-dir':
        options.publicDir = path.resolve(process.cwd(), readValue());
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  return options;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function countHtmlFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const childPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      total += await countHtmlFiles(childPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      total += 1;
    }
  }

  return total;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requiredPaths = [
    'index.html',
    'robots.txt',
    'sitemap.xml',
    path.join('appraiser', 'index.html'),
    path.join('location', 'index.html'),
  ];

  const missing = [];
  for (const relativePath of requiredPaths) {
    const absolutePath = path.join(options.publicDir, relativePath);
    if (!(await exists(absolutePath))) {
      missing.push(relativePath);
    }
  }

  if (missing.length) {
    throw new Error(
      `Static site validation failed for ${options.publicDir}. Missing required files: ${missing.join(', ')}`,
    );
  }

  const appraiserDir = path.join(options.publicDir, 'appraiser');
  const locationDir = path.join(options.publicDir, 'location');
  const appraiserCount = await countHtmlFiles(appraiserDir);
  const locationCount = await countHtmlFiles(locationDir);

  if (appraiserCount < 2) {
    throw new Error(`Static site validation failed: expected appraiser HTML under ${appraiserDir}`);
  }
  if (locationCount < 2) {
    throw new Error(`Static site validation failed: expected location HTML under ${locationDir}`);
  }

  console.log(
    JSON.stringify(
      {
        action: 'validated-static-site',
        publicDir: options.publicDir,
        appraiserHtmlFiles: appraiserCount,
        locationHtmlFiles: locationCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[check-static-site] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
