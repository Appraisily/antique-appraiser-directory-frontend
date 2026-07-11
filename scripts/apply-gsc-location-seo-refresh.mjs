#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public_site');
const START = '<!-- appraisily-gsc-location-refresh:start -->';
const END = '<!-- appraisily-gsc-location-refresh:end -->';
const APP_SHELL_CACHE_BUSTER = 'gsc-ctr-20260703';

const PAGES = [
  {
    slug: 'des-moines',
    city: 'Des Moines',
    title: 'Des Moines Antique & Art Appraisals | Signed Online Reports',
    description:
      'Compare Des Moines appraisers or get a signed online appraisal from photos for estate, insurance, donation, or personal property needs.',
    h1: 'Des Moines Antique & Art Appraisals',
    hero:
      'Compare Des Moines specialists, or upload photos for a signed appraisal report for estate, insurance, donation, or personal-property decisions.',
    heading: 'Signed appraisal reports and local options in Des Moines',
    body:
      'GSC demand is strongest around Des Moines art appraisals, art appraisers, and personal-property appraisers. Use local providers when a physical inspection is useful, and use Appraisily when photos, provenance, condition notes, and a signed online report are enough for the next decision.',
    phrases: ['Des Moines art appraisals', 'Des Moines personal property appraisers', 'Signed online appraisal reports'],
  },
  {
    slug: 'chicago',
    city: 'Chicago',
    title: 'Chicago Antique & Art Appraisals | Signed Reports Online',
    description:
      'Find Chicago appraisal options for antiques, art, estates, insurance, and donations. Upload photos for an online signed report.',
    h1: 'Chicago Antique & Art Appraisals',
    hero:
      'Compare Chicago antique and art appraisers, or upload photos for a signed online report when you need estate, insurance, donation, or resale documentation.',
    heading: 'Chicago signed reports, estate appraisals, and local options',
    body:
      'Chicago searches still show broad near-me and art-appraisal intent. Use local specialists when a hands-on inspection matters, and use online appraisal when photos and supporting details can move the decision forward faster.',
    phrases: ['Chicago antique appraisers', 'Chicago art appraisal services', 'Signed reports online'],
  },
  {
    slug: 'columbus',
    city: 'Columbus',
    title: 'Columbus Antique Appraisers | Art & Estate Reports',
    description:
      'Compare Columbus antique and art appraisal options, then use Appraisily for a signed online report from photos.',
    h1: 'Columbus Antique Appraisers for Art, Estate & Donation Needs',
    hero:
      'Find Columbus antique and art appraisers for donation documentation, tax-donation appraisal questions, estate review, insurance records, and personal-property valuation, or start with a signed online appraisal.',
    heading: 'Columbus donation, antique, and art appraisal services',
    body:
      'Columbus pages are earning impressions for donation appraiser, antique appraiser, art appraiser, and tax donation appraiser terms. Match the appraisal to the use case: donation paperwork, estate distribution, insurance scheduling, resale pricing, or a faster signed online report.',
    phrases: ['Columbus donation appraiser', 'Columbus antique appraiser', 'Columbus tax donation appraiser'],
  },
  {
    slug: 'denver',
    city: 'Denver',
    title: 'Denver Antique Appraisers & Art Appraisal | Online Signed Reports',
    description:
      'Compare Denver antique appraisers and Denver art appraisal options for estate, insurance, and donation needs. Get a signed online report from photos.',
    h1: 'Denver Antique Appraisers & Art Appraisal Options',
    hero:
      'Compare Denver specialists for antique and art appraisals, then choose the right fit for estate, insurance, donation, and personal-property needs.',
    heading: 'Denver signed reports and local appraisal options',
    body:
      'Denver appraisal searches combine local antique-appraiser intent with estate, insurance, donation, and online-report needs. Compare local specialists when a physical inspection matters, and use Appraisily when a photo-based signed report can move the decision forward.',
    phrases: ['Denver antique appraisers', 'Denver art appraisal services', 'Online signed reports'],
  },
  {
    slug: 'baltimore',
    city: 'Baltimore',
    title: 'Baltimore Antique & Art Appraisers | Signed Reports',
    description:
      'Compare Baltimore antique, furniture, and art appraisers for estate, insurance, donation, and online signed reports.',
    h1: 'Baltimore Antique & Art Appraisers',
    hero:
      'Compare Baltimore antique, furniture, and art appraisers, or upload photos for a signed report for estate, insurance, donation, and personal-property needs.',
    heading: 'Baltimore estate, furniture, and signed report options',
    body:
      'Baltimore demand includes Maryland antique appraisers and antique furniture appraisal searches. Furniture, silver, and Chesapeake-region estate material usually benefit from specialist review, especially when condition, provenance, donation documentation, or a signed report matters.',
    phrases: ['Antique appraisers in Baltimore Maryland', 'Antique furniture appraisal Maryland', 'Signed appraisal reports'],
  },
  {
    slug: 'new-orleans',
    city: 'New Orleans',
    title: 'New Orleans Antique & Art Appraisals | Online Reports',
    description:
      'Compare New Orleans and Metairie appraisal options, or start a signed online report for art, antiques, estates, and insurance.',
    h1: 'New Orleans Antique & Art Appraisals',
    hero:
      'Compare New Orleans and Metairie appraisal options, or start a signed online report for art, antiques, estates, insurance, donation, and personal property.',
    heading: 'New Orleans antique, art, and online report searches',
    body:
      'New Orleans queries include antiques appraisals and art appraisals in Louisiana. Local expertise can help with Creole decorative arts, colonial furniture, Mardi Gras material, and estate collections, while online appraisal is useful when photos and a signed report can answer the immediate need.',
    phrases: ['Antiques appraisals in New Orleans LA', 'Art appraisals in New Orleans LA', 'Signed online reports'],
  },
  {
    slug: 'tucson',
    city: 'Tucson',
    title: 'Tucson Antique & Art Appraisals | Signed Online Reports',
    description:
      'Compare Tucson appraisal experts and online report options for antiques, art, estate, insurance, and donation needs.',
    h1: 'Tucson Antique & Art Appraisals',
    hero:
      'Compare Tucson appraisal experts and online report options for antiques, art, estate, insurance, donation, and personal-property decisions.',
    heading: 'Tucson local appraisal and signed report options',
    body:
      'Tucson demand blends antique appraiser, art appraisal, estate, insurance, and donation intent. Compare local providers when inspection is useful, and choose an online signed report when photos, marks, condition notes, and provenance are enough.',
    phrases: ['Tucson antique appraisers', 'Tucson art appraisal', 'Signed online reports'],
  },
  {
    slug: 'seattle',
    city: 'Seattle',
    title: 'Seattle Antique & Art Appraisals | Signed Online Reports',
    description:
      'Compare Seattle antique and art appraisers, or upload photos for a signed online appraisal report for estate and insurance needs.',
    h1: 'Seattle Antique & Art Appraisals',
    hero:
      'Compare Seattle antique and art appraisers, or upload photos for a signed appraisal report for estate, insurance, donation, and collection decisions.',
    heading: 'Seattle art appraisal services and antique appraisers',
    body:
      'Seattle demand is led by art appraisal services. Use local specialists for art, Native American material, estate, and insurance work when hands-on review is required; use online appraisal when a photo-based signed report can move the decision forward.',
    phrases: ['Seattle art appraisal services', 'Seattle art appraisers', 'Signed appraisal report'],
  },
  {
    slug: 'boston',
    city: 'Boston',
    title: 'Boston Antique & Art Appraisals | Signed Online Reports',
    description:
      'Compare Boston antique and art appraisers, typical fees, and online signed report options for estate, insurance, and donation needs.',
    h1: 'Boston Antique & Art Appraisals',
    hero:
      'Compare Boston antique and art appraisers, typical fees, and signed online report options for estate, insurance, donation, and personal-property needs.',
    heading: 'Boston appraiser fees, local specialists, and signed reports',
    body:
      'Boston searches include antique appraisers, art appraisals, fees, estate, insurance, and donation needs. Compare local specialists when in-person review matters, and choose a signed online report when photos, marks, condition, and provenance can support the next decision.',
    phrases: ['Boston antique appraisers', 'Boston art appraisals', 'Signed online reports'],
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceMeta(html, attrName, attrValue, content) {
  const escapedAttrValue = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attrName}=["']${escapedAttrValue}["'])[^>]*>`, 'i');
  if (!pattern.test(html)) return html;
  return html.replace(pattern, `<meta ${attrName}="${attrValue}" content="${escapeHtml(content)}">`);
}

function buildBlock(page) {
  const phraseLinks = page.phrases
    .map(
      (phrase) =>
        `<a class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100 transition-colors" href="#local-appraisers">${escapeHtml(phrase)}</a>`,
    )
    .join('');
  return `${START}
    <section class="bg-emerald-50/70 border border-emerald-100 rounded-xl p-6 shadow-sm space-y-3" data-appraisily-gsc-location-refresh="static">
      <p class="text-sm font-semibold uppercase tracking-wide text-emerald-700">Search demand snapshot</p>
      <h2 class="text-2xl font-semibold text-gray-900">${escapeHtml(page.heading)}</h2>
      <p class="text-gray-700 leading-relaxed">${escapeHtml(page.body)}</p>
      <div class="flex flex-wrap gap-2">${phraseLinks}</div>
    </section>
  ${END}`;
}

function refreshMarkedBlock(html, block) {
  const markedPattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (markedPattern.test(html)) return html.replace(markedPattern, block);

  const target = '<section id="local-appraisers"';
  const index = html.indexOf(target);
  if (index === -1) return `${html}\n${block}\n`;
  return `${html.slice(0, index)}${block}\n      ${html.slice(index)}`;
}

function refreshAppShellAssetReferences(html) {
  return html.replace(
    /\/assets\/index-caoSrYsG\.js(?:\?v=[A-Za-z0-9._-]+)?/g,
    `/assets/index-caoSrYsG.js?v=${APP_SHELL_CACHE_BUSTER}`,
  );
}

function refreshPage(html, page) {
  const title = escapeHtml(page.title);
  const description = page.description;
  const hero = escapeHtml(page.hero);
  const signedReportHref = `https://appraisily.com/start?utm_source=directory&amp;utm_medium=hero&amp;utm_campaign=${page.slug}&amp;utm_content=signed_report`;
  const screenerHref = `https://appraisily.com/screener?utm_source=directory&amp;utm_medium=hero&amp;utm_campaign=${page.slug}&amp;utm_content=free_screener`;
  const sampleReportHref = `https://appraisily.com/sample-reports/professional?utm_source=directory&amp;utm_medium=hero_text&amp;utm_campaign=${page.slug}&amp;utm_content=sample_report`;

  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  next = replaceMeta(next, 'name', 'description', description);
  next = replaceMeta(next, 'property', 'og:title', page.title);
  next = replaceMeta(next, 'property', 'og:description', description);
  next = replaceMeta(next, 'name', 'twitter:title', page.title);
  next = replaceMeta(next, 'name', 'twitter:description', description);
  next = next.replace(
    /<h1 class="text-3xl md:text-4xl font-bold">[\s\S]*?<\/h1>/i,
    `<h1 class="text-3xl md:text-4xl font-bold">${escapeHtml(page.h1)}</h1>`,
  );
  next = next.replace(
    /(<h1 class="text-3xl md:text-4xl font-bold">[\s\S]*?<\/h1>\s*)<p class="text-lg text-blue-50\/90 leading-relaxed">[\s\S]*?<\/p>/i,
    `$1<p class="text-lg text-blue-50/90 leading-relaxed">${hero}</p>`,
  );
  next = next.replace(
    /<div class="flex flex-wrap gap-3 pt-2">\s*<a href="[^"]*\/screener[^"]*" class="([^"]*bg-white[^"]*)">\s*[\s\S]*?\s*<\/a>\s*<a href="#local-appraisers" class="([^"]*)">\s*[\s\S]*?\s*<\/a>\s*<\/div>/i,
    `<div class="flex flex-wrap gap-3 pt-2">
          <a href="${signedReportHref}" class="$1">
            Upload photos for a signed appraisal
          </a>
          <a href="${screenerHref}" class="$2">
            Try the free photo screener
          </a>
        </div>`,
  );
  next = next.replace(
    /<p class="text-sm text-blue-50\/85">\s*Ready to buy\? <a class="underline hover:no-underline" href="[^"]*">Start a paid appraisal<\/a>\s*<\/p>/i,
    `<p class="text-sm text-blue-50/85">
          Need proof first? <a class="underline hover:no-underline" href="${sampleReportHref}">View sample report</a>
        </p>`,
  );
  next = refreshMarkedBlock(next, buildBlock(page));
  return refreshAppShellAssetReferences(next);
}

for (const page of PAGES) {
  const filePath = path.join(PUBLIC_DIR, 'location', page.slug, 'index.html');
  const html = await fs.readFile(filePath, 'utf8');
  const next = refreshPage(html, page);
  await fs.writeFile(filePath, next, 'utf8');
  console.log(`[gsc-location-refresh] updated ${page.slug}`);
}
