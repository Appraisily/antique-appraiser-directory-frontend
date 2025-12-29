#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

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

  const sitemap = await regenerateSitemap({
    publicDir: options.publicDir,
    baseUrl: options.baseUrl,
  });

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          action: 'dry-run',
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
        sitemap,
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
