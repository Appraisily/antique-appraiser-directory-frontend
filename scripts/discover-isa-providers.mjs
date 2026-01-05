#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { normalizeRegionCode, normalizeWebsiteUrl, sanitizePlainText } from './utils/text-sanitize.js';
import { loadVerifiedProviders } from './utils/verified-providers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const CITIES_PATH = path.join(REPO_ROOT, 'src', 'data', 'cities.json');
const OUTPUT_PATH_DEFAULT = path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.isa.json');

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

function findMatchingExistingSlug({ locationSlug, name, phone, appraisers }) {
  const normalizedName = sanitizePlainText(name || '').trim().toLowerCase();
  const normalizedPhone = String(phone || '').replace(/[^\d]/g, '');

  for (const entry of appraisers || []) {
    const entrySlug = String(entry?.slug || entry?.id || '').trim();
    if (!entrySlug) continue;

    const entryPhoneDigits = String(entry?.phone || entry?.contact?.phone || '').replace(/[^\d]/g, '');
    if (normalizedPhone && entryPhoneDigits && normalizedPhone === entryPhoneDigits) return entrySlug;

    const entryName = sanitizePlainText(entry?.name || '').trim().toLowerCase();
    if (normalizedName && entryName && normalizedName === entryName) return entrySlug;
  }

  return `${locationSlug}-${slugify(name)}`;
}

function parseIsaProfileLinks(html) {
  const seen = new Set();
  const regex = /\/find-an-appraiser\/profile\/\d+\/[a-z0-9-]+/gi;
  let match;
  while ((match = regex.exec(html))) {
    const candidate = String(match[0] || '').trim();
    if (!candidate) continue;
    seen.add(`https://www.isa-appraisers.org${candidate}`);
  }
  return [...seen];
}

function extractListAfterHeading(document, headingText) {
  const headings = Array.from(document.querySelectorAll('#profile-primary h3'));
  const target = headings.find((node) => String(node.textContent || '').trim().toLowerCase() === headingText);
  if (!target) return [];
  let sibling = target.nextElementSibling;
  while (sibling && sibling.tagName !== 'UL') sibling = sibling.nextElementSibling;
  if (!sibling) return [];
  return Array.from(sibling.querySelectorAll('li'))
    .map((li) => sanitizePlainText(li.textContent || '').trim())
    .filter(Boolean);
}

function parseIsaProfile(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const name = sanitizePlainText(document.querySelector('#profile-secondary [itemprop="name"]')?.textContent || '').trim();
  const phone = sanitizePlainText(document.querySelector('#profile-secondary [itemprop="telephone"]')?.textContent || '').trim();
  const addressCity = sanitizePlainText(document.querySelector('#profile-secondary [itemprop="addressLocality"]')?.textContent || '').trim();
  const addressRegion = normalizeRegionCode(
    sanitizePlainText(document.querySelector('#profile-secondary [itemprop="addressRegion"]')?.textContent || '').trim(),
  );

  const specialties = extractListAfterHeading(document, 'specialties');
  const services = extractListAfterHeading(document, 'services');
  const performs = extractListAfterHeading(document, 'performs appraisals of');

  return {
    name,
    phone,
    address: {
      city: addressCity,
      region: addressRegion,
    },
    specialties: [...new Set([...specialties, ...performs])].slice(0, 24),
    services: services.slice(0, 24),
  };
}

function looksRelevantToArtAndAntiques({ specialties = [], services = [] } = {}) {
  const blob = `${specialties.join(' ')} ${services.join(' ')}`.toLowerCase();
  if (!blob) return true;

  const allow = ['antique', 'antiques', 'art', 'collectible', 'collectibles', 'decorative', 'jewel', 'jewelry', 'furniture'];
  const broadAllow = ['personal property', 'household', 'contents', 'estate'];
  const deny = ['machinery', 'equipment', 'vehicle', 'auto', 'real estate', 'business valuation'];

  const allowed = allow.some((kw) => blob.includes(kw));
  const broadlyAllowed = broadAllow.some((kw) => blob.includes(kw));
  const denied = deny.some((kw) => blob.includes(kw));
  if (denied && !allowed && !broadlyAllowed) return false;
  return allowed || broadlyAllowed;
}

