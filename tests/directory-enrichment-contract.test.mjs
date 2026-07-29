import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkDirectoryEnrichmentContract } from '../scripts/check-directory-enrichment-contract.mjs';

const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';

function cityHtml({ slug, provider = null, noindex = false }) {
  const profileRoute = provider ? `/appraiser/${provider}/` : null;
  const itemList = profileRoute
    ? [
        {
          '@type': 'ListItem',
          position: 1,
          name: provider,
          url: `${ORIGIN}${profileRoute}`,
        },
      ]
    : [];
  return `<!doctype html><html><head>
    <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
    <script type="application/ld+json">${JSON.stringify([
      { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: itemList },
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        provider: profileRoute
          ? [{ '@type': 'ProfessionalService', name: provider, url: `${ORIGIN}${profileRoute}` }]
          : [],
      },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: slug, item: `${ORIGIN}/location/${slug}/` },
      ] },
    ])}</script>
  </head><body>
    <nav aria-label="Breadcrumb"><a href="/">Home</a> / ${slug}</nav>
    ${profileRoute ? `<a href="${profileRoute}"><h3>${provider}</h3></a>` : ''}
    <section data-directory-city-utility="provider-evidence">
      <p>This city-specific evidence paragraph explains a locally distinct provider decision, the assignment fit, the inspection choice, and the evidence a customer should confirm before engagement. It is deliberately substantive enough to qualify as reviewed original utility.</p>
    </section>
  </body></html>`;
}

function limitedProfileHtml({
  slug = 'clean-limited-provider',
  name = 'Clean Limited Provider',
  sourceUrl = 'https://provider.example/',
} = {}) {
  return `<!doctype html><html><head>
    <title>${name} | Limited Directory Listing</title>
    <meta name="appraisily:provider-publication-status" content="limited">
    <meta name="appraisily:provider-source" content="${sourceUrl}">
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name,
      description:
        `${name} has a limited source-listed profile. Confirm all other details directly.`,
      url: `${ORIGIN}/appraiser/${slug}/`,
      sameAs: sourceUrl,
    })}</script>
  </head><body>
    <h1>${name}</h1>
    <p data-provider-publication-status="limited" data-provider-claim-scope="identity website">
      Limited directory listing. Identity and official website reviewed July 11, 2026.
      Current location, services, credentials, fees, and availability are not verified.
    </p>
    <h2>What has been checked</h2>
    <p>Business identity and official website only.</p>
    <a href="${sourceUrl}">Visit official website</a>
  </body></html>`;
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'directory-contract-'));
  const publicDir = path.join(root, 'public_site');
  await fs.mkdir(path.join(publicDir, 'location', 'clean-city'), { recursive: true });
  await fs.mkdir(path.join(publicDir, 'appraiser'), { recursive: true });
  await fs.mkdir(path.join(publicDir, 'appraiser', 'clean-provider'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(publicDir, 'appraiser', 'clean-provider', 'index.html'),
    '<!doctype html><html><body><h1>clean-provider</h1></body></html>'
  );
  await fs.mkdir(
    path.join(publicDir, 'appraiser', 'clean-limited-provider'),
    { recursive: true }
  );
  await fs.writeFile(
    path.join(
      publicDir,
      'appraiser',
      'clean-limited-provider',
      'index.html'
    ),
    limitedProfileHtml()
  );
  await fs.writeFile(
    path.join(publicDir, 'location', 'clean-city', 'index.html'),
    cityHtml({ slug: 'clean-city', provider: 'clean-provider' })
  );
  await fs.writeFile(
    path.join(publicDir, 'index.html'),
    '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Directory"}</script></head><body>Directory of source-reviewed listings.</body></html>'
  );
  const migrated = [
    'afp-art-consulting-llc-fine-art-consulting-appraisals-research-writing-and-collections-man',
    'heidi-vaughan-ma-isa-am',
    'open-to-the-public',
    'sarah-ann-wilson-art-services',
    'st-lifer-art-inc-international-art-appraiser',
  ];
  for (const slug of migrated) {
    const dir = path.join(publicDir, 'appraiser', slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'index.html'),
      `<!doctype html><html><head>
        <meta name="appraisily:provider-source" content="https://example.com/${slug}">
        <script type="application/ld+json">${JSON.stringify([
          {
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: 'Clean Provider',
            description: 'Clean Provider offers sourced appraisal help.',
            address: { '@type': 'PostalAddress', addressLocality: 'Clean City' },
            serviceType: 'Appraisal help',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
              { '@type': 'ListItem', position: 2, name: 'Clean City', item: `${ORIGIN}/location/clean-city/` },
              { '@type': 'ListItem', position: 3, name: 'Clean Provider', item: `${ORIGIN}/appraiser/${slug}/` },
            ],
          },
        ])}</script>
      </head><body>
        <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/location/clean-city/">Clean City</a> / Clean Provider</nav>
        <h1>Clean Provider</h1>
        <p>Clean Provider offers sourced appraisal help in Clean City. Service type: Appraisal help.</p>
        <p data-provider-publication-status="verified">Provider facts reviewed on July 28, 2026.</p>
      </body></html>`
    );
  }
  const manifest = path.join(root, 'manifest.json');
  await fs.writeFile(
    manifest,
    JSON.stringify({
      providers: [
        {
          slug: 'clean-provider',
          publicationStatus: 'verified',
        },
        {
          slug: 'clean-limited-provider',
          name: 'Clean Limited Provider',
          publicationStatus: 'limited',
          sourceUrl: 'https://provider.example/',
          verifiedAt: '2026-07-11',
          claimScope: ['identity', 'website'],
        },
      ],
    })
  );
  return { root, publicDir, manifest };
}

