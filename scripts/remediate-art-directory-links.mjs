#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_site');
const REGISTRY_PATH =
  '/srv/repos/tools/directory-site-utils/references/art-route-registry.json';
const RECEIPT_PATH = path.join(ROOT, 'data/art-directory-link-remediation.json');
const write = process.argv.includes('--write');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const GENERIC_HEADING = 'Looking for a fine-art appraiser?';
const GENERIC_BODY =
  'This page covers antique, decorative-arts, estate, and mixed personal-property providers. ' +
  'For paintings, prints, sculpture, photography, and gallery collections, browse the current ' +
  'source-reviewed art directory.';
const GENERIC_LINK_LABEL = 'Browse reviewed art appraisers by location';

async function walkHtml(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(absolute));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(absolute);
  }
  return files;
}

const registryText = await fs.readFile(REGISTRY_PATH, 'utf8');
const registry = JSON.parse(registryText);
const allowed = new Set(
  registry.routes
    .filter((route) => route.publicationStatus === 'published')
    .map((route) => route.canonicalUrl),
);
const locationHub = registry.routes.find(
  (route) => route.kind === 'location_hub' && route.publicationStatus === 'published',
)?.canonicalUrl;
if (!locationHub) throw new Error('Art route registry has no published location hub');

const changes = [];
for (const filename of await walkHtml(PUBLIC_DIR)) {
  const before = await fs.readFile(filename, 'utf8');
  const retiredTargets = [];
  let after = before.replace(
    /href=(["'])(https:\/\/art-appraisers-directory\.appraisily\.com\/[^"']*)\1/g,
    (match, quote, target) => {
      const parsed = new URL(target);
      const cleanTarget = `${parsed.origin}${parsed.pathname}`;
      if (allowed.has(cleanTarget)) {
        if (!parsed.search && !parsed.hash) return match;
        retiredTargets.push(target);
        return `href=${quote}${cleanTarget}${quote}`;
      }
      if (!/^\/location\/[^/]+\/?$/.test(parsed.pathname)) return match;
      retiredTargets.push(target);
      return `href=${quote}${locationHub}${quote}`;
    },
  );
  let normalizedGenericHubCopy = false;
  after = after.replace(
    /<section\b(?=[^>]*\bdata-directory-crosslink=["']antique-to-art["'])[\s\S]*?<\/section>/gi,
    (section) => {
      if (!section.includes(`href="${locationHub}"`) && !section.includes(`href='${locationHub}'`)) {
        return section;
      }

      const normalized = section
        .replace(
          /(<h2\b[^>]*>)[\s\S]*?(<\/h2>)/i,
          `$1${GENERIC_HEADING}$2`,
        )
        .replace(
          /(<p\b[^>]*>)\s*This page covers antique, decorative-arts[\s\S]*?(<\/p>)/i,
          `$1${GENERIC_BODY}$2`,
        )
        .replace(
          /(<a\b[^>]*\bhref=["'][^"']+["'][^>]*>)[\s\S]*?(<\/a>)/i,
          `$1${GENERIC_LINK_LABEL}$2`,
        );
      if (normalized !== section) normalizedGenericHubCopy = true;
      return normalized;
    },
  );
  if (after === before) continue;
  changes.push({
    file: path.relative(PUBLIC_DIR, filename),
    beforeSha256: sha256(before),
    afterSha256: sha256(after),
    replacedTargets: [...new Set(retiredTargets)].sort(),
    replacement: locationHub,
    normalizedGenericHubCopy,
  });
  if (write) await fs.writeFile(filename, after, 'utf8');
}

let receiptChanges = changes;
if (write) {
  try {
    const previous = JSON.parse(await fs.readFile(RECEIPT_PATH, 'utf8'));
    const combined = new Map(previous.changes.map((change) => [change.file, change]));
    for (const change of changes) {
      const prior = combined.get(change.file);
      combined.set(change.file, prior
        ? {
            ...change,
            beforeSha256: prior.beforeSha256,
            replacedTargets: [...new Set([
              ...(prior.replacedTargets || []),
              ...(change.replacedTargets || []),
            ])].sort(),
          }
        : change);
    }
    receiptChanges = [...combined.values()].sort((left, right) => left.file.localeCompare(right.file));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const receipt = {
  version: 1,
  action: write ? 'written' : 'preview',
  registryPath: REGISTRY_PATH,
  registrySha256: sha256(registryText),
  registryArtifactSha256: registry.generatedFrom.artifactSha256,
  filesChanged: receiptChanges.length,
  linksReplaced: receiptChanges.reduce((sum, change) => sum + change.replacedTargets.length, 0),
  changes: receiptChanges,
};
if (write) {
  await fs.mkdir(path.dirname(RECEIPT_PATH), { recursive: true });
  await fs.writeFile(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify(receipt, null, 2));
