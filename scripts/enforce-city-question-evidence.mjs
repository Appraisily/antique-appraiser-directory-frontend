#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_PUBLIC_DIR = path.join(ROOT, 'public_site');
const DEFAULT_POLICY = path.join(ROOT, 'data', 'city-question-evidence-policy.json');

function parseArgs(argv) {
  const options = {
    publicDir: DEFAULT_PUBLIC_DIR,
    policy: DEFAULT_POLICY,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--policy') options.policy = path.resolve(argv[++index] || '');
    else if (token === '--write') options.write = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isIndexable(document) {
  return !/\bnoindex\b/i.test(document.querySelector('meta[name="robots" i]')?.content || '');
}

function visibleFaqSections(document) {
  return [...document.querySelectorAll('section')].filter(
    (section) =>
      clean(section.querySelector(':scope > h2')?.textContent).toLowerCase() ===
      'frequently asked questions'
  );
}

function faqPages(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (value['@type'] === 'FAQPage') found.push(value);
  for (const child of Object.values(value)) faqPages(child, found);
  return found;
}

function faqSchemaScripts(document) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].filter((script) => {
    try {
      return faqPages(JSON.parse(script.textContent || '')).length > 0;
    } catch {
      return false;
    }
  });
}

function visibleQuestionNames(section) {
  return [...section.querySelectorAll('h3')].map((heading) => clean(heading.textContent));
}

function schemaQuestionNames(script) {
  try {
    return faqPages(JSON.parse(script.textContent || '')).flatMap((page) =>
      (page.mainEntity || [])
        .filter((entity) => entity?.['@type'] === 'Question')
        .map((entity) => clean(entity.name))
    );
  } catch {
    return [];
  }
}

