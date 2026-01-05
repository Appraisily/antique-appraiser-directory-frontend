#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  isLikelyPlaceholderUrl,
  normalizeRegionCode,
  normalizeWebsiteUrl,
  sanitizePlainText,
  truncateText,
} from './utils/text-sanitize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const BASE_URL = 'https://antique-appraiser-directory.appraisily.com';
const ASSETS_BASE_URL = 'https://assets.appraisily.com/assets/directory';
const IMAGEKIT_PREFIX = 'https://ik.imagekit.io/appraisily/';
const FALLBACK_IMAGE = `${ASSETS_BASE_URL}/placeholder.jpg`;

const DEFAULT_SLUGS = [];

const TRUST_FIRST_LOCATION_SLUGS = new Set(['kelowna', 'calgary', 'san-antonio']);
const TRUST_FIRST_MIN_VERIFIED = 3;

function filterAppraisersForLocation(slug, appraisers) {
  const list = Array.isArray(appraisers) ? [...appraisers] : [];

  list.sort((a, b) => {
    const aRank = a?.verified === true ? 2 : a?.listed === true ? 1 : 0;
    const bRank = b?.verified === true ? 2 : b?.listed === true ? 1 : 0;
    if (aRank !== bRank) return bRank - aRank;
    return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
  });

  const verified = list.filter((entry) => entry?.verified === true);
  const listed = list.filter((entry) => entry?.verified !== true && entry?.listed === true);

  const trustFirst = TRUST_FIRST_LOCATION_SLUGS.has(slug) || verified.length >= TRUST_FIRST_MIN_VERIFIED;
  if (trustFirst && verified.length) return verified;

  if (verified.length) return [...verified, ...listed];
  if (listed.length >= 2) return listed;
  return list;
}

