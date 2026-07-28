#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const publicDirIndex = args.indexOf('--public-dir');
const publicDir = path.resolve(
  publicDirIndex >= 0 ? args[publicDirIndex + 1] : 'public_site',
);
const write = args.includes('--write');
const check = args.includes('--check');
if (write === check) {
  throw new Error('Choose exactly one of --write or --check');
}

const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const SHARE_IMAGE =
  'https://assets.appraisily.com/logo-exploration/appraisily-logo-2026-07-09/concept-01-monogram-picture-frame.png';

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

function required(html, pattern, label, slug) {
  const value = html.match(pattern)?.[1];
  if (!value) throw new Error(`${slug} is missing ${label}`);
  return decode(value.trim());
}

const appraisers = JSON.parse(
  await fs.readFile(path.join(publicDir, 'appraisers.json'), 'utf8'),
).appraisers;
const changed = [];

for (const provider of appraisers) {
  const filename = path.join(
    publicDir,
    'appraiser',
    provider.slug,
    'index.html',
  );
  const before = await fs.readFile(filename, 'utf8');
  const title = required(
    before,
    /<title>([\s\S]*?)<\/title>/i,
    'title',
    provider.slug,
  );
  const description = required(
    before,
    /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']+)["']/i,
    'description',
    provider.slug,
  );
  const canonical = required(
    before,
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i,
    'canonical',
    provider.slug,
  );
  const expectedCanonical = `${ORIGIN}/appraiser/${provider.slug}/`;
  if (canonical !== expectedCanonical) {
    throw new Error(
      `${provider.slug} canonical is ${canonical}; expected ${expectedCanonical}`,
    );
  }

  const coreDefinitions = [
    [
      'og:type',
      /<meta\b[^>]*\bproperty=["']og:type["']/i,
      '<meta property="og:type" content="website">',
    ],
    [
      'og:site_name',
      /<meta\b[^>]*\bproperty=["']og:site_name["']/i,
      '<meta property="og:site_name" content="Appraisily Directory">',
    ],
    [
      'og:title',
      /<meta\b[^>]*\bproperty=["']og:title["']/i,
      `<meta property="og:title" content="${escape(title)}">`,
    ],
    [
      'og:description',
      /<meta\b[^>]*\bproperty=["']og:description["']/i,
      `<meta property="og:description" content="${escape(description)}">`,
    ],
    [
      'og:url',
      /<meta\b[^>]*\bproperty=["']og:url["']/i,
      `<meta property="og:url" content="${escape(canonical)}">`,
    ],
    [
      'og:image',
      /<meta\b[^>]*\bproperty=["']og:image["']/i,
      `<meta property="og:image" content="${SHARE_IMAGE}">`,
    ],
    [
      'twitter:card',
      /<meta\b[^>]*\bname=["']twitter:card["']/i,
      '<meta name="twitter:card" content="summary_large_image">',
    ],
    [
      'twitter:title',
      /<meta\b[^>]*\bname=["']twitter:title["']/i,
      `<meta name="twitter:title" content="${escape(title)}">`,
    ],
    [
      'twitter:description',
      /<meta\b[^>]*\bname=["']twitter:description["']/i,
      `<meta name="twitter:description" content="${escape(description)}">`,
    ],
    [
      'twitter:image',
      /<meta\b[^>]*\bname=["']twitter:image["']/i,
      `<meta name="twitter:image" content="${SHARE_IMAGE}">`,
    ],
  ];

  const existingOgUrl =
    before.match(
      /<meta\b[^>]*\bproperty=["']og:url["'][^>]*\bcontent=["']([^"']+)["']/i,
    )?.[1] ??
    before.match(
      /<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:url["']/i,
    )?.[1] ??
    null;
  if (existingOgUrl && existingOgUrl !== expectedCanonical) {
    throw new Error(
      `${provider.slug} og:url is ${existingOgUrl}; expected ${expectedCanonical}`,
    );
  }

  const additions = coreDefinitions
    .filter(([, pattern]) => !pattern.test(before))
    .map(([label, , tag]) => ({ label, tag }));
  if (additions.length === 0) continue;
  if (!/<meta\b[^>]*\bproperty=["']og:image:alt["']/i.test(before)) {
    const firstTwitter = additions.findIndex(({ label }) =>
      label.startsWith('twitter:'),
    );
    additions.splice(firstTwitter < 0 ? additions.length : firstTwitter, 0, {
      label: 'og:image:alt',
      tag: '<meta property="og:image:alt" content="Appraisily Directory">',
    });
  }
  changed.push({
    slug: provider.slug,
    file: path.relative(publicDir, filename),
    missing: additions.map(({ label }) => label),
  });
  if (!write) continue;

  const marker = before.match(
    /\s*<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
  )?.[0];
  if (!marker) throw new Error(`${provider.slug} canonical marker missing`);
  const block = `\n    ${additions.map(({ tag }) => tag).join('\n    ')}`;
  await fs.writeFile(filename, before.replace(marker, `${marker}${block}`), 'utf8');
}

const result = {
  action: write
    ? 'repaired-profile-sharing-metadata'
    : 'checked-profile-sharing-metadata',
  ok: write || changed.length === 0,
  publicDir,
  publishedProfileCount: appraisers.length,
  changedProfileCount: changed.length,
  changed,
};
console.log(JSON.stringify(result, null, 2));
if (check && changed.length > 0) process.exitCode = 1;
