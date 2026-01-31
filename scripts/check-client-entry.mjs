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
    publicDir: path.join(REPO_ROOT, 'dist'),
    marker: '__APPRAISILY_CLIENT_RENDER_ONLY__',
  };

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    switch (flag) {
      case '--public-dir':
      case '--publicDir':
        options.publicDir = path.resolve(process.cwd(), readValue());
        break;
      case '--marker':
        options.marker = String(readValue() || '').trim();
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  return options;
}

function extractFirstModuleScriptSrc(html) {
  const match = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*>/i);
  return match?.[1] || null;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const indexPath = path.join(options.publicDir, 'index.html');

  if (!await fileExists(indexPath)) {
    throw new Error(`[check-client-entry] Missing index.html at ${indexPath}`);
  }

  const html = await fs.readFile(indexPath, 'utf8');
  const moduleSrc = extractFirstModuleScriptSrc(html);
  if (!moduleSrc) {
    throw new Error('[check-client-entry] Could not find <script type="module" src="..."> in index.html');
  }

  const modulePath = path.join(options.publicDir, moduleSrc.replace(/^\//, ''));
  if (!await fileExists(modulePath)) {
    throw new Error(`[check-client-entry] index.html references missing module: ${moduleSrc} (${modulePath})`);
  }

  const js = await fs.readFile(modulePath, 'utf8');
  if (!js.includes(options.marker)) {
    throw new Error(
      `[check-client-entry] Missing marker "${options.marker}" in ${path.relative(REPO_ROOT, modulePath)}.\n` +
        'This usually means the build output is stale or the entrypoint is not the expected client-render-only version.'
    );
  }

  process.stdout.write(
    `[check-client-entry] OK: ${path.relative(REPO_ROOT, modulePath)} contains marker "${options.marker}".\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exit(1);
});

