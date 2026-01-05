#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVerifiedProviders } from './utils/verified-providers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

async function main() {
  const { filePath, filePaths, providers, errors } = await loadVerifiedProviders({ repoRoot: REPO_ROOT });

  if (errors.length) {
    console.error('[validate-verified-providers] Invalid verified providers file:', filePath);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const byLocation = new Map();
  let verifiedCount = 0;
  let listedCount = 0;
  for (const provider of providers) {
    if (provider?.verified === true) verifiedCount += 1;
    if (provider?.listed === true) listedCount += 1;
    const list = byLocation.get(provider.locationSlug) || [];
    list.push(provider);
    byLocation.set(provider.locationSlug, list);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        filePath,
        filePaths,
        providers: providers.length,
        verifiedProviders: verifiedCount,
        listedProviders: listedCount,
        locations: byLocation.size,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[validate-verified-providers] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
