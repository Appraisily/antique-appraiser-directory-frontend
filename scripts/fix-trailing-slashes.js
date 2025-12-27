#!/usr/bin/env node
/**
 * Fix trailing slashes in generated HTML for SEO consistency.
 *
 * Why: Google can treat /path and /path/ as distinct URLs. When the origin redirects
 * non-slash paths in a weird way (e.g. to :8080), canonicals/internal links pointing
 * to the non-slash variant can cause "Crawled - currently not indexed".
 *
 * This script:
 * - Ensures <link rel="canonical"> and og/twitter url metas end with a trailing slash
 *   for directory-style paths (no file extension).
 * - Ensures internal links to /appraiser/<slug> and /location/<slug> use trailing slashes.
 * - Updates the same paths inside JSON-LD strings ("url"/"item") when relative.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function log(message, type = 'info') {
  const now = new Date().toISOString();
  const color =
    type === 'error' ? chalk.red :
    type === 'warning' ? chalk.yellow :
    type === 'success' ? chalk.green :
    chalk.blue;
  console.log(`[${now}] ${color(message)}`);
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    publicDir: path.join(ROOT_DIR, 'public_site'),
    domain: 'https://antique-appraiser-directory.appraisily.com',
    dryRun: false,
    verbose: false,
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
      case '--domain':
        options.domain = String(readValue() || '').trim();
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  options.domain = options.domain.replace(/\/+$/, '');
  return options;
}

async function listHtmlFiles(rootDir) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        await walk(filePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.html')) continue;
      out.push(filePath);
    }
  }
  await walk(rootDir);
  return out;
}

function ensureTrailingSlashOnUrl(rawUrl, domain) {
  const value = String(rawUrl || '').trim();
  if (!value) return value;

  // Skip mailto/tel etc.
  if (!/^https?:\/\//i.test(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  // Normalize scheme for our domain (avoid http:// redirects).
  const domainHost = new URL(domain).hostname;
  if (url.hostname === domainHost) {
    url.protocol = 'https:';
    url.port = '';
  }

  // Only add slash to "directory-style" URLs (no extension, no trailing slash).
  if (!url.pathname.endsWith('/')) {
    const last = url.pathname.split('/').pop() || '';
    if (!last.includes('.')) {
      url.pathname = `${url.pathname}/`;
    }
  }

  return url.toString();
}

function ensureTrailingSlashOnPath(pathname) {
  const raw = String(pathname || '');
  if (!raw.startsWith('/')) return raw;
  if (raw.endsWith('/')) return raw;
  const last = raw.split('/').pop() || '';
  if (last.includes('.')) return raw;
  return `${raw}/`;
}

function rewriteHtml(html, options) {
  let next = html;

  // Canonical + social URL metas: normalize absolute URLs.
  next = next.replace(
    /<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/gi,
    (match, href) => match.replace(href, ensureTrailingSlashOnUrl(href, options.domain)),
  );

  next = next.replace(
    /<meta\s+property="og:url"\s+content="([^"]+)"\s*\/?>/gi,
    (match, content) => match.replace(content, ensureTrailingSlashOnUrl(content, options.domain)),
  );

  next = next.replace(
    /<meta\s+(?:name|property)="twitter:url"\s+content="([^"]+)"\s*\/?>/gi,
    (match, content) => match.replace(content, ensureTrailingSlashOnUrl(content, options.domain)),
  );

  // Internal HTML links for key routes.
  next = next.replace(
    /href="(\/(?:appraiser|location)\/[^"\/?#]+)"/g,
    (match, href) => `href="${ensureTrailingSlashOnPath(href)}"`,
  );

  // JSON-LD / embedded JSON strings that use relative URLs.
  next = next.replace(
    /"(url|item)"\s*:\s*"(\/(?:appraiser|location)\/[^"\/?#]+)"/g,
    (match, key, relPath) => `"${key}":"${ensureTrailingSlashOnPath(relPath)}"`,
  );

  return next;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!await fs.pathExists(options.publicDir)) {
    log(`Public dir not found: ${options.publicDir}`, 'error');
    process.exit(1);
  }

  log(`Fixing trailing slashes under ${options.publicDir}`, 'info');
  const files = await listHtmlFiles(options.publicDir);
  log(`Found ${files.length} HTML files`, 'info');

  let changed = 0;
  for (const filePath of files) {
    const original = await fs.readFile(filePath, 'utf8');
    const updated = rewriteHtml(original, options);
    if (updated === original) continue;

    changed += 1;
    if (options.verbose) {
      log(`Updated: ${path.relative(ROOT_DIR, filePath)}`, 'success');
    }

    if (!options.dryRun) {
      await fs.writeFile(filePath, updated, 'utf8');
    }
  }

  if (options.dryRun) {
    log(`Dry run complete. Files that would change: ${changed}`, 'success');
  } else {
    log(`Done. Files changed: ${changed}`, 'success');
  }
}

main().catch((err) => {
  log(err?.stack || err?.message || String(err), 'error');
  process.exit(1);
});

