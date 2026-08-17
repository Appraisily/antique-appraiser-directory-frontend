#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const ART_ORIGIN = 'https://art-appraisers-directory.appraisily.com';
const ANTIQUE_ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const DEFAULT_SITEMAP = path.join(ROOT, 'public_site/sitemap.xml');
const PROFILE_SLUGS = new Set([
  'afp-art-consulting-llc-fine-art-consulting-appraisals-research-writing-and-collections-man',
  'heidi-vaughan-ma-isa-am',
  'open-to-the-public',
  'sarah-ann-wilson-art-services',
  'st-lifer-art-inc-international-art-appraiser',
]);
const CONSOLIDATED_DIRECTORY_BRIDGE = `<section class="article-directory-bridge" data-enhancement="article-directory-bridge" data-analytics-impression="article_directory_view" data-analytics-location="inline-directory">
  <div class="article-directory-bridge__header">
    <p class="article-directory-bridge__eyebrow">Continue your valuation journey</p>
    <h2 class="article-directory-bridge__title">Find the right local appraisal specialist</h2>
    <p class="article-directory-bridge__body">Use one directory for antique, fine-art, estate, and personal-property appraisal specialists.</p>
  </div>
  <div class="article-directory-bridge__cards">
    <article class="article-directory-card">
      <p class="article-directory-card__eyebrow">Antique and fine-art specialists</p>
      <h3 class="article-directory-card__title">Browse the Antique &amp; Art Appraiser Directory</h3>
      <p class="article-directory-card__body">Compare 244 published profiles across 86 public location pages. Confirm current credentials, scope, fees, and availability directly with the provider.</p>
      <div class="article-directory-card__actions">
        <a class="article-directory-card__action" href="https://antique-appraiser-directory.appraisily.com/" data-analytics-event="article_directory_click" data-analytics-location="inline-directory" data-directory="antique-directory">Browse appraisal specialists</a>
      </div>
    </article>
  </div>
</section>`;

const options = {
  publicDir: path.join(ROOT, 'public_site'),
  baselineDir: null,
  sitemapPath: DEFAULT_SITEMAP,
  receiptPath: path.join(ROOT, 'data/art-directory-consolidation-receipt.json'),
  removeAntiqueCrosslinks: false,
  write: false,
};
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (token === '--write') options.write = true;
  else if (token === '--remove-antique-crosslinks') options.removeAntiqueCrosslinks = true;
  else if (token === '--public-dir') options.publicDir = path.resolve(process.argv[++index]);
  else if (token === '--baseline-dir') options.baselineDir = path.resolve(process.argv[++index]);
  else if (token === '--sitemap') options.sitemapPath = path.resolve(process.argv[++index]);
  else if (token === '--receipt') options.receiptPath = path.resolve(process.argv[++index]);
  else throw new Error(`Unknown argument: ${token}`);
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function walkHtml(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(absolute));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(absolute);
  }
  return files;
}

