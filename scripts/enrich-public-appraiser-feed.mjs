import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function decodeHtml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function getMeta(html, name) {
  for (const tag of html.match(/<meta\s+[^>]*>/gi) || []) {
    const tagName = tag.match(/\bname=(["'])(.*?)\1/i)?.[2] || '';
    if (decodeHtml(tagName) !== name) continue;
    const content = tag.match(/\bcontent=(["'])(.*?)\1/i)?.[2] || '';
    return decodeHtml(content.trim());
  }
  return '';
}

function getCanonical(html) {
  for (const tag of html.match(/<link\s+[^>]*>/gi) || []) {
    const rel = tag.match(/\brel=(["'])(.*?)\1/i)?.[2] || '';
    if (rel.toLowerCase() !== 'canonical') continue;
    const href = tag.match(/\bhref=(["'])(.*?)\1/i)?.[2] || '';
    return decodeHtml(href.trim());
  }
  return '';
}

function getTitle(html) {
  return decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
}

function booleanMeta(value) {
  return String(value).toLowerCase() === 'true';
}

function publicServiceAreas(locations) {
  const bySlug = new Map();
  for (const location of locations) {
    for (const appraiser of location.listedAppraisers || []) {
      if (!appraiser.slug || appraiser.publicRouteAvailable === false) continue;
      const serviceArea = {
        slug: location.slug || '',
        city: location.city || '',
        region: location.region || '',
        country: location.country || '',
        url: location.url || '',
      };
      const existing = bySlug.get(appraiser.slug) || [];
      if (!existing.some(area => area.slug === serviceArea.slug)) existing.push(serviceArea);
      bySlug.set(appraiser.slug, existing);
    }
  }
  return bySlug;
}

function allowedByClaimScope(entry, claimScope) {
  const allowed = new Set(claimScope);
  const next = { ...entry };

  if (!allowed.has('primary_location')) delete next.address;
  if (!allowed.has('phone')) delete next.telephone;
  if (!allowed.has('email')) delete next.email;
  if (!allowed.has('specialties')) delete next.specialties;
  if (!allowed.has('fine_art_services') && !allowed.has('services')) delete next.services;
  if (!allowed.has('pricing')) delete next.priceRange;

  // Ratings and reviews require a separately approved public claim. The
  // current manifest has no such claim, so hydrated pages must suppress them.
  if (!allowed.has('reviews')) {
    delete next.rating;
    delete next.reviewCount;
    delete next.reviews;
  }

  return next;
}

export function buildEnrichedFeed({ feed, manifest, locations, readProfileHtml }) {
  const manifestBySlug = new Map((manifest.providers || []).map(provider => [provider.slug, provider]));
  const serviceAreasBySlug = publicServiceAreas(locations.locations || []);

  const appraisers = (feed.appraisers || []).map(rawEntry => {
    const provider = manifestBySlug.get(rawEntry.slug);
    if (!provider || !['limited', 'verified'].includes(provider.publicationStatus)) {
      throw new Error(`Published feed entry ${rawEntry.slug || '(missing slug)'} lacks an approved manifest record.`);
    }

    const html = readProfileHtml(rawEntry.slug);
    const htmlStatus = getMeta(html, 'appraisily:provider-publication-status');
    const htmlClaimScope = getMeta(html, 'appraisily:provider-claim-scope')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const claimScope = Array.isArray(provider.claimScope) ? provider.claimScope : [];

    if (htmlStatus !== provider.publicationStatus) {
      throw new Error(`${rawEntry.slug}: static status ${htmlStatus || '(missing)'} does not match manifest ${provider.publicationStatus}.`);
    }
    if (
      htmlClaimScope.length > 0 &&
      JSON.stringify([...htmlClaimScope].sort()) !== JSON.stringify([...claimScope].sort())
    ) {
      throw new Error(`${rawEntry.slug}: static claim scope does not match the publication manifest.`);
    }

    const entry = allowedByClaimScope(rawEntry, claimScope);
    return {
      ...entry,
      publication: {
        status: provider.publicationStatus,
        sourceUrl: getMeta(html, 'appraisily:provider-source') || provider.sourceUrl || '',
        sourceChecked: getMeta(html, 'appraisily:provider-source-checked') || provider.verifiedAt || '',
        claimScope,
        providerClaimed: booleanMeta(getMeta(html, 'appraisily:provider-claimed')),
        credentialVerified: claimScope.includes('qualification') && provider.publicationStatus === 'verified',
      },
      serviceAreas: serviceAreasBySlug.get(rawEntry.slug) || [],
      seo: {
        title: getTitle(html),
        description: getMeta(html, 'description'),
        canonical: getCanonical(html) || rawEntry.url || '',
      },
    };
  });

  return {
    ...feed,
    schemaVersion: '2.0',
    count: appraisers.length,
    appraisers,
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function run({ root = DEFAULT_ROOT, mode = 'check' } = {}) {
  const publicDir = path.join(root, 'public_site');
  const feedPath = path.join(publicDir, 'appraisers.json');
  const feed = readJson(feedPath);
  const manifest = readJson(path.join(root, 'data/provider-publication-manifest.json'));
  const locations = readJson(path.join(publicDir, 'locations.json'));
  const enriched = buildEnrichedFeed({
    feed,
    manifest,
    locations,
    readProfileHtml(slug) {
      return fs.readFileSync(path.join(publicDir, 'appraiser', slug, 'index.html'), 'utf8');
    },
  });
  const expected = stableJson(enriched);

  if (mode === 'write') {
    fs.writeFileSync(feedPath, expected);
    console.log(`Enriched ${enriched.count} public appraiser records in ${feedPath}.`);
    return;
  }

  if (fs.readFileSync(feedPath, 'utf8') !== expected) {
    throw new Error('public_site/appraisers.json is missing canonical hydration fields. Run npm run build:profile-hydration-feed.');
  }
  console.log(`Public appraiser hydration feed passed (${enriched.count} records).`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  try {
    run({ mode });
  } catch (error) {
    console.error(`[enrich-public-appraiser-feed] ${error.stack || error}`);
    process.exit(1);
  }
}
