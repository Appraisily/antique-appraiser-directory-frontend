#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Data-driven allowlist (top /location/* pages by GSC impressions over 90 days).
// Source snapshot: /srv/manager/seo/antique-directory-pages-90d.csv (generated 2025-12-26).
const INDEXABLE_LOCATION_SLUGS = new Set([
  'kansas-city',
  'des-moines',
  'seattle',
  'philadelphia',
  'columbus',
  'denver',
  'milwaukee',
  'tucson',
  'cincinnati',
  'cleveland',
  'baltimore',
  'chicago',
  'honolulu',
  'oklahoma-city',
  'tampa',
  'ottawa',
  'san-antonio',
  'pittsburgh',
  'las-vegas',
  'richmond',
  'toledo',
  'indianapolis',
  'new-york',
  'tulsa',
  'louisville',
  'minneapolis',
  'detroit',
  'fort-worth',
  'calgary',
  'austin',
  'nashville',
  'atlanta',
  'hamilton',
  'kelowna',
  'palm-beach',
  'st-louis',
  'orlando',
  'aspen',
  'portland',
  'st-paul',
  'edmonton',
  'washington-dc',
  'omaha',
  'toronto',
  'sacramento',
  'virginia-beach',
  'saskatoon',
  'los-angeles',
  'buffalo',
  'lexington',
  'memphis',
  'jacksonville',
  'san-francisco',
  'vancouver',
  'baton-rouge',
  'halifax',
  'wichita',
  'charleston',
  'providence',
  'rochester',
  'little-rock',
  'san-diego',
  'san-jose',
  'st-john-s',
  'kitchener',
  'sudbury',
  'colorado-springs',
  'victoria',
  'albuquerque',
  'miami',
  'anchorage',
  'birmingham',
  'fredericton',
  'long-beach',
  'santa-fe',
  'quebec-city',
  'raleigh',
  'oakland',
  'montreal',
  'moncton',
  'norfolk',
  'savannah',
  'charlottetown',
  'fort-lauderdale',
  'arlington',
  'whitehorse',
  'el-paso',
  'boston',
  'thunder-bay',
  'salt-lake-city',
  'london',
  'new-orleans',
]);

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    publicDir: path.resolve(process.cwd(), 'public_site'),
    dryRun: false,
  };

  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : args.shift());

    switch (flag) {
      case '--public-dir':
        options.publicDir = path.resolve(process.cwd(), readValue());
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  return options;
}

function setMetaRobots(html, robotsContent) {
  const robotsTagRe = /<meta\s+name=(['"])robots\1[^>]*>/i;
  if (robotsTagRe.test(html)) {
    return html.replace(robotsTagRe, (tag) => {
      if (/content=/i.test(tag)) {
        return tag.replace(/content=(['"])(.*?)\1/i, `content="${robotsContent}"`);
      }
      return tag.replace(/\s*\/?>\s*$/, (suffix) => ` content="${robotsContent}"${suffix}`);
    });
  }

  const headCloseIdx = html.search(/<\/head>/i);
  if (headCloseIdx === -1) return html;

  const insert = `  <meta name="robots" content="${robotsContent}" />\n`;
  return `${html.slice(0, headCloseIdx)}${insert}${html.slice(headCloseIdx)}`;
}

function hasMetaRefresh(html) {
  return /<meta\s+http-equiv=(['"])refresh\1/i.test(html);
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type=(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const content = String(match[2] || '').trim();
    if (!content) continue;
    blocks.push(content);
  }
  return blocks;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function analyzeAppraiserJsonLd(html) {
  const blocks = extractJsonLdBlocks(html);
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      const items = toArray(parsed).flatMap((entry) => toArray(entry));
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const type = item['@type'];
        if (!type) continue;
        if (type !== 'ProfessionalService' && type !== 'LocalBusiness') continue;

        const reviewCountRaw = item.aggregateRating?.reviewCount ?? item.aggregateRating?.ratingCount;
        const reviewCount = Number.parseInt(String(reviewCountRaw ?? '').trim(), 10);
        const hasReviews = Number.isFinite(reviewCount) && reviewCount > 0;

        const telephone = String(item.telephone ?? '').trim();
        const email = String(item.email ?? '').trim();
        const hasContact = Boolean(telephone || email);

        return { hasReviews, hasContact };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function applyAntiqueBrandingFixes(html) {
  let updated = html;
  updated = updated.replaceAll('Expert Art Valuation Services', 'Expert Antique Valuation Services');
  updated = updated.replaceAll('Art Appraiser', 'Antique Appraiser');
  updated = updated.replaceAll('art appraisal services', 'antique appraisal services');
  updated = updated.replaceAll('Need Art Appraisal Services?', 'Need Antique Appraisal Services?');
  updated = updated.replaceAll('Art Appraisers in ', 'Antique Appraisers in ');
  return updated;
}

async function walkDir(root, visitor) {
  const queue = [root];
  while (queue.length) {
    const current = queue.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile()) await visitor(fullPath);
    }
  }
}

function toPosix(p) {
  return p.replace(/\\\\/g, '/');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const publicDir = options.publicDir;

  const stats = {
    publicDir,
    dryRun: options.dryRun,
    scanned: 0,
    changed: 0,
    noindexLocation: 0,
    indexableLocation: 0,
    noindexAppraiserLowValue: 0,
    noindexLegacyRedirect: 0,
    indexableAppraiser: 0,
    brandingFixes: 0,
  };

  await walkDir(publicDir, async (filePath) => {
    if (!filePath.endsWith('.html')) return;
    stats.scanned += 1;

    const rel = toPosix(path.relative(publicDir, filePath));
    const isLocationPage = rel.startsWith('location/') && rel.endsWith('/index.html');
    const isAppraiserPage = rel.startsWith('appraiser/') && rel.endsWith('/index.html');

    if (!isLocationPage && !isAppraiserPage) return;

    const original = await fs.readFile(filePath, 'utf8');
    let updated = original;
    let robots = null;

    if (isLocationPage) {
      const slug = rel.split('/')[1] || '';
      if (INDEXABLE_LOCATION_SLUGS.has(slug)) {
        robots = 'index, follow';
        stats.indexableLocation += 1;
      } else {
        robots = 'noindex, follow';
        stats.noindexLocation += 1;
      }
    } else if (isAppraiserPage) {
      if (hasMetaRefresh(updated)) {
        robots = 'noindex, follow';
        stats.noindexLegacyRedirect += 1;
      } else {
        const signals = analyzeAppraiserJsonLd(updated);
        if (signals && !signals.hasContact && !signals.hasReviews) {
          robots = 'noindex, follow';
          stats.noindexAppraiserLowValue += 1;
        } else {
          robots = 'index, follow';
          stats.indexableAppraiser += 1;
        }
      }

      const branded = applyAntiqueBrandingFixes(updated);
      if (branded !== updated) {
        updated = branded;
        stats.brandingFixes += 1;
      }
    }

    if (robots) {
      updated = setMetaRobots(updated, robots);
    }

    if (updated !== original) {
      stats.changed += 1;
      if (!options.dryRun) await fs.writeFile(filePath, updated, 'utf8');
    }
  });

  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error('[apply-indexing-rules] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
