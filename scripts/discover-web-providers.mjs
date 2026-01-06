#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { normalizeRegionCode, normalizeWebsiteUrl, sanitizePlainText } from './utils/text-sanitize.js';
import { loadVerifiedProviders } from './utils/verified-providers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const CITIES_PATH = path.join(REPO_ROOT, 'src', 'data', 'cities.json');
const STANDARDIZED_DIR = path.join(REPO_ROOT, 'src', 'data', 'standardized');
const OUTPUT_PATH_DEFAULT = path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.web.json');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const CANADA_REGION_CODES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

const BLOCKED_HOST_SNIPPETS = [
  'duckduckgo.com',
  'google.',
  'bing.com',
  'yahoo.',
  'appraisily.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'pinterest.',
  'youtube.com',
  'tiktok.com',
  'wikipedia.org',
  'yelp.',
  'angi.com',
  'homeadvisor.',
  'thumbtack.',
  'mapquest.',
  'yellowpages.',
  'bbb.org',
  'isa-appraisers.org',
];

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    slugs: [],
    maxPerCity: 2,
    delayMs: 900,
    timeoutMs: 15_000,
    reset: false,
    output: OUTPUT_PATH_DEFAULT,
    maxCandidatesPerCity: 6,
  };

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    switch (flag) {
      case '--slugs':
        options.slugs = String(readValue() || '')
          .split(',')
          .map((slug) => slug.trim())
          .filter(Boolean);
        break;
      case '--max-per-city':
        options.maxPerCity = Number.parseInt(String(readValue() || '').trim(), 10);
        break;
      case '--delay-ms':
        options.delayMs = Number.parseInt(String(readValue() || '').trim(), 10);
        break;
      case '--timeout-ms':
        options.timeoutMs = Number.parseInt(String(readValue() || '').trim(), 10);
        break;
      case '--max-candidates':
        options.maxCandidatesPerCity = Number.parseInt(String(readValue() || '').trim(), 10);
        break;
      case '--output':
        options.output = path.resolve(process.cwd(), String(readValue() || '').trim());
        break;
      case '--reset':
        options.reset = true;
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  if (!Number.isFinite(options.maxPerCity) || options.maxPerCity < 0) options.maxPerCity = 0;
  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) options.delayMs = 0;
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1_000) options.timeoutMs = 15_000;
  if (!Number.isFinite(options.maxCandidatesPerCity) || options.maxCandidatesPerCity < 0) options.maxCandidatesPerCity = 0;

  return options;
}

function toIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function fetchText(url, { timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Fetch failed (${response.status}) for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function decodeDuckDuckGoUrl(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  try {
    const maybe = new URL(raw, 'https://duckduckgo.com');
    if (maybe.hostname.includes('duckduckgo.com') && maybe.pathname === '/l/' && maybe.searchParams.has('uddg')) {
      return decodeURIComponent(maybe.searchParams.get('uddg') || '');
    }
    return raw;
  } catch {
    return '';
  }
}

function extractDuckDuckGoResultUrls(html) {
  const urls = [];
  const regex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(html))) {
    const decoded = decodeDuckDuckGoUrl(match[1]);
    if (decoded) urls.push(decoded);
  }
  return urls;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = match?.[1] ? stripHtml(match[1]) : '';
  if (!raw) return '';
  return raw.split('|')[0]?.split('–')[0]?.split('-')[0]?.trim() || raw.trim();
}

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractPhone(html) {
  const text = stripHtml(html).slice(0, 20_000);
  const match = text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  return match ? sanitizePlainText(match[0]).trim() : '';
}

function isBlockedHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOST_SNIPPETS.some((snippet) => host.includes(snippet));
  } catch {
    return true;
  }
}

