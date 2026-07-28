import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public_site');
const feed = JSON.parse(fs.readFileSync(path.join(publicDir, 'appraisers.json'), 'utf8'));
const locations = JSON.parse(fs.readFileSync(path.join(publicDir, 'locations.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/provider-publication-manifest.json'), 'utf8'));
const appraiserSource = fs.readFileSync(path.join(root, 'src/pages/StandardizedAppraiserPage.tsx'), 'utf8');
const dataSource = fs.readFileSync(path.join(root, 'src/utils/standardizedData.ts'), 'utf8');
const failures = [];

const appraiserBySlug = new Map((feed.appraisers || []).map(entry => [entry.slug, entry]));
const manifestBySlug = new Map((manifest.providers || []).map(entry => [entry.slug, entry]));

for (const entry of feed.appraisers || []) {
  const provider = manifestBySlug.get(entry.slug);
  if (!provider) {
    failures.push(`${entry.slug}: missing publication manifest record.`);
    continue;
  }
  if (entry.publication?.status !== provider.publicationStatus) {
    failures.push(`${entry.slug}: feed and manifest publication status differ.`);
  }
  if (!entry.seo?.title || !entry.seo?.description || !entry.seo?.canonical) {
    failures.push(`${entry.slug}: canonical hydration SEO payload is incomplete.`);
  }
  if (!Array.isArray(entry.serviceAreas)) {
    failures.push(`${entry.slug}: serviceAreas must be an explicit array.`);
  }
  const claims = new Set(entry.publication?.claimScope || []);
  for (const [field, claim] of [
    ['address', 'primary_location'],
    ['telephone', 'phone'],
    ['email', 'email'],
    ['specialties', 'specialties'],
    ['services', 'fine_art_services'],
    ['rating', 'reviews'],
    ['reviewCount', 'reviews'],
    ['reviews', 'reviews'],
  ]) {
    if (field in entry && !claims.has(claim)) {
      failures.push(`${entry.slug}: ${field} is present without the ${claim} publication claim.`);
    }
  }
}

for (const location of locations.locations || []) {
  for (const listed of location.listedAppraisers || []) {
    if (listed.publicRouteAvailable === false) continue;
    const entry = appraiserBySlug.get(listed.slug);
    if (!entry) {
      failures.push(`${location.slug}/${listed.slug}: listed provider is absent from the canonical public feed.`);
      continue;
    }
    if (!entry.serviceAreas.some(area => area.slug === location.slug)) {
      failures.push(`${location.slug}/${listed.slug}: canonical feed lacks its public service-area association.`);
    }
  }
}

const pridhams = appraiserBySlug.get('pridhams-auctions-appraisals');
if (!pridhams) {
  failures.push('Pridham’s is absent from the canonical public feed.');
} else {
  const expectedClaims = JSON.stringify(['identity', 'website']);
  if (
    pridhams.publication?.status !== 'limited' ||
    JSON.stringify(pridhams.publication?.claimScope) !== expectedClaims ||
    pridhams.website !== 'https://pridhams.ca/' ||
    pridhams.serviceAreas?.[0]?.slug !== 'ottawa'
  ) {
    failures.push('Pridham’s must remain a limited identity-and-website listing associated with Ottawa.');
  }
  for (const privateField of ['address', 'telephone', 'email', 'rating', 'reviewCount', 'reviews']) {
    if (privateField in pridhams) {
      failures.push(`Pridham’s canonical payload must not expose ${privateField}.`);
    }
  }
}

for (const prohibited of [
  'Phone not available',
  'No reviews yet.',
  'Certified expert with verified reviews.',
  'sourceAppraisers.find(',
  'return getStandardizedLocation(normalizedSlug);',
]) {
  if (appraiserSource.includes(prohibited) || dataSource.includes(prohibited)) {
    failures.push(`Hydrated rendering must not retain ${JSON.stringify(prohibited)}.`);
  }
}

for (const required of [
  'data-provider-publication-status={appraiser.publication.status}',
  "publication.claimScope.includes('primary_location')",
  'appraiser.seo.title',
  'appraiser.seo.description',
  'appraiser.seo.canonical',
  'getPublishedAppraiserFeed()',
  'publishedEntryToSafeAppraiser(publicEntry, normalizedSlug)',
]) {
  if (!appraiserSource.includes(required) && !dataSource.includes(required)) {
    failures.push(`Hydration contract must include ${JSON.stringify(required)}.`);
  }
}

if (failures.length > 0) {
  console.error('Public profile hydration parity failed:');
  failures.slice(0, 100).forEach(failure => console.error(`- ${failure}`));
  if (failures.length > 100) console.error(`- …and ${failures.length - 100} more.`);
  process.exit(1);
}

console.log(`Public profile hydration parity passed (${feed.appraisers.length} profiles, ${locations.locations.length} locations).`);