function spliceEdits(source, edits) {
  let output = source;
  for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, edit.start)}${edit.text}${output.slice(edit.end)}`;
  }
  return output;
}

function nodeEdit(dom, node, source) {
  const location = dom.nodeLocation(node);
  if (!location) return null;
  let start = location.startOffset;
  let end = location.endOffset;
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  if (/^[\t ]*$/.test(source.slice(lineStart, start))) start = lineStart;
  if (source.slice(end, end + 2) === '\r\n') end += 2;
  else if (source[end] === '\n') end += 1;
  return { start, end, text: '' };
}

function nonFaqSurfaceFingerprint(source) {
  const dom = new JSDOM(source);
  const { document } = dom.window;
  const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .filter((script) => {
      try {
        return faqPages(JSON.parse(script.textContent || '')).length === 0;
      } catch {
        return true;
      }
    })
    .map((script) => clean(script.textContent));
  const fingerprint = {
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    robots: document.querySelector('meta[name="robots" i]')?.content || '',
    profileHrefs: [...document.querySelectorAll('a[href*="/appraiser/"]')]
      .map((link) => link.getAttribute('href'))
      .sort(),
    nonFaqSchemas: schemas,
    authoritativeCityMarkers: document.querySelectorAll(
      '[data-directory-static-authoritative="true"]'
    ).length,
    comparisonRows: document.querySelectorAll(
      '[data-shared-evergreen="city-provider-comparison"] tbody tr'
    ).length,
  };
  dom.window.close();
  return JSON.stringify(fingerprint);
}

function approvedQuestionMap(policy) {
  const map = new Map();
  for (const entry of policy.approvedCityQuestions || []) {
    if (!/^\/location\/[^/]+\/$/.test(entry.route || '')) {
      throw new Error(`Invalid approved city-question route: ${entry.route || '<missing>'}`);
    }
    if (map.has(entry.route)) {
      throw new Error(`Duplicate approved city-question route: ${entry.route}`);
    }
    const questions = entry.questions || [];
    if (
      !questions.length ||
      questions.some(
        (question) =>
          !clean(question.question) ||
          !Array.isArray(question.evidenceIds) ||
          question.evidenceIds.length === 0
      )
    ) {
      throw new Error(
        `${entry.route} requires non-empty questions and evidenceIds before FAQ publication`
      );
    }
    map.set(
      entry.route,
      questions.map((question) => clean(question.question))
    );
  }
  return map;
}

async function loadPolicy(filename) {
  const policy = JSON.parse(await fs.readFile(filename, 'utf8'));
  if (policy.schemaVersion !== 1) {
    throw new Error(`Unsupported city-question policy schema: ${policy.schemaVersion}`);
  }
  approvedQuestionMap(policy);
  return policy;
}

async function inspectFile(filename, publicDir, approvals, write) {
  const source = await fs.readFile(filename, 'utf8');
  const dom = new JSDOM(source, { includeNodeLocations: true });
  const { document } = dom.window;
  if (!isIndexable(document)) {
    dom.window.close();
    return { changed: false, removedQuestionCount: 0, removedSchemaCount: 0, failures: [] };
  }

  const slug = path.basename(path.dirname(filename));
  const route = `/location/${slug}/`;
  if (approvals.has(route)) {
    dom.window.close();
    return { changed: false, removedQuestionCount: 0, removedSchemaCount: 0, failures: [] };
  }

  const sections = visibleFaqSections(document);
  const scripts = faqSchemaScripts(document);
  const edits = [...sections, ...scripts].map((node) => nodeEdit(dom, node, source));
  const removedQuestionCount = sections.reduce(
    (total, section) => total + visibleQuestionNames(section).length,
    0
  );
  dom.window.close();

  if (edits.some((edit) => !edit)) {
    return {
      changed: false,
      removedQuestionCount,
      removedSchemaCount: scripts.length,
      failures: [{ route, code: 'CITY_FAQ_SOURCE_BOUNDARY_MISSING' }],
    };
  }

  const normalized = spliceEdits(source, edits);
  if (normalized !== source) {
    const before = nonFaqSurfaceFingerprint(source);
    const after = nonFaqSurfaceFingerprint(normalized);
    if (before !== after) {
      return {
        changed: false,
        removedQuestionCount,
        removedSchemaCount: scripts.length,
        failures: [{ route, code: 'CITY_FAQ_REMOVAL_CHANGED_NON_FAQ_SURFACE' }],
      };
    }
    if (write) await fs.writeFile(filename, normalized);
  }

  return {
    path: path.relative(publicDir, filename),
    changed: normalized !== source,
    removedQuestionCount,
    removedSchemaCount: scripts.length,
    failures: [],
  };
}

async function validate(publicDir, policy, approvals) {
  const failures = [];
  const routes = new Set();
  let indexableCityCount = 0;
  let visibleFaqSectionCount = 0;
  let faqSchemaCount = 0;
  let visibleQuestionCount = 0;
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
    if (!isIndexable(document)) {
      dom.window.close();
      continue;
    }

    indexableCityCount += 1;
    const route = `/location/${entry.name}/`;
    routes.add(route);
    const sections = visibleFaqSections(document);
    const scripts = faqSchemaScripts(document);
    const visibleQuestions = sections.flatMap(visibleQuestionNames);
    const schemaQuestions = scripts.flatMap(schemaQuestionNames);
    visibleFaqSectionCount += sections.length;
    faqSchemaCount += scripts.length;
    visibleQuestionCount += visibleQuestions.length;
    const approved = approvals.get(route);

    if (!approved && (sections.length || scripts.length)) {
      failures.push({
        route,
        code: 'UNMEASURED_CITY_FAQ_SURFACE',
        visibleSections: sections.length,
        faqSchemas: scripts.length,
        visibleQuestions: visibleQuestions.length,
      });
    } else if (approved) {
      if (
        sections.length !== 1 ||
        scripts.length !== 1 ||
        JSON.stringify(visibleQuestions) !== JSON.stringify(approved) ||
        JSON.stringify(schemaQuestions) !== JSON.stringify(approved)
      ) {
        failures.push({
          route,
          code: 'APPROVED_CITY_FAQ_PARITY_MISMATCH',
          approved,
          visibleQuestions,
          schemaQuestions,
          visibleSections: sections.length,
          faqSchemas: scripts.length,
        });
      }
    }
    dom.window.close();
  }

  if (indexableCityCount !== policy.expectedIndexableCityCount) {
    failures.push({
      code: 'INDEXABLE_CITY_COUNT_DRIFT',
      expected: policy.expectedIndexableCityCount,
      actual: indexableCityCount,
    });
  }
  for (const route of approvals.keys()) {
    if (!routes.has(route)) {
      failures.push({ route, code: 'APPROVED_CITY_FAQ_ROUTE_NOT_INDEXABLE' });
    }
  }

  return {
    indexableCityCount,
    approvedCityCount: approvals.size,
    visibleFaqSectionCount,
    faqSchemaCount,
    visibleQuestionCount,
    failures,
  };
}

export async function run(options) {
  const policy = await loadPolicy(options.policy);
  const approvals = approvedQuestionMap(policy);
  const changedFiles = [];
  const inspectionFailures = [];
  let removedQuestionCount = 0;
  let removedSchemaCount = 0;
  const locationDir = path.join(options.publicDir, 'location');

  for (const entry of await fs.readdir(locationDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(locationDir, entry.name, 'index.html');
    try {
      const result = await inspectFile(filename, options.publicDir, approvals, options.write);
      if (result.changed) changedFiles.push(result.path);
      removedQuestionCount += result.removedQuestionCount;
      removedSchemaCount += result.removedSchemaCount;
      inspectionFailures.push(...result.failures);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  const validation = await validate(options.publicDir, policy, approvals);
  const pendingChanges = options.write
    ? []
    : changedFiles.map((file) => ({ file, code: 'PENDING_UNMEASURED_CITY_FAQ_REMOVAL' }));
  const failures = [...inspectionFailures, ...pendingChanges, ...validation.failures];

  return {
    action: options.write
      ? 'removed-unmeasured-city-faqs'
      : 'checked-city-question-evidence',
    ok: failures.length === 0,
    mode: options.write ? 'write' : 'check',
    policy: {
      reviewedAt: policy.reviewedAt,
      packetCount: policy.evidenceSnapshot?.packetCount,
      measuredQuestionCount: policy.evidenceSnapshot?.measuredQuestionCount,
      peopleAlsoAskCount: policy.evidenceSnapshot?.peopleAlsoAskCount,
      relatedSearchCount: policy.evidenceSnapshot?.relatedSearchCount,
    },
    changedFileCount: changedFiles.length,
    changedFiles,
    removedQuestionCount,
    removedSchemaCount,
    ...validation,
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
