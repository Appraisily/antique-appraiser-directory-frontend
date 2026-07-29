import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkConflictedProviderTerminalContract } from '../scripts/check-conflicted-provider-terminal-contract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function heldProfile(slug) {
  return `<!doctype html><html><head>
    <meta name="robots" content="noindex, follow">
    <meta name="appraisily:provider-publication-status" content="under_review">
    <link rel="canonical" href="https://antique-appraiser-directory.appraisily.com/appraiser/${slug}/">
  </head><body><h1>New York Fine Art Appraisers</h1></body></html>`;
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'conflicted-providers-'));
  const publicDir = path.join(root, 'public_site');
  const appraiserDir = path.join(publicDir, 'appraiser');
  await fs.mkdir(appraiserDir, { recursive: true });

  const slugs = [
    'new-york-fine-art-appraisers',
    'washington-dc-new-york-fine-art-appraisers',
  ];
  for (const slug of slugs) {
    const directory = path.join(appraiserDir, slug);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'index.html'), heldProfile(slug));
  }

  await fs.writeFile(
    path.join(publicDir, 'index.html'),
    '<!doctype html><html><head><meta name="robots" content="index, follow"></head><body>Directory</body></html>'
  );
  await fs.writeFile(path.join(publicDir, 'sitemap.xml'), '<urlset></urlset>');
  await fs.writeFile(path.join(publicDir, 'appraisers.json'), '[]');
  await fs.writeFile(path.join(publicDir, 'directory.json'), '[]');
  await fs.writeFile(path.join(publicDir, 'locations.json'), '[]');
  await fs.writeFile(path.join(publicDir, 'indexing-manifest.json'), '{"urls":[]}');

  const manifest = path.join(root, 'manifest.json');
  await fs.writeFile(
    manifest,
    JSON.stringify({
      providers: slugs.map((slug) => ({
        slug,
        name: 'New York Fine Art Appraisers',
        publicationStatus: 'under_review',
      })),
    })
  );
  return { root, publicDir, manifest };
}

test('current artifact keeps all three conflict decisions terminal and undiscoverable', async () => {
  const result = await checkConflictedProviderTerminalContract({
    publicDir: path.join(ROOT, 'public_site'),
    manifest: path.join(ROOT, 'data', 'provider-publication-manifest.json'),
  });
  assert.equal(result.ok, true, JSON.stringify(result.failures, null, 2));
  assert.equal(result.rejectedAliasCount, 3);
  assert.equal(result.heldNyfaaRouteCount, 2);
});

test('contract rejects a restored alias, an indexable held route, and discovery links', async () => {
  const context = await fixture();
  try {
    const rejectedDirectory = path.join(
      context.publicDir,
      'appraiser',
      'adelaide-fine-art'
    );
    await fs.mkdir(rejectedDirectory, { recursive: true });
    await fs.writeFile(
      path.join(rejectedDirectory, 'index.html'),
      '<!doctype html><html><body><h1>Adelaide Fine Art</h1></body></html>'
    );

    const heldFilename = path.join(
      context.publicDir,
      'appraiser',
      'new-york-fine-art-appraisers',
      'index.html'
    );
    const heldHtml = await fs.readFile(heldFilename, 'utf8');
    await fs.writeFile(
      heldFilename,
      heldHtml.replace('noindex, follow', 'index, follow')
    );
    await fs.writeFile(
      path.join(context.publicDir, 'sitemap.xml'),
      '<urlset><url><loc>https://antique-appraiser-directory.appraisily.com/appraiser/new-york-fine-art-appraisers/</loc></url></urlset>'
    );
    await fs.writeFile(
      path.join(context.publicDir, 'index.html'),
      `<!doctype html><html><head><meta name="robots" content="index, follow"></head><body>
        <a href="/appraiser/adelaide-fine-art/">Adelaide Fine Art</a>
        <a href="/appraiser/new-york-fine-art-appraisers/">New York Fine Art Appraisers</a>
      </body></html>`
    );

    const result = await checkConflictedProviderTerminalContract(context);
    const codes = new Set(result.failures.map((failure) => failure.code));
    assert.equal(result.ok, false);
    assert.ok(codes.has('REJECTED_ALIAS_PROFILE_EXISTS'));
    assert.ok(codes.has('REJECTED_ALIAS_DISCOVERABLE'));
    assert.ok(codes.has('HELD_ENTITY_PUBLICLY_EMITTED'));
    assert.ok(codes.has('HELD_NYFAA_ROUTE_INDEXABLE'));
    assert.ok(codes.has('HELD_NYFAA_LINKED_FROM_INDEXABLE_HTML'));
    assert.ok(codes.has('HELD_NYFAA_IN_DISCOVERY_ARTIFACT'));
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});
