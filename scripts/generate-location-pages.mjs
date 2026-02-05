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
const CTA_URL = 'https://appraisily.com/start';
const ASSETS_BASE_URL = 'https://assets.appraisily.com/assets/directory';
const FALLBACK_IMAGE = `${ASSETS_BASE_URL}/placeholder.jpg`;
const SERVICE_LABEL = 'Antique Appraisers';
const SERVICE_LABEL_LOWER = 'antique appraisers';
const SERVICE_TYPE_LABEL = 'Antique Appraisal';

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
  return `${SERVICE_LABEL} in ${safeCity} | Appraisily`;
}

function buildDescription(cityDisplayName) {
  const safeCity = sanitizePlainText(cityDisplayName) || 'your city';
  return truncateText(
    `Compare ${SERVICE_LABEL_LOWER} in ${safeCity} for insurance, estates, donations, and resale. Or get a fast online appraisal from Appraisily.`,
    155,
  );
}

function buildFaq(cityDisplayName) {
  const qs = [
    {
      q: `How do antique appraisals work in ${cityDisplayName}?`,
      a: `Most ${SERVICE_LABEL_LOWER} in ${cityDisplayName} review condition, age, maker marks/materials, provenance details, and comparable sales to estimate value. A written report is often used for insurance, estates, donations, or resale.`,
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

  const intro = `Hiring the right ${SERVICE_LABEL_LOWER} in ${safeCity} depends on your goal (insurance, estate settlement, donation, or resale). Look for clear fees, a written report when needed, and evidence of recent comparable research for your item type.`;
  const checklist = `When you reach out, ask about turnaround time, what photos/details they need, and whether the valuation is for fair market value or replacement value. If you prefer a faster path, Appraisily can deliver a written online appraisal from photos and measurements.`;

  const regionLabel = safeState ? `in ${safeState}` : '';

	  return `
	    <section class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-5">
	      <div class="space-y-2">
	        <h2 class="text-2xl font-semibold text-gray-900">How to choose an antique appraiser ${escapeHtml(
	          regionLabel,
	        )}</h2>
	        <p class="text-gray-700 leading-relaxed">${escapeHtml(intro)}</p>
	        <p class="text-gray-700 leading-relaxed">${escapeHtml(checklist)}</p>
	      </div>

      ${
        specialties.length
          ? `<div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Common specialties you’ll see ${escapeHtml(
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
          `${CTA_URL}?utm_source=directory&utm_medium=guide&utm_campaign=${encodeURIComponent(citySlug)}`,
        )}">Start an online appraisal</a>
        <a class="inline-flex items-center px-4 py-2 text-blue-700 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors" href="/location/">Browse all locations</a>
      </div>

      <div class="text-sm text-gray-600 flex flex-wrap gap-3">
        <a class="underline hover:text-blue-700" href="/methodology/" data-gtm-event="directory_cta" data-gtm-cta="methodology_link">How we build this directory</a>
        <a class="underline hover:text-blue-700" href="/get-listed/" data-gtm-event="directory_cta" data-gtm-cta="get_listed_link">Are you an appraiser? Get listed</a>
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
    name: `${SERVICE_LABEL} in ${cityDisplayName}`,
    url: canonicalUrl,
    numberOfItems: appraisers.length,
    itemListElement: listItems,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${DIRECTORY_DOMAIN}/` },
      { '@type': 'ListItem', position: 2, name: `${SERVICE_LABEL} in ${cityDisplayName}`, item: canonicalUrl },
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
  const ctaHref = `${CTA_URL}?utm_source=directory&utm_medium=organic&utm_campaign=${encodeURIComponent(
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
            Request Online Appraisal
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
  appraisers,
  relatedSlugs,
  labelForSlug,
}) {
  const localAppraisersId = 'local-appraisers';
  const hero = `
    <section class="bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-xl shadow-lg p-8">
      <div class="space-y-4">
        <h1 class="text-3xl md:text-4xl font-bold">${escapeHtml(SERVICE_LABEL)} in ${escapeHtml(cityDisplayName)}</h1>
        <p class="text-lg text-blue-50/90 leading-relaxed">${escapeHtml(description)}</p>
        <div class="flex flex-wrap gap-3 pt-2">
          <a href="${escapeHtml(
            `${CTA_URL}?utm_source=directory&utm_medium=hero&utm_campaign=${encodeURIComponent(citySlug)}`,
          )}" class="inline-flex items-center px-5 py-3 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            Get an online appraisal
          </a>
          <a href="#${localAppraisersId}" onclick="event.preventDefault();var el=document.getElementById('${localAppraisersId}');if(el){el.scrollIntoView({behavior:'smooth'});}history.replaceState(null,'',window.location.pathname+window.location.search+'#${localAppraisersId}');" class="inline-flex items-center px-5 py-3 border border-white/50 text-white rounded-lg hover:bg-white/10 transition-colors">
            Browse local providers
          </a>
        </div>
        <p class="text-sm text-blue-50/80">
          <a class="underline hover:no-underline" href="/methodology/">How this directory is built</a>
          ·
          <a class="underline hover:no-underline" href="/get-listed/">Get listed</a>
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
            SERVICE_LABEL_LOWER,
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
        <p class="text-gray-700 leading-relaxed">Request a fast online appraisal from Appraisily. You’ll get a written valuation based on photos, measurements, and recent market comparables.</p>
        <a class="inline-flex items-center px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors mt-5" href="${escapeHtml(
          `${CTA_URL}?utm_source=directory&utm_medium=empty_state&utm_campaign=${encodeURIComponent(citySlug)}`,
        )}">Start an online appraisal</a>
      </section>
    `;

  const { html: faqHtml } = buildFaq(cityDisplayName);
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
  const title = buildTitle(titleDisplay);
  const description = buildDescription(descriptionDisplay);

  const labelForSlug = (candidateSlug) => {
      const meta = normalizeCityMeta(cities.get(candidateSlug));
      const fallbackCityName = meta.cityName || titleCaseFromSlug(candidateSlug) || candidateSlug;
      const fallbackState = meta.stateName;
      const fallbackCode = normalizeRegionCode(fallbackState);
      const display = fallbackCode ? `${fallbackCityName}, ${fallbackCode}` : fallbackCityName;
      return `${SERVICE_LABEL} in ${display}`;
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
