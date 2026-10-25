import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'public_site');
const registry = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data/provider-terminal-takedowns.json'), 'utf8'),
);
const disposition = registry.records.find(
  (record) => record.id === 'fine-art-appraisal-services-non-affiliation-20261025',
);
const expectedSlugs = [
  'kelly-juhaszfine-art-appraisalservices',
  'asianpersian-decorative-arts',
  'fine-art-archives',
  'fredericton-kelly-juhaszfine-art-appraisalservices',
  'toronto-asianpersian-decorative-arts',
  'toronto-fine-art-archives',
];
const expectedRoutes = expectedSlugs.map((slug) => `/appraiser/${slug}/`);
const identityNeedles = [
  ...expectedSlugs,
  'kelly juhasz',
  'fine art appraisal + services',
  'fine art appraisal＆services',
  'asian/persian decorative arts',
  'fine art & archives',
];

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files;
}

function assertNoIdentity(text, label) {
  const normalized = text.toLowerCase();
  const found = identityNeedles.filter((needle) => normalized.includes(needle));
  assert.deepEqual(found, [], `${label} contains retired identity terms: ${found.join(', ')}`);
}

test('the governed registry records the complete terminal non-affiliation disposition', () => {
  assert.ok(disposition, 'terminal disposition is missing');
  assert.equal(disposition.status, 'terminal');
  assert.equal(disposition.effectiveDate, '2026-10-25');
  assert.equal(disposition.reason, 'official_non_affiliation_notice');
  assert.deepEqual(disposition.notice, {
    publishedAt: '2025-09-17',
    url: 'https://www.fineartappraisalandservices.com/news-1/not-affiliated-with-online-appraisal-service',
  });
  assert.equal(disposition.routing.httpStatus, 410);
  assert.deepEqual(disposition.routing.routes, expectedRoutes);
  assert.deepEqual(disposition.publication, {
    publishIdentity: false,
    removeGeneratedArtifacts: true,
    retainRawResearchAsNonPublishableEvidence: true,
    republishWithoutDocumentedConsent: false,
  });
  assert.equal(
    fs.existsSync(path.join(publicRoot, 'provider-terminal-takedowns.json')),
    false,
    'the non-public governance registry must not be copied into the served tree',
  );
});

test('retired profile files, manifest records, and publishable source objects are absent', () => {
  for (const slug of expectedSlugs) {
    assert.equal(
      fs.existsSync(path.join(publicRoot, 'appraiser', slug, 'index.html')),
      false,
      `${slug} still has a public profile document`,
    );
  }

  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data/provider-publication-manifest.json'), 'utf8'),
  );
  const manifestSlugs = new Set(manifest.providers.map((provider) => provider.slug));
  for (const slug of expectedSlugs) assert.equal(manifestSlugs.has(slug), false, `${slug} remains in manifest`);
  assert.equal(manifest.summary.changedProfiles, manifest.providers.length);

  for (const source of disposition.sourceRecords) {
    const data = JSON.parse(fs.readFileSync(path.join(repoRoot, source.file), 'utf8'));
    assert.equal(
      data.appraisers.some((provider) => provider.slug === source.slug),
      false,
      `${source.slug} remains in ${source.file}`,
    );
  }
  for (const directory of ['src/data/standardized', 'src/data/verified']) {
    for (const file of walk(path.join(repoRoot, directory)).filter((item) => item.endsWith('.json'))) {
      assertNoIdentity(
        fs.readFileSync(file, 'utf8'),
        `${path.relative(repoRoot, file)} publishable source`,
      );
    }
  }
});

test('quarantine keeps evidence but marks every source identity as not publishable', () => {
  const quarantine = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data/provider-source-quarantine.json'), 'utf8'),
  );
  const sourceSlugs = disposition.sourceRecords.map((record) => record.slug);
  const evidence = quarantine.quarantine.filter((record) => sourceSlugs.includes(record.slug));
  assert.equal(evidence.length, sourceSlugs.length);
  for (const record of evidence) {
    assert.equal(record.publicationStatus, 'not_published', `${record.slug}: publication state`);
    assert.equal(record.identityPublicationStatus, 'not_published', `${record.slug}: identity state`);
    assert.equal(record.terminalDispositionId, disposition.id, `${record.slug}: terminal disposition`);
    assert.ok(
      record.findings.some((finding) => finding.code === 'official_non_affiliation_notice'),
      `${record.slug}: official notice finding missing`,
    );
  }
});

