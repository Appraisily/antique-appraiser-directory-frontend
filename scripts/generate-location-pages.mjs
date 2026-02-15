#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  extractKeywordPhrases,
  normalizeRegionCode,
  sanitizePlainText,
  truncateText,
} from './utils/text-sanitize.js';
import { INDEXABLE_LOCATION_SLUG_SET, POPULAR_LOCATION_SLUGS } from './utils/indexable-locations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_PUBLIC_DIR = path.join(REPO_ROOT, 'public_site');
const STANDARDIZED_DIR = path.join(REPO_ROOT, 'src', 'data', 'standardized');
const STANDARDIZED_VERIFIED_DIR = path.join(REPO_ROOT, 'src', 'data', 'standardized_verified');
const CITIES_FILE = path.join(REPO_ROOT, 'src', 'data', 'cities.json');

const DIRECTORY_DOMAIN = 'https://antique-appraiser-directory.appraisily.com';
// Primary CTA should maximize signups/engagement from SEO landers.
// Keep a secondary "paid start" link for users ready to buy immediately.
const PRIMARY_CTA_URL = 'https://appraisily.com/screener';
const SECONDARY_CTA_URL = 'https://appraisily.com/start';
const ASSETS_BASE_URL = 'https://assets.appraisily.com/assets/directory';
const FALLBACK_IMAGE = `${ASSETS_BASE_URL}/placeholder.jpg`;
const SERVICE_LABEL = 'Antique Appraisers';
const SERVICE_LABEL_LOWER = 'antique appraisers';
// Display label used in page titles / headings to capture both "antique" and "art" intent.
const SERVICE_LABEL_DISPLAY = 'Antique & Art Appraisers';
const SERVICE_LABEL_DISPLAY_LOWER = 'antique and art appraisers';
const SERVICE_TYPE_LABEL = 'Antique Appraisal';
const LOCATION_SEO_OVERRIDES = {
  'des-moines': {
    title: 'Des Moines Antique Appraisers | Art, Donation & Estate Values',
    description:
      'Compare antique and art appraisers in Des Moines for donation, estate, insurance, and personal property valuations. Review specialties, then choose local or online appraisal.',
    h1: 'Des Moines Antique & Art Appraisers',
    heroDescription:
      'Compare local antique and art appraisal specialists in Des Moines, then choose the best fit for donation, estate, or insurance needs.',
  },
  'kansas-city': {
    title: 'Kansas City Art & Antique Appraisers | Local Valuation Experts',
    description:
      'Looking for an art appraiser in Kansas City? Compare local antique and art appraisal specialists, review credentials, and choose in-person or faster online service.',
    h1: 'Kansas City Art & Antique Appraisers',
    heroDescription:
      'Review Kansas City appraisers for art, antiques, and collections, then pick local in-person help or a faster online appraisal.',
  },
  chicago: {
    title: 'Chicago Antique Appraisers | Art Appraisal & Estate Experts',
    description:
      'Compare Chicago antique and art appraisers for estate, donation, insurance, and resale needs. See specialties and select local or online appraisal support.',
    h1: 'Chicago Antique & Art Appraisers',
    heroDescription:
      'Find Chicago appraisers for antiques, art, and collections, then choose local in-person service or a faster online appraisal route.',
  },
  tucson: {
    title: 'Tucson Antique Appraisers | Donation, Art & Estate Values',
    description:
      'Compare Tucson antique and art appraisers for donation, estate, and personal property valuation. Check specialties and choose local or online appraisal.',
    h1: 'Tucson Antique & Art Appraisers',
    heroDescription:
      'Compare Tucson specialists for antique, art, and donation valuations, then pick the local or online path that matches your timeline.',
  },
  columbus: {
    title: 'Columbus Antique Appraisers | Art, Donation & Tax Appraisals',
    description:
      'Find and compare Columbus appraisers for antiques, art, donation, and tax-related valuations. Review credentials and choose local or online appraisal.',
    h1: 'Columbus Antique & Art Appraisers',
    heroDescription:
      'Compare Columbus appraisal experts for donation, tax, estate, and insurance needs before choosing local in-person or online service.',
  },
  denver: {
    title: 'Denver Antique Appraisers | Art Appraisal Near You',
    description:
      'Compare Denver antique and art appraisers, including specialists for insurance, estate, and resale valuation. Choose local in-person or online appraisal.',
    h1: 'Denver Antique & Art Appraisers',
    heroDescription:
      'Find Denver appraisers for antiques and art, compare specialties, and choose between local appointments or faster online appraisal.',
  },
  milwaukee: {
    title: 'Milwaukee Antique Appraisers | Estate & Art Appraisal Experts',
    description:
      'Compare Milwaukee antique appraisers for estate items, collections, and art valuation. Review specialties and choose in-person or online appraisal support.',
    h1: 'Milwaukee Antique Appraisers',
    heroDescription:
      'Compare Milwaukee appraisal options for antiques, estate items, and art, then choose local in-person service or online turnaround.',
  },
  cleveland: {
    title: 'Cleveland Antique Appraisers | Donation & Personal Property',
    description:
      'Find Cleveland appraisers for antiques, art, charitable donation, and personal property valuation. Compare local providers and online alternatives.',
    h1: 'Cleveland Antique & Art Appraisers',
    heroDescription:
      'Compare Cleveland appraisers for donation, personal property, and antique valuation needs, then choose local or online service.',
  },
  louisville: {
    title: 'Louisville Antique Appraisers | Art, Tax & Estate Valuation',
    description:
      'Compare Louisville appraisers for antiques, art, tax donation, and estate valuation. Review local specialists and choose in-person or online appraisal.',
    h1: 'Louisville Antique & Art Appraisers',
    heroDescription:
      'Find Louisville specialists for antique, art, and tax-related valuations, then choose local in-person or faster online appraisal.',
  },
  baltimore: {
    title: 'Baltimore Antique Appraisers | Furniture & Art Valuation',
    description:
      'Compare Baltimore antique appraisers for furniture, art, estate, and insurance valuations. Check specialties and choose local or online appraisal service.',
    h1: 'Baltimore Antique & Art Appraisers',
    heroDescription:
      'Compare Baltimore specialists for antique furniture, art, and collection valuation, then choose local in-person or online appraisal.',
  },
};


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
  if (listed.length) return listed;
  return list;
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    publicDir: DEFAULT_PUBLIC_DIR,
    dryRun: false,
    limit: null,
  };

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    switch (flag) {
      case '--public-dir':
        options.publicDir = path.resolve(process.cwd(), String(readValue() || ''));
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--limit':
        options.limit = Number.parseInt(String(readValue() || '').trim(), 10);
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  if (!Number.isFinite(options.limit)) options.limit = null;
  return options;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeImageUrl(input = '') {
  const url = String(input || '').trim();
  if (!url) return FALLBACK_IMAGE;
  if (url.startsWith(ASSETS_BASE_URL)) return url;
  if (url.startsWith('https://ik.imagekit.io/appraisily/')) {
    return `${ASSETS_BASE_URL}/${url.slice('https://ik.imagekit.io/appraisily/'.length)}`;
  }
  if (url.startsWith('https://placehold.co')) return FALLBACK_IMAGE;
  return url;
}

function normalizePhoneHref(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (!digits) return '';
  return `tel:${digits}`;
}

function normalizeWebsite(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

function upsertMeta(head, selector, attrs) {
  let node = head.querySelector(selector);
  if (!node) {
    node = head.ownerDocument.createElement('meta');
    head.appendChild(node);
  }
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
}

function upsertLink(head, rel, href) {
  let node = head.querySelector(`link[rel="${rel}"]`);
  if (!node) {
    node = head.ownerDocument.createElement('link');
    node.setAttribute('rel', rel);
    head.appendChild(node);
  }
  node.setAttribute('href', href);
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

function buildAbsoluteUrl(pathname = '') {
  if (!pathname) return `${DIRECTORY_DOMAIN}/`;
  if (/^https?:\/\//i.test(pathname)) return pathname;
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${DIRECTORY_DOMAIN}${normalized}`;
}

function titleCaseFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildTitle(cityDisplayName) {
  const safeCity = sanitizePlainText(cityDisplayName) || 'Your City';
  // CTR-focused: make it obvious this is a local "near you" comparison page, with fees.
  // Keep this short enough for SERPs.
  return `${SERVICE_LABEL_DISPLAY} in ${safeCity} | Compare Fees & Experts | Appraisily`;
}

function buildDescription(cityDisplayName) {
  const safeCity = sanitizePlainText(cityDisplayName) || 'your city';
  return truncateText(
    `Compare ${SERVICE_LABEL_DISPLAY_LOWER} near ${safeCity}. See specialties, typical fees, and contact info. Or try Appraisily's free screener first, then upgrade to a written appraisal when you need it.`,
    155,
  );
}

function buildFaq(cityDisplayName) {
  const qs = [
    {
      q: `How do antique and art appraisals work in ${cityDisplayName}?`,
      a: `Most ${SERVICE_LABEL_DISPLAY_LOWER} in ${cityDisplayName} review condition, age, maker marks/materials, provenance details, and comparable sales to estimate value. A written report is often used for insurance, estates, donations, or resale.`,
    },
    {
      q: 'What should I prepare before contacting an appraiser?',
      a: 'Bring clear photos (front/back/details/marks), measurements, condition notes, and any provenance (receipts, family history, restoration notes).',
    },
    {
      q: `How much does an appraisal cost in ${cityDisplayName}?`,
      a: `Pricing varies by item type and scope (single item vs. estate). Many providers quote a flat fee or hourly rate; ask whether the fee includes a written report and research/comparables.`,
    },
    {
      q: 'Can Appraisily help if there is no local appraiser available?',
      a: 'Yes. You can request an online appraisal from Appraisily. Submit photos and details, and receive a written valuation without an in-person visit.',
    },
  ];

  return {
    html: `
      <section class="py-10 border-t border-gray-200">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Frequently asked questions</h2>
        <div class="space-y-6">
          ${qs
            .map(
              (entry) => `
            <div class="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h3 class="text-lg font-medium text-gray-900 mb-2">${escapeHtml(entry.q)}</h3>
              <p class="text-gray-700 leading-relaxed">${escapeHtml(entry.a)}</p>
            </div>
          `,
            )
            .join('')}
        </div>
      </section>
    `,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: qs.map((entry) => ({
        '@type': 'Question',
        name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a },
      })),
    },
  };
}

function buildLearnMoreSection(cityDisplayName, citySlug) {
  const safeCity = sanitizePlainText(cityDisplayName) || 'your city';
  const utm = `utm_source=directory&utm_medium=learn_more&utm_campaign=${encodeURIComponent(citySlug)}`;
  const links = [
    {
      title: 'Free antique identification app (how it works)',
      href: `https://articles.appraisily.com/free-antique-identification-app/?${utm}`,
      description: 'What photos to take, what details matter, and how to get a fast value range.',
    },
    {
      title: 'Antique furniture value (what affects pricing)',
      href: `https://articles.appraisily.com/how-to-determine-value-of-antique-furniture/?${utm}`,
      description: 'How condition, materials, and comps affect value (plus a photo checklist).',
    },
    {
      title: 'How to identify antiques (quick checklist)',
      href: `https://articles.appraisily.com/5-expert-tips-on-how-to-identify-antiques-uncover-the-value-of-your-vintage-finds/?${utm}`,
      description: 'A practical checklist for maker marks, materials, condition, and provenance.',
    },
    {
      title: 'When you need a qualified appraisal (IRS / donation)',
      href: `https://articles.appraisily.com/5-reasons-why-an-irs-qualified-appraisal-is-important/?${utm}`,
      description: 'When documentation matters for taxes, donations, estates, or insurance.',
    },
  ];

	  return `
	    <section class="py-10 border-t border-gray-200">
	      <h2 class="text-2xl font-semibold text-gray-900 mb-2">Learn more before you contact an appraiser</h2>
      <p class="text-gray-700 leading-relaxed mb-6">
        If you are in ${escapeHtml(safeCity)} and you want to move faster, use this short checklist and examples before you reach out.
      </p>
	      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
	        ${links
          .map(
            (link) => `
          <a class="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow" href="${escapeHtml(
            link.href,
          )}" target="_blank" rel="noopener noreferrer">
            <div class="text-sm font-semibold text-gray-900">${escapeHtml(link.title)}</div>
            <div class="mt-2 text-sm text-gray-700 leading-relaxed">${escapeHtml(link.description)}</div>
            <div class="mt-3 text-sm font-semibold text-blue-700">Read article →</div>
          </a>
        `,
          )
          .join('')}
      </div>
      <div class="mt-6 flex flex-wrap gap-3">
        <a class="inline-flex items-center px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors" href="${escapeHtml(
          `${PRIMARY_CTA_URL}?utm_source=directory&utm_medium=learn_more_cta&utm_campaign=${encodeURIComponent(citySlug)}`,
        )}">Try the free screener</a>
        <a class="inline-flex items-center px-5 py-3 text-blue-700 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors" href="${escapeHtml(
          `${SECONDARY_CTA_URL}?utm_source=directory&utm_medium=learn_more_paid&utm_campaign=${encodeURIComponent(citySlug)}`,
        )}">Start a paid appraisal</a>
      </div>
    </section>
  `;
}

