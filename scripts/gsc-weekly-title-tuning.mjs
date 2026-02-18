#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SEARCH_ANALYTICS_SCRIPT = '/srv/repos/tools/search-console-inspector/search-analytics.mjs';
const CITIES_FILE = path.join(REPO_ROOT, 'src', 'data', 'cities.json');
const PUBLIC_SITE_DIR = path.join(REPO_ROOT, 'public_site');

const TOP_CITY_SLUGS = [
  'des-moines',
  'kansas-city',
  'chicago',
  'tucson',
  'columbus',
  'denver',
  'milwaukee',
  'cleveland',
  'baltimore',
  'louisville',
  'orlando',
  'san-antonio',
  'calgary',
  'austin',
  'honolulu',
  'minneapolis',
  'indianapolis',
  'edmonton',
  'seattle',
  'sacramento',
];

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    property: 'sc-domain:appraisily.com',
    days: 28,
    rowLimit: 25000,
    minImpressions: 8,
    maxPosition: 30,
    outputDir: `/srv/manager/seo/${new Date().toISOString().slice(0, 10)}-location-title-tuning`,
  };

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    switch (flag) {
      case '--property':
        options.property = String(readValue() || '').trim() || options.property;
        break;
      case '--days':
        options.days = Number.parseInt(String(readValue() || '').trim(), 10) || options.days;
        break;
      case '--row-limit':
        options.rowLimit = Number.parseInt(String(readValue() || '').trim(), 10) || options.rowLimit;
        break;
      case '--min-impressions':
        options.minImpressions = Number.parseInt(String(readValue() || '').trim(), 10) || options.minImpressions;
        break;
      case '--max-position':
        options.maxPosition = Number.parseFloat(String(readValue() || '').trim()) || options.maxPosition;
        break;
      case '--output-dir':
        options.outputDir = path.resolve(process.cwd(), String(readValue() || ''));
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  return options;
}