test('identity-bearing generated assets and public text are absent', () => {
  for (const relative of disposition.generatedAssets) {
    assert.equal(fs.existsSync(path.join(repoRoot, relative)), false, `${relative} still exists`);
    const distRelative = relative.replace(/^public_site\//, 'dist/');
    assert.equal(fs.existsSync(path.join(repoRoot, distRelative)), false, `${distRelative} still exists`);
  }

  const textExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.txt', '.xml']);
  for (const file of walk(publicRoot)) {
    if (!textExtensions.has(path.extname(file))) continue;
    assertNoIdentity(fs.readFileSync(file, 'utf8'), path.relative(repoRoot, file));
  }
});

test('sitemap, feeds, and city pages contain no retired identity references', () => {
  for (const relative of ['sitemap.xml', 'appraisers.json', 'directory.json']) {
    assertNoIdentity(fs.readFileSync(path.join(publicRoot, relative), 'utf8'), `public_site/${relative}`);
  }
  for (const file of walk(path.join(publicRoot, 'location')).filter((item) => item.endsWith('index.html'))) {
    assertNoIdentity(fs.readFileSync(file, 'utf8'), path.relative(repoRoot, file));
  }
});

test('nginx has one early, exact, finite 410 contract and preserves normal 200/404 routing', () => {
  const nginx = fs.readFileSync(path.join(repoRoot, 'nginx.conf'), 'utf8');
  const routeAlternation = expectedSlugs.join('|');
  const regexSource = `^/appraiser/(?:${routeAlternation})(?:/|/index\\.html)?$`;
  const block = [
    `location ~ ${regexSource} {`,
    '      return 410;',
    '    }',
  ].join('\n');
  const blockIndex = nginx.indexOf(block);
  assert.ok(blockIndex >= 0, 'exact finite 410 block is missing');
  assert.equal(nginx.indexOf(block, blockIndex + 1), -1, '410 block is duplicated');
  assert.equal((nginx.match(/\breturn 410;/g) || []).length, 1, 'unexpected additional 410 routes');
  assert.ok(blockIndex < nginx.indexOf('# The Art directory is retired'), '410 must precede redirects');
  assert.ok(blockIndex < nginx.indexOf('location ^~ /assets/'), '410 must precede asset routing');
  assert.ok(blockIndex < nginx.indexOf('location / {'), '410 must precede generic static routing');

  const routePattern = new RegExp(regexSource);
  for (const slug of expectedSlugs) {
    for (const uri of [
      `/appraiser/${slug}`,
      `/appraiser/${slug}/`,
      `/appraiser/${slug}/index.html`,
    ]) {
      assert.equal(routePattern.test(uri), true, `${uri} must map to 410`);
    }
  }

  for (const uri of [
    '/appraiser/kelly-juhaszfine-art-appraisalservices-extra/',
    '/appraiser/fine-art-archives/child',
    '/appraiser/toronto-fine-art-archives/index.htm',
    '/location/toronto/',
  ]) {
    assert.equal(routePattern.test(uri), false, `${uri} must stay outside the finite 410 set`);
  }

  const validSlug = 'a-coin-and-stamp-gallery-estate-appraisal';
  assert.equal(routePattern.test(`/appraiser/${validSlug}/`), false);
  assert.equal(fs.existsSync(path.join(publicRoot, 'appraiser', validSlug, 'index.html')), true);

  const randomSlug = 'not-a-real-appraiser-410-control';
  assert.equal(routePattern.test(`/appraiser/${randomSlug}/`), false);
  assert.equal(fs.existsSync(path.join(publicRoot, 'appraiser', randomSlug, 'index.html')), false);
  assert.match(nginx, /location \/ \{\s*try_files \$uri \$uri\/index\.html =404;/);
});
