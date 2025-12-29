#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_PUBLIC_DIR = path.join(REPO_ROOT, 'public_site');
const STANDARDIZED_DIR = path.join(REPO_ROOT, 'src', 'data', 'standardized');
const CITIES_FILE = path.join(REPO_ROOT, 'src', 'data', 'cities.json');

const DIRECTORY_DOMAIN = 'https://antique-appraiser-directory.appraisily.com';
const CTA_URL = 'https://appraisily.com/start';
const ASSETS_BASE_URL = 'https://assets.appraisily.com/assets/directory';
const FALLBACK_IMAGE = `${ASSETS_BASE_URL}/placeholder.jpg`;

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
  const safeCity = String(cityDisplayName || '').trim() || 'Your City';
  return `Antique Appraisers in ${safeCity} — Local Appraisal Services | Appraisily`;
}

function buildDescription(cityDisplayName) {
  const safeCity = String(cityDisplayName || '').trim() || 'your city';
  return `Find antique appraisers in ${safeCity} for antiques, art, jewelry & estate items. Compare local appraisal services, or request a fast online appraisal from Appraisily.`;
}

function buildFaq(cityDisplayName) {
  const qs = [
    {
      q: `How do antique appraisals work in ${cityDisplayName}?`,
      a: `Most antique appraisers in ${cityDisplayName} review condition, age, maker marks, materials, and comparable sales to estimate fair market value. A written report is often used for insurance, estates, donations, or resale.`,
    },
    {
      q: 'What should I prepare before contacting an appraiser?',
      a: 'Bring clear photos (front/back/details/marks), measurements, condition notes, and any provenance (receipts, family history, restoration notes).',
    },
    {
      q: `How much does an antique appraisal cost in ${cityDisplayName}?`,
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

function buildSchemas(cityDisplayName, canonicalUrl, appraisers, faqSchema) {
  const listItems = appraisers.slice(0, Math.min(appraisers.length, 15)).map((appraiser, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: appraiser.name,
    url: buildAbsoluteUrl(`/appraiser/${encodeURIComponent(appraiser.slug || appraiser.id || '')}/`),
    image: normalizeImageUrl(appraiser.imageUrl || FALLBACK_IMAGE),
    description: appraiser.content?.about || '',
  }));

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Antique appraisers in ${cityDisplayName}`,
    url: canonicalUrl,
    numberOfItems: appraisers.length,
    itemListElement: listItems,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${DIRECTORY_DOMAIN}/` },
      { '@type': 'ListItem', position: 2, name: `Antique appraisers in ${cityDisplayName}`, item: canonicalUrl },
    ],
  };

  const schemas = [itemList, breadcrumb];
  if (faqSchema) schemas.push(faqSchema);
  return schemas;
}

