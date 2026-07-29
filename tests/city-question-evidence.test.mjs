import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { run } from '../scripts/enforce-city-question-evidence.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function cityHtml({ question = 'How much does an appraisal cost in Example City?' } = {}) {
  return `<!doctype html>
<html>
  <head>
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://example.test/location/example-city/">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","url":"https://example.test/appraiser/example-provider/"}]}</script>
    <script type="application/ld+json" data-appraisily-schema="faq-visible">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"${question}","acceptedAnswer":{"@type":"Answer","text":"Generic answer."}}]}</script>
  </head>
  <body>
    <section data-directory-static-authoritative="true" data-city-slug="example-city">
      <a href="/appraiser/example-provider/">Example Provider</a>
    </section>
    <section>
      <h2>Frequently asked questions</h2>
      <div><h3>${question}</h3><p>Generic answer.</p></div>
    </section>
  </body>
</html>`;
}

async function fixture(policyOverrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'city-question-evidence-'));
  const publicDir = path.join(root, 'public_site');
  const cityDir = path.join(publicDir, 'location', 'example-city');
  await fs.mkdir(cityDir, { recursive: true });
  await fs.writeFile(path.join(cityDir, 'index.html'), cityHtml());
  const policy = {
    schemaVersion: 1,
    reviewedAt: '2026-07-29',
    expectedIndexableCityCount: 1,
    evidenceSnapshot: {
      packetCount: 1,
      measuredQuestionCount: 0,
      peopleAlsoAskCount: 0,
      relatedSearchCount: 0,
    },
    approvedCityQuestions: [],
    ...policyOverrides,
  };
  const policyFile = path.join(root, 'policy.json');
  await fs.writeFile(policyFile, JSON.stringify(policy));
  return { root, publicDir, policyFile, cityDir };
}

test('unmeasured city FAQ is removed without changing provider or non-FAQ schema surfaces', async () => {
  const f = await fixture();
  try {
    const before = await run({ publicDir: f.publicDir, policy: f.policyFile, write: false });
    assert.equal(before.ok, false);
    assert.equal(before.changedFileCount, 1);
    assert.equal(before.removedQuestionCount, 1);
    assert.ok(
      before.failures.some(
        (failure) => failure.code === 'PENDING_UNMEASURED_CITY_FAQ_REMOVAL'
      )
    );

    const written = await run({ publicDir: f.publicDir, policy: f.policyFile, write: true });
    assert.equal(written.ok, true, JSON.stringify(written.failures, null, 2));
    assert.equal(written.changedFileCount, 1);
    const html = await fs.readFile(path.join(f.cityDir, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /FAQPage|Frequently asked questions/);
    assert.match(html, /"@type":"ItemList"/);
    assert.match(html, /href="\/appraiser\/example-provider\/"/);

    const after = await run({ publicDir: f.publicDir, policy: f.policyFile, write: false });
    assert.equal(after.ok, true, JSON.stringify(after.failures, null, 2));
    assert.equal(after.changedFileCount, 0);
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});

test('approved city question requires exact visible and schema parity', async () => {
  const question = 'How much does an appraisal cost in Example City?';
  const f = await fixture({
    approvedCityQuestions: [
      {
        route: '/location/example-city/',
        questions: [{ question, evidenceIds: ['gsc:example-query'] }],
      },
    ],
  });
  try {
    const exact = await run({ publicDir: f.publicDir, policy: f.policyFile, write: false });
    assert.equal(exact.ok, true, JSON.stringify(exact.failures, null, 2));

    const filename = path.join(f.cityDir, 'index.html');
    const mismatched = (await fs.readFile(filename, 'utf8')).replace(
      `<h3>${question}</h3>`,
      '<h3>Unapproved question?</h3>'
    );
    await fs.writeFile(filename, mismatched);
    const rejected = await run({ publicDir: f.publicDir, policy: f.policyFile, write: false });
    assert.equal(rejected.ok, false);
    assert.ok(
      rejected.failures.some(
        (failure) => failure.code === 'APPROVED_CITY_FAQ_PARITY_MISMATCH'
      )
    );
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});

test('current indexable city artifact contains no unmeasured FAQ surface', async () => {
  const result = await run({
    publicDir: path.join(ROOT, 'public_site'),
    policy: path.join(ROOT, 'data', 'city-question-evidence-policy.json'),
    write: false,
  });
  assert.equal(result.ok, true, JSON.stringify(result.failures, null, 2));
  assert.equal(result.indexableCityCount, 85);
  assert.equal(result.approvedCityCount, 0);
  assert.equal(result.visibleFaqSectionCount, 0);
  assert.equal(result.faqSchemaCount, 0);
  assert.equal(result.visibleQuestionCount, 0);
});