function normalizeImageUrl(input = '') {
  const url = String(input || '').trim();
  if (!url) return FALLBACK_IMAGE;
  if (url.startsWith(ASSETS_BASE_URL)) return url;
  if (url.startsWith(IMAGEKIT_PREFIX)) {
    return `${ASSETS_BASE_URL}/${url.slice(IMAGEKIT_PREFIX.length)}`;
  }
  if (url.startsWith('https://placehold.co')) return FALLBACK_IMAGE;
  return url;
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    publicDir: path.join(REPO_ROOT, 'public_site'),
    slugs: DEFAULT_SLUGS,
    dryRun: false,
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
      case '--slugs':
        {
          const value = String(readValue() || '').trim();
          options.slugs = value
            .split(',')
            .map((slug) => slug.trim())
            .filter(Boolean);
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  return options;
}

async function listLocationSlugs(publicDir) {
  try {
    const locationDir = path.join(publicDir, 'location');
    const entries = await fs.readdir(locationDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function buildUrl(relativePath) {
  let normalized = String(relativePath || '').trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  return `${BASE_URL}${normalized}`;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeSchemaTypes(typeValue) {
  if (!typeValue) return [];
  if (Array.isArray(typeValue)) return typeValue.map((entry) => String(entry));
  return [String(typeValue)];
}

function schemaObjectHasType(candidate, typesToMatch) {
  if (!candidate || typeof candidate !== 'object') return false;
  const schemaTypes = normalizeSchemaTypes(candidate['@type']);
  return schemaTypes.some((type) => typesToMatch.has(type));
}

function stripTopLevelJsonLdTypes(payload, typesToStrip) {
  if (Array.isArray(payload)) {
    const filtered = payload.filter((entry) => !schemaObjectHasType(entry, typesToStrip));
    return filtered.length ? filtered : null;
  }

  if (payload && typeof payload === 'object') {
    if (schemaObjectHasType(payload, typesToStrip)) return null;

    const graph = payload['@graph'];
    if (Array.isArray(graph)) {
      const filteredGraph = graph.filter((entry) => !schemaObjectHasType(entry, typesToStrip));
      return { ...payload, '@graph': filteredGraph };
    }

    return payload;
  }

  return payload;
}

function stripJsonLdTypesFromHead(head, typesToStrip, protectedKeys = new Set()) {
  const scripts = Array.from(head.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    const key = script.getAttribute('data-appraisily-schema') || '';
    if (key && protectedKeys.has(key)) continue;
    if (!script.textContent) continue;

    const parsed = safeJsonParse(script.textContent);
    if (!parsed) continue;

    const nextPayload = stripTopLevelJsonLdTypes(parsed, typesToStrip);
    if (nextPayload === null) {
      script.remove();
      continue;
    }

    script.textContent = JSON.stringify(nextPayload);
  }
}

function upsertJsonLd(head, key, payload) {
  const selector = `script[type="application/ld+json"][data-appraisily-schema="${key}"]`;
  let script = head.querySelector(selector);
  if (!script) {
    script = head.ownerDocument.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-appraisily-schema', key);
    head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

function titleCaseFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function detectCountry({ stateCode = '', stateName = '' } = {}) {
  const normalizedCode = String(stateCode || '').trim().toUpperCase();
  const normalizedName = String(stateName || '').trim().toLowerCase();

  const caCodes = new Set([
    'AB',
    'BC',
    'MB',
    'NB',
    'NL',
    'NS',
    'NT',
    'NU',
    'ON',
    'PE',
    'QC',
    'SK',
    'YT',
    // Non-standard codes found in data exports.
    'BR', // British Columbia
    'QU', // Quebec
  ]);

  const caNames = new Set([
    'alberta',
    'british columbia',
    'manitoba',
    'new brunswick',
    'newfoundland and labrador',
    'nova scotia',
    'northwest territories',
    'nunavut',
    'ontario',
    'prince edward island',
    'quebec',
    'saskatchewan',
    'yukon',
  ]);

  if (caCodes.has(normalizedCode) || caNames.has(normalizedName)) return 'CA';
  return 'US';
}

function buildLocationSchemas({ slug, cityName, stateCode, appraisers }) {
  const firstAddress = appraisers?.[0]?.address ?? {};
  const safeStateName = sanitizePlainText(stateCode || firstAddress?.state || '').trim();
  const stateCodeNormalized = normalizeRegionCode(safeStateName || firstAddress?.state);
  const addressRegion = stateCodeNormalized || safeStateName || firstAddress?.state || '';
  const country = detectCountry({ stateCode: stateCodeNormalized || firstAddress?.state, stateName: safeStateName });
  const cityLocality = sanitizePlainText(
    firstAddress?.city || String(cityName || '').split(',')[0]?.trim() || titleCaseFromSlug(slug),
  );
  const locationPath = `/location/${slug}/`;
  const locationUrl = buildUrl(locationPath);

  const providers = Array.isArray(appraisers)
    ? appraisers.slice(0, 50).map((appraiser) => {
        const verified = Boolean(appraiser?.verified);
        const website = normalizeWebsiteUrl(appraiser?.website || appraiser?.contact?.website);
        const sameAs = verified && website && !isLikelyPlaceholderUrl(website) ? [website] : undefined;

        const email = verified ? String(appraiser?.email || appraiser?.contact?.email || '').trim() : '';
        const telephone = verified ? String(appraiser?.phone || appraiser?.contact?.phone || '').trim() : '';
        const url = verified && website ? website : buildUrl(`/appraiser/${appraiser?.slug || appraiser?.id || ''}/`);

        return {
          '@type': 'LocalBusiness',
          name: sanitizePlainText(appraiser?.name) || 'Art & Antique Appraiser',
          image: normalizeImageUrl(appraiser?.imageUrl),
          address: {
            '@type': 'PostalAddress',
            addressLocality: cityLocality,
            addressRegion,
            addressCountry: country,
          },
          url,
          sameAs,
          email: email || undefined,
          telephone: telephone || undefined,
        };
      })
    : [];

  const locationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': locationUrl,
    name: `Antique & Art Appraisers in ${cityName}`,
    description: truncateText(
      `Compare antique and art appraisers in ${cityName} and request a fast online appraisal from Appraisily.`,
      200,
    ),
    serviceType: 'Art & Antique Appraisal',
    areaServed: {
      '@type': 'City',
      name: cityLocality,
      address: {
        '@type': 'PostalAddress',
        addressLocality: cityLocality,
        addressRegion: addressRegion || safeStateName,
        addressCountry: country,
      },
      containedInPlace: {
        '@type': 'State',
        name: safeStateName || addressRegion,
      },
    },
    provider: providers,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': locationUrl,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: buildUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `Antique & Art Appraisers in ${cityName}`,
        item: locationUrl,
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Do you offer in-person appraisals in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Appraisily focuses on online appraisals. This directory lists local providers in ${cityName} so you can contact them directly, or use Appraisily for a fast online alternative.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How does an online appraisal work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Submit clear photos, measurements, and any provenance. Our experts review the item and deliver a written valuation report online.',
        },
      },
      {
        '@type': 'Question',
        name: 'What should I prepare before requesting an appraisal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Provide multiple photos (front, back, details, marks), dimensions, condition notes, and any history or purchase information.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I still use a local appraiser?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Use this directory to contact in-person providers in ${cityName}, or request an online appraisal from Appraisily if you want a faster path.`,
        },
      },
    ],
  };

  return { locationSchema, breadcrumbSchema, faqSchema };
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.slugs.length) {
    options.slugs = await listLocationSlugs(options.publicDir);
  }
  const citiesPath = path.join(REPO_ROOT, 'src', 'data', 'cities.json');
  const citiesJson = await loadJson(citiesPath);
  const cities = Array.isArray(citiesJson?.cities) ? citiesJson.cities : [];
  const cityBySlug = new Map(cities.map((city) => [city.slug, city]));

  const stats = {
    publicDir: options.publicDir,
    dryRun: options.dryRun,
    requested: options.slugs.length,
    updated: 0,
    missingHtml: 0,
    missingData: 0,
  };

  for (const slug of options.slugs) {
    const htmlPath = path.join(options.publicDir, 'location', slug, 'index.html');
    const dataPathPrimary = path.join(REPO_ROOT, 'src', 'data', 'standardized_verified', `${slug}.json`);
    const dataPathFallback = path.join(REPO_ROOT, 'src', 'data', 'standardized', `${slug}.json`);

    let html;
    try {
      html = await fs.readFile(htmlPath, 'utf8');
    } catch {
      stats.missingHtml += 1;
      continue;
    }

    let locationData;
    try {
      locationData = await loadJson(dataPathPrimary);
    } catch {
      try {
        locationData = await loadJson(dataPathFallback);
      } catch {
        stats.missingData += 1;
        continue;
      }
    }

    const meta = cityBySlug.get(slug);
    const cityName = meta ? `${meta.name}, ${meta.state}` : titleCaseFromSlug(slug);
    const stateCode = meta?.state || locationData?.appraisers?.[0]?.address?.state || '';
    const appraisers = filterAppraisersForLocation(
      slug,
      Array.isArray(locationData?.appraisers) ? locationData.appraisers : [],
    );

    const { locationSchema, breadcrumbSchema, faqSchema } = buildLocationSchemas({
      slug,
      cityName,
      stateCode,
      appraisers,
    });

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const head = document.querySelector('head');
    if (!head) continue;

    stripJsonLdTypesFromHead(head, new Set(['BreadcrumbList', 'FAQPage']), new Set(['location', 'breadcrumbs', 'faq']));

    upsertJsonLd(head, 'location', locationSchema);
    upsertJsonLd(head, 'breadcrumbs', breadcrumbSchema);
    upsertJsonLd(head, 'faq', faqSchema);

    const output = dom.serialize();
    if (!options.dryRun) {
      await fs.writeFile(htmlPath, output, 'utf8');
    }
    stats.updated += 1;
  }

  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error('[enrich-location-pages] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