function normalizeCityMeta(meta) {
  if (!meta) return { cityName: '', stateName: '', cityDisplayName: '' };
  const cityName = String(meta?.name || '').trim();
  const stateName = String(meta?.state || '').trim();
  const cityDisplayName = cityName && stateName ? `${cityName}, ${stateName}` : cityName || stateName;
  return { cityName, stateName, cityDisplayName };
}

function buildKeywordCounts(appraisers, fieldAccessor) {
  const counts = new Map();
  for (const appraiser of appraisers) {
    const phrases = extractKeywordPhrases(fieldAccessor(appraiser), 8);
    for (const phrase of phrases) {
      const cleaned = sanitizePlainText(phrase);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      const entry = counts.get(key) || { label: cleaned, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => (b.count - a.count ? b.count - a.count : a.label.localeCompare(b.label)))
    .map((entry) => entry.label);
}

function buildRelatedLocationLinks({ slug, stateName, citiesBySlug, slugsInBuild }) {
  const stateCode = normalizeRegionCode(stateName);
  if (!stateCode) return [];

  const candidates = [];
  for (const otherSlug of slugsInBuild) {
    if (otherSlug === slug) continue;
    if (!INDEXABLE_LOCATION_SLUG_SET.has(otherSlug)) continue;
    const otherMeta = citiesBySlug.get(otherSlug);
    if (!otherMeta) continue;
    const otherStateCode = normalizeRegionCode(String(otherMeta?.state || '').trim());
    if (!otherStateCode || otherStateCode !== stateCode) continue;
    candidates.push(otherSlug);
  }

  candidates.sort((a, b) => a.localeCompare(b));
  return candidates.slice(0, 6);
}

function buildFallbackLocationLinks({ slug, slugsInBuild }) {
  const candidates = POPULAR_LOCATION_SLUGS.filter(
    (candidate) => candidate !== slug && INDEXABLE_LOCATION_SLUG_SET.has(candidate) && slugsInBuild.includes(candidate),
  );
  return candidates.slice(0, 6);
}

function renderLocationGuideSection({ cityDisplayName, stateName, citySlug, appraisers, relatedSlugs, labelForSlug }) {
  const safeCity = sanitizePlainText(cityDisplayName) || 'your city';
  const safeState = sanitizePlainText(stateName);

  const specialties = buildKeywordCounts(appraisers, (entry) => entry?.expertise?.specialties).slice(0, 8);
  const services = buildKeywordCounts(appraisers, (entry) => entry?.expertise?.services).slice(0, 8);

  const verifiedCount = appraisers.filter((entry) => entry?.verified === true).length;
  const listedCount = appraisers.filter((entry) => entry?.verified !== true && entry?.listed === true).length;
  const providerCount = appraisers.length;

  const intro = `Hiring the right ${SERVICE_LABEL_DISPLAY_LOWER} in ${safeCity} depends on your goal (insurance, estate settlement, donation, or resale). Look for clear fees, a written report when needed, and evidence of comparable research for your item type.`;
  const checklist = `Before you contact a provider, gather photos, measurements, and any provenance. Ask about turnaround time, what kind of value the report uses (fair market vs replacement), and whether the fee includes a written report.`;
  const supplyNote =
    providerCount > 0
      ? `This page lists ${providerCount} provider${providerCount === 1 ? '' : 's'} (${verifiedCount} verified, ${listedCount} listed).`
      : `This page is being updated as we add more local coverage.`;

  const regionLabel = safeState ? `in ${safeState}` : '';
  const hubHref = `https://appraisily.com/antique-appraiser-near-me?utm_source=directory&utm_medium=guide&utm_campaign=${encodeURIComponent(
    citySlug,
  )}&utm_content=how_to_choose`;
  const artDirectoryHref = `https://art-appraisers-directory.appraisily.com/?utm_source=directory&utm_medium=guide&utm_campaign=${encodeURIComponent(
    citySlug,
  )}&utm_content=art_directory`;

	  return `
	    <section class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-5">
	      <div class="space-y-2">
	        <h2 class="text-2xl font-semibold text-gray-900">How to choose an appraiser ${escapeHtml(
	          regionLabel,
	        )}</h2>
	        <p class="text-gray-700 leading-relaxed">${escapeHtml(intro)}</p>
	        <p class="text-gray-700 leading-relaxed">${escapeHtml(checklist)}</p>
          <p class="text-sm text-gray-600">${escapeHtml(supplyNote)}</p>
	      </div>

      ${
        specialties.length
          ? `<div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Common specialties you will see ${escapeHtml(
          regionLabel,
        )}</h3>
        <ul class="list-disc pl-5 space-y-1 text-gray-700">
          ${specialties.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>`
          : ''
      }

      ${
        services.length
          ? `<div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Typical appraisal services</h3>
        <ul class="list-disc pl-5 space-y-1 text-gray-700">
          ${services.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>`
          : ''
      }

      <div class="flex flex-wrap gap-3">
        <a class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" href="${escapeHtml(
          `${PRIMARY_CTA_URL}?utm_source=directory&utm_medium=guide&utm_campaign=${encodeURIComponent(citySlug)}`,
        )}">Start free screener</a>
        <a class="inline-flex items-center px-4 py-2 text-blue-700 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors" href="${escapeHtml(
          hubHref,
        )}" target="_blank" rel="noopener noreferrer">How to choose</a>
        <a class="inline-flex items-center px-4 py-2 text-blue-700 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors" href="/location/">Browse all locations</a>
      </div>

      <div class="text-sm text-gray-600 flex flex-wrap gap-3">
        <a class="underline hover:text-blue-700" href="/methodology/" data-gtm-event="directory_cta" data-gtm-cta="methodology_link">How we build this directory</a>
        <a class="underline hover:text-blue-700" href="/get-listed/" data-gtm-event="directory_cta" data-gtm-cta="get_listed_link">Are you an appraiser? Get listed</a>
        <a class="underline hover:text-blue-700" href="${escapeHtml(
          artDirectoryHref,
        )}" target="_blank" rel="noopener noreferrer" data-gtm-event="directory_cta" data-gtm-cta="art_directory_link">Need art-only providers?</a>
      </div>

      ${
        relatedSlugs.length
          ? `<div class="pt-2 border-t border-gray-100">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Related locations</h3>
        <div class="flex flex-wrap gap-2">
          ${relatedSlugs
            .map((related) => {
              const label = labelForSlug(related);
              return `<a class="text-blue-700 hover:underline" href="/location/${escapeHtml(
                related,
              )}/">${escapeHtml(label)}</a>`;
            })
            .join('<span class="text-gray-300">·</span>')}
        </div>
      </div>`
          : ''
      }
    </section>
  `;
}

function buildAppraiserSummary(appraiser, cityPlain) {
  const name = sanitizePlainText(appraiser?.name) || 'This provider';
  const specialties = extractKeywordPhrases(appraiser?.expertise?.specialties, 4);
  const services = extractKeywordPhrases(appraiser?.expertise?.services, 3);

  const parts = [`${name} offers antique appraisal support in ${cityPlain}.`];
  if (specialties.length) parts.push(`Specialties: ${specialties.join(', ')}.`);
  if (services.length) parts.push(`Services: ${services.join(', ')}.`);

  return truncateText(parts.join(' '), 220);
}

function buildSchemas(cityDisplayName, canonicalUrl, appraisers, faqSchema) {
  const cityPlain = sanitizePlainText(cityDisplayName);
  const listItems = appraisers.slice(0, Math.min(appraisers.length, 15)).map((appraiser, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: sanitizePlainText(appraiser.name),
    url: buildAbsoluteUrl(`/appraiser/${encodeURIComponent(appraiser.slug || appraiser.id || '')}/`),
    image: normalizeImageUrl(appraiser.imageUrl || FALLBACK_IMAGE),
    description: buildAppraiserSummary(appraiser, cityPlain),
  }));

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${SERVICE_LABEL_DISPLAY} in ${cityDisplayName}`,
    url: canonicalUrl,
    numberOfItems: appraisers.length,
    itemListElement: listItems,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${DIRECTORY_DOMAIN}/` },
      { '@type': 'ListItem', position: 2, name: `${SERVICE_LABEL_DISPLAY} in ${cityDisplayName}`, item: canonicalUrl },
    ],
  };

  const schemas = [itemList, breadcrumb];
  if (faqSchema) schemas.push(faqSchema);
  return schemas;
}

