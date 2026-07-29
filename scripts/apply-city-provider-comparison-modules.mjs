#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_PUBLIC_DIR = path.join(ROOT, 'public_site');
const DEFAULT_MANIFEST = path.join(ROOT, 'data/provider-publication-manifest.json');
const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const UPDATED_DATE = '2026-07-29';
const MODULE_PATTERN =
  /<section\b[^>]*data-dpe005-provider-comparison=["'][^"']+["'][^>]*>[\s\S]*?<\/section>/i;
const ROOT_CLOSE_PATTERN =
  /\n {4}<\/div>\n {2}<\/div>\n[ \t]*\n {2}<script>/;

function parseArgs(argv) {
  const options = {
    publicDir: DEFAULT_PUBLIC_DIR,
    manifest: DEFAULT_MANIFEST,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--manifest') options.manifest = path.resolve(argv[++index] || '');
    else if (token === '--write') options.write = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanRoute(value) {
  try {
    const url = new URL(String(value || ''), ORIGIN);
    let pathname = url.pathname.replace(/\/+/g, '/');
    if (!pathname.endsWith('/')) pathname += '/';
    return pathname;
  } catch {
    return '';
  }
}

function schemas(document) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(
    (script) => {
      try {
        const payload = JSON.parse(script.textContent);
        return Array.isArray(payload) ? payload : [payload];
      } catch {
        return [];
      }
    }
  );
}

function isIndexable(document) {
  return !/\bnoindex\b/i.test(
    document.querySelector('meta[name="robots" i]')?.content || ''
  );
}

function providerRows(document) {
  const rows = new Map();
  for (const record of schemas(document)) {
    const types = Array.isArray(record?.['@type'])
      ? record['@type']
      : [record?.['@type']];
    if (!types.includes('ItemList')) continue;
    for (const item of Array.isArray(record.itemListElement)
      ? record.itemListElement
      : []) {
      const route = cleanRoute(item?.url || item?.item?.url);
      if (!/^\/appraiser\/[^/]+\/$/.test(route)) continue;
      rows.set(route, {
        route,
        slug: route.split('/').filter(Boolean).at(-1),
        name: String(item?.name || item?.item?.name || '').trim(),
      });
    }
  }
  return [...rows.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function coordinates(document) {
  const value = document.querySelector('meta[name="ICBM" i]')?.content || '';
  const [latitude, longitude] = value.split(/[;,]/).map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function radians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const firstLatitude = radians(left.latitude);
  const secondLatitude = radians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!value || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function quickFacts(document) {
  for (const section of document.querySelectorAll('section')) {
    if (section.querySelector('h2')?.textContent.trim() !== 'Quick facts') continue;
    const facts = {};
    for (const term of section.querySelectorAll('dt')) {
      const description = term.nextElementSibling;
      if (description?.tagName !== 'DD') continue;
      facts[term.textContent.trim().toLowerCase()] =
        description.textContent.replace(/\s+/g, ' ').trim();
    }
    return facts;
  }
  return {};
}

async function readProfileFacts(publicDir, provider) {
  const filename = path.join(
    publicDir,
    'appraiser',
    provider.slug,
    'index.html'
  );
  const html = await fs.readFile(filename, 'utf8');
  const dom = new JSDOM(html);
  const facts = quickFacts(dom.window.document);
  dom.window.close();
  return facts;
}

function cell(value) {
  return escapeHtml(value || 'Confirm directly');
}

export function renderComparisonModule({ city, providers, alternatives }) {
  if (!providers.length) throw new Error('Comparison module requires providers');
  if (providers.length >= 3) {
    throw new Error(
      `${city.slug} has ${providers.length} providers and requires a separately designed filter control`
    );
  }
  const verifiedCount = providers.filter(
    (provider) => provider.publicationStatus === 'verified'
  ).length;
  const limitedCount = providers.filter(
    (provider) => provider.publicationStatus === 'limited'
  ).length;
  const rows = providers
    .map((provider) => {
      const isVerified = provider.publicationStatus === 'verified';
      const state = isVerified ? 'Verified' : 'Source-listed';
      const stateDetail = isVerified
        ? 'approved claim scope'
        : 'identity and official website only';
      const unknown = 'Not independently verified — confirm directly';
      const specialty = isVerified ? provider.facts.specialty : unknown;
      const assignment = isVerified ? provider.facts['assignment fit'] : unknown;
      const inspection = isVerified ? provider.facts['inspection mode'] : unknown;
      const serviceArea = isVerified
        ? `Primary location: ${provider.facts['primary location'] || 'confirm directly'}; confirm service area and travel directly`
        : unknown;
      const fees = isVerified ? provider.facts['fees and timing'] : unknown;
      return `            <tr class="border-t border-slate-200 align-top">
              <th scope="row" class="px-3 py-3 text-left font-semibold text-gray-900">
                <a class="text-blue-700 underline hover:no-underline" href="${escapeHtml(provider.route)}">${escapeHtml(provider.name)}</a>
                <span class="mt-1 block text-xs font-normal text-slate-600">${state} · ${stateDetail} · checked ${escapeHtml(provider.reviewDate)}</span>
              </th>
              <td class="px-3 py-3 text-slate-700">${cell(specialty)}</td>
              <td class="px-3 py-3 text-slate-700">${cell(assignment)}</td>
              <td class="px-3 py-3 text-slate-700">${cell(inspection)}</td>
              <td class="px-3 py-3 text-slate-700">${cell(serviceArea)}</td>
              <td class="px-3 py-3 text-slate-700">${cell(fees)}</td>
            </tr>`;
    })
    .join('\n');
  const alternativeLinks = alternatives
    .map(
      (alternative) =>
        `<a class="text-blue-700 underline hover:no-underline" href="/location/${escapeHtml(alternative.slug)}/">${escapeHtml(alternative.label)}</a>`
    )
    .join(' · ');

  return `<section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5" data-dpe005-provider-comparison="${UPDATED_DATE}" data-shared-evergreen="city-provider-comparison" data-city-slug="${escapeHtml(city.slug)}" data-verified-count="${verifiedCount}" data-source-listed-count="${limitedCount}" data-filter-policy="withheld-provider-count-below-3">
      <div class="space-y-2">
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-700">Claim-safe provider comparison</p>
        <h2 class="text-2xl font-semibold text-gray-900">Compare the published ${escapeHtml(city.label)} profiles</h2>
        <p class="text-gray-700 leading-relaxed">This page has ${verifiedCount} verified and ${limitedCount} source-listed ${providers.length === 1 ? 'profile' : 'profiles'}. “Source-listed” means the directory checked the business identity and official website only; it does not establish location, specialty, credentials, inspection mode, assignment fit, fees, or availability.</p>
      </div>
      <div class="overflow-x-auto rounded-lg border border-slate-200" style="max-width:100%;overflow-x:auto" role="region" aria-label="${escapeHtml(city.label)} provider comparison" tabindex="0">
        <table class="w-full border-collapse text-sm" style="min-width:70rem">
          <thead class="bg-slate-50 text-slate-800">
            <tr>
              <th scope="col" class="px-3 py-3 text-left">Provider and trust state</th>
              <th scope="col" class="px-3 py-3 text-left">Specialty</th>
              <th scope="col" class="px-3 py-3 text-left">Assignment purpose</th>
              <th scope="col" class="px-3 py-3 text-left">Inspection mode</th>
              <th scope="col" class="px-3 py-3 text-left">Service area</th>
              <th scope="col" class="px-3 py-3 text-left">Public fee basis</th>
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="text-sm text-slate-700">Filters are intentionally withheld because this page has fewer than three published profiles. Open a profile for its source log, exact claim scope, and correction route; a city-page presence is not proof of a provider’s current service radius.</p>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg bg-slate-50 p-4">
          <h3 class="font-semibold text-gray-900">Choose and prepare</h3>
          <p class="mt-2 text-sm text-slate-700">Review <a class="text-blue-700 underline hover:no-underline" href="/methodology/">trust states, credentials, and fee conflicts</a>; compare <a class="text-blue-700 underline hover:no-underline" href="/antique-appraisers-near-me/">local and online appraisal paths</a>; and use the <a class="text-blue-700 underline hover:no-underline" href="/methodology/#preparation-checklist">printable item, photo, and document checklist</a>.</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-4">
          <h3 class="font-semibold text-gray-900">Related evidence and online routes</h3>
          <p class="mt-2 text-sm text-slate-700"><a class="text-blue-700 underline hover:no-underline" href="https://appraisily.com/sample-reports">Review sample reports</a>, compare the <a class="text-blue-700 underline hover:no-underline" href="https://appraisily.com/art">online art appraisal route</a> and <a class="text-blue-700 underline hover:no-underline" href="https://appraisily.com/antiques">online antique appraisal route</a>, or use the page-specific local decision guidance above.</p>
        </div>
      </div>
      <div class="rounded-lg border border-slate-200 p-4">
        <h3 class="font-semibold text-gray-900">Nearby directory alternatives with published profiles</h3>
        <p class="mt-2 text-sm text-slate-700">${alternativeLinks}. These are nearby city pages with actual published profile inventory, not claims that any provider serves ${escapeHtml(city.label)}.</p>
      </div>
      <p class="text-xs text-slate-600">Reviewer: Appraisily Directory Research Team · Source policy: publication manifest plus each linked profile’s source log · Module updated July 29, 2026.</p>
    </section>`;
}

function uniqueProfileRoutes(html) {
  return [
    ...new Set(
      [...String(html).matchAll(/href=["']([^"']*\/appraiser\/[^"']+)["']/gi)]
        .map((match) => cleanRoute(match[1]))
        .filter((route) => /^\/appraiser\/[^/]+\/$/.test(route))
    ),
  ].sort();
}

async function cityInventory(publicDir) {
  const locationDir = path.join(publicDir, 'location');
  const cities = [];
  for (const entry of await fs.readdir(locationDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(locationDir, entry.name, 'index.html');
    let html;
    try {
      html = await fs.readFile(filename, 'utf8');
    } catch {
      continue;
    }
    const dom = new JSDOM(html);
    const document = dom.window.document;
    if (!isIndexable(document)) {
      dom.window.close();
      continue;
    }
    const providers = providerRows(document);
    const label =
      document.querySelector('meta[name="geo.placename" i]')?.content ||
      entry.name.replaceAll('-', ' ');
    cities.push({
      slug: entry.name,
      filename,
      html,
      label,
      coordinates: coordinates(document),
      providers,
    });
    dom.window.close();
  }
  return cities;
}

async function buildExpected({ publicDir, manifest }) {
  const payload = JSON.parse(await fs.readFile(manifest, 'utf8'));
  const manifestMap = new Map(
    (Array.isArray(payload) ? payload : payload.providers || []).map((provider) => [
      provider.slug,
      provider,
    ])
  );
  const cities = await cityInventory(publicDir);
  const eligible = cities.filter((city) => city.providers.length > 0);
  const expected = new Map();

  for (const city of eligible) {
    const providers = [];
    for (const row of city.providers) {
      const manifestEntry = manifestMap.get(row.slug);
      if (!['verified', 'limited'].includes(manifestEntry?.publicationStatus)) {
        throw new Error(
          `/location/${city.slug}/ links ${row.route} without an eligible manifest state`
        );
      }
      const reviewDate = formatDate(manifestEntry.verifiedAt);
      if (!reviewDate) {
        throw new Error(`${row.route} has no valid manifest review date`);
      }
      providers.push({
        ...row,
        name: row.name || manifestEntry.name,
        publicationStatus: manifestEntry.publicationStatus,
        reviewDate,
        facts:
          manifestEntry.publicationStatus === 'verified'
            ? await readProfileFacts(publicDir, row)
            : {},
      });
    }
    const alternatives = eligible
      .filter((candidate) => candidate.slug !== city.slug)
      .map((candidate) => ({
        slug: candidate.slug,
        label: candidate.label,
        distance: distanceKm(city.coordinates, candidate.coordinates),
      }))
      .sort(
        (left, right) =>
          left.distance - right.distance || left.slug.localeCompare(right.slug)
      )
      .slice(0, 3);
    expected.set(
      city.slug,
      renderComparisonModule({ city, providers, alternatives })
    );
  }
  return { cities, eligible, expected };
}

function applyModule(html, module, slug) {
  if (MODULE_PATTERN.test(html)) return html.replace(MODULE_PATTERN, module);
  const approvedProviderSection =
    /(<section\b[^>]*data-approved-provider-packet=["'][^"']+["'][^>]*>[\s\S]*?<\/section>)/i;
  if (approvedProviderSection.test(html)) {
    return html.replace(approvedProviderSection, `$1\n${module}`);
  }
  const match = html.match(ROOT_CLOSE_PATTERN);
  if (!match) {
    throw new Error(`/location/${slug}/ static city root closing anchor not found`);
  }
  return html.replace(
    ROOT_CLOSE_PATTERN,
    `\n${module}\n    </div>\n  </div>\n\n  <script>`
  );
}

async function validate({ cities, eligible, expected }) {
  const failures = [];
  const eligibleSlugs = new Set(eligible.map((city) => city.slug));
  let moduleCount = 0;
  let tableRowCount = 0;

  for (const city of cities) {
    const html = await fs.readFile(city.filename, 'utf8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const modules = document.querySelectorAll(
      'section[data-dpe005-provider-comparison]'
    );
    if (!eligibleSlugs.has(city.slug)) {
      if (modules.length) {
        failures.push({
          route: `/location/${city.slug}/`,
          code: 'PROVIDERLESS_CITY_HAS_COMPARISON_MODULE',
        });
      }
      dom.window.close();
      continue;
    }
    moduleCount += modules.length;
    if (modules.length !== 1) {
      failures.push({
        route: `/location/${city.slug}/`,
        code: 'CITY_COMPARISON_MODULE_COUNT',
        actual: modules.length,
      });
      dom.window.close();
      continue;
    }
    const module = modules[0];
    const rows = module.querySelectorAll('tbody tr');
    tableRowCount += rows.length;
    const expectedProviders = city.providers.map((provider) => provider.route).sort();
    const actualProviders = [
      ...new Set(
        [...module.querySelectorAll('a[href*="/appraiser/"]')]
          .map((link) => cleanRoute(link.getAttribute('href')))
          .filter(Boolean)
      ),
    ].sort();
    if (
      rows.length !== expectedProviders.length ||
      JSON.stringify(actualProviders) !== JSON.stringify(expectedProviders)
    ) {
      failures.push({
        route: `/location/${city.slug}/`,
        code: 'CITY_COMPARISON_PROVIDER_MISMATCH',
        rows: rows.length,
        expectedProviders,
        actualProviders,
      });
    }
    if (module.outerHTML !== new JSDOM(expected.get(city.slug)).window.document.body.firstElementChild.outerHTML) {
      failures.push({
        route: `/location/${city.slug}/`,
        code: 'CITY_COMPARISON_MODULE_DRIFT',
      });
    }
    dom.window.close();
  }
  return { moduleCount, tableRowCount, failures };
}

export async function run(options) {
  const inventory = await buildExpected(options);
  const changedFiles = [];
  for (const city of inventory.eligible) {
    const originalRoutes = uniqueProfileRoutes(city.html);
    const next = applyModule(
      city.html,
      inventory.expected.get(city.slug),
      city.slug
    );
    const nextRoutes = uniqueProfileRoutes(next);
    if (JSON.stringify(originalRoutes) !== JSON.stringify(nextRoutes)) {
      throw new Error(
        `/location/${city.slug}/ provider relationship changed while adding comparison module`
      );
    }
    if (next !== city.html) {
      changedFiles.push(path.relative(ROOT, city.filename));
      if (options.write) await fs.writeFile(city.filename, next);
    }
  }

  const validation = await validate(inventory);
  const failures = [
    ...(!options.write
      ? changedFiles.map((file) => ({
          file,
          code: 'PENDING_CITY_PROVIDER_COMPARISON_MODULE',
        }))
      : []),
    ...validation.failures,
  ];
  return {
    action: options.write
      ? 'applied-city-provider-comparison-modules'
      : 'checked-city-provider-comparison-modules',
    ok: failures.length === 0,
    mode: options.write ? 'write' : 'check',
    indexableCityCount: inventory.cities.length,
    eligibleCityCount: inventory.eligible.length,
    providerlessCityCount:
      inventory.cities.length - inventory.eligible.length,
    providerRowCount: inventory.eligible.reduce(
      (total, city) => total + city.providers.length,
      0
    ),
    moduleCount: validation.moduleCount,
    tableRowCount: validation.tableRowCount,
    changedFileCount: changedFiles.length,
    changedFiles,
    failures,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const result = await run(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
