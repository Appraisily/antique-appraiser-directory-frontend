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
const OUTPUT_PATH_DEFAULT = path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.seeded.json');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const CANADA_REGION_CODES = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    slugs: [],
    maxPerCity: 3,
    delayMs: 250,
    timeoutMs: 15_000,
    reset: false,
    output: OUTPUT_PATH_DEFAULT,
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

function extractJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const raw = String(match[1] || '').trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return blocks;
}

function normalizePhoneToE164ish(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return value;
}

function parseYellowPagesSearchItemList(jsonLdBlocks) {
  for (const block of jsonLdBlocks) {
    const graph = Array.isArray(block?.['@graph']) ? block['@graph'] : null;
    if (!graph) continue;
    const itemList = graph.find((entry) => entry?.['@type'] === 'ItemList' && Array.isArray(entry?.itemListElement));
    if (!itemList) continue;
    return itemList.itemListElement
      .map((element) => element?.item?.url)
      .map((url) => String(url || '').trim())
      .filter(Boolean)
      .filter((url) => url.startsWith('https://www.yellowpages.ca/bus/'));
  }
  return [];
}

function parseYellowPagesMerchant(jsonLdBlocks) {
  for (const block of jsonLdBlocks) {
    const graph = Array.isArray(block?.['@graph']) ? block['@graph'] : null;
    if (!graph) continue;
    const entity = graph.find((entry) => entry?.telephone && entry?.name && entry?.address);
    if (!entity) continue;

    const services = Array.isArray(entity?.hasOfferCatalog?.itemListElement)
      ? entity.hasOfferCatalog.itemListElement.map((service) => String(service?.name || '').trim()).filter(Boolean)
      : [];

    return {
      name: sanitizePlainText(entity.name || '').trim(),
      telephone: normalizePhoneToE164ish(entity.telephone || ''),
      address: entity.address || {},
      services,
    };
  }
  return null;
}

