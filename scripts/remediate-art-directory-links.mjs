#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public_site');
const REGISTRY_PATH =
  '/srv/repos/tools/directory-site-utils/references/art-route-registry.json';
const DEFAULT_RECEIPT_PATH = path.join(ROOT, 'data/art-directory-link-remediation.json');
const options = {
  publicDir: PUBLIC_DIR,
  baselineDir: null,
  receiptPath: DEFAULT_RECEIPT_PATH,
  write: false,
};
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (token === '--write') options.write = true;
  else if (token === '--public-dir') options.publicDir = path.resolve(process.argv[++index]);
  else if (token === '--baseline-dir') options.baselineDir = path.resolve(process.argv[++index]);
  else if (token === '--receipt') options.receiptPath = path.resolve(process.argv[++index]);
  else throw new Error(`Unknown argument: ${token}`);
}
const {
  publicDir,
  baselineDir,
  receiptPath,
  write,
} = options;

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

async function writeDetachedAtomic(filename, contents) {
  const temporary = path.join(
    path.dirname(filename),
    `.${path.basename(filename)}.art-link-remediation-${process.pid}-${Date.now()}.tmp`,
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
const conflicts = [];
for (const filename of await walkHtml(publicDir)) {
  const before = await fs.readFile(filename, 'utf8');
  const relative = path.relative(publicDir, filename);
  if (baselineDir) {
    const baselinePath = path.join(baselineDir, relative);
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
    file: relative,
    beforeSha256: sha256(before),
    afterSha256: sha256(after),
    replacedTargets: [...new Set(retiredTargets)].sort(),
    replacement: locationHub,
    normalizedGenericHubCopy,
  });
  if (write) await writeDetachedAtomic(filename, after);
}

let receiptChanges = changes;
if (write) {
  try {
    const previous = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
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
  baselineDir,
  registryPath: REGISTRY_PATH,
  registrySha256: sha256(registryText),
  registryArtifactSha256: registry.generatedFrom.artifactSha256,
  filesChanged: receiptChanges.length,
  linksReplaced: receiptChanges.reduce((sum, change) => sum + change.replacedTargets.length, 0),
  conflicts: conflicts.length,
  changes: receiptChanges,
  conflictRecords: conflicts,
};
if (write) {
  await fs.mkdir(path.dirname(receiptPath), { recursive: true });
  await writeDetachedAtomic(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}
console.log(JSON.stringify(receipt, null, 2));
if (conflicts.length) process.exitCode = 2;
