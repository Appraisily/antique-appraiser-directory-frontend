#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { POPULAR_LOCATION_SLUGS } from './utils/indexable-locations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const LEGACY_CHAT_EMBED_SRC = 'https://www.appraisily.com/widgets/chat-embed.js';
const CANONICAL_CHAT_EMBED_SRC = 'https://appraisily.com/widgets/chat-embed.js';

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    String(date.getUTCFullYear()),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    publicDir: path.join(REPO_ROOT, 'public_site'),
    releaseRoot: '/mnt/srv-storage/antique-appraiser-directory/releases',
    baseUrl: 'https://antique-appraiser-directory.appraisily.com',
    dryRun: false,
    restartContainer: true,
    containerName: 'antique-appraiser-directory',
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
      case '--release-root':
        options.releaseRoot = path.resolve(process.cwd(), readValue());
        break;
      case '--base-url':
        options.baseUrl = String(readValue() || '').trim();
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--no-restart':
        options.restartContainer = false;
        break;
      case '--restart-container':
        options.restartContainer = true;
        break;
      case '--container':
        {
          const value = readValue();
          if (value) options.containerName = String(value).trim();
        }
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, '');
  return options;
}

function escapeXml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttr(value = '') {
  return escapeXml(String(value || ''));
}

function buildMailto({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const query = params.toString();
  return `mailto:${to}${query ? `?${query}` : ''}`;
}

function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function extractAppraiserLabel(html, slug) {
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1?.[1]) return stripHtml(h1[1]);

  const title = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (title?.[1]) {
    const rawTitle = stripHtml(title[1]);
    const trimmed = rawTitle.split('|')[0]?.split(' - ')[0]?.trim();
    if (trimmed) return trimmed;
    return rawTitle;
  }

  return slug;
}

function extractLocationLabel(html, slug) {
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1?.[1]) return stripHtml(h1[1]);

  const title = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (title?.[1]) {
    const rawTitle = stripHtml(title[1]);
    const trimmed = rawTitle.split('|')[0]?.split(' - ')[0]?.trim();
    if (trimmed) return trimmed;
    return rawTitle;
  }

  return slug;
}

