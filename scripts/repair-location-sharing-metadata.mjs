#!/usr/bin/env node
/**
 * Point city pages at branded share cards and add listing image dimensions.
 *
 * City og:image must not be placeholder.jpg or a listing portrait. That would
 * make one appraiser look featured. Share cards live at
 * /assets/og/location-{slug}.jpg.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const CITY_NAME_OVERRIDES = new Map([
  ['st-john-s', "St. John's"],
  ['st-louis', 'St. Louis'],
  ['st-paul', 'St. Paul'],
  ['washington-dc', 'Washington, DC'],
]);
const SVG_WIDTH = '1200';
const SVG_HEIGHT = '900';

function decode(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function titleCaseSlug(slug) {
  if (CITY_NAME_OVERRIDES.has(slug)) return CITY_NAME_OVERRIDES.get(slug);
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseArgs(argv) {
  const options = {
    publicDir: path.resolve(process.cwd(), 'public_site'),
    write: false,
    check: false,
  };
  const args = [...argv];
  while (args.length) {
    const [flag, inline] = String(args.shift() || '').split('=');
    const value = () => inline ?? args.shift();
    if (flag === '--public-dir') options.publicDir = path.resolve(process.cwd(), String(value() || ''));
    else if (flag === '--write') options.write = true;
    else if (flag === '--check') options.check = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  if (options.write === options.check) {
    throw new Error('Choose exactly one of --write or --check');
  }
  return options;
}

function metaTag(attr, key, content) {
  return `<meta ${attr}="${key}" content="${escape(content)}">`;
}

function upsertMeta(html, attr, key, content) {
  const pattern = new RegExp(
    `<meta\\b[^>]*\\b${attr}=["']${key}["'][^>]*>`,
    'i',
  );
  const tag = metaTag(attr, key, content);
  if (pattern.test(html)) {
    return html.replace(pattern, tag);
  }
  const canonical = html.match(/\s*<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
  if (canonical) {
    return html.replace(canonical, `${canonical}\n    ${tag}`);
  }
  const headClose = html.match(/\s*<\/head>/i)?.[0];
  if (!headClose) {
    throw new Error('Unable to insert meta tag; no canonical or </head>');
  }
  return html.replace(headClose, `\n    ${tag}${headClose}`);
}

function shareImageUrl(slug) {
  return `${ORIGIN}/assets/og/location-${slug}.jpg`;
}

function shareAlt(html, slug) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (title) {
    const decoded = decode(title).split('|')[0].trim();
    if (decoded) return decoded;
  }
  return `Antique appraisers in ${titleCaseSlug(slug)}`;
}

function isForbiddenShareImage(url) {
  const value = String(url || '').toLowerCase();
  return (
    value.includes('placeholder.jpg') ||
    value.includes('appraiser-images/') ||
    value.includes('generated-appraiser-profiles/')
  );
}

function repairListingDimensions(html) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';
    if (!src.includes('/assets/generated-appraiser-profiles/')) {
      return tag;
    }
    let next = tag;
    if (!/\bwidth=["']/i.test(next)) {
      next = next.replace(/<img\b/i, `<img width="${SVG_WIDTH}"`);
    }
    if (!/\bheight=["']/i.test(next)) {
      next = next.replace(/<img\b/i, `<img height="${SVG_HEIGHT}"`);
    }
    return next;
  });
}

function repairCityHtml(html, slug) {
  const image = shareImageUrl(slug);
  const alt = shareAlt(html, slug);
  let next = html;
  next = upsertMeta(next, 'property', 'og:image', image);
  next = upsertMeta(next, 'property', 'og:image:width', '1200');
  next = upsertMeta(next, 'property', 'og:image:height', '630');
  next = upsertMeta(next, 'property', 'og:image:alt', alt);
  next = upsertMeta(next, 'name', 'twitter:image', image);
  next = upsertMeta(next, 'name', 'twitter:image:alt', alt);
  next = repairListingDimensions(next);
  return next;
}

function currentOgImage(html) {
  return (
    html.match(
      /<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"']+)["']/i,
    )?.[1] ||
    html.match(
      /<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:image["']/i,
    )?.[1] ||
    null
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const locationRoot = path.join(options.publicDir, 'location');
  const entries = await fs.readdir(locationRoot, { withFileTypes: true });
  const changed = [];
  const missingImages = [];
  let pages = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(locationRoot, entry.name, 'index.html');
    let before;
    try {
      before = await fs.readFile(filename, 'utf8');
    } catch {
      continue;
    }
    pages += 1;
    const imagePath = path.join(
      options.publicDir,
      'assets',
      'og',
      `location-${entry.name}.jpg`,
    );
    try {
      await fs.access(imagePath);
    } catch {
      missingImages.push(`assets/og/location-${entry.name}.jpg`);
    }
    const after = repairCityHtml(before, entry.name);
    if (isForbiddenShareImage(currentOgImage(after))) {
      throw new Error(`${entry.name} still points og:image at a listing or placeholder`);
    }
    if (after !== before) {
      changed.push(entry.name);
      if (options.write) await fs.writeFile(filename, after, 'utf8');
    }
  }

  const result = {
    action: options.write
      ? 'repaired-location-sharing-metadata'
      : 'checked-location-sharing-metadata',
    ok: (options.write || changed.length === 0) && missingImages.length === 0,
    publicDir: options.publicDir,
    pages,
    changedCityCount: changed.length,
    changed,
    missingImages,
  };
  console.log(JSON.stringify(result, null, 2));
  if (options.check && (changed.length > 0 || missingImages.length > 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
