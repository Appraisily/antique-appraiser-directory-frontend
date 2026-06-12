#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public_site');
const START = '<!-- appraisily-gsc-location-refresh:start -->';
const END = '<!-- appraisily-gsc-location-refresh:end -->';

const PAGES = [
  {
    slug: 'des-moines',
    city: 'Des Moines',
    title: 'Des Moines Art Appraisals & Antique Appraisers | Personal Property Reports',
    description:
      'Compare Des Moines art appraisals, antique appraisers, and personal-property appraisal options for estate, donation, insurance, and online reports.',
    h1: 'Des Moines Art Appraisals & Antique Appraisers',
    hero:
      'Compare Des Moines specialists for art appraisals, antique appraisals, and personal-property reports, then choose the right fit for donation, estate, insurance, or faster online review.',
    heading: 'Art appraisals and personal-property reports in Des Moines',
    body:
      'GSC demand is strongest around Des Moines art appraisals, art appraisers, and personal-property appraisers. Use local providers when a physical inspection is useful, and use Appraisily when photos, provenance, condition notes, and a written online report are enough for the next decision.',
    phrases: ['Des Moines art appraisals', 'Des Moines personal property appraisers', 'Des Moines Iowa art appraisals'],
  },
  {
    slug: 'new-orleans',
    city: 'New Orleans',
    title: 'New Orleans Antique Appraisers & Art Appraisals | Estate, Insurance, Donation',
    description:
      'Compare New Orleans antique appraisers, antiques appraisals, and art appraisals for estate, insurance, donation, personal property, and online support.',
    h1: 'New Orleans Antique Appraisers & Art Appraisals',
    hero:
      'Compare New Orleans specialists for antiques appraisals, art appraisals, estate, insurance, donation, and personal-property needs.',
    heading: 'New Orleans antique and art appraisal searches',
    body:
      'New Orleans queries include antiques appraisals and art appraisals in Louisiana. Local expertise can help with Creole decorative arts, colonial furniture, Mardi Gras material, and estate collections, while online appraisal is useful for a fast first screen.',
    phrases: ['Antiques appraisals in New Orleans LA', 'Art appraisals in New Orleans LA', 'New Orleans antique appraisers'],
  },
  {
    slug: 'columbus',
    city: 'Columbus',
    title: 'Columbus Antique Appraisers | Donation, Art & Personal Property Reports',
    description:
      'Compare Columbus antique appraisers for donation, art, estate, insurance, and personal-property reports. Review local experts and online appraisal options.',
    h1: 'Columbus Antique Appraisers for Donation, Art & Estate Needs',
    hero:
      'Find Columbus antique and art appraisers for donation documentation, estate review, insurance records, and personal-property valuation, or start with faster online appraisal support.',
    heading: 'Columbus donation, antique, and art appraisal services',
    body:
      'Columbus pages are earning impressions for donation appraiser, antique appraiser, and art appraiser terms. Match the appraisal to the use case: donation paperwork, estate distribution, insurance scheduling, resale pricing, or a faster online valuation.',
    phrases: ['Columbus donation appraiser', 'Columbus antique appraiser', 'Columbus art appraiser'],
  },
  {
    slug: 'aspen',
    city: 'Aspen',
    title: 'Aspen Antique Appraisers & Art Appraisers | Estate, Insurance, Donation',
    description:
      'Compare Aspen antique appraisers and art appraisers for estate, insurance, donation, art, and personal-property valuation. Review local and online options.',
    h1: 'Aspen Antique Appraisers & Art Appraisers',
    hero:
      'Compare Aspen antique and art appraisal options for estate, insurance, donation, and high-value personal-property needs, then choose local or online support.',
    heading: 'Aspen antique and art appraiser searches',
    body:
      'Aspen searches cluster around antique appraisers and art appraisers, often for estate, insurance, or collection decisions. Compare local specialists for high-value items, then use an online appraisal when you need a faster first read before scheduling an appointment.',
    phrases: ['Aspen antique appraisers', 'Aspen art appraisers'],
  },
  {
    slug: 'baltimore',
    city: 'Baltimore',
    title: 'Baltimore Antique Appraisers | Furniture, Maryland Estates & Art',
    description:
      'Compare Baltimore antique appraisers for Maryland estates, antique furniture, silver, art, donation, insurance, and online appraisal options.',
    h1: 'Baltimore Antique Appraisers for Furniture, Estates & Art',
    hero:
      'Compare Baltimore specialists for antique furniture, fine art, silver, estate, insurance, donation, and personal-property needs, then choose local or online appraisal support.',
    heading: 'Baltimore antique furniture, estate, and art appraisals',
    body:
      'Baltimore demand includes Maryland antique appraisers and antique furniture appraisal searches. Furniture, silver, and Chesapeake-region estate material usually benefit from specialist review, especially when condition, provenance, or donation documentation matters.',
    phrases: ['Antique appraisers in Baltimore Maryland', 'Antique furniture appraisal Maryland', 'Baltimore antique appraisals'],
  },
  {
    slug: 'cincinnati',
    city: 'Cincinnati',
    title: 'Cincinnati Personal Property Appraisers | Tax Donation, Antique & Art',
    description:
      'Compare Cincinnati personal property appraisers for tax donation, antique, art, estate, and insurance valuation needs. Review local and online options.',
    h1: 'Cincinnati Personal Property Appraisers for Tax Donation & Antiques',
    hero:
      'Review Cincinnati appraisal options for antiques, art, personal property, and tax donation documentation, then choose local in-person service or online appraisal support.',
    heading: 'Cincinnati personal-property and tax donation appraisals',
    body:
      'Cincinnati searchers frequently look for personal-property appraisers and tax donation appraisers. Clarify whether you need estate planning, insurance scheduling, charitable donation support, or resale guidance before choosing the provider.',
    phrases: ['Cincinnati personal property appraisers', 'Cincinnati tax donation appraisers', 'Cincinnati antique appraisers'],
  },
  {
    slug: 'cleveland',
    city: 'Cleveland',
    title: 'Cleveland Antique Appraiser Options | Donation, Estate & Art Appraisals',
    description:
      'Compare Cleveland antique appraiser options for donation, estate, insurance, art, and personal-property valuation. Review local experts and online support.',
    h1: 'Cleveland Antique Appraiser Options',
    hero:
      'Compare Cleveland specialists for antique, art, donation, estate, and insurance appraisals, then choose local in-person service or a faster online written appraisal.',
    heading: 'Cleveland donation and antique appraisal needs',
    body:
      'Cleveland queries show donation and antique appraiser intent. When the item may be used for donation, estate, or insurance records, keep photos, measurements, maker marks, condition notes, and any ownership history together before requesting a report.',
    phrases: ['Cleveland donation appraiser', 'Cleveland antique appraiser', 'Cleveland art appraisers'],
  },
  {
    slug: 'chicago',
    city: 'Chicago',
    title: 'Chicago Antique Appraisers & Art Appraisals | Estate, Donation, Insurance',
    description:
      'Compare Chicago antique appraisers and art appraisal options for estate, donation, insurance, furniture, fine art, and online written reports.',
    h1: 'Chicago Antique Appraisers & Art Appraisals',
    hero:
      'Find antique and art appraisers near you in Chicago for estate, donation, insurance, furniture, and fine-art valuation needs.',
    heading: 'Chicago estate, furniture, and fine-art appraisal searches',
    body:
      'Chicago searches still show broad near-me and art-appraisal intent. Use local specialists when a hands-on inspection matters, and use online appraisal when photos and supporting details can move the decision forward faster.',
    phrases: ['Chicago antique appraisers', 'Chicago art appraisal services', 'Antique appraisers Chicago IL'],
  },
  {
    slug: 'seattle',
    city: 'Seattle',
    title: 'Seattle Art Appraisal Services & Antique Appraisers | Estate & Insurance',
    description:
      'Compare Seattle art appraisal services and antique appraisers for estate, insurance, donation, resale, and personal-property valuation. Review local and online options.',
    h1: 'Seattle Art Appraisal Services & Antique Appraisers',
    hero:
      'Find Seattle appraisal specialists for antiques, art, and collections, then choose local in-person or online valuation support.',
    heading: 'Seattle art appraisal services and antique appraisers',
    body:
      'Seattle demand is led by art appraisal services. Use local specialists for art, Native American material, estate, and insurance work when hands-on review is required; use online appraisal when a photo-based written report can move the decision forward.',
    phrases: ['Seattle art appraisal services', 'Seattle art appraisers', 'Seattle antique appraisers'],
  },
  {
    slug: 'atlanta',
    city: 'Atlanta',
    title: 'Atlanta Antique Appraisers & Art Appraisal Services | Estate & Donation',
    description:
      'Compare Atlanta antique appraisers and art appraisal services for estate, donation, insurance, furniture, collectibles, and online appraisal support.',
    h1: 'Atlanta Antique Appraisers & Art Appraisal Services',
    hero:
      'Review Atlanta appraisal options for antiques, art, furniture, estate, donation, and insurance needs before choosing local service or faster online review.',
    heading: 'Atlanta estate, donation, and art appraisal options',
    body:
      'Atlanta appraisal searches often mix antique, art, estate, and donation intent. Start by matching the provider to the item category and report purpose, then choose local inspection or online documentation based on timeline and risk.',
    phrases: ['Atlanta antique appraisers', 'Atlanta art appraisal services', 'Atlanta donation appraisals'],
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
    <section class="bg-emerald-50/70 border border-emerald-100 rounded-xl p-6 shadow-sm space-y-3">
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

function refreshPage(html, page) {
  const title = escapeHtml(page.title);
  const description = page.description;
  const hero = escapeHtml(page.hero);

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
  return refreshMarkedBlock(next, buildBlock(page));
}

for (const page of PAGES) {
  const filePath = path.join(PUBLIC_DIR, 'location', page.slug, 'index.html');
  const html = await fs.readFile(filePath, 'utf8');
  const next = refreshPage(html, page);
  await fs.writeFile(filePath, next, 'utf8');
  console.log(`[gsc-location-refresh] updated ${page.slug}`);
}
