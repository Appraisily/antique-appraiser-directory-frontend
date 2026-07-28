#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const CITY_PATH = '/location/houston/';
const GUIDE_PATH = '/location/houston/appraisal-guide/';

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function read(root, relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required artifact: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function extractAttribute(html, tagName, attributeName, attributeValue, targetAttribute) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];
  const match = tags.find((tag) => {
    const attribute = tag.match(new RegExp(`\\b${attributeName}=(?:"([^"]*)"|'([^']*)')`, 'i'));
    return (attribute?.[1] ?? attribute?.[2]) === attributeValue;
  });
  if (!match) return null;
  const target = match.match(new RegExp(`\\b${targetAttribute}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return target?.[1] ?? target?.[2] ?? null;
}

function extractJsonLd(html) {
  const values = [];
  const pattern = /<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    values.push(JSON.parse(match[1]));
  }
  return values;
}

function collectExactUrls(value, urls = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectExactUrls(item, urls);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'url' || key === 'item') && typeof item === 'string') urls.push(item);
      collectExactUrls(item, urls);
    }
  }
  return urls;
}

function hasSitemapUrl(xml, url) {
  return xml.includes(`<loc>${url}</loc>`);
}

const publicDir = path.resolve(readArgument('--public-dir', 'public_site'));
const homepage = read(publicDir, 'index.html');
const city = read(publicDir, 'location/houston/index.html');
const guide = read(publicDir, 'location/houston/appraisal-guide/index.html');
const sitemap = read(publicDir, 'sitemap.xml');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const cityUrl = `${ORIGIN}${CITY_PATH}`;
const guideUrl = `${ORIGIN}${GUIDE_PATH}`;
const homepageStructuredUrls = extractJsonLd(homepage).flatMap((entry) => collectExactUrls(entry));
const priorityCities = homepage.match(/<p\b[^>]*>[\s\S]*?<strong\b[^>]*>Priority cities:<\/strong>[\s\S]*?<\/p>/i)?.[0] ?? '';

check(
  extractAttribute(city, 'meta', 'name', 'robots', 'content')
    ?.toLowerCase()
    .split(',')
    .map((value) => value.trim())
    .includes('noindex'),
  'Houston city page must remain noindex.',
);
check(
  extractAttribute(city, 'link', 'rel', 'canonical', 'href') === cityUrl,
  'Houston city page must remain self-canonical.',
);
check(!hasSitemapUrl(sitemap, cityUrl), 'Houston city page must remain absent from the sitemap.');
check(
  !homepageStructuredUrls.includes(cityUrl),
  'Homepage structured data must not promote the noindex Houston city page.',
);
check(
  !new RegExp(`href=(?:"${CITY_PATH}"|'${CITY_PATH}')`, 'i').test(priorityCities),
  'Homepage priority-city links must not promote the noindex Houston city page.',
);
check(
  new RegExp(`href=(?:"${GUIDE_PATH}"|'${GUIDE_PATH}')`, 'i').test(homepage),
  'Homepage must provide a clearly labeled path to the indexable Houston appraisal guide.',
);
check(
  extractAttribute(guide, 'link', 'rel', 'canonical', 'href') === guideUrl,
  'Houston appraisal guide must remain self-canonical.',
);
check(
  !extractAttribute(guide, 'meta', 'name', 'robots', 'content')?.toLowerCase().includes('noindex'),
  'Houston appraisal guide must remain indexable.',
);
check(hasSitemapUrl(sitemap, guideUrl), 'Houston appraisal guide must remain in the sitemap.');
check(
  guide.includes('data-appraisily-houston-held-disclosure="1"')
    && guide.includes('Inclusion is not verification.'),
  'Houston appraisal guide must disclose that held city records are not verified.',
);

if (failures.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    publicDir,
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  publicDir,
  state: 'held',
  city: {
    url: cityUrl,
    robots: 'noindex, follow',
    inSitemap: false,
    homepagePromoted: false,
  },
  guide: {
    url: guideUrl,
    indexable: true,
    inSitemap: true,
    homepageLinked: true,
    unverifiedRecordDisclosure: true,
  },
}, null, 2));
