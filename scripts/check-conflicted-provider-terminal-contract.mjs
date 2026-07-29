#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_PUBLIC_DIR = path.join(ROOT, 'public_site');
const DEFAULT_MANIFEST = path.join(ROOT, 'data/provider-publication-manifest.json');

const REJECTED_ALIASES = [
  {
    taskId: 'DPE-P09-alexandria-nyfaa',
    slug: 'alexandria-new-york-fine-art-appraisers',
    entity: 'New York Fine Art Appraisers',
    rejectedLocation: 'Alexandria',
  },
  {
    taskId: 'DPE-P11-adelaide-fine-art',
    slug: 'adelaide-fine-art',
    entity: 'Adelaide Fine Art',
    rejectedLocation: 'Boston / New York',
  },
  {
    taskId: 'DPE-P12-abh-fine-art-advisory',
    slug: 'abh-fine-art-advisory',
    entity: 'ABH Fine Art Advisory',
    rejectedLocation: 'Naperville / Chicago',
  },
];

const HELD_NYFAA_ROUTES = [
  'new-york-fine-art-appraisers',
  'washington-dc-new-york-fine-art-appraisers',
];

function parseArgs(argv) {
  const options = {
    publicDir: DEFAULT_PUBLIC_DIR,
    manifest: DEFAULT_MANIFEST,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--manifest') options.manifest = path.resolve(argv[++index] || '');
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile() && /\.(?:html|json|xml|txt)$/i.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files.sort();
}

function isIndexable(html) {
  return !/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(
    html
  );
}

function publicationStatus(html) {
  return (
    html.match(
      /<meta\b[^>]*name=["']appraisily:provider-publication-status["'][^>]*content=["']([^"']+)["']/i
    )?.[1] || ''
  ).toLowerCase();
}

function manifestProviders(payload) {
  return Array.isArray(payload) ? payload : payload.providers || [];
}

function relative(publicDir, filename) {
  return path.relative(publicDir, filename).split(path.sep).join('/');
}

export async function checkConflictedProviderTerminalContract(options = {}) {
  const publicDir = path.resolve(options.publicDir || DEFAULT_PUBLIC_DIR);
  const manifest = path.resolve(options.manifest || DEFAULT_MANIFEST);
  const files = await walk(publicDir);
  const entries = await Promise.all(
    files.map(async (filename) => ({
      filename,
      route: relative(publicDir, filename),
      text: await fs.readFile(filename, 'utf8'),
    }))
  );
  const manifestPayload = JSON.parse(await fs.readFile(manifest, 'utf8'));
  const providers = manifestProviders(manifestPayload);
  const failures = [];

  for (const rule of REJECTED_ALIASES) {
    const rejectedProfile = path.join(
      publicDir,
      'appraiser',
      rule.slug,
      'index.html'
    );
    try {
      await fs.access(rejectedProfile);
      failures.push({
        taskId: rule.taskId,
        code: 'REJECTED_ALIAS_PROFILE_EXISTS',
        route: `/appraiser/${rule.slug}/`,
      });
    } catch {
      // Absence is the required terminal state.
    }

    const slugReferences = entries
      .filter(({ text }) => text.toLowerCase().includes(rule.slug))
      .map(({ route }) => route);
    if (slugReferences.length) {
      failures.push({
        taskId: rule.taskId,
        code: 'REJECTED_ALIAS_DISCOVERABLE',
        slug: rule.slug,
        files: slugReferences,
      });
    }

    if (rule.taskId !== 'DPE-P09-alexandria-nyfaa') {
      const entityReferences = entries
        .filter(({ text }) => text.toLowerCase().includes(rule.entity.toLowerCase()))
        .map(({ route }) => route);
      if (entityReferences.length) {
        failures.push({
          taskId: rule.taskId,
          code: 'HELD_ENTITY_PUBLICLY_EMITTED',
          entity: rule.entity,
          files: entityReferences,
        });
      }
    }
  }

  for (const slug of HELD_NYFAA_ROUTES) {
    const filename = path.join(publicDir, 'appraiser', slug, 'index.html');
    let html;
    try {
      html = await fs.readFile(filename, 'utf8');
    } catch {
      failures.push({
        taskId: 'DPE-P09-alexandria-nyfaa',
        code: 'HELD_NYFAA_ROUTE_MISSING',
        route: `/appraiser/${slug}/`,
      });
      continue;
    }
    if (isIndexable(html)) {
      failures.push({
        taskId: 'DPE-P09-alexandria-nyfaa',
        code: 'HELD_NYFAA_ROUTE_INDEXABLE',
        route: `/appraiser/${slug}/`,
      });
    }
    if (publicationStatus(html) !== 'under_review') {
      failures.push({
        taskId: 'DPE-P09-alexandria-nyfaa',
        code: 'HELD_NYFAA_ROUTE_WRONG_STATE',
        route: `/appraiser/${slug}/`,
        actual: publicationStatus(html),
      });
    }

    const manifestEntry = providers.find((provider) => provider.slug === slug);
    if (manifestEntry?.publicationStatus !== 'under_review') {
      failures.push({
        taskId: 'DPE-P09-alexandria-nyfaa',
        code: 'HELD_NYFAA_MANIFEST_WRONG_STATE',
        route: `/appraiser/${slug}/`,
        actual: manifestEntry?.publicationStatus || 'missing',
      });
    }
  }

  const indexableHtml = entries.filter(
    ({ route, text }) => route.endsWith('.html') && isIndexable(text)
  );
  for (const slug of HELD_NYFAA_ROUTES) {
    const references = indexableHtml
      .filter(({ text }) => text.includes(`/appraiser/${slug}/`))
      .map(({ route }) => route);
    if (references.length) {
      failures.push({
        taskId: 'DPE-P09-alexandria-nyfaa',
        code: 'HELD_NYFAA_LINKED_FROM_INDEXABLE_HTML',
        slug,
        files: references,
      });
    }
  }

  const discoveryFiles = entries.filter(({ route }) =>
    /(?:^|\/)(?:sitemap[^/]*\.xml|appraisers\.json|directory\.json|locations\.json|indexing-manifest\.json)$/i.test(
      route
    )
  );
  for (const slug of HELD_NYFAA_ROUTES) {
    const references = discoveryFiles
      .filter(({ text }) => text.includes(`/appraiser/${slug}/`) || text.includes(`"${slug}"`))
      .map(({ route }) => route);
    if (references.length) {
      failures.push({
        taskId: 'DPE-P09-alexandria-nyfaa',
        code: 'HELD_NYFAA_IN_DISCOVERY_ARTIFACT',
        slug,
        files: references,
      });
    }
  }

  return {
    action: 'checked-conflicted-provider-terminal-contract',
    ok: failures.length === 0,
    publicDir,
    rejectedAliasCount: REJECTED_ALIASES.length,
    heldNyfaaRouteCount: HELD_NYFAA_ROUTES.length,
    scannedFileCount: files.length,
    failures,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const result = await checkConflictedProviderTerminalContract(
      parseArgs(process.argv.slice(2))
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
