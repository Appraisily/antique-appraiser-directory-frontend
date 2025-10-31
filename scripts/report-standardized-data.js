#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'src', 'data', 'standardized');
const OUTPUT_DIR = path.join(__dirname, '..', 'logs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'standardized-data-report.json');

const TEMPLATED_PRICING = new Set([
  'Initial consultation from $150; comprehensive reports quoted per project.',
  'Desktop valuations start at $95 per item; onsite work billed hourly.',
  'Museum-grade reports from $325; collection reviews offered with custom estimates.',
  'Express photo appraisal $175; full USPAP-compliant documentation priced individually.',
  'Estate packages begin at $450 and include research, inspection, and documentation.',
  'Single-item opinions from $125; multi-piece engagements receive tailored pricing.',
  'Project-based'
]);

const TEMPLATED_EXPERIENCE = new Set([
  'Founded in 2004 with two decades of appraisal expertise.',
  '15+ years providing certified antique valuations nationwide.',
  'Established in 2010 and trusted for museum-quality reporting.',
  'Serving collectors since 2007 with USPAP-compliant analyses.',
  'Over 18 years assisting estates, insurers, and private collectors.',
  'Established firm with more than 12 years of specialized appraisal practice.',
  'Established business'
]);

function hasPlaceholderName(name = '') {
  return /^\[.*\]$/.test(name.trim());
}

function isPlaceholderAbout(about = '') {
  return about.includes('[') && about.includes(']');
}

function isTemplatedNotes(notes = '', city = '') {
  if (!notes) return false;
  if (notes.includes('Serving the') && notes.includes('area with professional antique appraisal services.')) {
    return true;
  }
  if (city) {
    const pattern = `Serving the ${city}`;
    if (notes.startsWith(pattern) && notes.endsWith('area with professional antique appraisal services.')) {
      return true;
    }
  }
  return false;
}

function detectRepeatedReviews(appraiser) {
  const seen = new Set();
  const duplicates = [];
  for (const review of appraiser.reviews || []) {
    const key = `${review.author}|${review.content}`;
    if (seen.has(key)) {
      duplicates.push(key);
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

async function main() {
  const entries = await fs.readdir(DATA_DIR);
  let totalCities = 0;
  let totalAppraisers = 0;
  const issues = [];

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const slug = entry.replace('.json', '');
    const filePath = path.join(DATA_DIR, entry);
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

    totalCities += 1;
    for (const appraiser of data.appraisers || []) {
      totalAppraisers += 1;
      const appraiserIssues = [];

      if (TEMPLATED_PRICING.has(appraiser.business?.pricing?.trim())) {
        appraiserIssues.push('templated_pricing');
      }
      if (TEMPLATED_EXPERIENCE.has(appraiser.business?.yearsInBusiness?.trim())) {
        appraiserIssues.push('templated_experience');
      }
      if (hasPlaceholderName(appraiser.name)) {
        appraiserIssues.push('placeholder_name');
      }
      if (isPlaceholderAbout(appraiser.content?.about)) {
        appraiserIssues.push('placeholder_about');
      }
      if (isTemplatedNotes(appraiser.content?.notes, appraiser.address?.city)) {
        appraiserIssues.push('templated_notes');
      }
      const duplicateReviews = detectRepeatedReviews(appraiser);
      if (duplicateReviews.length) {
        appraiserIssues.push('duplicate_reviews');
      }

      if (appraiserIssues.length) {
        issues.push({
          city: slug,
          appraiserId: appraiser.id,
          name: appraiser.name,
          issues: appraiserIssues
        });
      }
    }
  }

  const summary = {
    totals: {
      cities: totalCities,
      appraisers: totalAppraisers
    },
    issueCounts: issues.reduce((acc, item) => {
      item.issues.forEach(issue => {
        acc[issue] = (acc[issue] || 0) + 1;
      });
      return acc;
    }, {}),
    issues
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(summary, null, 2));

  console.log('Standardized data report written to', OUTPUT_FILE);
  console.log('Summary:', summary.totals, summary.issueCounts);
}

main().catch(error => {
  console.error('Failed to analyze standardized data:', error);
  process.exit(1);
});
