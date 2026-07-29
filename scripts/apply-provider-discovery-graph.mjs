#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const publicDirIndex = args.indexOf('--public-dir');
const publicDir = path.resolve(
  publicDirIndex >= 0 ? args[publicDirIndex + 1] : 'public_site',
);
const write = args.includes('--write');

function isIndexable(html) {
  const robots =
    html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']robots["']/i)?.[1] ??
    '';
  return !/\bnoindex\b/i.test(robots);
}

function injectBeforeBody(html, block) {
  const index = html.lastIndexOf('</body>');
  if (index === -1) throw new Error('HTML has no closing body element');
  return `${html.slice(0, index)}${block}\n${html.slice(index)}`;
}

function stripGeneratedDiscovery(html) {
  return String(html)
    .replace(
      /\s*<script\b[^>]*data-appraisily-schema="provider-discovery"[^>]*>[\s\S]*?<\/script>/g,
      '',
    )
    .replace(
      /\s*<section data-appraisily-provider-discovery="[^"]+"[\s\S]*?<\/section>/g,
      '',
    );
}

function visibleProfileSlugs(html) {
  const slugs = [];
  for (const match of String(html).matchAll(/href=["']\/appraiser\/([^/"']+)\/["']/g)) {
    slugs.push(match[1]);
  }
  return [...new Set(slugs)].sort();
}

const appraisers = JSON.parse(
  await fs.readFile(path.join(publicDir, 'appraisers.json'), 'utf8'),
).appraisers;
const locations = JSON.parse(
  await fs.readFile(path.join(publicDir, 'directory.json'), 'utf8'),
).locations;
const locationsWithHtml = [];
for (const location of locations) {
  const filename = path.join(publicDir, 'location', location.slug, 'index.html');
  let html = '';
  try {
    html = await fs.readFile(filename, 'utf8');
  } catch {
    // Missing location pages cannot be discovery owners.
  }
  const withoutGeneratedDiscovery = stripGeneratedDiscovery(html);
  locationsWithHtml.push({
    ...location,
    filename,
    html,
    withoutGeneratedDiscovery,
    indexable: Boolean(html) && isIndexable(html),
    visibleProfileSlugs: visibleProfileSlugs(withoutGeneratedDiscovery),
  });
}

const publishedSlugs = new Set(appraisers.map((provider) => provider.slug));
const cityOwnersByProfile = new Map();
for (const location of locationsWithHtml.filter((entry) => entry.indexable)) {
  for (const slug of location.visibleProfileSlugs) {
    if (!publishedSlugs.has(slug)) continue;
    if (!cityOwnersByProfile.has(slug)) cityOwnersByProfile.set(slug, []);
    cityOwnersByProfile.get(slug).push(location.slug);
  }
}
const hubOnlyProfiles = appraisers.filter(
  (provider) => !cityOwnersByProfile.has(provider.slug),
);

const changedFiles = [];
async function update(filename, transform) {
  const before = await fs.readFile(filename, 'utf8');
  const withoutOld = stripGeneratedDiscovery(before);
  const after = transform(withoutOld);
  if (after === before) return;
  changedFiles.push(path.relative(publicDir, filename));
  if (write) await fs.writeFile(filename, after, 'utf8');
}

for (const location of locationsWithHtml) {
  if (!location.html) continue;
  await update(location.filename, (html) => html);
}
await update(path.join(publicDir, 'location', 'index.html'), (html) => html);
await update(path.join(publicDir, 'index.html'), (html) =>
  html.replace(/\s*·\s*<a href="\/location\/houston\/">Houston<\/a>/, ''),
);

const houstonPath = path.join(publicDir, 'location', 'houston', 'index.html');
await update(houstonPath, (html) => {
  let held = html
    .replace(
      /\s*<script\b[^>]*data-appraisily-schema="verified-fine-art-provider"[^>]*>[\s\S]*?<\/script>/,
      '',
    )
    .replace(
      /\s*<section data-verified-migrated-provider="heidi-vaughan-ma-isa-am"[\s\S]*?<\/section>/,
      '',
    )
    .replace(
      'The source-listed records above remain under separate review; the verified fine-art profile is shown in its own section.',
      'No verified local appraiser profiles are currently listed for Houston.',
    )
    .replace(
      /\s*<section data-appraisily-houston-state="held"[\s\S]*?<\/section>/,
      '',
    );
  const block = `
  <section data-appraisily-houston-state="held" aria-labelledby="houston-held-heading" style="max-width:1120px;margin:32px auto;padding:24px;border:1px solid #dbe4ee;border-radius:14px;background:#f8fafc;">
    <p style="margin:0 0 6px;font-weight:700;color:#475569;">Directory review in progress</p>
    <h2 id="houston-held-heading" style="margin:0 0 8px;">No verified local provider is published for Houston yet</h2>
    <p style="margin:0 0 12px;">Houston remains outside the sitemap while provider identity, credentials, services, and current availability are reviewed. Existing source-listed records are not endorsements or verified local matches.</p>
    <p style="margin:0;"><a href="/location/houston/appraisal-guide/">Read the indexable Houston appraisal guide</a> or <a href="/location/">browse other published locations</a>.</p>
  </section>`;
  return injectBeforeBody(held, block);
});

console.log(
  JSON.stringify(
    {
      action: write
        ? 'applied-provider-discovery-graph'
        : 'planned-provider-discovery-graph',
      publicDir,
      write,
      profileCount: appraisers.length,
      relationshipPolicy:
        'preserve reviewed server-rendered city links; never infer city ownership from appraisers.json addresses',
      exactCityProfileCount: cityOwnersByProfile.size,
      fallbackProfileCount: hubOnlyProfiles.length,
      exactCityOwnerCount: locationsWithHtml.filter(
        (location) => location.indexable && location.visibleProfileSlugs.length > 0,
      ).length,
      cityOwnersByProfile: Object.fromEntries(
        [...cityOwnersByProfile.entries()].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      hubOnlyProfiles: hubOnlyProfiles.map((provider) => provider.slug).sort(),
      changedFileCount: changedFiles.length,
      changedFiles: changedFiles.sort(),
    },
    null,
    2,
  ),
);
if (!write && changedFiles.length > 0) process.exitCode = 1;