function parseYellowPagesOfficialWebsite(html) {
  const regex = /redirect=(https?%3A%2F%2F[^"&\s]+)/gi;
  const match = regex.exec(html);
  if (!match) return '';
  try {
    return normalizeWebsiteUrl(decodeURIComponent(match[1]));
  } catch {
    return '';
  }
}

function containsKeyword(text, keywords) {
  const haystack = String(text || '').toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function parseBbbProfileLinks(html) {
  const seen = new Set();
  const regex = /\/us\/[a-z]{2}\/[a-z0-9-]+\/profile\/[^"?#\s]+/gi;
  let match;
  while ((match = regex.exec(html))) {
    const pathCandidate = String(match[0] || '').trim();
    if (!pathCandidate || pathCandidate.includes('/leave-a-review')) continue;
    seen.add(`https://www.bbb.org${pathCandidate}`);
  }
  return [...seen];
}

function parseBbbLocalBusiness(jsonLdBlocks) {
  const queue = [];
  for (const block of jsonLdBlocks) queue.push(block);

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (typeof current !== 'object') continue;

    const type = current['@type'];
    const types = Array.isArray(type) ? type : [type].filter(Boolean);
    const isLocalBusiness = types.includes('LocalBusiness');
    if (isLocalBusiness) return current;
  }
  return null;
}

function looksRelevantToCity({ cityName, localBusiness }) {
  const addressLocality = sanitizePlainText(localBusiness?.address?.addressLocality || '').trim().toLowerCase();
  const cityLower = sanitizePlainText(cityName || '').trim().toLowerCase();
  if (addressLocality && cityLower && addressLocality.includes(cityLower)) return true;

  const areaServed = localBusiness?.areaServed;
  const areas = Array.isArray(areaServed) ? areaServed : areaServed ? [areaServed] : [];
  for (const area of areas) {
    const candidate = typeof area === 'string' ? area : area?.name;
    const normalized = sanitizePlainText(candidate || '').trim().toLowerCase();
    if (normalized && cityLower && normalized.includes(cityLower)) return true;
  }

  if (!addressLocality) return true;
  return false;
}

async function loadCities() {
  const raw = await fs.readFile(CITIES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const cities = Array.isArray(parsed?.cities) ? parsed.cities : [];
  return new Map(cities.map((city) => [city.slug, city]));
}

async function loadStandardizedLocationSlugs() {
  const standardizedDir = path.join(REPO_ROOT, 'src', 'data', 'standardized');
  const files = await fs.readdir(standardizedDir);
  return files
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/i, ''))
    .sort((a, b) => a.localeCompare(b));
}

async function loadStandardizedAppraisers(locationSlug) {
  const filePath = path.join(REPO_ROOT, 'src', 'data', 'standardized', `${locationSlug}.json`);
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

async function discoverForCanadianCity({
  locationSlug,
  cityName,
  regionCode,
  verifiedAt,
  maxPerCity,
  delayMs,
  timeoutMs,
  appraisers,
}) {
  const locationQuery = `${cityName} ${regionCode}`.trim();
  const providers = [];
  const queries = ['antique appraisal', 'antique appraisals', 'art appraisals', 'estate appraisal', 'jewellery appraisals'];

  for (const query of queries) {
    if (providers.length >= maxPerCity) break;

    const searchUrl = `https://www.yellowpages.ca/search/si/1/${encodeURIComponent(query)}/${encodeURIComponent(locationQuery)}`;

    let searchHtml;
    try {
      searchHtml = await fetchText(searchUrl, { timeoutMs });
    } catch {
      continue;
    }

    await sleep(delayMs);

    const searchBlocks = extractJsonLdBlocks(searchHtml);
    const merchantUrls = parseYellowPagesSearchItemList(searchBlocks).slice(0, 10);

    for (const merchantUrl of merchantUrls) {
      if (providers.length >= maxPerCity) break;

      let merchantHtml;
      try {
        merchantHtml = await fetchText(merchantUrl, { timeoutMs });
      } catch {
        continue;
      }

      const merchantBlocks = extractJsonLdBlocks(merchantHtml);
      const entity = parseYellowPagesMerchant(merchantBlocks);
      if (!entity?.name || !entity?.telephone) {
        await sleep(delayMs);
        continue;
      }

    const serviceBlob = entity.services.join(' ').toLowerCase();
    const nameBlob = sanitizePlainText(entity.name).toLowerCase();
    const looksAppraisalRelated = serviceBlob.includes('apprais') || nameBlob.includes('apprais');
    const looksPersonalPropertyRelated = containsKeyword(`${nameBlob} ${serviceBlob}`, [
      'antique',
      'antiques',
      'art',
      'collect',
      'jewel',
      'auction',
      'gallery',
      'fine art',
    ]);
    const looksDisqualified = containsKeyword(`${nameBlob} ${serviceBlob}`, [
      'vehicle',
      'motor',
      'real estate',
      'realtor',
      'realty',
      'residential',
      'commercial',
      'property assess',
    ]);

    if (!looksAppraisalRelated || !looksPersonalPropertyRelated || looksDisqualified) {
      await sleep(delayMs);
      continue;
    }

    const merchantCity = sanitizePlainText(entity.address?.addressLocality || '').trim();
    const merchantRegion = normalizeRegionCode(entity.address?.addressRegion || '');
    const cityLower = sanitizePlainText(cityName).toLowerCase();
    if (merchantRegion && merchantRegion !== regionCode) {
      await sleep(delayMs);
      continue;
    }
    if (merchantCity && cityLower && !merchantCity.toLowerCase().includes(cityLower)) {
      await sleep(delayMs);
      continue;
    }

    const officialWebsite = parseYellowPagesOfficialWebsite(merchantHtml);
    const slug = findMatchingExistingSlug({
      locationSlug,
      name: entity.name,
      website: officialWebsite,
      phone: entity.telephone,
      appraisers,
    });

      providers.push({
        locationSlug,
        slug,
        name: entity.name,
        website: officialWebsite,
        phone: entity.telephone,
        address: {
          city: merchantCity || cityName,
          region: merchantRegion || regionCode,
          country: 'CA',
        },
        specialties: [],
        services: [query],
        verification: {
          sourceUrl: merchantUrl,
          verifiedAt,
          sourceType: 'YellowPages.ca',
          notes: `Seeded from YellowPages.ca (“${query}”, ${locationQuery}).`,
        },
      });

      await sleep(delayMs);
    }
  }

  return providers;
}

async function discoverForUsCity({
  locationSlug,
  cityName,
  regionCode,
  verifiedAt,
  maxPerCity,
  delayMs,
  timeoutMs,
  appraisers,
}) {
  const locationQuery = `${cityName}, ${regionCode}`.trim();
  const queries = ['antique appraisal', 'estate appraisal'];
  const providers = [];
  const seenProfileUrls = new Set();

  for (const query of queries) {
    if (providers.length >= maxPerCity) break;
    const searchUrl = `https://www.bbb.org/search?find_country=USA&find_loc=${encodeURIComponent(
      locationQuery,
    )}&find_text=${encodeURIComponent(query)}`;

    let searchHtml;
    try {
      searchHtml = await fetchText(searchUrl, { timeoutMs });
    } catch {
      continue;
    }

    const profileUrls = parseBbbProfileLinks(searchHtml).filter((url) => !seenProfileUrls.has(url));
    for (const url of profileUrls) seenProfileUrls.add(url);

    await sleep(delayMs);

    for (const profileUrl of profileUrls.slice(0, 10)) {
      if (providers.length >= maxPerCity) break;

      let profileHtml;
      try {
        profileHtml = await fetchText(profileUrl, { timeoutMs });
      } catch {
        continue;
      }

      const blocks = extractJsonLdBlocks(profileHtml);
      const business = parseBbbLocalBusiness(blocks);
      if (!business?.name) {
        await sleep(delayMs);
        continue;
      }

      const telephone = normalizePhoneToE164ish(business.telephone || '');
      if (!telephone) {
        await sleep(delayMs);
        continue;
      }

      if (!looksRelevantToCity({ cityName, localBusiness: business })) {
        await sleep(delayMs);
        continue;
      }

      const slug = findMatchingExistingSlug({
        locationSlug,
        name: business.name,
        website: '',
        phone: telephone,
        appraisers,
      });

      providers.push({
        locationSlug,
        slug,
        name: sanitizePlainText(business.name).trim(),
        phone: telephone,
        address: {
          city: cityName,
          region: regionCode,
          country: 'US',
        },
        specialties: [],
        services: [query],
        verification: {
          sourceUrl: profileUrl,
          verifiedAt,
          sourceType: 'BBB',
          notes: `Seeded from BBB search (“${query}”, ${locationQuery}).`,
        },
      });

      await sleep(delayMs);
    }
  }

  return providers;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cities = await loadCities();
  const slugsInDirectory = await loadStandardizedLocationSlugs();
  const slugs = options.slugs.length ? options.slugs : slugsInDirectory;

  const { providers: existingProviders } = await loadVerifiedProviders({ repoRoot: REPO_ROOT });
  const existingSlugs = new Set(existingProviders.map((provider) => provider.slug));
  const existingByLocation = new Map();
  for (const provider of existingProviders) {
    const list = existingByLocation.get(provider.locationSlug) || [];
    list.push(provider);
    existingByLocation.set(provider.locationSlug, list);
  }

  const verifiedAt = toIsoDate(new Date());

  let seeded = [];
  if (!options.reset) {
    try {
      const raw = await fs.readFile(options.output, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) seeded = parsed;
    } catch {
      // ignore missing/invalid seed file (we'll regenerate)
    }
  }

  const stats = {
    processedCities: 0,
    totalCities: slugs.length,
    skippedAlreadyStrong: 0,
    attemptedCities: 0,
    discoveredProviders: 0,
    addedProviders: 0,
    existingSeededProviders: seeded.length,
    output: options.output,
  };

  for (const locationSlug of slugs) {
    const meta = cities.get(locationSlug);
    const cityName = sanitizePlainText(meta?.name || '').trim();
    const stateName = sanitizePlainText(meta?.state || '').trim();
    const regionCode = normalizeRegionCode(stateName);
    if (!cityName || !regionCode) continue;

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

    const targetRemaining = Math.max(0, options.maxPerCity - alreadyListedCount);
    if (!targetRemaining) {
      stats.processedCities += 1;
      continue;
    }

    const isCanada = CANADA_REGION_CODES.has(regionCode);
    stats.attemptedCities += 1;

    let discovered = [];
    if (isCanada) {
      discovered = await discoverForCanadianCity({
        locationSlug,
        cityName,
        regionCode,
        verifiedAt,
        maxPerCity: targetRemaining,
        delayMs: options.delayMs,
        timeoutMs: options.timeoutMs,
        appraisers,
      });
    } else {
      discovered = await discoverForUsCity({
        locationSlug,
        cityName,
        regionCode,
        verifiedAt,
        maxPerCity: targetRemaining,
        delayMs: options.delayMs,
        timeoutMs: options.timeoutMs,
        appraisers,
      });
    }

    stats.discoveredProviders += discovered.length;

    for (const provider of discovered) {
      if (!provider?.slug || existingSlugs.has(provider.slug)) continue;
      existingSlugs.add(provider.slug);
      seeded.push(provider);
      stats.addedProviders += 1;
    }

    stats.processedCities += 1;

    if (stats.processedCities % 10 === 0) {
      console.error(
        `[discover-seeded-providers] Progress ${stats.processedCities}/${stats.totalCities} (added=${stats.addedProviders})`,
      );
    }
  }

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(seeded, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

main().catch((error) => {
  console.error('[discover-seeded-providers] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