async function generateAppraiserHub({ publicDir, baseUrl }) {
  const appraiserRoot = path.join(publicDir, 'appraiser');
  const outputPath = path.join(appraiserRoot, 'index.html');

  let entries = [];
  try {
    entries = await fs.readdir(appraiserRoot, { withFileTypes: true });
  } catch (error) {
    console.warn('[publish] Unable to read appraiser directory:', error.message);
    return { outputPath, count: 0 };
  }

  const slugs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const items = [];
  for (const slug of slugs) {
    const pagePath = path.join(appraiserRoot, slug, 'index.html');
    try {
      const html = await fs.readFile(pagePath, 'utf8');
      const label = extractAppraiserLabel(html, slug);
      items.push({ slug, label });
    } catch {
      items.push({ slug, label: slug });
    }
  }

  const hubHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>All Art &amp; Antique Appraisers | Appraisily Directory</title>
    <meta name="robots" content="noindex, follow" />
    <link rel="canonical" href="${escapeXml(`${baseUrl}/appraiser/`)}" />
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; color: #111827; background: #f9fafb; }
      header, main { max-width: 960px; margin: 0 auto; padding: 16px; }
      header { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
      ul { columns: 2; column-gap: 24px; margin: 0; padding-left: 18px; }
      li { break-inside: avoid; padding: 4px 0; }
      @media (max-width: 720px) { ul { columns: 1; } }
      .meta { color: #6b7280; font-size: 14px; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1 style="margin: 0; font-size: 20px;">All Art &amp; Antique Appraisers</h1>
        <div class="meta">${items.length} profiles</div>
      </div>
      <nav class="meta">
        <a href="/">Home</a> · <a href="/location/">Locations</a> · <a href="/sitemap.xml">Sitemap</a>
      </nav>
    </header>
    <main>
      <div class="card">
        <ul>
${items
  .map((item) => `          <li><a href="/appraiser/${escapeXml(item.slug)}/">${escapeXml(item.label)}</a></li>`)
  .join('\n')}
        </ul>
      </div>
    </main>
  </body>
</html>
`;

  await fs.writeFile(outputPath, hubHtml, 'utf8');
  return { outputPath, count: items.length };
}

async function generateLocationHub({ publicDir, baseUrl }) {
  const locationRoot = path.join(publicDir, 'location');
  const outputPath = path.join(locationRoot, 'index.html');

  let entries = [];
  try {
    entries = await fs.readdir(locationRoot, { withFileTypes: true });
  } catch (error) {
    console.warn('[publish] Unable to read location directory:', error.message);
    return { outputPath, count: 0 };
  }

  const slugs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const items = [];
  const labelBySlug = new Map();
  for (const slug of slugs) {
    const pagePath = path.join(locationRoot, slug, 'index.html');
    try {
      const html = await fs.readFile(pagePath, 'utf8');
      const label = extractLocationLabel(html, slug);
      items.push({ slug, label });
      labelBySlug.set(slug, label);
    } catch {
      items.push({ slug, label: slug });
      labelBySlug.set(slug, slug);
    }
  }

  // Lightweight internal-link boost for the pages that currently drive clicks/impressions.
  // Keep this list short; the full index remains below.
  const popularSlugs = POPULAR_LOCATION_SLUGS.filter((slug) => labelBySlug.has(slug));

  const hubHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Antique Appraiser Locations | Appraisily Directory</title>
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeXml(`${baseUrl}/location/`)}" />
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; color: #111827; background: #f9fafb; }
      header, main { max-width: 960px; margin: 0 auto; padding: 16px; }
      header { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
      ul { columns: 2; column-gap: 24px; margin: 0; padding-left: 18px; }
      li { break-inside: avoid; padding: 4px 0; }
      @media (max-width: 720px) { ul { columns: 1; } }
      .meta { color: #6b7280; font-size: 14px; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1 style="margin: 0; font-size: 20px;">Browse Locations</h1>
        <div class="meta">${items.length} locations</div>
      </div>
      <nav class="meta">
        <a href="/">Home</a> · <a href="/methodology/">Methodology</a> · <a href="/get-listed/">Get listed</a> · <a href="/sitemap.xml">Sitemap</a>
      </nav>
    </header>
    <main>
      <div class="card">
        ${popularSlugs.length ? `<h2 style="margin:0 0 10px;font-size:16px;">Popular locations</h2>
        <ul style="columns:2;column-gap:24px;margin:0 0 18px;padding-left:18px;">
${popularSlugs
  .map((slug) => `          <li><a href="/location/${escapeXml(slug)}/">${escapeXml(labelBySlug.get(slug) || slug)}</a></li>`)
  .join('\n')}
        </ul>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;">` : ''}
        <ul>
${items
  .map((item) => `          <li><a href="/location/${escapeXml(item.slug)}/">${escapeXml(item.label)}</a></li>`)
  .join('\n')}
        </ul>
      </div>
    </main>
  </body>
</html>
`;

  await fs.writeFile(outputPath, hubHtml, 'utf8');
  return { outputPath, count: items.length };
}

async function generateMethodologyPage({ publicDir, baseUrl }) {
  const outDir = path.join(publicDir, 'methodology');
  const outputPath = path.join(outDir, 'index.html');
  await fs.mkdir(outDir, { recursive: true });

  const contactMailto = buildMailto({
    to: 'info@appraisily.com',
    subject: 'Directory: question / correction',
    body: 'Hi Appraisily team,\n\nPage URL:\n\nWhat needs updating:\n\nSource link(s) (optional):\n',
  });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Directory Methodology | Appraisily</title>
    <meta name="description" content="How Appraisily builds and maintains the Antique Appraiser Directory: sources, updates, and quality checks." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeAttr(`${baseUrl}/methodology/`)}" />
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; color: #111827; background: #f9fafb; }
      header, main { max-width: 960px; margin: 0 auto; padding: 16px; }
      header { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
      .meta { color: #6b7280; font-size: 14px; }
      ul { margin: 10px 0 0; padding-left: 18px; }
      li { padding: 4px 0; }
      h1 { margin: 0; font-size: 20px; }
      h2 { margin: 18px 0 8px; font-size: 16px; }
      p { margin: 8px 0; line-height: 1.6; color: #374151; }
      .cta { display: inline-block; margin-top: 12px; padding: 10px 12px; border-radius: 10px; border: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>How We Build This Directory</h1>
        <div class="meta">Antique Appraiser Directory by Appraisily</div>
      </div>
      <nav class="meta">
        <a href="/">Home</a> · <a href="/location/">Locations</a> · <a href="/get-listed/">Get listed</a> · <a href="/sitemap.xml">Sitemap</a>
      </nav>
    </header>
    <main>
      <div class="card">
        <p>This directory helps people find antique appraisal providers by location and provides an online alternative via Appraisily when a local option isn’t available.</p>

        <h2>What you’ll find here</h2>
        <ul>
          <li>Location pages that summarize appraisal needs (insurance, estates, donations, resale) and list local providers where available.</li>
          <li>A consistent FAQ so users understand what info to prepare and what reports are typically required.</li>
          <li>Links for business owners to request inclusion or corrections.</li>
        </ul>

        <h2>Quality & trust</h2>
        <ul>
          <li>We avoid publishing unverified review counts or ratings in structured data.</li>
          <li>We prioritize updates for locations with real search demand (Search Console impressions/clicks).</li>
          <li>Users should verify details directly with the provider (fees, turnaround, service area, report type).</li>
        </ul>

        <h2>Report an issue</h2>
        <p>If a listing looks incorrect or you’re the owner and want changes, email us with the page URL and the correction.</p>
        <p><a class="cta" href="${escapeAttr(contactMailto)}" data-gtm-event="directory_cta" data-gtm-cta="directory_contact">Email the directory team</a></p>
      </div>
    </main>
  </body>
</html>
`;

  await fs.writeFile(outputPath, html, 'utf8');
  return { outputPath };
}

async function generateGetListedPage({ publicDir, baseUrl }) {
  const outDir = path.join(publicDir, 'get-listed');
  const outputPath = path.join(outDir, 'index.html');
  await fs.mkdir(outDir, { recursive: true });

  const mailto = buildMailto({
    to: 'info@appraisily.com',
    subject: 'Directory: request to get listed',
    body: [
      'Hi Appraisily team,',
      '',
      'Please add/update my appraisal business listing in the Antique Appraiser Directory.',
      '',
      'Business name:',
      'City / State (or Province):',
      'Website:',
      'Email:',
      'Phone (optional):',
      'Services (insurance/estate/donation/resale/etc):',
      'Specialties (e.g., jewelry, furniture, art, coins):',
      'Service area (travel radius / remote?):',
      '',
      'Thanks!',
    ].join('\n'),
  });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Get Listed | Appraisily Directory</title>
    <meta name="description" content="Are you an antique appraiser? Request a listing or correction in the Appraisily Antique Appraiser Directory." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeAttr(`${baseUrl}/get-listed/`)}" />
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; color: #111827; background: #f9fafb; }
      header, main { max-width: 960px; margin: 0 auto; padding: 16px; }
      header { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
      .meta { color: #6b7280; font-size: 14px; }
      h1 { margin: 0; font-size: 20px; }
      p { margin: 8px 0; line-height: 1.6; color: #374151; }
      ul { margin: 8px 0 0; padding-left: 18px; }
      li { padding: 4px 0; }
      .cta { display: inline-block; margin-top: 12px; padding: 10px 12px; border-radius: 10px; border: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>Get Listed</h1>
        <div class="meta">Antique Appraiser Directory by Appraisily</div>
      </div>
      <nav class="meta">
        <a href="/">Home</a> · <a href="/location/">Locations</a> · <a href="/methodology/">Methodology</a> · <a href="/sitemap.xml">Sitemap</a>
      </nav>
    </header>
    <main>
      <div class="card">
        <p>If you’re an antique appraiser (or you manage a valuation team) you can request inclusion or correction in this directory.</p>
        <p><a class="cta" href="${escapeAttr(mailto)}" data-gtm-event="directory_cta" data-gtm-cta="get_listed_email">Email to request a listing</a></p>
        <p class="meta">Email: <code>info@appraisily.com</code></p>

        <p style="margin-top: 14px;">To speed up processing, include:</p>
        <ul>
          <li>Business name + website</li>
          <li>City/state (or province) + service area</li>
          <li>Specialties + services (insurance/estate/donation/resale)</li>
        </ul>
      </div>
    </main>
  </body>
</html>
`;

  await fs.writeFile(outputPath, html, 'utf8');
  return { outputPath };
}

async function ensureHomeCrawlLinks({ publicDir }) {
  const homePath = path.join(publicDir, 'index.html');
  const marker = 'data-appraisily-crawl-links';
  const injection = `\n<div ${marker} style="max-width:960px;margin:0 auto;padding:12px 16px;font:14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#6b7280;">\n  <a href=\"/location/\">Browse locations</a> · <a href=\"/methodology/\">Methodology</a> · <a href=\"/get-listed/\">Get listed</a> · <a href=\"/sitemap.xml\">Sitemap</a> · <a href=\"https://articles.appraisily.com/priority-guides/\">Top 100 guides</a> · <a href=\"https://articles.appraisily.com/irs-qualified-appraiser-near-me/\">IRS appraisal guide</a>\n</div>\n`;
  const markerBlockRe = /<div[^>]*\bdata-appraisily-crawl-links\b[^>]*>[\s\S]*?<\/div>/i;

  let html = '';
  try {
    html = await fs.readFile(homePath, 'utf8');
  } catch (error) {
    console.warn('[publish] Unable to read home page for crawl links:', error.message);
    return { updated: false };
  }

  if (html.includes(marker)) {
    const updatedHtml = html.replace(markerBlockRe, injection.trim());
    if (updatedHtml === html) return { updated: false };
    await fs.writeFile(homePath, updatedHtml, 'utf8');
    return { updated: true };
  }
  if (!html.includes('</body>')) return { updated: false };

  const updatedHtml = html.replace('</body>', `${injection}</body>`);
  await fs.writeFile(homePath, updatedHtml, 'utf8');
  return { updated: true };
}

function buildLoc(relativePath, baseUrl) {
  let normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized === 'index.html') {
    return `${baseUrl}/`;
  }
  if (normalized.endsWith('index.html')) {
    normalized = normalized.slice(0, -'index.html'.length);
  }
  normalized = normalized.replace(/\/+$/, '');
  if (!normalized) {
    return `${baseUrl}/`;
  }
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (!normalized.endsWith('/') && !normalized.includes('.')) {
    normalized = `${normalized}/`;
  }
  return `${baseUrl}${normalized}`;
}

async function walkHtml(publicDir, relativeDir, bucket, options) {
  const currentDir = path.join(publicDir, relativeDir);
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const childRel = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      if (options.skipDirs.has(entry.name)) continue;
      await walkHtml(publicDir, childRel, bucket, options);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.html')) continue;
    if (options.skipFiles.has(entry.name)) continue;

    const absolutePath = path.join(publicDir, childRel);
    if (options.shouldInclude && !(await options.shouldInclude(absolutePath, childRel))) continue;
    const stat = await fs.stat(absolutePath);
    bucket.push({
      loc: buildLoc(childRel, options.baseUrl),
      lastmod: new Date(stat.mtimeMs).toISOString(),
      changefreq: options.changefreq,
      priority: 0.8,
    });
  }
}

function renderUrl(entry) {
  return `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`;
}

async function shouldIncludeInSitemap(htmlPath) {
  const content = await fs.readFile(htmlPath, 'utf8');
  if (/<meta\s+http-equiv=(['"])refresh\1/i.test(content)) return false;
  if (/<meta\s+name=(['"])robots\1[^>]*content=(['"])\s*[^"']*noindex/i.test(content)) return false;
  return true;
}

async function regenerateSitemap({ publicDir, baseUrl }) {
  const outputPath = path.join(publicDir, 'sitemap.xml');
  const options = {
    baseUrl,
    changefreq: 'weekly',
    skipDirs: new Set(['css', 'js', 'fonts', 'images', 'assets', '_templates', 'tmp', 'temp', 'node_modules']),
    skipFiles: new Set(['404.html', '50x.html', 'sitemap.xml']),
    shouldInclude: async (absolutePath) => shouldIncludeInSitemap(absolutePath),
  };

  const urls = [];
  await walkHtml(publicDir, '', urls, options);

  if (!urls.length) {
    throw new Error(`No HTML files discovered under ${publicDir}`);
  }

  urls.sort((a, b) => a.loc.localeCompare(b.loc));

  const base = `${baseUrl}/`;
  const rootIndex = urls.findIndex((entry) => entry.loc === base);
  if (rootIndex > 0) {
    const [home] = urls.splice(rootIndex, 1);
    home.priority = 1.0;
    urls.unshift(home);
  } else if (rootIndex === -1) {
    urls.unshift({
      loc: base,
      lastmod: new Date().toISOString(),
      changefreq: options.changefreq,
      priority: 1.0,
    });
  } else {
    urls[0].priority = 1.0;
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(renderUrl),
    '</urlset>',
    '',
  ].join('\n');

  await fs.writeFile(outputPath, xml, 'utf8');
  return { outputPath, count: urls.length };
}

async function walkHtmlFiles(rootDir, relativeDir, bucket) {
  const currentDir = path.join(rootDir, relativeDir);
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const childRel = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      await walkHtmlFiles(rootDir, childRel, bucket);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    bucket.push(path.join(rootDir, childRel));
  }
}

async function normalizeChatEmbedHost(releaseDir) {
  const candidates = [];
  await walkHtmlFiles(releaseDir, '', candidates);
  let touchedCount = 0;

  for (const file of candidates) {
    const input = await fs.readFile(file, 'utf8');
    const next = input.replaceAll(LEGACY_CHAT_EMBED_SRC, CANONICAL_CHAT_EMBED_SRC);
    if (next !== input) {
      await fs.writeFile(file, next, 'utf8');
      touchedCount += 1;
    }
  }

  return { touchedCount };
}

async function assertNoLegacyChatEmbedHost(releaseDir) {
  const candidates = [];
  await walkHtmlFiles(releaseDir, '', candidates);
  const offenders = [];

  for (const file of candidates) {
    const input = await fs.readFile(file, 'utf8');
    if (input.includes(LEGACY_CHAT_EMBED_SRC)) {
      offenders.push(path.relative(releaseDir, file));
      if (offenders.length >= 10) break;
    }
  }

  if (offenders.length) {
    throw new Error(
      `Legacy chat embed host detected in release HTML (${LEGACY_CHAT_EMBED_SRC}). Example files: ${offenders.join(', ')}`,
    );
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const timestamp = formatTimestamp();
  const releaseDir = path.join(options.releaseRoot, timestamp);
  const currentSymlink = path.join(options.releaseRoot, 'current');

  run(process.execPath, [path.join(__dirname, 'validate-verified-providers.mjs')], {
    cwd: REPO_ROOT,
  });

  run(process.execPath, [path.join(__dirname, 'build-standardized-with-verified.mjs')], {
    cwd: REPO_ROOT,
  });

  run(process.execPath, [path.join(__dirname, 'generate-location-pages.mjs'), '--public-dir', options.publicDir], {
    cwd: REPO_ROOT,
  });

  run(
    process.execPath,
    [path.join(__dirname, 'enrich-location-pages.mjs'), '--public-dir', options.publicDir],
    {
      cwd: REPO_ROOT,
    },
  );

  run(process.execPath, [path.join(__dirname, 'apply-indexing-rules.mjs'), '--public-dir', options.publicDir], {
    cwd: REPO_ROOT,
  });

  // Guardrail: this directory's pre-rendered HTML is not shipped with a serialized React snapshot,
  // so publishing a hydration client entry will trigger repeated recoverable errors (#418) in production.
  run(process.execPath, [path.join(__dirname, 'check-client-entry.mjs'), '--public-dir', options.publicDir], {
    cwd: REPO_ROOT,
  });

  const locationHub = await generateLocationHub({ publicDir: options.publicDir, baseUrl: options.baseUrl });
  const appraiserHub = await generateAppraiserHub({ publicDir: options.publicDir, baseUrl: options.baseUrl });
  const methodology = await generateMethodologyPage({ publicDir: options.publicDir, baseUrl: options.baseUrl });
  const getListed = await generateGetListedPage({ publicDir: options.publicDir, baseUrl: options.baseUrl });
  const crawlLinks = await ensureHomeCrawlLinks({ publicDir: options.publicDir });

  const sitemap = await regenerateSitemap({
    publicDir: options.publicDir,
    baseUrl: options.baseUrl,
  });

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          action: 'dry-run',
          locationHub,
          appraiserHub,
          methodology,
          getListed,
          crawlLinks,
          sitemap,
          releaseDir,
          currentSymlink,
        },
        null,
        2,
      ),
    );
    return;
  }

  await fs.mkdir(releaseDir, { recursive: true });
  run('rsync', ['-a', '--delete', '--no-perms', '--no-owner', '--no-group', `${options.publicDir}/`, `${releaseDir}/`]);
  const chatHostNormalization = await normalizeChatEmbedHost(releaseDir);
  await assertNoLegacyChatEmbedHost(releaseDir);
  run('ln', ['-sfn', releaseDir, currentSymlink]);

  if (options.restartContainer && options.containerName) {
    try {
      run('docker', ['restart', options.containerName]);
    } catch (error) {
      console.warn(`[publish] Warning: failed to restart container ${options.containerName}:`, error.message);
    }
  }

  console.log(
    JSON.stringify(
      {
        action: 'published',
        locationHub,
        appraiserHub,
        methodology,
        getListed,
        crawlLinks,
        sitemap,
        chatHostNormalization,
        releaseDir,
        currentSymlink,
        containerRestarted: Boolean(options.restartContainer && options.containerName),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[publish] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
