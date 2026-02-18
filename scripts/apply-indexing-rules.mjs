#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { looksLikeAiJunk } from './utils/text-sanitize.js';
import { INDEXABLE_LOCATION_SLUG_SET, POPULAR_LOCATION_SLUGS } from './utils/indexable-locations.js';
import { loadVerifiedProviders } from './utils/verified-providers.mjs';

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    publicDir: path.resolve(process.cwd(), 'public_site'),
    dryRun: false,
    maxIndexableAppraisers: 120,
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
      case '--max-indexable-appraisers':
        {
          const value = Number.parseInt(String(readValue() || '').trim(), 10);
          if (Number.isFinite(value) && value >= 0) options.maxIndexableAppraisers = value;
        }
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
    const suspicious = looksLikeAiJunk(block);
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
        const hasReviews = !suspicious && Number.isFinite(reviewCount) && reviewCount > 0 && reviewCount < 5000;

        const telephone = String(item.telephone ?? '').trim();
        const email = String(item.email ?? '').trim();
        const digits = telephone.replace(/[^\d+]/g, '');
        const telephoneOk = digits.length >= 10 && digits.length <= 15;
        const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/example/i.test(email);
        const hasContact = !suspicious && Boolean((telephone && telephoneOk) || (email && emailOk));

        return { hasReviews, hasContact, suspicious };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function applyDirectoryBrandingFixes(html) {
  // Keep changes narrow: avoid broad "Art" -> "Antique" replacements, because the directory now
  // intentionally targets both art + antique appraisal queries.
  let updated = html;
  updated = updated.replaceAll('Art Appraiser Directory', 'Antique & Art Appraiser Directory');
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

async function buildTrustedAppraiserSlugSet(maxCount) {
  const loaded = await loadVerifiedProviders();
  const providers = Array.isArray(loaded?.providers) ? loaded.providers : [];
  if (!providers.length || maxCount <= 0) return new Set();

  const popularityRank = new Map(
    POPULAR_LOCATION_SLUGS.map((slug, index) => [slug, index + 1]),
  );

  const ranked = providers
    .filter((provider) => provider?.slug)
    .map((provider) => {
      const trustScore = provider.verified ? 3 : provider.listed ? 1 : 0;
      const hasWebsite = provider.website ? 1 : 0;
      const hasPhone = provider.phone ? 1 : 0;
      const hasEmail = provider.email ? 1 : 0;
      const specialtiesCount = Array.isArray(provider.specialties) ? provider.specialties.length : 0;
      const servicesCount = Array.isArray(provider.services) ? provider.services.length : 0;
      const locationRank = popularityRank.get(String(provider.locationSlug || '').trim()) ?? 9999;
      const verifiedAt = String(provider?.verification?.verifiedAt || '1900-01-01');
      return {
        slug: String(provider.slug).trim(),
        trustScore,
        hasWebsite,
        hasPhone,
        hasEmail,
        specialtiesCount,
        servicesCount,
        locationRank,
        verifiedAt,
      };
    })
    .sort((a, b) => {
      if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
      if (a.locationRank !== b.locationRank) return a.locationRank - b.locationRank;
      if (b.hasWebsite !== a.hasWebsite) return b.hasWebsite - a.hasWebsite;
      if (b.hasPhone !== a.hasPhone) return b.hasPhone - a.hasPhone;
      if (b.hasEmail !== a.hasEmail) return b.hasEmail - a.hasEmail;
      if (b.specialtiesCount !== a.specialtiesCount) return b.specialtiesCount - a.specialtiesCount;
      if (b.servicesCount !== a.servicesCount) return b.servicesCount - a.servicesCount;
      if (b.verifiedAt !== a.verifiedAt) return b.verifiedAt.localeCompare(a.verifiedAt);
      return a.slug.localeCompare(b.slug);
    });

  const selected = ranked.slice(0, maxCount).map((entry) => entry.slug);
  return new Set(selected);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const publicDir = options.publicDir;
  const trustedAppraiserSlugSet = await buildTrustedAppraiserSlugSet(options.maxIndexableAppraisers);

  const stats = {
    publicDir,
    dryRun: options.dryRun,
    maxIndexableAppraisers: options.maxIndexableAppraisers,
    trustedAppraiserCandidates: trustedAppraiserSlugSet.size,
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
      if (slug === 'index.html') {
        robots = 'index, follow';
        stats.indexableLocation += 1;
      } else if (INDEXABLE_LOCATION_SLUG_SET.has(slug)) {
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
        const appraiserSlug = rel.split('/')[1] || '';
        if (trustedAppraiserSlugSet.has(appraiserSlug)) {
          robots = 'index, follow';
          stats.indexableAppraiser += 1;
        } else {
          robots = 'noindex, follow';
          stats.noindexAppraiserLowValue += 1;
        }
      }

      const branded = applyDirectoryBrandingFixes(updated);
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