function looksLikeBusinessAppraiserPage(htmlText) {
  const haystack = String(htmlText || '').toLowerCase();
  const hasAppraisal = haystack.includes('apprais');
  const hasPersonalProperty = ['antique', 'antiques', 'art', 'collectible', 'collectibles', 'jewel', 'jewelry', 'estate'].some(
    (kw) => haystack.includes(kw),
  );
  const disqualify = ['real estate', 'realtor', 'commercial appraisal', 'residential appraisal', 'home appraisal', 'vehicle'].some(
    (kw) => haystack.includes(kw),
  );

  return hasAppraisal && hasPersonalProperty && !disqualify;
}

async function loadCities() {
  const raw = await fs.readFile(CITIES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const cities = Array.isArray(parsed?.cities) ? parsed.cities : [];
  return new Map(cities.map((city) => [city.slug, city]));
}

async function loadStandardizedLocationSlugs() {
  const files = await fs.readdir(STANDARDIZED_DIR);
  return files
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/i, ''))
    .sort((a, b) => a.localeCompare(b));
}

async function loadStandardizedAppraisers(locationSlug) {
  const filePath = path.join(STANDARDIZED_DIR, `${locationSlug}.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed?.appraisers) ? parsed.appraisers : [];
}

function findMatchingExistingSlug({ locationSlug, name, website, phone, appraisers }) {
  const normalizedName = sanitizePlainText(name || '').trim().toLowerCase();
  const normalizedWebsite = normalizeWebsiteUrl(website || '');
  const normalizedPhone = String(phone || '').replace(/[^\d]/g, '');

  for (const entry of appraisers || []) {
    const entrySlug = String(entry?.slug || entry?.id || '').trim();
    if (!entrySlug) continue;

    const entryWebsite = normalizeWebsiteUrl(entry?.website || entry?.contact?.website || '');
    if (normalizedWebsite && entryWebsite && normalizedWebsite === entryWebsite) return entrySlug;

    const entryPhoneDigits = String(entry?.phone || entry?.contact?.phone || '').replace(/[^\d]/g, '');
    if (normalizedPhone && entryPhoneDigits && normalizedPhone === entryPhoneDigits) return entrySlug;

    const entryName = sanitizePlainText(entry?.name || '').trim().toLowerCase();
    if (normalizedName && entryName && normalizedName === entryName) return entrySlug;
  }

  return `${locationSlug}-${slugify(name)}`;
}

function resolveCountry(regionCode) {
  return CANADA_REGION_CODES.has(regionCode) ? 'CA' : 'US';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cities = await loadCities();
  const slugsInDirectory = await loadStandardizedLocationSlugs();
  const slugs = options.slugs.length ? options.slugs : slugsInDirectory;

  const { providers: allProviders } = await loadVerifiedProviders({ repoRoot: REPO_ROOT });
  const existingSlugs = new Set(allProviders.map((provider) => provider.slug));
  const existingByLocation = new Map();
  for (const provider of allProviders) {
    const list = existingByLocation.get(provider.locationSlug) || [];
    list.push(provider);
    existingByLocation.set(provider.locationSlug, list);
  }

  let webProviders = [];
  if (!options.reset) {
    try {
      const raw = await fs.readFile(options.output, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) webProviders = parsed;
    } catch {
      // ignore missing file
    }
  }

  const originSeen = new Set(
    webProviders
      .map((entry) => {
        try {
          return new URL(entry.website || '').origin;
        } catch {
          return '';
        }
      })
      .filter(Boolean),
  );

  const verifiedAt = toIsoDate(new Date());

  const stats = {
    processedCities: 0,
    totalCities: slugs.length,
    skippedAlreadyStrong: 0,
    attemptedCities: 0,
    discoveredProviders: 0,
    addedProviders: 0,
    existingProviders: webProviders.length,
    output: options.output,
  };

  for (const locationSlug of slugs) {
    const meta = cities.get(locationSlug);
    const cityName = sanitizePlainText(meta?.name || '').trim();
    const stateName = sanitizePlainText(meta?.state || '').trim();
    const regionCode = normalizeRegionCode(stateName);
    if (!cityName || !regionCode) {
      stats.processedCities += 1;
      continue;
    }

    const already = existingByLocation.get(locationSlug) || [];
    const alreadyListedCount = already.filter((entry) => entry?.listed === true).length;
    if (alreadyListedCount >= options.maxPerCity) {
      stats.skippedAlreadyStrong += 1;
      stats.processedCities += 1;
      continue;
    }

    let appraisers;
    try {
      appraisers = await loadStandardizedAppraisers(locationSlug);
    } catch {
      stats.processedCities += 1;
      continue;
    }

    const remaining = Math.max(0, options.maxPerCity - alreadyListedCount);
    if (!remaining) {
      stats.processedCities += 1;
      continue;
    }

    stats.attemptedCities += 1;

    const locationQuery = `${cityName} ${regionCode}`.trim();
    const queries = [`antique appraiser ${locationQuery}`, `art appraisal ${locationQuery}`];

    const discovered = [];

    for (const query of queries) {
      if (discovered.length >= remaining) break;

      const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      let searchHtml;
      try {
        searchHtml = await fetchText(ddgUrl, { timeoutMs: options.timeoutMs });
      } catch {
        await sleep(options.delayMs);
        continue;
      }

      await sleep(options.delayMs);

      const candidates = extractDuckDuckGoResultUrls(searchHtml)
        .filter((url) => url.startsWith('http'))
        .filter((url) => !isBlockedHost(url))
        .slice(0, Math.max(0, options.maxCandidatesPerCity));

      for (const candidateUrl of candidates) {
        if (discovered.length >= remaining) break;

        let pageHtml;
        try {
          pageHtml = await fetchText(candidateUrl, { timeoutMs: options.timeoutMs });
        } catch {
          await sleep(options.delayMs);
          continue;
        }

        const pageText = stripHtml(pageHtml).slice(0, 30_000);
        if (!looksLikeBusinessAppraiserPage(pageText)) {
          await sleep(options.delayMs);
          continue;
        }

        const title = extractTitle(pageHtml);
        const name = decodeBasicEntities(title ? title : `Appraiser in ${cityName}`);
        const phone = extractPhone(pageHtml);

        let website = '';
        try {
          const parsed = new URL(candidateUrl);
          website = parsed.origin;
        } catch {
          website = '';
        }

        const normalizedWebsite = normalizeWebsiteUrl(website);
        if (normalizedWebsite && isBlockedHost(normalizedWebsite)) {
          await sleep(options.delayMs);
          continue;
        }
        if (!normalizedWebsite && !phone) {
          await sleep(options.delayMs);
          continue;
        }

        if (normalizedWebsite) {
          try {
            const origin = new URL(normalizedWebsite).origin;
            if (originSeen.has(origin)) {
              await sleep(options.delayMs);
              continue;
            }
            originSeen.add(origin);
          } catch {
            // ignore
          }
        }

        const slug = findMatchingExistingSlug({
          locationSlug,
          name,
          website: normalizedWebsite,
          phone,
          appraisers,
        });

        discovered.push({
          locationSlug,
          slug,
          name: sanitizePlainText(name).trim(),
          website: normalizedWebsite,
          phone,
          address: {
            city: cityName,
            region: regionCode,
            country: resolveCountry(regionCode),
          },
          specialties: [],
          services: [query],
          verification: {
            sourceUrl: normalizeWebsiteUrl(candidateUrl),
            verifiedAt,
            sourceType: 'Website',
            notes: `Discovered via DuckDuckGo (“${query}”).`,
          },
        });

        await sleep(options.delayMs);
      }
    }

    stats.discoveredProviders += discovered.length;

    for (const provider of discovered) {
      if (!provider?.slug || existingSlugs.has(provider.slug)) continue;
      existingSlugs.add(provider.slug);
      webProviders.push(provider);
      stats.addedProviders += 1;
    }

    stats.processedCities += 1;
    if (stats.processedCities % 10 === 0) {
      console.error(`[discover-web-providers] Progress ${stats.processedCities}/${stats.totalCities} (added=${stats.addedProviders})`);
    }

    await sleep(options.delayMs);
  }

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(webProviders, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

main().catch((error) => {
  console.error('[discover-web-providers] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
