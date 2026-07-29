#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ARTWORK_VERSION = '20260728-limited-trust';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function listHtmlFiles(root) {
  const output = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await listHtmlFiles(filename));
    else if (entry.isFile() && entry.name.endsWith('.html')) output.push(filename);
  }
  return output;
}

export async function normalizeLimitedProviderArtwork({
  publicDir,
  manifestPath,
  write = false,
}) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const providers = Array.isArray(manifest) ? manifest : manifest.providers ?? [];
  const limited = providers.filter(
    (provider) => provider.publicationStatus === 'limited'
  );
  const failures = [];
  const changedArtwork = [];
  const changedHtml = [];
  const limitedSlugs = new Set(limited.map((provider) => provider.slug));
  const referencedSlugs = new Set();

  for (const provider of limited) {
    const relativePath = path.join(
      'assets',
      'generated-appraiser-profiles',
      `${provider.slug}.svg`
    );
    const filename = path.join(publicDir, relativePath);
    let source;
    try {
      source = await fs.readFile(filename, 'utf8');
    } catch (error) {
      failures.push({
        slug: provider.slug,
        code: 'LIMITED_PROVIDER_ARTWORK_MISSING',
        detail: error.message,
      });
      continue;
    }

    const safeName = escapeXml(provider.name ?? provider.slug);
    const expectedDescription =
      `Generated non-likeness directory artwork for ${safeName}; ` +
      'location not verified.';
    let normalized = source.replace(
      /<desc id="desc">[^<]*<\/desc>/,
      `<desc id="desc">${expectedDescription}</desc>`
    );
    normalized = normalized.replace(
      /(<text x="600" y="720"[^>]*>)[^<]*(<\/text>)/,
      '$1Location not verified$2'
    );

    if (
      !normalized.includes(`<desc id="desc">${expectedDescription}</desc>`) ||
      !normalized.includes('>Location not verified</text>')
    ) {
      failures.push({
        slug: provider.slug,
        code: 'LIMITED_PROVIDER_ARTWORK_BOUNDARY_MISSING',
        path: relativePath,
      });
      continue;
    }

    if (normalized !== source) {
      changedArtwork.push(relativePath);
      if (write) await fs.writeFile(filename, normalized);
    }
  }

  for (const filename of await listHtmlFiles(publicDir)) {
    const source = await fs.readFile(filename, 'utf8');
    const normalized = source.replace(
      /generated-appraiser-profiles\/([^"'?\s]+)\.svg(?:\?[^"'\s]*)?/g,
      (match, slug) => {
        if (!limitedSlugs.has(slug)) return match;
        referencedSlugs.add(slug);
        return `generated-appraiser-profiles/${slug}.svg?v=${ARTWORK_VERSION}`;
      }
    );
    if (normalized !== source) {
      changedHtml.push(path.relative(publicDir, filename));
      if (write) await fs.writeFile(filename, normalized);
    }
  }

  for (const provider of limited) {
    if (!referencedSlugs.has(provider.slug)) {
      failures.push({
        slug: provider.slug,
        code: 'LIMITED_PROVIDER_ARTWORK_UNREFERENCED',
      });
    }
  }

  const changed = [...changedArtwork, ...changedHtml];
  return {
    ok: failures.length === 0 && (write || changed.length === 0),
    mode: write ? 'write' : 'check',
    artworkVersion: ARTWORK_VERSION,
    limitedProviderCount: limited.length,
    changedFileCount: changed.length,
    changedArtworkFileCount: changedArtwork.length,
    changedHtmlFileCount: changedHtml.length,
    changedFiles: changed,
    failures,
  };
}

const isCli = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isCli) {
  const result = await normalizeLimitedProviderArtwork({
    publicDir: path.resolve(readArg('--public-dir', 'public_site')),
    manifestPath: path.resolve(
      readArg('--manifest', 'data/provider-publication-manifest.json')
    ),
    write: process.argv.includes('--write'),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
