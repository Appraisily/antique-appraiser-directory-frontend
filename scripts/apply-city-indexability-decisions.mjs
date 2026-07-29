#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

function parseArgs(argv) {
  const options = {
    publicDir: path.join(ROOT, 'public_site'),
    decisions: path.join(ROOT, 'data/city-indexability-decisions-2026-07-29.json'),
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--decisions') options.decisions = path.resolve(argv[++index] || '');
    else if (token === '--write') options.write = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function robots(html) {
  return html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']robots["']/i)?.[1]
    || '';
}

function setNoindex(html) {
  const tag = /<meta\b[^>]*\bname=["']robots["'][^>]*>/i;
  if (tag.test(html)) return html.replace(tag, '<meta name="robots" content="noindex, follow">');
  return html.replace(/<\/head>/i, '  <meta name="robots" content="noindex, follow">\n</head>');
}

function removeSitemapUrl(sitemap, canonical) {
  return sitemap.replace(
    new RegExp(`<url>\\s*<loc>${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/loc>[\\s\\S]*?<\\/url>\\s*`, 'g'),
    '',
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const decisions = JSON.parse(await fs.readFile(options.decisions, 'utf8'));
  const sitemapPath = path.join(options.publicDir, 'sitemap.xml');
  let sitemap = await fs.readFile(sitemapPath, 'utf8');
  const failures = [];
  const changed = [];

  for (const slug of decisions.noindexUntilProvider) {
    const filename = path.join(options.publicDir, 'location', slug, 'index.html');
    let html = await fs.readFile(filename, 'utf8');
    const canonical = `https://antique-appraiser-directory.appraisily.com/location/${slug}/`;
    const next = setNoindex(html);
    if (next !== html) {
      changed.push(path.relative(ROOT, filename));
      if (options.write) {
        await fs.writeFile(filename, next);
        html = next;
      }
    }
    const nextSitemap = removeSitemapUrl(sitemap, canonical);
    if (nextSitemap !== sitemap) {
      changed.push('public_site/sitemap.xml');
      if (options.write) sitemap = nextSitemap;
    }
    if (!/\bnoindex\b/i.test(robots(html))) failures.push(`${slug}: city page is not noindex`);
    if (sitemap.includes(`<loc>${canonical}</loc>`)) failures.push(`${slug}: city remains in sitemap`);
  }

  if (options.write) await fs.writeFile(sitemapPath, sitemap);
  if (!options.write && changed.length) failures.push(`${changed.length} pending file changes`);
  const result = {
    action: options.write ? 'applied-city-indexability-decisions' : 'checked-city-indexability-decisions',
    ok: failures.length === 0,
    noindexCityCount: decisions.noindexUntilProvider.length,
    changedFiles: [...new Set(changed)].sort(),
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