function resolveCountry(regionCode) {
  return CANADA_REGION_CODES.has(regionCode) ? 'CA' : 'US';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cities = await loadCities();
  const slugsInDirectory = await loadStandardizedLocationSlugs();
  const slugs = options.slugs.length ? options.slugs : slugsInDirectory;

  const manualOnly = await loadVerifiedProviders({
    repoRoot: REPO_ROOT,
    filePaths: [path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.json')],
  });
  const manualByLocation = new Map();
  for (const provider of manualOnly.providers || []) {
    const list = manualByLocation.get(provider.locationSlug) || [];
    list.push(provider);
    manualByLocation.set(provider.locationSlug, list);
  }

  const { providers: allProviders } = await loadVerifiedProviders({ repoRoot: REPO_ROOT });
  const existingSlugs = new Set(allProviders.map((provider) => provider.slug));

  let priorIsaProviders = [];
  try {
    const raw = await fs.readFile(options.output, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) priorIsaProviders = parsed;
  } catch {
    // ignore missing file
  }

  if (options.reset) {
    for (const provider of priorIsaProviders) {
      if (provider?.slug) existingSlugs.delete(provider.slug);
    }
  }

  let isaProviders = [];
  if (!options.reset) isaProviders = priorIsaProviders;

  const isaByLocation = new Map();
  for (const provider of isaProviders) {
    const slug = String(provider?.locationSlug || '').trim();
    if (!slug) continue;
    const list = isaByLocation.get(slug) || [];
    list.push(provider);
    isaByLocation.set(slug, list);
  }

  const verifiedAt = toIsoDate(new Date());

  const stats = {
    processedCities: 0,
    totalCities: slugs.length,
    skippedAlreadyStrong: 0,
    attemptedCities: 0,
    discoveredProviders: 0,
    addedProviders: 0,
    existingProviders: isaProviders.length,
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

    const manualCount = (manualByLocation.get(locationSlug) || []).filter((entry) => entry?.verified === true).length;
    const existingIsaCount = (isaByLocation.get(locationSlug) || []).length;
    const alreadyVerifiedCount = manualCount + existingIsaCount;

    if (alreadyVerifiedCount >= options.maxPerCity) {
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

    const remaining = Math.max(0, options.maxPerCity - alreadyVerifiedCount);
    if (!remaining) {
      stats.processedCities += 1;
      continue;
    }

    stats.attemptedCities += 1;

    const searchLocation = `${cityName} ${regionCode}`.trim();
    const searchUrl = `https://www.isa-appraisers.org/find-an-appraiser/results/List?searchLocation=${encodeURIComponent(searchLocation)}&distance=50`;

    let searchHtml;
    try {
      searchHtml = await fetchText(searchUrl, { timeoutMs: options.timeoutMs });
    } catch {
      await sleep(options.delayMs);
      stats.processedCities += 1;
      continue;
    }

    await sleep(options.delayMs);

    const profileLinks = parseIsaProfileLinks(searchHtml).slice(0, 12);
    const discovered = [];

    for (const profileUrl of profileLinks) {
      if (discovered.length >= remaining) break;

      let profileHtml;
      try {
        profileHtml = await fetchText(profileUrl, { timeoutMs: options.timeoutMs });
      } catch {
        await sleep(options.delayMs);
        continue;
      }

      const profile = parseIsaProfile(profileHtml);
      if (!profile?.name || !profile?.phone) {
        await sleep(options.delayMs);
        continue;
      }

      if (profile.address.region && profile.address.region !== regionCode) {
        await sleep(options.delayMs);
        continue;
      }

      if (!looksRelevantToArtAndAntiques({ specialties: profile.specialties, services: profile.services })) {
        await sleep(options.delayMs);
        continue;
      }

      const slug = findMatchingExistingSlug({
        locationSlug,
        name: profile.name,
        phone: profile.phone,
        appraisers,
      });

      discovered.push({
        locationSlug,
        slug,
        name: profile.name,
        website: '',
        phone: profile.phone,
        address: {
          city: profile.address.city || cityName,
          region: profile.address.region || regionCode,
          country: resolveCountry(regionCode),
        },
        specialties: profile.specialties || [],
        services: profile.services || [],
        verification: {
          sourceUrl: normalizeWebsiteUrl(profileUrl),
          verifiedAt,
          sourceType: 'ISA directory',
          notes: `Imported from ISA Find an Appraiser directory (${searchLocation}).`,
        },
      });

      await sleep(options.delayMs);
    }

    stats.discoveredProviders += discovered.length;

    for (const provider of discovered) {
      if (!provider?.slug || existingSlugs.has(provider.slug)) continue;
      existingSlugs.add(provider.slug);
      isaProviders.push(provider);
      const list = isaByLocation.get(provider.locationSlug) || [];
      list.push(provider);
      isaByLocation.set(provider.locationSlug, list);
      stats.addedProviders += 1;
    }

    stats.processedCities += 1;
    if (stats.processedCities % 10 === 0) {
      console.error(`[discover-isa-providers] Progress ${stats.processedCities}/${stats.totalCities} (added=${stats.addedProviders})`);
    }

    await sleep(options.delayMs);
  }

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(isaProviders, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

main().catch((error) => {
  console.error('[discover-isa-providers] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
