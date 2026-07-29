import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { quarantineUnlinkedCityCards } from '../scripts/quarantine-unlinked-city-cards.mjs';

function cityHtml({ linked = false } = {}) {
  const linkedCard = linked
    ? '<a class="block" href="/appraiser/reviewed-provider/"><h3>Reviewed Provider</h3></a>'
    : '';
  return `<!doctype html><html><head>
    <meta name="geo.placename" content="Fixture City, Test State">
  </head><body>
    <section id="local-appraisers">
      <div><h2>Directory profiles (2)</h2><p>Compare the listed providers.</p></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${linkedCard}
        <article class="block"><h3>Unsupported Provider</h3><p>Unverified specialties and services.</p><span>Profile route unavailable</span></article>
      </div>
    </section>
    <section>
      <h2>How to choose an appraiser</h2>
      <p>This page lists 2 providers.</p>
      <h3>Common specialties you will see</h3>
      <h3>Typical appraisal services</h3>
    </section>
  </body></html>`;
}

async function fixture(options) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'city-card-quarantine-'));
  const publicDir = path.join(root, 'public_site');
  const cityDir = path.join(publicDir, 'location', 'fixture-city');
  await fs.mkdir(cityDir, { recursive: true });
  await fs.writeFile(path.join(cityDir, 'index.html'), cityHtml(options));
  return { root, publicDir, filename: path.join(cityDir, 'index.html') };
}

test('check mode rejects and write mode quarantines an unavailable city card', async () => {
  const context = await fixture();
  try {
    const before = await quarantineUnlinkedCityCards({
      publicDir: context.publicDir,
    });
    assert.equal(before.ok, false);
    assert.equal(before.quarantinedCardCount, 1);

    const written = await quarantineUnlinkedCityCards({
      publicDir: context.publicDir,
      write: true,
    });
    assert.equal(written.ok, true, JSON.stringify(written.failures, null, 2));
    assert.equal(written.remainingUnavailableCardCount, 0);

    const html = await fs.readFile(context.filename, 'utf8');
    assert.doesNotMatch(html, /Unsupported Provider|Profile route unavailable/);
    assert.match(html, /data-directory-empty-state="true"/);
    assert.match(html, /data-city-provider-summary="claim-safe"/);
    assert.doesNotMatch(
      html,
      /This page lists 2 providers|Common specialties you will see/
    );

    const checked = await quarantineUnlinkedCityCards({
      publicDir: context.publicDir,
    });
    assert.equal(checked.ok, true, JSON.stringify(checked.failures, null, 2));
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('mixed grid keeps its crawlable linked card while quarantining unavailable siblings', async () => {
  const context = await fixture({ linked: true });
  try {
    const written = await quarantineUnlinkedCityCards({
      publicDir: context.publicDir,
      write: true,
    });
    assert.equal(written.ok, true, JSON.stringify(written.failures, null, 2));
    const html = await fs.readFile(context.filename, 'utf8');
    assert.match(html, /href="\/appraiser\/reviewed-provider\/"/);
    assert.match(html, /Reviewed Provider/);
    assert.doesNotMatch(html, /Unsupported Provider|Profile route unavailable/);
    assert.match(html, /Source-labeled provider profiles \(1\)/);
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});

test('check mode rejects and write mode repairs stale provider-count guidance after cards are already gone', async () => {
  const context = await fixture();
  try {
    const initialWrite = await quarantineUnlinkedCityCards({
      publicDir: context.publicDir,
      write: true,
    });
    assert.equal(initialWrite.ok, true, JSON.stringify(initialWrite.failures, null, 2));

    const repaired = await fs.readFile(context.filename, 'utf8');
    const staleAgain = repaired.replace(
      '</body>',
      '<section><h2>Old provider summary</h2><p>This page lists 9 providers.</p></section></body>'
    );
    await fs.writeFile(context.filename, staleAgain);

    const before = await quarantineUnlinkedCityCards({
      publicDir: context.publicDir,
    });
    assert.equal(before.ok, false);
    assert.deepEqual(
      before.failures.map((finding) => finding.code),
      ['QUARANTINED_CITY_STALE_PROVIDER_SUMMARY']
    );

    const written = await quarantineUnlinkedCityCards({
      publicDir: context.publicDir,
      write: true,
    });
    assert.equal(written.ok, true, JSON.stringify(written.failures, null, 2));
    const html = await fs.readFile(context.filename, 'utf8');
    assert.doesNotMatch(html, /This page lists 9 providers/);
    assert.match(html, /data-city-provider-summary="claim-safe"/);
  } finally {
    await fs.rm(context.root, { recursive: true, force: true });
  }
});