test('clean sourced fixture passes the enrichment contract', async () => {
  const context = await fixture();
  try {
    const result = await checkDirectoryEnrichmentContract(context);
    assert.equal(result.ok, true, JSON.stringify(result.failures, null, 2));
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('indexable empty city and retired-host residue fail', async () => {
  const context = await fixture();
  try {
    await fs.mkdir(path.join(context.publicDir, 'location', 'empty'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(context.publicDir, 'location', 'empty', 'index.html'),
      cityHtml({ slug: 'empty' }).replace(
        '</body>',
        '<a href="https://art-appraisers-directory.appraisily.com/">old host</a></body>'
      )
    );
    const result = await checkDirectoryEnrichmentContract(context);
    assert.equal(result.ok, false);
    assert.ok(
      result.failures.some(
        (failure) =>
          failure.code === 'INDEXABLE_CITY_WITHOUT_ELIGIBLE_PROVIDER'
      )
    );
    assert.ok(
      result.failures.some(
        (failure) => failure.code === 'RETIRED_HOST_REFERENCE'
      )
    );
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('indexable city cannot show provider cards without reviewed profile routes', async () => {
  const context = await fixture();
  try {
    const filename = path.join(
      context.publicDir,
      'location',
      'clean-city',
      'index.html'
    );
    const html = await fs.readFile(filename, 'utf8');
    await fs.writeFile(
      filename,
      html.replace(
        '</body>',
        '<article><h3>Unreviewed Provider</h3><span>Profile unavailable</span></article><article><h3>Second Unreviewed Provider</h3><span>Profile details unavailable</span></article></body>'
      )
    );
    const result = await checkDirectoryEnrichmentContract(context);
    const failure = result.failures.find(
      (entry) =>
        entry.code === 'INDEXABLE_CITY_HAS_UNLINKED_PROVIDER_CARDS'
    );
    assert.ok(
      failure,
      JSON.stringify(result.failures, null, 2)
    );
    assert.match(failure.detail, /^2 visible provider card/);
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('indexable city requires an explicit unique decision-utility module', async () => {
  const context = await fixture();
  try {
    const filename = path.join(
      context.publicDir,
      'location',
      'clean-city',
      'index.html'
    );
    const html = await fs.readFile(filename, 'utf8');
    await fs.writeFile(
      filename,
      html.replace(' data-directory-city-utility="provider-evidence"', '')
    );
    const result = await checkDirectoryEnrichmentContract(context);
    assert.ok(
      result.failures.some(
        (failure) =>
          failure.code ===
          'INDEXABLE_CITY_WITHOUT_UNIQUE_DECISION_UTILITY'
      ),
      JSON.stringify(result.failures, null, 2)
    );
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('city card and schema identities must match the linked profile', async () => {
  const context = await fixture();
  try {
    const filename = path.join(
      context.publicDir,
      'location',
      'clean-city',
      'index.html'
    );
    const html = await fs.readFile(filename, 'utf8');
    await fs.writeFile(
      filename,
      html.replace(
        '<h3>clean-provider</h3>',
        '<h3>Unrelated Business</h3>'
      )
    );
    const result = await checkDirectoryEnrichmentContract(context);
    assert.ok(
      result.failures.some(
        (failure) =>
          failure.code === 'CITY_PROVIDER_IDENTITY_MISMATCH' &&
          failure.detail.includes('visible-card')
      ),
      JSON.stringify(result.failures, null, 2)
    );
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('city template similarity detects paragraphs with only place-name changes', async () => {
  const context = await fixture();
  try {
    const first = path.join(context.publicDir, 'location', 'template-one');
    const second = path.join(context.publicDir, 'location', 'template-two');
    await fs.mkdir(first, { recursive: true });
    await fs.mkdir(second, { recursive: true });
    const paragraphs = (place) => `
      <p>When choosing an appraiser in ${place}, compare the provider specialty, report scope, fee basis, inspection method, and delivery timing before an engagement begins.</p>
      <p>People in ${place} should gather overall photographs, marks, measurements, condition details, provenance, receipts, and prior reports before contacting a provider.</p>
      <p>An online appraisal may work for a ${place} assignment when photographs and documentation are sufficient, but the client or intended user may require a local inspection.</p>`;
    await fs.writeFile(
      path.join(first, 'index.html'),
      cityHtml({ slug: 'template-one', provider: 'clean-provider' }).replace(
        '</body>',
        `${paragraphs('Template One')}</body>`
      )
    );
    await fs.writeFile(
      path.join(second, 'index.html'),
      cityHtml({ slug: 'template-two', provider: 'clean-provider' }).replace(
        '</body>',
        `${paragraphs('Template Two')}</body>`
      )
    );
    const result = await checkDirectoryEnrichmentContract(context);
    assert.ok(
      result.failures.some(
        (failure) => failure.code === 'NEAR_DUPLICATE_CITY_BODY'
      ),
      JSON.stringify(result.failures, null, 2)
    );
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('a held provider identity term cannot appear in public output', async () => {
  const context = await fixture();
  try {
    const manifest = JSON.parse(await fs.readFile(context.manifest, 'utf8'));
    manifest.providers.push({
      slug: 'identity-conflict',
      publicationStatus: 'verified',
      claimReviewHolds: [
        {
          kind: 'principal_identity',
          blockedPublicTerms: ['Conflicted Person'],
        },
      ],
    });
    await fs.writeFile(context.manifest, JSON.stringify(manifest));
    await fs.writeFile(
      path.join(context.publicDir, 'held-claim.html'),
      '<p>Conflicted Person is the principal.</p>'
    );
    const result = await checkDirectoryEnrichmentContract(context);
    assert.ok(
      result.failures.some(
        (failure) => failure.code === 'HELD_PROVIDER_CLAIM_PUBLIC'
      )
    );
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('limited profiles cannot exceed the manifest identity and website scope', async () => {
  const context = await fixture();
  try {
    const filename = path.join(
      context.publicDir,
      'appraiser',
      'clean-limited-provider',
      'index.html'
    );
    const html = await fs.readFile(filename, 'utf8');
    await fs.writeFile(
      filename,
      html
        .replace(
          '<title>Clean Limited Provider | Limited Directory Listing</title>',
          '<title>Clean Limited Provider | Certified Estate Appraisals</title>'
        )
        .replace(
          '"url":"https://antique-appraiser-directory.appraisily.com/appraiser/clean-limited-provider/"',
          '"address":{"@type":"PostalAddress","addressLocality":"Claimed City"},"serviceType":"Estate appraisal","url":"https://antique-appraiser-directory.appraisily.com/appraiser/clean-limited-provider/"'
        )
        .replace(
          '<h2>What has been checked</h2>',
          '<h2>Specialties</h2>'
        )
    );
    const result = await checkDirectoryEnrichmentContract(context);
    const failure = result.failures.find(
      (entry) =>
        entry.code === 'LIMITED_PROFILE_CLAIM_SCOPE_EXCEEDED' &&
        entry.route === '/appraiser/clean-limited-provider/'
    );
    assert.ok(failure, JSON.stringify(result.failures, null, 2));
    assert.match(failure.detail, /schema-fields:address,serviceType/);
    assert.match(failure.detail, /unsupported-headings:Specialties/);
    assert.match(failure.detail, /marketing-title/);
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});
