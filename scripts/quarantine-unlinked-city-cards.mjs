#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function spliceEdits(source, edits) {
  let output = source;
  for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, edit.start)}${edit.text}${output.slice(edit.end)}`;
  }
  return output;
}

function fullEdit(dom, node, text) {
  if (!node) return null;
  const location = dom.nodeLocation(node);
  if (!location) return null;
  return { start: location.startOffset, end: location.endOffset, text };
}

function cityName(document, slug) {
  return (
    clean(document.querySelector('meta[name="geo.placename" i]')?.content) ||
    clean(document.querySelector('h1')?.textContent) ||
    slug
  );
}

function isProfileLink(node) {
  return Boolean(
    node.matches?.('a[href^="/appraiser/"]') ||
      node.querySelector('a[href^="/appraiser/"]')
  );
}

function isUnavailableCard(node) {
  return (
    !isProfileLink(node) &&
    /profile (?:route |details )?unavailable/i.test(clean(node.textContent))
  );
}

function safeGrid(grid, linkedCards, name) {
  const classes = grid.getAttribute('class') || 'grid grid-cols-1 md:grid-cols-2 gap-6';
  if (linkedCards.length) {
    return `<div class="${escapeHtml(classes)}">${linkedCards
      .map((card) => card.outerHTML)
      .join('')}</div>`;
  }
  return `<div class="${escapeHtml(classes)}"><div class="md:col-span-2 rounded-lg border border-gray-200 bg-white p-6 text-gray-700" data-directory-empty-state="true">No approved crawlable provider profile is currently published for ${escapeHtml(name)}. Legacy records remain quarantined until their identity, source, location relationship, and claim scope pass review.</div></div>`;
}

function safeProviderSectionIntro(count, name) {
  const label = count === 1 ? 'profile' : 'profiles';
  const description = count
    ? `Review ${count} crawlable source-labeled ${label}. Use the linked profile’s exact verification boundary; do not infer specialties, credentials, fees, availability, or local coverage from older directory records.`
    : `No crawlable source-labeled provider profile is currently approved for ${name}. Use the decision guidance or browse other reviewed locations while legacy records remain quarantined.`;
  return {
    heading: `Source-labeled provider profiles (${count})`,
    description,
  };
}

function safeGuidance(name, count) {
  const countSentence = count
    ? `This page currently links ${count} source-labeled provider ${count === 1 ? 'profile' : 'profiles'}.`
    : 'This page currently links no approved provider profile.';
  return `<section data-city-provider-summary="claim-safe" class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
        <h2 class="text-2xl font-semibold text-gray-900">How to evaluate appraisal help for ${escapeHtml(name)}</h2>
        <p class="text-gray-700 leading-relaxed">${countSentence} A business name, old city label, or directory row is not proof of current location, service area, specialty, credentials, inspection mode, assignment fit, report acceptance, fees, or availability.</p>
        <p class="text-gray-700 leading-relaxed">Before engagement, ask the intended recipient what value basis, signer qualifications, inspection scope, effective date, research, and report format it requires. Then review <a class="text-blue-700 underline hover:no-underline" href="/methodology/">the directory evidence method</a>, compare <a class="text-blue-700 underline hover:no-underline" href="/antique-appraisers-near-me/">local and online appraisal paths</a>, and prepare the <a class="text-blue-700 underline hover:no-underline" href="/methodology/#preparation-checklist">item, photo, and document checklist</a>.</p>
        <div class="flex flex-wrap gap-3">
          <a class="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-4 py-2 font-medium text-blue-700" href="https://appraisily.com/sample-reports">Review sample reports</a>
          <a class="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white" href="https://appraisily.com/screener?utm_source=directory&amp;utm_medium=claim_safe_city_guidance">Try the online first look</a>
        </div>
      </section>`;
}

async function inspectFile(filename, publicDir, write) {
  const source = await fs.readFile(filename, 'utf8');
  const dom = new JSDOM(source, { includeNodeLocations: true });
  const { document } = dom.window;
  const providerSection = document.querySelector('#local-appraisers');
  const grid = providerSection?.querySelector('.grid');
  if (!providerSection || !grid) {
    dom.window.close();
    return { changed: false, quarantinedCardCount: 0, failures: [] };
  }

  const children = [...grid.children];
  const unavailableCards = children.filter(isUnavailableCard);
  const staleGuidance = [...document.querySelectorAll('section')].find(
    (section) =>
      /This page lists \d+ providers|Common specialties you will see|Typical appraisal services/i.test(
        clean(section.textContent)
      )
  );
  if (!unavailableCards.length && !staleGuidance) {
    dom.window.close();
    return {
      changed: false,
      quarantinedCardCount: 0,
      failures: [],
    };
  }

  const relative = path.relative(publicDir, filename);
  const slug = path.basename(path.dirname(filename));
  const name = cityName(document, slug);
  const linkedCards = children.filter(isProfileLink);
  const count = linkedCards.length;
  const edits = [];
  let gridEdit = null;
  let headingEdit = null;
  let introEdit = null;
  if (unavailableCards.length) {
    gridEdit = fullEdit(dom, grid, safeGrid(grid, linkedCards, name));
    if (gridEdit) edits.push(gridEdit);

    const heading = providerSection.querySelector('h2');
    const intro = heading?.parentElement?.querySelector('p');
    const safeIntro = safeProviderSectionIntro(count, name);
    headingEdit = fullEdit(
      dom,
      heading,
      `<h2 class="${escapeHtml(heading?.getAttribute('class') || 'text-2xl font-semibold text-gray-900')}">${escapeHtml(safeIntro.heading)}</h2>`
    );
    introEdit = fullEdit(
      dom,
      intro,
      `<p class="${escapeHtml(intro?.getAttribute('class') || 'text-gray-700 leading-relaxed')}">${escapeHtml(safeIntro.description)}</p>`
    );
    if (headingEdit) edits.push(headingEdit);
    if (introEdit) edits.push(introEdit);
  }

  const guidanceEdit = fullEdit(dom, staleGuidance, safeGuidance(name, count));
  if (guidanceEdit) edits.push(guidanceEdit);
  dom.window.close();

  const failures = [];
  const missingUnavailableBoundaries =
    unavailableCards.length > 0 && (!gridEdit || !headingEdit || !introEdit);
  const missingGuidanceBoundary = Boolean(staleGuidance) && !guidanceEdit;
  if (missingUnavailableBoundaries || missingGuidanceBoundary) {
    failures.push({
      path: relative,
      code: 'UNLINKED_CITY_CARD_QUARANTINE_BOUNDARY_MISSING',
      boundaries: {
        grid: Boolean(gridEdit),
        heading: Boolean(headingEdit),
        intro: Boolean(introEdit),
        guidance: Boolean(guidanceEdit),
      },
    });
    return {
      changed: false,
      quarantinedCardCount: unavailableCards.length,
      failures,
    };
  }

  const normalized = spliceEdits(source, edits);
  if (write && normalized !== source) await fs.writeFile(filename, normalized);
  return {
    path: relative,
    changed: normalized !== source,
    quarantinedCardCount: unavailableCards.length,
    remainingLinkedCardCount: count,
    failures,
  };
}

async function validate(publicDir) {
  const failures = [];
  let unavailableCardCount = 0;
  let claimSafeSummaryCount = 0;
  const locationDir = path.join(publicDir, 'location');
  for (const entry of await fs.readdir(locationDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(locationDir, entry.name, 'index.html');
    let source;
    try {
      source = await fs.readFile(filename, 'utf8');
    } catch {
      continue;
    }
    const dom = new JSDOM(source);
    const { document } = dom.window;
    const grid = document.querySelector('#local-appraisers .grid');
    const unavailable = [...(grid?.children ?? [])].filter(isUnavailableCard);
    unavailableCardCount += unavailable.length;
    if (unavailable.length) {
      failures.push({
        route: `/location/${entry.name}/`,
        code: 'UNLINKED_CITY_PROVIDER_CARD',
        count: unavailable.length,
      });
    }
    const safeSummary = document.querySelector(
      'section[data-city-provider-summary="claim-safe"]'
    );
    if (safeSummary) {
      claimSafeSummaryCount += 1;
      if (
        /This page lists \d+ providers|Common specialties you will see|Typical appraisal services/i.test(
          clean(document.body.textContent)
        )
      ) {
        failures.push({
          route: `/location/${entry.name}/`,
          code: 'QUARANTINED_CITY_STALE_PROVIDER_SUMMARY',
        });
      }
    }
    dom.window.close();
  }
  return { unavailableCardCount, claimSafeSummaryCount, failures };
}

export async function quarantineUnlinkedCityCards({
  publicDir,
  write = false,
}) {
  const changedFiles = [];
  let quarantinedCardCount = 0;
  const repairFailures = [];
  const locationDir = path.join(publicDir, 'location');
  for (const entry of await fs.readdir(locationDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(locationDir, entry.name, 'index.html');
    try {
      const result = await inspectFile(filename, publicDir, write);
      quarantinedCardCount += result.quarantinedCardCount;
      if (result.changed) changedFiles.push(result.path);
      repairFailures.push(...result.failures);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const validation = await validate(publicDir);
  const failures = [...repairFailures, ...validation.failures];
  return {
    ok:
      failures.length === 0 &&
      (write
        ? validation.unavailableCardCount === 0
        : quarantinedCardCount === 0 && changedFiles.length === 0),
    mode: write ? 'write' : 'check',
    quarantinedCardCount,
    changedFileCount: changedFiles.length,
    changedFiles: changedFiles.sort(),
    remainingUnavailableCardCount: validation.unavailableCardCount,
    claimSafeSummaryCount: validation.claimSafeSummaryCount,
    failures,
  };
}

const isCli = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isCli) {
  const result = await quarantineUnlinkedCityCards({
    publicDir: path.resolve(readArg('--public-dir', 'public_site')),
    write: process.argv.includes('--write'),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
