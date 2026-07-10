#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';

const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';

function parseArgs(argv) {
  const options = {
    publicDir: path.resolve(process.cwd(), 'public_site'),
    sitemapPath: '',
    write: false,
    output: '',
  };
  const args = [...argv];
  while (args.length) {
    const token = args.shift();
    const [flag, inline] = String(token || '').split('=');
    const value = () => inline ?? args.shift();
    if (flag === '--public-dir') options.publicDir = path.resolve(process.cwd(), String(value() || ''));
    else if (flag === '--sitemap') options.sitemapPath = path.resolve(process.cwd(), String(value() || ''));
    else if (flag === '--write') options.write = true;
    else if (flag === '--check') options.write = false;
    else if (flag === '--output') options.output = path.resolve(process.cwd(), String(value() || ''));
    else throw new Error(`Unknown flag ${flag}`);
  }
  return options;
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeXml(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function htmlPath(publicDir, url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  if (pathname === '/') return path.join(publicDir, 'index.html');
  return path.join(publicDir, pathname.replace(/^\//, ''), pathname.endsWith('/') ? 'index.html' : '');
}

function inspectHtml(html, url) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const robots = normalize(document.querySelector('meta[name="robots" i]')?.getAttribute('content')).toLowerCase();
  const canonical = normalize(document.querySelector('link[rel~="canonical"]')?.getAttribute('href'));
  const h1Count = [...document.querySelectorAll('h1')].filter((node) => normalize(node.textContent)).length;
  const description = normalize(document.querySelector('meta[name="description" i]')?.getAttribute('content'));
  dom.window.close();
  if (canonical !== url) return { classification: 'redirect-consolidate', reasons: [`canonical:${canonical || 'missing'}`] };
  if (robots.includes('noindex')) return { classification: 'noindex-exclude', reasons: [`robots:${robots}`] };
  const repairReasons = [];
  if (h1Count !== 1) repairReasons.push(`h1-count:${h1Count}`);
  if (description.length < 40) repairReasons.push(`description-length:${description.length}`);
  if (repairReasons.length) return { classification: 'repair-static-html', reasons: repairReasons };
  return { classification: 'keep-indexable', reasons: [] };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sitemapPath = options.sitemapPath || path.join(options.publicDir, 'sitemap.xml');
  const sitemap = await fs.readFile(sitemapPath, 'utf8');
  const blockPattern = /\s*<url>[\s\S]*?<\/url>/gi;
  const blocks = [...sitemap.matchAll(blockPattern)].map((match) => match[0]);
  const records = [];
  const keptBlocks = [];
  for (const block of blocks) {
    const rawUrl = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1];
    if (!rawUrl) continue;
    const url = decodeXml(rawUrl);
    let result;
    try {
      const file = htmlPath(options.publicDir, url);
      const html = await fs.readFile(file, 'utf8');
      result = inspectHtml(html, url);
    } catch (error) {
      result = { classification: 'repair-static-html', reasons: [`missing-static-file:${error.code || error.message}`] };
    }
    records.push({ url, ...result });
    if (result.classification === 'keep-indexable') keptBlocks.push(block);
  }

  const counts = records.reduce((summary, record) => {
    summary[record.classification] = (summary[record.classification] || 0) + 1;
    return summary;
  }, {});
  const manifest = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    sourceSitemapUrls: records.length,
    retainedSitemapUrls: counts['keep-indexable'] || 0,
    counts,
    records,
  };
  const outputPath = options.output || path.join(options.publicDir, 'indexing-manifest.json');
  if (options.write || options.output) {
    await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  if (options.write) {
    if (options.sitemapPath && options.sitemapPath !== path.join(options.publicDir, 'sitemap.xml')) {
      throw new Error('--write cannot be used with an alternate --sitemap source.');
    }
    const repairCount = counts['repair-static-html'] || 0;
    if (repairCount) {
      throw new Error(`Refusing to rewrite sitemap while ${repairCount} URL(s) require static HTML repair.`);
    }
    const prefix = sitemap.slice(0, sitemap.search(blockPattern)).trimEnd();
    await fs.writeFile(sitemapPath, `${prefix}\n${keptBlocks.join('')}\n</urlset>\n`);
  } else if ((counts['redirect-consolidate'] || 0) + (counts['noindex-exclude'] || 0) + (counts['repair-static-html'] || 0) > 0) {
    console.error(JSON.stringify({ action: 'checked-antique-indexing-manifest', ok: false, counts, outputPath }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ action: options.write ? 'wrote-antique-indexing-manifest' : 'checked-antique-indexing-manifest', ok: true, counts, outputPath }, null, 2));
}

main().catch((error) => {
  console.error('[build-indexing-manifest] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
