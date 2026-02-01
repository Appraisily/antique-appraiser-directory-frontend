#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const options = {
    publicDir: path.resolve(process.cwd(), 'public_site'),
    dryRun: false,
    verbose: false,
  };

  for (const token of argv) {
    if (!token) continue;
    if (token === '--dry-run') options.dryRun = true;
    else if (token === '--verbose') options.verbose = true;
    else if (token.startsWith('--public-dir=')) options.publicDir = path.resolve(process.cwd(), token.slice(13));
    else if (token === '--help' || token === '-h') {
      console.log(`Usage: fix-client-entry-hydration-mode.mjs [--public-dir=public_site] [--dry-run] [--verbose]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${token}`);
    }
  }

  return options;
}

async function listIndexBundles(assetsDir) {
  let entries = [];
  try {
    entries = await fs.readdir(assetsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && /^index-.*\.js$/.test(entry.name))
    .map((entry) => path.join(assetsDir, entry.name));
}

function patchBundle(source, { rootVar, hydrateFn, createRootFn, verbose }) {
  const before = source;
  let modified = source;

  if (!modified.includes('💧 Hydrating pre-rendered content')) {
    return { changed: false, output: source, reason: 'no hydration branch marker' };
  }

  if (verbose) {
    console.log(`[fix-client-entry-hydration-mode] Detected rootVar=${rootVar} hydrateFn=${hydrateFn} createRootFn=${createRootFn}`);
  }

  modified = modified.replace(
    'console.log("💧 Hydrating pre-rendered content"),',
    `console.log("🧯 Pre-rendered HTML detected; skipping hydration (client render only)"),${rootVar}.innerHTML="",`
  );

  modified = modified.replace(/console\.log\("✅ Hydration complete"\)/g, 'console.log("✅ Rendering complete")');
  modified = modified.replace(
    /console\.log\("🌱 Creating new React root \\(client-only rendering\\)"\)/g,
    'console.log("🌱 No pre-rendered HTML; client render only")'
  );

  // Switch hydrateRoot(container, element) to createRoot(container).render(element)
  modified = modified.replace(new RegExp(`${hydrateFn}\\(${rootVar},`, 'g'), `${createRootFn}(${rootVar}).render(`);

  const changed = modified !== before;
  return { changed, output: modified, reason: changed ? 'patched' : 'no-op' };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const assetsDir = path.join(options.publicDir, 'assets');
  const bundles = await listIndexBundles(assetsDir);

  if (bundles.length === 0) {
    console.log(`[fix-client-entry-hydration-mode] No index bundles found in ${assetsDir}`);
    return;
  }

  let changedCount = 0;
  for (const bundlePath of bundles) {
    const source = await fs.readFile(bundlePath, 'utf8');

    const rootMatch = source.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*document\.getElementById\("root"\)/);
    if (!rootMatch) {
      console.log(`[fix-client-entry-hydration-mode] Skipping ${path.basename(bundlePath)}: could not find root element variable`);
      continue;
    }
    const rootVar = rootMatch[1];

    const createRootMatch = source.match(new RegExp(`([A-Za-z_$][\\w$]*)\\(${rootVar}\\)\\.render\\(`));
    if (!createRootMatch) {
      console.log(`[fix-client-entry-hydration-mode] Skipping ${path.basename(bundlePath)}: could not find createRoot(...).render(...) call`);
      continue;
    }
    const createRootFn = createRootMatch[1];

    const hydrateMatch = source.match(
      new RegExp(`console\\.log\\("💧 Hydrating pre-rendered content"\\),([A-Za-z_$][\\w$]*)\\(${rootVar},`)
    );
    if (!hydrateMatch) {
      console.log(`[fix-client-entry-hydration-mode] Skipping ${path.basename(bundlePath)}: could not find hydrate function name`);
      continue;
    }
    const hydrateFn = hydrateMatch[1];

    const result = patchBundle(source, { rootVar, hydrateFn, createRootFn, verbose: options.verbose });
    if (!result.changed) {
      console.log(`[fix-client-entry-hydration-mode] No changes for ${path.basename(bundlePath)} (${result.reason})`);
      continue;
    }

    changedCount += 1;
    console.log(
      `[fix-client-entry-hydration-mode] Patched ${path.basename(bundlePath)} (${options.dryRun ? 'dry-run' : 'written'})`
    );

    if (!options.dryRun) {
      await fs.writeFile(bundlePath, result.output, 'utf8');
    }
  }

  console.log(`[fix-client-entry-hydration-mode] Done. Patched ${changedCount}/${bundles.length} bundles.`);
}

main().catch((error) => {
  console.error('[fix-client-entry-hydration-mode] Failed:', error);
  process.exitCode = 1;
});