async function writeDetachedAtomic(filename, contents) {
  const temporary = path.join(
    path.dirname(filename),
    `.${path.basename(filename)}.art-consolidation-${process.pid}-${Date.now()}.tmp`,
  );
  let mode;
  try {
    mode = (await fs.stat(filename)).mode;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await fs.writeFile(temporary, contents, {
      encoding: 'utf8',
      ...(mode ? { mode } : {}),
    });
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

const sitemapText = await fs.readFile(options.sitemapPath, 'utf8');
const publishedUrls = new Set(
  [...sitemapText.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((match) => match[1].trim()),
);
const publishedLocationPaths = new Set(
  [...publishedUrls]
    .map((value) => new URL(value))
    .filter((url) => /^\/location\/[^/]+\/$/.test(url.pathname))
    .map((url) => url.pathname),
);
function destinationFor(source) {
  const parsed = new URL(source.replace(/&amp;/g, '&'));
  const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  if (pathname === '/') return `${ANTIQUE_ORIGIN}/`;
  if (pathname === '/location/') return `${ANTIQUE_ORIGIN}/location/`;
  if (/^\/location\/[^/]+\/$/.test(pathname)) {
    return publishedLocationPaths.has(pathname)
      ? `${ANTIQUE_ORIGIN}${pathname}`
      : `${ANTIQUE_ORIGIN}/location/`;
  }
  const profileMatch = pathname.match(/^\/appraiser\/([^/]+)\/$/);
  if (profileMatch && PROFILE_SLUGS.has(profileMatch[1])) {
    return `${ART_ORIGIN}${pathname}`;
  }
  throw new Error(`No reviewed consolidation destination for ${source}`);
}

function normalizeArticleCopy(html) {
  return html
    .replace(
      /Need a local expert\? Browse our <a[^>]*href=["']https:\/\/antique-appraiser-directory\.appraisily\.com\/["'][^>]*>Art Appraisers Directory<\/a> or <a[^>]*href=["']https:\/\/antique-appraiser-directory\.appraisily\.com\/["'][^>]*>Antique Appraisers Directory<\/a>\./g,
      'Need a local expert? Browse the <a href="https://antique-appraiser-directory.appraisily.com/">Antique &amp; Art Appraiser Directory</a>.',
    )
    .replace(
      /href=["']href=["'](https:\/\/antique-appraiser-directory\.appraisily\.com\/[^"']*)["']/g,
      'href="$1"',
    )
    .replace(/>Art Appraisers Directory<\/a>/g, '>Antique &amp; Art Appraiser Directory</a>')
    .replace(/data-directory=["']art-directory["']/g, 'data-directory="antique-directory"')
    .replace(/utm_campaign=directory_cards_art/g, 'utm_campaign=directory_cards_consolidated')
    .replace(
      /<section\b(?=[^>]*\bclass=["'][^"']*\barticle-directory-bridge\b[^"']*["'])[\s\S]*?<\/section>/gi,
      (section) => {
        const destinationLinks = section.match(
          /href=["']https:\/\/antique-appraiser-directory\.appraisily\.com\/[^"']*["']/g,
        ) || [];
        return destinationLinks.length > 1 ? CONSOLIDATED_DIRECTORY_BRIDGE : section;
      },
    );
}

const changes = [];
const conflicts = [];
for (const filename of await walkHtml(options.publicDir)) {
  const before = await fs.readFile(filename, 'utf8');
  const relative = path.relative(options.publicDir, filename);
  if (options.baselineDir) {
    const baselinePath = path.join(options.baselineDir, relative);
    let baseline;
    try {
      baseline = await fs.readFile(baselinePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      conflicts.push({ file: relative, reason: 'missing_baseline' });
      continue;
    }
    if (sha256(before) !== sha256(baseline)) {
      conflicts.push({
        file: relative,
        reason: 'candidate_differs_from_baseline',
        candidateSha256: sha256(before),
        baselineSha256: sha256(baseline),
      });
      continue;
    }
  }

  const replacements = [];
  let after = before.replace(
    /href=(["'])(https:\/\/art-appraisers-directory\.appraisily\.com\/[^"']*)\1/g,
    (match, quote, source) => {
      const destination = destinationFor(source);
      replacements.push({ source: source.replace(/&amp;/g, '&'), destination });
      return `href=${quote}${destination}${quote}`;
    },
  );
  after = normalizeArticleCopy(after);
  let removedCrosslinks = 0;
  if (options.removeAntiqueCrosslinks) {
    after = after.replace(
      /\s*<section\b(?=[^>]*\b(?:data-directory-crosslink=["']antique-to-art["']|data-art-directory-recovery-links=["'][^"']*["']))[\s\S]*?<\/section>/gi,
      () => {
        removedCrosslinks += 1;
        return '';
      },
    );
  }
  if (after === before) continue;
  changes.push({
    file: relative,
    beforeSha256: sha256(before),
    afterSha256: sha256(after),
    linksReplaced: replacements.length,
    removedCrosslinks,
    replacements,
  });
  if (options.write) await writeDetachedAtomic(filename, after);
}

const receipt = {
  version: 1,
  action: options.write ? 'written' : 'preview',
  sourceOrigin: ART_ORIGIN,
  destinationOrigin: ANTIQUE_ORIGIN,
  publicDir: options.publicDir,
  baselineDir: options.baselineDir,
  sitemapPath: options.sitemapPath,
  sitemapSha256: sha256(sitemapText),
  filesChanged: changes.length,
  linksReplaced: changes.reduce((sum, change) => sum + change.linksReplaced, 0),
  crosslinkSectionsRemoved: changes.reduce((sum, change) => sum + change.removedCrosslinks, 0),
  conflicts: conflicts.length,
  changes,
  conflictRecords: conflicts,
};
if (options.write) {
  await fs.mkdir(path.dirname(options.receiptPath), { recursive: true });
  await writeDetachedAtomic(options.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}
console.log(JSON.stringify({
  ...receipt,
  changes: receipt.changes.slice(0, 10),
  changeRecordsTruncated: receipt.changes.length > 10,
}, null, 2));
if (conflicts.length) process.exitCode = 2;