function csvEscape(value = '') {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function loadCurrentTitle(slug) {
  const filePath = path.join(PUBLIC_SITE_DIR, 'location', slug, 'index.html');
  return fs.readFile(filePath, 'utf8').then((html) => {
    const match = html.match(/<title>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }).catch(() => '');
}

function extractSlugFromPageUrl(pageUrl) {
  const match = String(pageUrl || '').match(/^https:\/\/antique-appraiser-directory\.appraisily\.com\/location\/([^/?#]+)\/?$/i);
  return match ? match[1].trim() : '';
}

function titleCaseFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildSuggestedTitle(cityName, topQueries) {
  const q1 = String(topQueries[0]?.query || '').toLowerCase();
  if (q1.includes('art appraiser') || q1.includes('art appraisal')) {
    return `${cityName} Art & Antique Appraisers | Compare Local Valuation Experts`;
  }
  if (q1.includes('estate')) {
    return `${cityName} Antique Appraisers | Estate, Donation & Insurance Values`;
  }
  if (q1.includes('insurance')) {
    return `${cityName} Antique Appraisers | Insurance & Personal Property Valuations`;
  }
  return `${cityName} Antique Appraisers | Art, Estate & Donation Valuation`;
}

function buildSuggestedDescription(cityName, topQueries) {
  const phrase = topQueries.slice(0, 2).map((q) => q.query).filter(Boolean).join(' and ');
  if (!phrase) {
    return `Compare ${cityName} antique and art appraisers for estate, donation, insurance, and personal property valuation. Review local providers and online options.`;
  }
  return `Compare ${cityName} appraisers for ${phrase}. Review local specialties, service formats, and options for estate, donation, insurance, and personal property valuation.`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outputDir, { recursive: true });

  const cmd = [
    SEARCH_ANALYTICS_SCRIPT,
    '--property', options.property,
    '--dimensions', 'query,page',
    '--days', String(options.days),
    '--row-limit', String(options.rowLimit),
    '--min-impressions', String(options.minImpressions),
    '--max-position', String(options.maxPosition),
    '--format', 'json',
  ];

  const result = spawnSync(process.execPath, cmd, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(`search-analytics failed: ${result.stderr || result.stdout}`);
  }

  const payload = JSON.parse(result.stdout || '{}');
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  const bySlug = new Map();
  for (const row of rows) {
    const slug = extractSlugFromPageUrl(row.page);
    if (!slug || !TOP_CITY_SLUGS.includes(slug)) continue;
    const query = String(row.query || '').trim();
    if (!query || query.toLowerCase().includes('appraisily')) continue;

    const bucket = bySlug.get(slug) || new Map();
    const entry = bucket.get(query) || { query, impressions: 0, clicks: 0, avgPositionWeighted: 0 };
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    const position = Number(row.position || 0);
    entry.impressions += impressions;
    entry.clicks += clicks;
    entry.avgPositionWeighted += position * impressions;
    bucket.set(query, entry);
    bySlug.set(slug, bucket);
  }

  const rawCities = JSON.parse(await fs.readFile(CITIES_FILE, 'utf8'));
  const cityBySlug = new Map((rawCities.cities || []).map((city) => [city.slug, city]));

  const rowsOut = [];
  for (const slug of TOP_CITY_SLUGS) {
    const city = cityBySlug.get(slug);
    const cityName = city?.name || titleCaseFromSlug(slug);

    const queryMap = bySlug.get(slug) || new Map();
    const topQueries = [...queryMap.values()]
      .map((entry) => ({
        query: entry.query,
        impressions: Math.round(entry.impressions),
        clicks: Math.round(entry.clicks),
        position: entry.impressions > 0 ? entry.avgPositionWeighted / entry.impressions : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    const currentTitle = await loadCurrentTitle(slug);
    const suggestedTitle = buildSuggestedTitle(cityName, topQueries);
    const suggestedDescription = buildSuggestedDescription(cityName, topQueries);

    rowsOut.push({
      slug,
      cityName,
      page: `https://antique-appraiser-directory.appraisily.com/location/${slug}/`,
      currentTitle,
      suggestedTitle,
      suggestedDescription,
      topQueries,
    });
  }

  const jsonPath = path.join(options.outputDir, 'location-title-tuning.json');
  const csvPath = path.join(options.outputDir, 'location-title-tuning.csv');
  const mdPath = path.join(options.outputDir, 'location-title-tuning.md');

  await fs.writeFile(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), options, rows: rowsOut }, null, 2)}\n`, 'utf8');

  const csvHeader = [
    'slug',
    'city_name',
    'page',
    'current_title',
    'suggested_title',
    'suggested_description',
    'top_query_1',
    'top_query_1_impressions',
    'top_query_2',
    'top_query_2_impressions',
    'top_query_3',
    'top_query_3_impressions',
  ];

  const csvLines = [csvHeader.join(',')];
  for (const row of rowsOut) {
    const q1 = row.topQueries[0] || {};
    const q2 = row.topQueries[1] || {};
    const q3 = row.topQueries[2] || {};
    csvLines.push([
      row.slug,
      row.cityName,
      row.page,
      row.currentTitle,
      row.suggestedTitle,
      row.suggestedDescription,
      q1.query || '',
      q1.impressions || 0,
      q2.query || '',
      q2.impressions || 0,
      q3.query || '',
      q3.impressions || 0,
    ].map(csvEscape).join(','));
  }
  await fs.writeFile(csvPath, `${csvLines.join('\n')}\n`, 'utf8');

  const mdLines = [];
  mdLines.push(`# Weekly Location Title Tuning`);
  mdLines.push(``);
  mdLines.push(`Generated: ${new Date().toISOString()}`);
  mdLines.push(`Property: ${options.property}`);
  mdLines.push(`Range: last ${options.days} days`);
  mdLines.push(``);
  mdLines.push(`Run weekly command:`);
  mdLines.push('```bash');
  mdLines.push('node scripts/gsc-weekly-title-tuning.mjs --days 28');
  mdLines.push('```');
  mdLines.push(``);

  for (const row of rowsOut) {
    mdLines.push(`## ${row.cityName} (${row.slug})`);
    mdLines.push(`- Page: ${row.page}`);
    mdLines.push(`- Current title: ${row.currentTitle || '(missing)'}`);
    mdLines.push(`- Suggested title: ${row.suggestedTitle}`);
    mdLines.push(`- Suggested description: ${row.suggestedDescription}`);
    if (row.topQueries.length) {
      mdLines.push(`- Top queries:`);
      for (const query of row.topQueries.slice(0, 3)) {
        mdLines.push(`  - ${query.query} (${query.impressions} impressions, pos ${query.position.toFixed(1)})`);
      }
    } else {
      mdLines.push(`- Top queries: none in this window`);
    }
    mdLines.push('');
  }

  await fs.writeFile(mdPath, `${mdLines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({
    status: 'ok',
    outputDir: options.outputDir,
    files: { jsonPath, csvPath, mdPath },
    cities: rowsOut.length,
  }, null, 2));
}

main().catch((error) => {
  console.error('[gsc-weekly-title-tuning] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
