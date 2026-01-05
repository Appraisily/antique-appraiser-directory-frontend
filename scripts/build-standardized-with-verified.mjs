#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { normalizeRegionCode, sanitizePlainText } from './utils/text-sanitize.js';
import { indexVerifiedProviders, loadVerifiedProviders } from './utils/verified-providers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const INPUT_DIR = path.join(REPO_ROOT, 'src', 'data', 'standardized');
const OUTPUT_DIR = path.join(REPO_ROOT, 'src', 'data', 'standardized_verified');

function normalizeProviderIntoAppraiser(provider, existing = null) {
  const updated = existing && typeof existing === 'object' ? { ...existing } : {};

  updated.verified = true;
  delete updated.listed;
  updated.verification = provider.verification || updated.verification;

  if (provider.name) updated.name = sanitizePlainText(provider.name);

  const slug = String(provider.slug || '').trim();
  if (slug) {
    updated.slug = slug;
    if (!updated.id) updated.id = slug;
  }

  const website = String(provider.website || '').trim();
  const email = String(provider.email || '').trim();
  const phone = String(provider.phone || '').trim();

  if (website) updated.website = website;
  else delete updated.website;
  if (email) updated.email = email;
  else delete updated.email;
  if (phone) updated.phone = phone;
  else delete updated.phone;

  const contact = updated.contact && typeof updated.contact === 'object' ? { ...updated.contact } : {};
  if (website) contact.website = website;
  else delete contact.website;
  if (email) contact.email = email;
  else delete contact.email;
  if (phone) contact.phone = phone;
  else delete contact.phone;
  updated.contact = contact;

  const address = updated.address && typeof updated.address === 'object' ? { ...updated.address } : {};
  const addressCity = sanitizePlainText(provider.address?.city || '') || sanitizePlainText(address.city || '');
  const addressRegion = normalizeRegionCode(provider.address?.region || provider.address?.state || '') || normalizeRegionCode(address.state || '');
  const addressCountry = sanitizePlainText(provider.address?.country || '') || sanitizePlainText(address.country || '');
  if (addressCity) address.city = addressCity;
  if (addressRegion) address.state = addressRegion;
  if (addressCountry) address.country = addressCountry;
  updated.address = address;

  const expertise = updated.expertise && typeof updated.expertise === 'object' ? { ...updated.expertise } : {};
  if (Array.isArray(provider.specialties) && provider.specialties.length) expertise.specialties = provider.specialties;
  if (Array.isArray(provider.services) && provider.services.length) expertise.services = provider.services;
  updated.expertise = expertise;

  return updated;
}

function normalizeListedProviderIntoAppraiser(provider, existing = null) {
  const updated = existing && typeof existing === 'object' ? { ...existing } : {};

  updated.verified = false;
  updated.listed = true;
  updated.verification = provider.verification || updated.verification;

  if (provider.name) updated.name = sanitizePlainText(provider.name);

  const slug = String(provider.slug || '').trim();
  if (slug) {
    updated.slug = slug;
    if (!updated.id) updated.id = slug;
  }

  const website = String(provider.website || '').trim();
  const email = String(provider.email || '').trim();
  const phone = String(provider.phone || '').trim();

  if (website) updated.website = website;
  if (email) updated.email = email;
  if (phone) updated.phone = phone;

  const contact = updated.contact && typeof updated.contact === 'object' ? { ...updated.contact } : {};
  if (website) contact.website = website;
  if (email) contact.email = email;
  if (phone) contact.phone = phone;
  updated.contact = contact;

  const address = updated.address && typeof updated.address === 'object' ? { ...updated.address } : {};
  const addressCity = sanitizePlainText(provider.address?.city || '') || sanitizePlainText(address.city || '');
  const addressRegion =
    normalizeRegionCode(provider.address?.region || provider.address?.state || '') || normalizeRegionCode(address.state || '');
  const addressCountry = sanitizePlainText(provider.address?.country || '') || sanitizePlainText(address.country || '');
  if (addressCity) address.city = addressCity;
  if (addressRegion) address.state = addressRegion;
  if (addressCountry) address.country = addressCountry;
  updated.address = address;

  const expertise = updated.expertise && typeof updated.expertise === 'object' ? { ...updated.expertise } : {};
  if (Array.isArray(provider.specialties) && provider.specialties.length) expertise.specialties = provider.specialties;
  if (Array.isArray(provider.services) && provider.services.length) expertise.services = provider.services;
  updated.expertise = expertise;

  return updated;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const verifiedLoaded = await loadVerifiedProviders({ repoRoot: REPO_ROOT });
  if ((verifiedLoaded.errors || []).length) {
    throw new Error(`Invalid verified providers file: ${(verifiedLoaded.errors || []).join('; ')}`);
  }
  const verifiedByLocation = indexVerifiedProviders(verifiedLoaded.providers || []);

  const inputFiles = (await fs.readdir(INPUT_DIR)).filter((name) => name.endsWith('.json')).sort();
  const stats = {
    inputFiles: inputFiles.length,
    outputDir: OUTPUT_DIR,
    verifiedProviders: (verifiedLoaded.providers || []).length,
    writtenFiles: 0,
    upgradedExisting: 0,
    addedNew: 0,
  };

  for (const fileName of inputFiles) {
    const locationSlug = fileName.replace(/\.json$/i, '');
    const inputPath = path.join(INPUT_DIR, fileName);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    const payload = await readJson(inputPath);
    const appraisers = Array.isArray(payload?.appraisers) ? [...payload.appraisers] : [];

    const providersForLocation = verifiedByLocation.get(locationSlug) || [];
    const verifiedProviders = providersForLocation.filter((provider) => provider?.verified === true);
    const listedProviders = providersForLocation.filter((provider) => provider?.listed === true);

    if (verifiedProviders.length || listedProviders.length) {
      const bySlug = new Map();
      for (let i = 0; i < appraisers.length; i += 1) {
        const entry = appraisers[i];
        const slug = String(entry?.slug || entry?.id || '').trim();
        if (slug) bySlug.set(slug, i);
      }

      for (const provider of verifiedProviders) {
        const slug = String(provider.slug || '').trim();
        if (!slug) continue;

        if (bySlug.has(slug)) {
          const idx = bySlug.get(slug);
          appraisers[idx] = normalizeProviderIntoAppraiser(provider, appraisers[idx]);
          stats.upgradedExisting += 1;
        } else {
          const normalized = normalizeProviderIntoAppraiser(provider, null);
          appraisers.push(normalized);
          bySlug.set(slug, appraisers.length - 1);
          stats.addedNew += 1;
        }
      }

      for (const provider of listedProviders) {
        const slug = String(provider.slug || '').trim();
        if (!slug) continue;

        if (bySlug.has(slug)) {
          const idx = bySlug.get(slug);
          const existing = appraisers[idx];
          if (existing?.verified === true) continue;
          appraisers[idx] = normalizeListedProviderIntoAppraiser(provider, existing);
          stats.upgradedExisting += 1;
        } else {
          const normalized = normalizeListedProviderIntoAppraiser(provider, null);
          appraisers.push(normalized);
          bySlug.set(slug, appraisers.length - 1);
          stats.addedNew += 1;
        }
      }
    }

    const nextPayload = { ...payload, appraisers };
    await writeJson(outputPath, nextPayload);
    stats.writtenFiles += 1;
  }

  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error('[build-standardized-with-verified] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
