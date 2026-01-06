import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLikelyPlaceholderUrl, normalizeRegionCode, normalizeWebsiteUrl, sanitizePlainText } from './text-sanitize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PROVIDER_SOURCES = [
  {
    path: path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.json'),
    trust: 'verified',
  },
  {
    path: path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.isa.json'),
    trust: 'verified',
  },
  {
    path: path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.seeded.json'),
    trust: 'listed',
  },
  {
    path: path.join(REPO_ROOT, 'src', 'data', 'verified', 'providers.web.json'),
    trust: 'listed',
  },
];

function normalizeTrust(value, fallback) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'verified' || raw === 'listed') return raw;
  return fallback;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function normalizeCountry(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'USA') return 'US';
  if (raw === 'CAN') return 'CA';
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return raw;
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.length < 10 || digits.length > 16) return '';
  return raw;
}

function normalizeEmail(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) return '';
  if (/example/i.test(raw)) return '';
  return raw;
}

function normalizeStringList(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const cleaned = list
    .map((entry) => sanitizePlainText(entry))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.length >= 2 && entry.length <= 80);
  return [...new Set(cleaned)].slice(0, 24);
}

export async function loadVerifiedProviders({ repoRoot = REPO_ROOT, filePath = null, filePaths = null } = {}) {
  const resolvedPaths = filePaths?.length
    ? filePaths.map((candidate) => (path.isAbsolute(candidate) ? candidate : path.join(repoRoot, candidate)))
    : filePath
      ? [path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath)]
      : PROVIDER_SOURCES.map((source) => (path.isAbsolute(source.path) ? source.path : path.join(repoRoot, source.path)));

  const providers = [];
  const errors = [];
  const slugSeen = new Set();
  const loadedFiles = [];

  for (const resolved of resolvedPaths) {
    const sourceMeta = PROVIDER_SOURCES.find((entry) => entry.path === resolved) || null;
    const defaultTrust = sourceMeta?.trust || 'verified';
    let raw;
    try {
      raw = await fs.readFile(resolved, 'utf8');
    } catch {
      continue;
    }

    loadedFiles.push(resolved);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      errors.push(`Invalid JSON in ${resolved}: ${error.message}`);
      continue;
    }

    if (!Array.isArray(parsed)) {
      errors.push(`Expected an array in ${resolved}`);
      continue;
    }

    for (let index = 0; index < parsed.length; index += 1) {
      const row = parsed[index];
      if (!row || typeof row !== 'object') {
        errors.push(`${resolved}: providers[${index}] must be an object`);
        continue;
      }

      const locationSlug = String(row.locationSlug || '').trim();
      const slug = String(row.slug || '').trim();
      const name = sanitizePlainText(row.name || '').trim();

      const verification = row.verification && typeof row.verification === 'object' ? row.verification : {};
      const sourceUrl = normalizeWebsiteUrl(verification.sourceUrl || '');
      const verifiedAt = String(verification.verifiedAt || '').trim();
      const sourceType = sanitizePlainText(verification.sourceType || '').trim();

      const website = normalizeWebsiteUrl(row.website || '');
      const email = normalizeEmail(row.email || '');
      const phone = normalizePhone(row.phone || '');

      const address = row.address && typeof row.address === 'object' ? row.address : {};
      const addressCity = sanitizePlainText(address.city || '').trim();
      const addressRegion = normalizeRegionCode(address.region || address.state || '');
      const addressCountry = normalizeCountry(address.country || '');

      const specialties = normalizeStringList(row.specialties || []);
      const services = normalizeStringList(row.services || []);
      const trust = normalizeTrust(row.trust || verification.trust || verification.level, defaultTrust);
      const isVerified = trust === 'verified';

      if (!locationSlug) errors.push(`${resolved}: providers[${index}].locationSlug is required`);
      if (!slug) errors.push(`${resolved}: providers[${index}].slug is required`);
      if (slug && slugSeen.has(slug)) errors.push(`${resolved}: duplicate providers slug: ${slug}`);
      if (slug) slugSeen.add(slug);
      if (!name) errors.push(`${resolved}: providers[${index}].name is required`);

      if (!sourceUrl || isLikelyPlaceholderUrl(sourceUrl)) {
        errors.push(`${resolved}: providers[${index}].verification.sourceUrl must be a real public URL`);
      }
      if (!verifiedAt || !isIsoDate(verifiedAt)) errors.push(`${resolved}: providers[${index}].verification.verifiedAt must be YYYY-MM-DD`);
      if (!website && !email && !phone) errors.push(`${resolved}: providers[${index}] must include at least one of website/email/phone`);
      if (website && isLikelyPlaceholderUrl(website)) errors.push(`${resolved}: providers[${index}].website looks like a placeholder URL`);

      providers.push({
        locationSlug,
        slug,
        name,
        website,
        email,
        phone,
        address: {
          city: addressCity,
          region: addressRegion,
          country: addressCountry,
        },
        specialties,
        services,
        verification: {
          sourceUrl,
          verifiedAt,
          notes: sanitizePlainText(verification.notes || '').trim(),
          sourceType,
        },
        trust,
        listed: trust === 'listed',
        verified: isVerified,
      });
    }
  }

  return { filePath: loadedFiles[0] || resolvedPaths[0], filePaths: loadedFiles, providers, errors };
}

export function indexVerifiedProviders(providers) {
  const byLocation = new Map();
  for (const provider of providers || []) {
    const slug = String(provider?.locationSlug || '').trim();
    if (!slug) continue;
    const list = byLocation.get(slug) || [];
    list.push(provider);
    byLocation.set(slug, list);
  }
  return byLocation;
}