function buildAppraiserCard(appraiser, { citySlug, cityDisplayName }) {
  const slug = appraiser.slug || appraiser.id || '';
  const profilePath = `/appraiser/${encodeURIComponent(slug)}/`;
  const imageUrl = normalizeImageUrl(appraiser.imageUrl || FALLBACK_IMAGE);
  const address = sanitizePlainText(cityDisplayName) || sanitizePlainText(appraiser.address?.city) || '';
  const aboutText = buildAppraiserSummary(appraiser, sanitizePlainText(cityDisplayName));
  const ctaHref = `${PRIMARY_CTA_URL}?utm_source=directory&utm_medium=card&utm_campaign=${encodeURIComponent(
    citySlug,
  )}&utm_content=${encodeURIComponent(slug)}`;
  const website = appraiser.verified || appraiser.listed ? String(appraiser.website || '').trim() : '';
  const sourceUrl = String(appraiser?.verification?.sourceUrl || '').trim();
  const sourceLabel = (() => {
    const explicit = String(appraiser?.verification?.sourceType || '').trim();
    if (explicit) return explicit;
    if (!sourceUrl) return 'public listing';
    if (sourceUrl.includes('isa-appraisers.org')) return 'ISA directory';
    if (sourceUrl.includes('yellowpages.ca')) return 'YellowPages.ca';
    if (sourceUrl.includes('bbb.org')) return 'BBB';
    return 'public listing';
  })();
  const badge = appraiser.verified
    ? 'Verified'
    : appraiser.listed
      ? 'Listed'
      : '';
  const badgeClass = appraiser.verified
    ? 'text-green-700 bg-green-50 border-green-100'
    : appraiser.listed
      ? 'text-amber-800 bg-amber-50 border-amber-100'
      : '';
  const phone =
    appraiser.verified || appraiser.listed ? String(appraiser.phone || appraiser.contact?.phone || '').trim() : '';
  const phoneHref = phone ? normalizePhoneHref(phone) : '';

	  return `
	    <article class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white">
	      <div class="h-48 bg-gray-200 overflow-hidden">
	        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(
	    `${appraiser.name} - Antique appraiser in ${appraiser.address?.city || ''}`,
	  )}" class="w-full h-full object-cover" loading="lazy">
	      </div>
      <div class="p-5">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 class="text-xl font-semibold text-gray-900">
              <a href="${escapeHtml(profilePath)}" class="hover:text-blue-600 transition-colors">${escapeHtml(
    appraiser.name,
  )}</a>
            </h3>
            ${address ? `<p class="text-sm text-gray-600 mt-2">${escapeHtml(address)}</p>` : ''}
          </div>
          ${
            badge
              ? `<span class="text-xs font-semibold uppercase tracking-wide ${badgeClass} border px-2 py-1 rounded">${badge}</span>`
              : ''
          }
        </div>
        ${aboutText ? `<p class="text-gray-700 leading-relaxed mb-4">${escapeHtml(aboutText)}</p>` : ''}
        <div class="flex flex-wrap gap-2 mt-5">
          <a href="${escapeHtml(profilePath)}" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            View Profile
          </a>
          ${
            website
              ? `<a href="${escapeHtml(website)}" rel="nofollow noopener" target="_blank" class="inline-flex items-center px-4 py-2 text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
            Website
          </a>`
              : ''
          }
          ${
            phoneHref
              ? `<a href="${escapeHtml(phoneHref)}" class="inline-flex items-center px-4 py-2 text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
            Call
          </a>`
              : ''
          }
          <a href="${escapeHtml(ctaHref)}" class="inline-flex items-center px-4 py-2 text-blue-700 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
            Try free screener
          </a>
        </div>
        ${
          sourceUrl
            ? `<p class="text-xs text-gray-500 mt-4">Source: <a href="${escapeHtml(
                sourceUrl,
              )}" target="_blank" rel="nofollow noopener" class="text-blue-600 hover:underline">${escapeHtml(sourceLabel)}</a></p>`
            : ''
        }
      </div>
    </article>
  `;
}

function renderLocationBody({
  cityDisplayName,
  stateName,
  citySlug,
  canonicalUrl,
  description,
  heroHeading,
  heroDescription,
  appraisers,
  relatedSlugs,
  labelForSlug,
}) {
  const localAppraisersId = 'local-appraisers';
	  const hero = `
	    <section class="bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-xl shadow-lg p-8">
	      <div class="space-y-4">
	        <h1 class="text-3xl md:text-4xl font-bold">${escapeHtml(heroHeading)}</h1>
	        <p class="text-lg text-blue-50/90 leading-relaxed">${escapeHtml(heroDescription)}</p>
	        <div class="flex flex-wrap gap-3 pt-2">
	          <a href="${escapeHtml(
	            `${PRIMARY_CTA_URL}?utm_source=directory&utm_medium=hero&utm_campaign=${encodeURIComponent(citySlug)}`,
          )}" class="inline-flex items-center px-5 py-3 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            Try the free screener
          </a>
          <a href="#${localAppraisersId}" onclick="event.preventDefault();var el=document.getElementById('${localAppraisersId}');if(el){el.scrollIntoView({behavior:'smooth'});}history.replaceState(null,'',window.location.pathname+window.location.search+'#${localAppraisersId}');" class="inline-flex items-center px-5 py-3 border border-white/50 text-white rounded-lg hover:bg-white/10 transition-colors">
            Browse local providers
          </a>
        </div>
        <p class="text-sm text-blue-50/85">
          Ready to buy? <a class="underline hover:no-underline" href="${escapeHtml(
            `${SECONDARY_CTA_URL}?utm_source=directory&utm_medium=hero_text&utm_campaign=${encodeURIComponent(citySlug)}`,
          )}">Start a paid appraisal</a>
        </p>
	        <p class="text-sm text-blue-50/80">
	          <a class="underline hover:no-underline" href="/methodology/">How this directory is built</a>
	          ·
	          <a class="underline hover:no-underline" href="/get-listed/">Get listed</a>
	          ·
	          <a class="underline hover:no-underline" href="https://appraisily.com/antique-appraiser-near-me?utm_source=directory&utm_medium=hero&utm_campaign=${encodeURIComponent(
	            citySlug,
	          )}&utm_content=hub" target="_blank" rel="noopener noreferrer">How to choose an appraiser</a>
	        </p>
	      </div>
	    </section>
	  `;

  const cards = appraisers.length
    ? `
      <section id="${localAppraisersId}" class="space-y-6 scroll-mt-20">
	        <div class="space-y-3">
	          <h2 class="text-2xl font-semibold text-gray-900">Directory profiles (${appraisers.length})</h2>
	          <p class="text-gray-700 leading-relaxed">Compare specialties and services for ${escapeHtml(
	            SERVICE_LABEL_DISPLAY_LOWER,
	          )} serving ${escapeHtml(
	            cityDisplayName,
	          )}.</p>
	        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${appraisers.map((appraiser) => buildAppraiserCard(appraiser, { citySlug, cityDisplayName })).join('\n')}
        </div>
      </section>
    `
    : `
      <section class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 class="text-2xl font-semibold text-gray-900 mb-2">Need help valuing an antique today?</h2>
        <p class="text-gray-700 leading-relaxed">Try the free screener to see what kind of appraisal you need, then upgrade if you want a written valuation.</p>
        <div class="flex flex-wrap gap-3 mt-5">
          <a class="inline-flex items-center px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors" href="${escapeHtml(
            `${PRIMARY_CTA_URL}?utm_source=directory&utm_medium=empty_state&utm_campaign=${encodeURIComponent(citySlug)}`,
          )}">Start free screener</a>
          <a class="inline-flex items-center px-5 py-3 text-blue-700 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors" href="${escapeHtml(
            `${SECONDARY_CTA_URL}?utm_source=directory&utm_medium=empty_state_paid&utm_campaign=${encodeURIComponent(citySlug)}`,
          )}">Start paid appraisal</a>
        </div>
      </section>
    `;

  const { html: faqHtml } = buildFaq(cityDisplayName);
  const learnMoreHtml = buildLearnMoreSection(cityDisplayName, citySlug);
  const guide = renderLocationGuideSection({
    cityDisplayName,
    stateName,
    citySlug,
    appraisers,
    relatedSlugs,
    labelForSlug,
  });

  return `
    <div class="container mx-auto px-4 py-8 mt-16 space-y-10">
      ${hero}
      ${cards}
      ${guide}
      ${learnMoreHtml}
      ${faqHtml}
    </div>
  `;
}

async function loadCities() {
  const raw = await fs.readFile(CITIES_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const cities = Array.isArray(parsed?.cities) ? parsed.cities : [];
  const map = new Map();
  for (const city of cities) {
    if (city?.slug) map.set(city.slug, city);
  }
  return map;
}

async function listLocationSlugs(publicDir) {
  const locationDir = path.join(publicDir, 'location');
  const entries = await fs.readdir(locationDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function loadLocationData(slug) {
  const candidates = [
    path.join(STANDARDIZED_VERIFIED_DIR, `${slug}.json`),
    path.join(STANDARDIZED_DIR, `${slug}.json`),
  ];

  for (const dataPath of candidates) {
    try {
      const raw = await fs.readFile(dataPath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.appraisers) ? parsed.appraisers : [];
    } catch {
      continue;
    }
  }

  throw new Error(`Missing standardized data for slug ${slug}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cities = await loadCities();
  const slugs = await listLocationSlugs(options.publicDir);
  const limitedSlugs = options.limit ? slugs.slice(0, Math.max(0, options.limit)) : slugs;

  const stats = {
    publicDir: options.publicDir,
    dryRun: options.dryRun,
    discovered: slugs.length,
    processed: 0,
    updated: 0,
    missingHtml: 0,
    missingData: 0,
  };

  for (const slug of limitedSlugs) {
    const htmlPath = path.join(options.publicDir, 'location', slug, 'index.html');
    let html;
    try {
      html = await fs.readFile(htmlPath, 'utf8');
    } catch {
      stats.missingHtml += 1;
      continue;
    }

    let appraisers;
    try {
      appraisers = await loadLocationData(slug);
    } catch {
      stats.missingData += 1;
      continue;
    }

    appraisers = filterAppraisersForLocation(slug, appraisers);

    const cityMeta = cities.get(slug);
    const normalizedCity = normalizeCityMeta(cityMeta);
    const cityName = normalizedCity.cityName || titleCaseFromSlug(slug) || 'Location';
    const stateName = normalizedCity.stateName;
    const cityDisplayName = normalizedCity.cityDisplayName || (stateName ? `${cityName}, ${stateName}` : cityName);
    const canonicalUrl = buildAbsoluteUrl(`/location/${slug}/`);
    const regionCode = normalizeRegionCode(stateName);
    const titleDisplay = regionCode ? `${cityName}, ${regionCode}` : cityName;
    const descriptionDisplay = stateName ? `${cityName}, ${stateName}` : cityName;
    const seoOverride = LOCATION_SEO_OVERRIDES[slug];
    const title = seoOverride?.title || buildTitle(titleDisplay);
    const description = seoOverride?.description || buildDescription(descriptionDisplay);
    const heroHeading = seoOverride?.h1 || `${SERVICE_LABEL_DISPLAY} in ${cityDisplayName}`;
    const heroDescription = seoOverride?.heroDescription || description;

  const labelForSlug = (candidateSlug) => {
      const meta = normalizeCityMeta(cities.get(candidateSlug));
      const fallbackCityName = meta.cityName || titleCaseFromSlug(candidateSlug) || candidateSlug;
      const fallbackState = meta.stateName;
      const fallbackCode = normalizeRegionCode(fallbackState);
      const display = fallbackCode ? `${fallbackCityName}, ${fallbackCode}` : fallbackCityName;
      return `${SERVICE_LABEL_DISPLAY} in ${display}`;
    };

    const regionRelated = buildRelatedLocationLinks({ slug, stateName, citiesBySlug: cities, slugsInBuild: slugs });
    const relatedSlugs = regionRelated.length
      ? regionRelated
      : buildFallbackLocationLinks({ slug, slugsInBuild: slugs });

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const head = document.querySelector('head');
    const root = document.querySelector('#root');
    if (!head || !root) {
      stats.processed += 1;
      continue;
    }

    const bodyMarkup = renderLocationBody({
      cityDisplayName,
      stateName,
      citySlug: slug,
      canonicalUrl,
      description,
      heroHeading,
      heroDescription,
      appraisers,
      relatedSlugs,
      labelForSlug,
    });
    root.innerHTML = bodyMarkup;

    document.title = title;
    upsertMeta(head, 'meta[name="description"]', { name: 'description', content: description });
    upsertLink(head, 'canonical', canonicalUrl);

    upsertMeta(head, 'meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta(head, 'meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta(head, 'meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta(head, 'meta[property="og:type"]', { property: 'og:type', content: 'website' });

    const imageForSocial = appraisers.length ? normalizeImageUrl(appraisers[0]?.imageUrl) : FALLBACK_IMAGE;
    upsertMeta(head, 'meta[property="og:image"]', { property: 'og:image', content: imageForSocial });

    upsertMeta(head, 'meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta(head, 'meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta(head, 'meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta(head, 'meta[name="twitter:image"]', { name: 'twitter:image', content: imageForSocial });
    upsertMeta(head, 'meta[name="twitter:url"]', { name: 'twitter:url', content: canonicalUrl });

    const { schema: faqSchema } = buildFaq(cityDisplayName);
    const schemas = buildSchemas(cityDisplayName, canonicalUrl, appraisers, faqSchema);
    upsertJsonLd(head, 'schemas', schemas);

    const output = dom.serialize();
    stats.processed += 1;

    if (!options.dryRun) {
      await fs.writeFile(htmlPath, output, 'utf8');
      stats.updated += 1;
    }
  }

  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

main().catch((error) => {
  console.error('[generate-location-pages] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
