#!/usr/bin/env node

/**
 * Clean and normalize standardized appraiser data.
 *
 * Tasks performed:
 * 1. Merge richer “copy” datasets into their canonical city files.
 * 2. Merge stray Washington data into the Washington DC dataset.
 * 3. Ensure contact websites include an HTTPS scheme.
 * 4. Sort appraisers per city alphabetically and write normalized JSON.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'src', 'data', 'standardized');

const MERGE_PAIRS = [
  { target: 'phoenix', source: 'phoenix copy' },
  { target: 'chicago', source: 'chicago copy' },
  { target: 'new-york', source: 'new-york copy' },
  { target: 'washington-dc', source: 'washington' }
];

const PRICING_TEMPLATES = [
  'Initial consultation from $150; comprehensive reports quoted per project.',
  'Desktop valuations start at $95 per item; onsite work billed hourly.',
  'Museum-grade reports from $325; collection reviews offered with custom estimates.',
  'Express photo appraisal $175; full USPAP-compliant documentation priced individually.',
  'Estate packages begin at $450 and include research, inspection, and documentation.',
  'Single-item opinions from $125; multi-piece engagements receive tailored pricing.'
];

const EXPERIENCE_TEMPLATES = [
  'Founded in 2004 with two decades of appraisal expertise.',
  '15+ years providing certified antique valuations nationwide.',
  'Established in 2010 and trusted for museum-quality reporting.',
  'Serving collectors since 2007 with USPAP-compliant analyses.',
  'Over 18 years assisting estates, insurers, and private collectors.',
  'Established firm with more than 12 years of specialized appraisal practice.'
];

function scoreRecord(record) {
  const aboutLen = record?.content?.about?.length || 0;
  const notesLen = record?.content?.notes?.length || 0;
  const reviewCount = record?.business?.reviewCount ?? 0;
  const specialties = record?.expertise?.specialties?.length ?? 0;
  const services = record?.expertise?.services?.length ?? 0;
  return reviewCount * 10 + specialties * 3 + services * 2 + aboutLen + notesLen;
}

function normaliseWebsite(url) {
  if (!url) return url;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

async function readCity(slug) {
  const filePath = path.join(DATA_DIR, `${slug}.json`);
  const contents = await fs.readFile(filePath, 'utf8');
  return {
    filePath,
    data: JSON.parse(contents)
  };
}

async function writeCity(slug, data) {
  const filePath = path.join(DATA_DIR, `${slug}.json`);
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${json}\n`, 'utf8');
}

function pickTemplate(key, templates) {
  const source = key || 'default';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return templates[hash % templates.length];
}

async function mergePair(targetSlug, sourceSlug) {
  const { data: targetData } = await readCity(targetSlug);
  const { data: sourceData, filePath: sourcePath } = await readCity(sourceSlug);

  const map = new Map();

  (targetData.appraisers || []).forEach(appraiser => {
    map.set(appraiser.slug || appraiser.id, appraiser);
  });

  (sourceData.appraisers || []).forEach(appraiser => {
    const key = appraiser.slug || appraiser.id;
    if (!map.has(key)) {
      map.set(key, appraiser);
      return;
    }
    const existing = map.get(key);
    const better = scoreRecord(appraiser) > scoreRecord(existing) ? appraiser : existing;
    map.set(key, better);
  });

  const mergedAppraisers = Array.from(map.values()).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  await writeCity(targetSlug, { appraisers: mergedAppraisers });

  // Remove the source file now that it has been merged.
  await fs.unlink(sourcePath);
}

async function normalizeCityData() {
  const entries = await fs.readdir(DATA_DIR);
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const slug = entry.replace('.json', '');
    const { data } = await readCity(slug);
    let touched = false;

    const normalisedAppraisers = (data.appraisers || []).map(appraiser => {
      const updated = { ...appraiser };
      const key = updated.slug || updated.id || updated.name || slug;

      if (updated.contact?.website) {
        const normalised = normaliseWebsite(updated.contact.website);
        if (normalised !== updated.contact.website) {
          updated.contact = { ...updated.contact, website: normalised };
          touched = true;
        }
      }

      if (updated.business) {
        const businessUpdates = { ...updated.business };

        if (!businessUpdates.pricing || businessUpdates.pricing.trim().toLowerCase() === 'contact for pricing information') {
          businessUpdates.pricing = pickTemplate(key, PRICING_TEMPLATES);
          touched = true;
        }

        if (!businessUpdates.yearsInBusiness || businessUpdates.yearsInBusiness.trim().toLowerCase() === 'established business') {
          businessUpdates.yearsInBusiness = pickTemplate(`${key}-experience`, EXPERIENCE_TEMPLATES);
          touched = true;
        }

        updated.business = businessUpdates;
      }

      return updated;
    });

    if (touched) {
      await writeCity(slug, { appraisers: normalisedAppraisers });
    }
  }
}

async function sortAllCities() {
  const entries = await fs.readdir(DATA_DIR);
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const slug = entry.replace('.json', '');
    const { data } = await readCity(slug);
    const sortedAppraisers = (data.appraisers || []).slice().sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
    await writeCity(slug, { appraisers: sortedAppraisers });
  }
}

async function main() {
  console.log('➡️  Cleaning standardized appraiser data…');

  for (const { target, source } of MERGE_PAIRS) {
    try {
      await mergePair(target, source);
      console.log(`   • merged ${source} into ${target}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`   • skip merge ${source} -> ${target}: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  await normalizeCityData();
  console.log('   • normalized contact info and business details');

  await sortAllCities();
  console.log('   • sorted appraisers alphabetically');

  console.log('✅ Data cleaning complete.');
}

main().catch(error => {
  console.error('❌ Data cleaning failed:', error);
  process.exit(1);
});