function buildAppraiserCard(appraiser, citySlug) {
  const slug = appraiser.slug || appraiser.id || '';
  const profilePath = `/appraiser/${encodeURIComponent(slug)}/`;
  const imageUrl = normalizeImageUrl(appraiser.imageUrl || FALLBACK_IMAGE);
  const rating = Number(appraiser.business?.rating);
  const reviewCount = Number(appraiser.business?.reviewCount) || 0;
  const hasRating = Number.isFinite(rating) && rating > 0;
  const ratingText = hasRating ? rating.toFixed(1) : '';
  const address =
    String(appraiser.address?.formatted || '').trim() ||
    `${appraiser.address?.city || ''}, ${appraiser.address?.state || ''}`.trim();
  const phone = String(appraiser.contact?.phone || '').trim();
  const phoneHref = normalizePhoneHref(phone);
  const website = normalizeWebsite(appraiser.contact?.website);
  const about = String(appraiser.content?.about || '').trim();
  const aboutText = about.length > 260 ? `${about.slice(0, 257).trimEnd()}…` : about;
  const ctaHref = `${CTA_URL}?utm_source=directory&utm_medium=organic&utm_campaign=${encodeURIComponent(
    citySlug,
  )}&utm_content=${encodeURIComponent(slug)}`;

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
            hasRating
              ? `
            <div class="flex flex-col items-end">
              <div class="flex items-center bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                <span class="font-semibold">${escapeHtml(ratingText)}</span>
              </div>
              ${reviewCount ? `<span class="text-xs text-gray-500 mt-1">${escapeHtml(`${reviewCount} review${reviewCount === 1 ? '' : 's'}`)}</span>` : ''}
            </div>
          `
              : ''
          }
        </div>
        ${aboutText ? `<p class="text-gray-700 leading-relaxed mb-4">${escapeHtml(aboutText)}</p>` : ''}
        <div class="flex flex-wrap gap-2 mt-5">
          <a href="${escapeHtml(profilePath)}" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            View Profile
          </a>
          ${
            phoneHref && phone
              ? `<a href="${escapeHtml(phoneHref)}" class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">${escapeHtml(phone)}</a>`
              : ''
          }
          ${
            website
              ? `<a href="${escapeHtml(website)}" class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" target="_blank" rel="nofollow noopener">Website</a>`
              : ''
          }
          <a href="${escapeHtml(ctaHref)}" class="inline-flex items-center px-4 py-2 text-blue-700 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
            Request Online Appraisal
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderLocationBody({ cityDisplayName, citySlug, canonicalUrl, description, appraisers }) {
  const hero = `
    <section class="bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-xl shadow-lg p-8">
      <div class="space-y-4">
        <h1 class="text-3xl md:text-4xl font-bold">${escapeHtml(cityDisplayName)} Antique Appraisers</h1>
        <p class="text-lg text-blue-50/90 leading-relaxed">${escapeHtml(description)}</p>
        <div class="flex flex-wrap gap-3 pt-2">
          <a href="${escapeHtml(
            `${CTA_URL}?utm_source=directory&utm_medium=hero&utm_campaign=${encodeURIComponent(citySlug)}`,
          )}" class="inline-flex items-center px-5 py-3 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            Get an online appraisal
          </a>
          <a href="${escapeHtml(canonicalUrl)}" class="inline-flex items-center px-5 py-3 border border-white/50 text-white rounded-lg hover:bg-white/10 transition-colors">
            Browse local providers
          </a>
        </div>
      </div>
    </section>
  `;

  const cards = appraisers.length
    ? `
      <section class="space-y-6">
        <div class="space-y-3">
          <h2 class="text-2xl font-semibold text-gray-900">Directory profiles (${appraisers.length})</h2>
          <p class="text-gray-700 leading-relaxed">Compare specialties, ratings, and contact options for antique appraisers serving ${escapeHtml(
            cityDisplayName,
          )}.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${appraisers.map((appraiser) => buildAppraiserCard(appraiser, citySlug)).join('\n')}
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

  return `
    <div class="container mx-auto px-4 py-8 mt-16 space-y-10">
      ${hero}
      ${cards}
      ${faqHtml}
      <section class="border-t border-gray-200 pt-8 text-sm text-gray-500">
        <p>Canonical URL: <a class="text-blue-600 hover:underline" href="${escapeHtml(canonicalUrl)}">${escapeHtml(
    canonicalUrl,
  )}</a></p>
      </section>
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
  const dataPath = path.join(STANDARDIZED_DIR, `${slug}.json`);
  const raw = await fs.readFile(dataPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed?.appraisers) ? parsed.appraisers : [];
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

    const cityMeta = cities.get(slug);
    const cityName = String(cityMeta?.name || '').trim() || titleCaseFromSlug(slug) || 'Location';
    const stateName = String(cityMeta?.state || '').trim();
    const cityDisplayName = stateName ? `${cityName}, ${stateName}` : cityName;
    const canonicalUrl = buildAbsoluteUrl(`/location/${slug}/`);
    const title = buildTitle(cityName);
    const description = buildDescription(cityName);

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
      citySlug: slug,
      canonicalUrl,
      description,
      appraisers,
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
