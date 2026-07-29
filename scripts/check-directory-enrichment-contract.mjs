#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_PUBLIC_DIR = path.join(ROOT, 'public_site');
const DEFAULT_MANIFEST = path.join(ROOT, 'data/provider-publication-manifest.json');
const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const RETIRED_HOSTS = [
  'artappraisers.appraisily.com',
  'art-appraisers-directory.appraisily.com',
  'fine-art-appraiser-directory.appraisily.com',
];
const MIGRATED_PROFILES = new Set([
  'afp-art-consulting-llc-fine-art-consulting-appraisals-research-writing-and-collections-man',
  'heidi-vaughan-ma-isa-am',
  'open-to-the-public',
  'sarah-ann-wilson-art-services',
  'st-lifer-art-inc-international-art-appraiser',
]);

function parseArgs(argv) {
  const options = {
    publicDir: DEFAULT_PUBLIC_DIR,
    manifest: DEFAULT_MANIFEST,
    output: null,
    enforce: false,
    similarityThreshold: 0.8,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--manifest') options.manifest = path.resolve(argv[++index] || '');
    else if (token === '--output') options.output = path.resolve(argv[++index] || '');
    else if (token === '--enforce') options.enforce = true;
    else if (token === '--similarity-threshold') {
      options.similarityThreshold = Number(argv[++index]);
    } else throw new Error(`Unknown argument: ${token}`);
  }
  if (
    !Number.isFinite(options.similarityThreshold) ||
    options.similarityThreshold < 0 ||
    options.similarityThreshold > 1
  ) {
    throw new Error('--similarity-threshold must be between 0 and 1');
  }
  return options;
}

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile() && /\.(?:html|json|xml|txt)$/i.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files.sort();
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function visibleText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  return visibleText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function metaContent(html, name) {
  for (const match of String(html).matchAll(/<meta\b([^>]+)>/gi)) {
    const attrs = match[1];
    const metaName =
      attrs.match(/\bname=["']([^"']+)["']/i)?.[1] ||
      attrs.match(/\bproperty=["']([^"']+)["']/i)?.[1];
    if (String(metaName || '').toLowerCase() !== name.toLowerCase()) continue;
    return decodeEntities(attrs.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '');
  }
  return '';
}

function titleText(html) {
  return decodeEntities(
    String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
  ).trim();
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(String(value || ''));
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(value || '').trim().toLowerCase().replace(/\/$/, '');
  }
}

function formatReviewDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function schemas(html) {
  const output = [];
  for (const match of String(html).matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const payload = JSON.parse(match[1]);
      output.push(...(Array.isArray(payload) ? payload : [payload]));
    } catch {
      output.push({ '@type': '__invalid_json_ld__' });
    }
  }
  return output;
}

const LIMITED_PROVIDER_SCHEMA_ALLOWED_FIELDS = new Set([
  '@context',
  '@id',
  '@type',
  'name',
  'image',
  'logo',
  'description',
  'url',
  'sameAs',
]);

const LIMITED_PROVIDER_UNSUPPORTED_HEADINGS =
  /^(?:about|specialt(?:y|ies)|services?|expertise|credentials?|certifications?|assignments?|fees?|pricing|hours?|service area|locations?|reviews?|ratings?|contact)$/i;

const LIMITED_PROVIDER_MARKETING_TERMS = new Set([
  'appraisal',
  'appraisals',
  'appraiser',
  'appraisers',
  'insurance',
  'donation',
  'estate',
  'estates',
  'certified',
  'qualified',
  'uspap',
  'isa',
  'asa',
  'aaa',
]);

function titleResidualTokens(title, providerName) {
  const nameTokens = new Set(normalize(providerName).split(/\s+/).filter(Boolean));
  return normalize(title)
    .split(/\s+/)
    .filter((token) => token && !nameTokens.has(token));
}

function limitedProfileScopeAudit({ html, provider }) {
  const route = `/appraiser/${provider.slug}/`;
  const violations = [];
  const body = visibleText(html);
  const normalizedBody = normalize(body);
  const expectedSource = normalizeSourceUrl(provider.sourceUrl);
  const actualSource = normalizeSourceUrl(
    metaContent(html, 'appraisily:provider-source')
  );
  const status = metaContent(
    html,
    'appraisily:provider-publication-status'
  ).toLowerCase();
  const expectedReviewDate = normalize(formatReviewDate(provider.verifiedAt));
  const declaredScope = [...String(html).matchAll(
    /\bdata-provider-claim-scope=["']([^"']+)["']/gi
  )].map((match) => normalize(match[1]));

  if (status !== 'limited') violations.push('status-meta');
  if (!expectedSource || actualSource !== expectedSource) {
    violations.push('source-meta');
  }
  if (
    !expectedReviewDate ||
    !normalizedBody.includes(expectedReviewDate)
  ) {
    violations.push('review-date');
  }
  if (
    !declaredScope.some((scope) => {
      const tokens = new Set(scope.split(/\s+/).filter(Boolean));
      return (
        tokens.size === 2 &&
        tokens.has('identity') &&
        tokens.has('website')
      );
    })
  ) {
    violations.push('claim-scope-marker');
  }
  if (
    !/\blimited\b/i.test(body) ||
    !/(?:\bnot verified\b|confirm all other details|confirm .* directly)/i.test(
      body
    )
  ) {
    violations.push('visible-scope-boundary');
  }

  const records = schemas(html);
  const professional = records.find((record) =>
    ['ProfessionalService', 'LocalBusiness'].includes(record?.['@type'])
  );
  if (!professional) {
    violations.push('professional-schema');
  } else {
    const extraFields = Object.keys(professional).filter(
      (field) => !LIMITED_PROVIDER_SCHEMA_ALLOWED_FIELDS.has(field)
    );
    if (extraFields.length) {
      violations.push(`schema-fields:${extraFields.sort().join(',')}`);
    }
    if (normalize(professional.name) !== normalize(provider.name)) {
      violations.push('schema-name');
    }
    const schemaSource = normalizeSourceUrl(professional.sameAs);
    if (!schemaSource || schemaSource !== expectedSource) {
      violations.push('schema-source');
    }
    if (
      !/\blimited\b/i.test(String(professional.description || '')) ||
      !/(?:\bnot verified\b|confirm all other details|confirm .* directly)/i.test(
        String(professional.description || '')
      )
    ) {
      violations.push('schema-scope-boundary');
    }
  }

  const unsupportedHeadings = [
    ...String(html).matchAll(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi),
  ]
    .map((match) => visibleText(match[1]))
    .filter((heading) => LIMITED_PROVIDER_UNSUPPORTED_HEADINGS.test(heading));
  if (unsupportedHeadings.length) {
    violations.push(
      `unsupported-headings:${[...new Set(unsupportedHeadings)].sort().join(',')}`
    );
  }
  if (/(?:href=["'](?:tel:|mailto:))|data-provider-phone|data-provider-email/i.test(html)) {
    violations.push('direct-contact');
  }

  const residualTitleTokens = titleResidualTokens(
    titleText(html),
    provider.name
  );
  if (
    residualTitleTokens.some((token) =>
      LIMITED_PROVIDER_MARKETING_TERMS.has(token)
    ) &&
    !normalize(titleText(html)).includes('limited directory listing')
  ) {
    violations.push('marketing-title');
  }

  return {
    route,
    slug: provider.slug,
    sourceUrl: provider.sourceUrl,
    verifiedAt: provider.verifiedAt,
    claimScope: provider.claimScope,
    violations: [...new Set(violations)],
  };
}

function schemaByType(records, type) {
  return records.filter((record) => {
    const types = Array.isArray(record?.['@type'])
      ? record['@type']
      : [record?.['@type']];
    return types.includes(type);
  });
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

function visibleProfileRoutes(html) {
  const routes = [];
  for (const match of String(html).matchAll(
    /href=["']((?:https:\/\/antique-appraiser-directory\.appraisily\.com)?\/appraiser\/[^"'?#]+\/?)["']/gi
  )) {
    const route = cleanRoute(match[1]);
    if (/^\/appraiser\/[^/]+\/$/.test(route)) routes.push(route);
  }
  return [...new Set(routes)].sort();
}

function visibleProfileLabels(html) {
  const labels = [];
  for (const match of String(html).matchAll(
    /<a\b[^>]*href=["']((?:https:\/\/antique-appraiser-directory\.appraisily\.com)?\/appraiser\/[^"'?#]+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const route = cleanRoute(match[1]);
    const heading = match[2].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1];
    const label = visibleText(heading);
    if (route && label) labels.push({ route, label, source: 'visible-card' });
  }
  return labels;
}

function schemaProfileLabels(records) {
  const labels = [];
  for (const itemList of schemaByType(records, 'ItemList')) {
    for (const item of Array.isArray(itemList?.itemListElement)
      ? itemList.itemListElement
      : []) {
      const route = cleanRoute(item?.url || item?.item?.url);
      const label = String(item?.name || item?.item?.name || '').trim();
      if (route && label) labels.push({ route, label, source: 'ItemList' });
    }
  }
  for (const service of schemaByType(records, 'Service')) {
    const providers = Array.isArray(service?.provider)
      ? service.provider
      : service?.provider
        ? [service.provider]
        : [];
    for (const provider of providers) {
      const route = cleanRoute(provider?.url);
      const label = String(provider?.name || '').trim();
      if (route && label) labels.push({ route, label, source: 'Service' });
    }
  }
  return labels;
}

const PROVIDER_IDENTITY_STOPWORDS = new Set([
  'and',
  'the',
  'of',
  'in',
  'for',
  'at',
  'llc',
  'inc',
  'company',
  'co',
  'services',
  'service',
  'appraisal',
  'appraisals',
  'appraiser',
  'appraisers',
  'antique',
  'antiques',
  'art',
  'arts',
  'estate',
  'estates',
  'gallery',
  'galleries',
  'auction',
  'auctions',
  'fine',
  'professional',
  'professionals',
]);

function providerIdentityTokens(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token && !PROVIDER_IDENTITY_STOPWORDS.has(token));
}

function providerLabelsAgree(left, right) {
  const leftTokens = new Set(providerIdentityTokens(left));
  const rightTokens = new Set(providerIdentityTokens(right));
  if (!leftTokens.size || !rightTokens.size) return normalize(left) === normalize(right);
  return [...leftTokens].some((token) => rightTokens.has(token));
}

function unavailableProfileCardCount(html) {
  return [
    ...String(html).matchAll(
      /\bProfile(?:\s+(?:route|details))?\s+unavailable\b/gi
    ),
  ].length;
}

function itemListProfileRoutes(records) {
  const routes = [];
  for (const itemList of schemaByType(records, 'ItemList')) {
    for (const item of Array.isArray(itemList?.itemListElement)
      ? itemList.itemListElement
      : []) {
      const route = cleanRoute(item?.url || item?.item?.url);
      if (/^\/appraiser\/[^/]+\/$/.test(route)) routes.push(route);
    }
  }
  return [...new Set(routes)].sort();
}

function serviceProfileRoutes(records) {
  const routes = [];
  for (const service of schemaByType(records, 'Service')) {
    const providers = Array.isArray(service?.provider)
      ? service.provider
      : service?.provider
        ? [service.provider]
        : [];
    for (const provider of providers) {
      const route = cleanRoute(provider?.url);
      if (/^\/appraiser\/[^/]+\/$/.test(route)) routes.push(route);
    }
  }
  return [...new Set(routes)].sort();
}

function visibleBreadcrumbRoutes(html) {
  const nav = String(html).match(
    /<nav\b[^>]*aria-label=["']Breadcrumb["'][^>]*>([\s\S]*?)<\/nav>/i
  )?.[1];
  if (!nav) return null;
  return [...nav.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => cleanRoute(match[1]))
    .filter(Boolean);
}

function schemaBreadcrumbRoutes(records) {
  const breadcrumb = schemaByType(records, 'BreadcrumbList')[0];
  if (!breadcrumb) return null;
  return (Array.isArray(breadcrumb.itemListElement)
    ? breadcrumb.itemListElement
    : []
  )
    .map((item) => cleanRoute(item?.item))
    .filter(Boolean);
}

function cityParagraphs(html) {
  let source = String(html)
    .replace(
      /<(?:section|aside|div)\b[^>]*data-shared-evergreen[^>]*>[\s\S]*?<\/(?:section|aside|div)>/gi,
      ' '
    )
    .replace(/<(?:header|footer|nav)\b[\s\S]*?<\/(?:header|footer|nav)>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  const output = [];
  for (const match of source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const paragraph = normalize(match[1]);
    if (paragraph.length >= 100) output.push(paragraph);
  }
  return [...new Set(output)];
}

function cityUtilityModules(html) {
  const modules = [];
  const pattern =
    /<section\b(?=[^>]*(?:data-directory-city-utility|data-verified-migrated-provider))[^>]*>([\s\S]*?)<\/section>/gi;
  for (const match of String(html).matchAll(pattern)) {
    const text = normalize(match[1]);
    if (text.length < 200) continue;
    modules.push({
      textLength: text.length,
      providerRoutes: visibleProfileRoutes(match[0]),
    });
  }
  return modules;
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

function cityBodySimilarity(leftParagraphs, rightParagraphs) {
  const candidates = [];
  for (let left = 0; left < leftParagraphs.length; left += 1) {
    for (let right = 0; right < rightParagraphs.length; right += 1) {
      candidates.push({
        left,
        right,
        score: jaccard(
          leftParagraphs[left].split(/\s+/),
          rightParagraphs[right].split(/\s+/)
        ),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const usedLeft = new Set();
  const usedRight = new Set();
  const matches = [];
  for (const candidate of candidates) {
    if (candidate.score < 0.75) break;
    if (usedLeft.has(candidate.left) || usedRight.has(candidate.right)) continue;
    usedLeft.add(candidate.left);
    usedRight.add(candidate.right);
    matches.push(candidate);
  }
  const denominator = Math.max(leftParagraphs.length, rightParagraphs.length);
  return {
    score: denominator ? matches.length / denominator : 0,
    matchedParagraphs: matches.length,
    averageParagraphSimilarity:
      matches.length
        ? matches.reduce((sum, match) => sum + match.score, 0) / matches.length
        : 0,
  };
}

function add(failures, code, route, detail) {
  failures.push({ code, route, detail });
}

async function inspectCity({ filename, publicDir, unresolvedRoutes, failures }) {
  const html = await fs.readFile(filename, 'utf8');
  const route = `/${path
    .relative(publicDir, path.dirname(filename))
    .replaceAll(path.sep, '/')}/`;
  const records = schemas(html);
  const robots = metaContent(html, 'robots').toLowerCase();
  const indexable = !robots.includes('noindex');
  const visibleRoutes = visibleProfileRoutes(html);
  const itemListRoutes = itemListProfileRoutes(records);
  const serviceRoutes = serviceProfileRoutes(records);
  const unavailableCards = unavailableProfileCardCount(html);
  const utilityModules = cityUtilityModules(html);

  if (indexable && visibleRoutes.length === 0) {
    add(
      failures,
      'INDEXABLE_CITY_WITHOUT_ELIGIBLE_PROVIDER',
      route,
      'Indexable city page has no crawlable provider-profile link.'
    );
  }
  if (indexable && utilityModules.length === 0) {
    add(
      failures,
      'INDEXABLE_CITY_WITHOUT_UNIQUE_DECISION_UTILITY',
      route,
      'Indexable city page lacks a reviewed provider-evidence or city-specific decision module with at least 200 visible characters.'
    );
  }
  if (indexable && unavailableCards > 0) {
    add(
      failures,
      'INDEXABLE_CITY_HAS_UNLINKED_PROVIDER_CARDS',
      route,
      `${unavailableCards} visible provider card(s) have no reviewed profile route.`
    );
  }
  if (JSON.stringify(visibleRoutes) !== JSON.stringify(itemListRoutes)) {
    add(
      failures,
      'VISIBLE_ITEMLIST_MISMATCH',
      route,
      `visible=${visibleRoutes.length} itemList=${itemListRoutes.length}`
    );
  }
  if (JSON.stringify(visibleRoutes) !== JSON.stringify(serviceRoutes)) {
    add(
      failures,
      'VISIBLE_SERVICE_MISMATCH',
      route,
      `visible=${visibleRoutes.length} serviceProviders=${serviceRoutes.length}`
    );
  }
  const profileHeadings = new Map();
  for (const entry of [
    ...visibleProfileLabels(html),
    ...schemaProfileLabels(records),
  ]) {
    if (!/^\/appraiser\/[^/]+\/$/.test(entry.route)) continue;
    if (!profileHeadings.has(entry.route)) {
      const profileFilename = path.join(
        publicDir,
        entry.route.replace(/^\/|\/$/g, ''),
        'index.html'
      );
      try {
        const profileHtml = await fs.readFile(profileFilename, 'utf8');
        profileHeadings.set(
          entry.route,
          visibleText(
            profileHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
          )
        );
      } catch {
        profileHeadings.set(entry.route, '');
      }
    }
    const profileHeading = profileHeadings.get(entry.route);
    if (
      profileHeading &&
      !providerLabelsAgree(entry.label, profileHeading)
    ) {
      add(
        failures,
        'CITY_PROVIDER_IDENTITY_MISMATCH',
        route,
        `${entry.source}:${entry.route}:${entry.label} != ${profileHeading}`
      );
    }
  }
  for (const providerRoute of [
    ...visibleRoutes,
    ...itemListRoutes,
    ...serviceRoutes,
  ]) {
    if (unresolvedRoutes.has(providerRoute)) {
      add(
        failures,
        'UNRESOLVED_PROVIDER_DISCOVERABLE',
        route,
        providerRoute
      );
    }
  }
  const visibleBreadcrumbs = visibleBreadcrumbRoutes(html);
  const structuredBreadcrumbs = schemaBreadcrumbRoutes(records);
  if (
    visibleBreadcrumbs &&
    structuredBreadcrumbs &&
    JSON.stringify(visibleBreadcrumbs) !==
      JSON.stringify(structuredBreadcrumbs.slice(0, visibleBreadcrumbs.length))
  ) {
    add(
      failures,
      'BREADCRUMB_SCHEMA_MISMATCH',
      route,
      `visible=${visibleBreadcrumbs.join(',')} schema=${structuredBreadcrumbs.join(',')}`
    );
  }
  return {
    route,
    indexable,
    visibleProviderCount: visibleRoutes.length,
    unavailableProviderCardCount: unavailableCards,
    utilityModuleCount: utilityModules.length,
    itemListProviderCount: itemListRoutes.length,
    serviceProviderCount: serviceRoutes.length,
    paragraphs: indexable ? cityParagraphs(html) : [],
  };
}

async function inspectMigratedProfile({
  filename,
  publicDir,
  failures,
}) {
  const html = await fs.readFile(filename, 'utf8');
  const route = `/${path
    .relative(publicDir, path.dirname(filename))
    .replaceAll(path.sep, '/')}/`;
  const source = metaContent(html, 'appraisily:provider-source');
  const body = visibleText(html);
  const hasReviewDate =
    /\b(?:reviewed|verified)\b[\s\S]{0,100}\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}\b/i.test(
      body
    );
  if (!source || !hasReviewDate) {
    add(
      failures,
      'PROFILE_SOURCE_OR_REVIEW_DATE_MISSING',
      route,
      `source=${Boolean(source)} reviewDate=${hasReviewDate}`
    );
  }
  const records = schemas(html);
  const professional = records.find((record) =>
    ['ProfessionalService', 'LocalBusiness'].includes(record?.['@type'])
  );
  if (!professional) {
    add(failures, 'PROFILE_SCHEMA_MISSING', route, 'No ProfessionalService schema.');
  } else {
    for (const [field, value] of [
      ['name', professional.name],
      ['description', professional.description],
      ['addressLocality', professional.address?.addressLocality],
      ['serviceType', professional.serviceType],
    ]) {
      const needle = normalize(value);
      if (needle && !normalize(body).includes(needle)) {
        add(
          failures,
          'PROFILE_SCHEMA_CLAIM_NOT_VISIBLE',
          route,
          field
        );
      }
    }
  }
  const visibleBreadcrumbs = visibleBreadcrumbRoutes(html);
  const structuredBreadcrumbs = schemaBreadcrumbRoutes(records);
  if (
    visibleBreadcrumbs &&
    structuredBreadcrumbs &&
    JSON.stringify(visibleBreadcrumbs) !==
      JSON.stringify(structuredBreadcrumbs.slice(0, visibleBreadcrumbs.length))
  ) {
    add(
      failures,
      'BREADCRUMB_SCHEMA_MISMATCH',
      route,
      `visible=${visibleBreadcrumbs.join(',')} schema=${structuredBreadcrumbs.join(',')}`
    );
  }
}

export async function checkDirectoryEnrichmentContract(inputOptions = {}) {
  const options = {
    publicDir: path.resolve(inputOptions.publicDir || DEFAULT_PUBLIC_DIR),
    manifest: path.resolve(inputOptions.manifest || DEFAULT_MANIFEST),
    similarityThreshold: inputOptions.similarityThreshold ?? 0.8,
  };
  const manifest = JSON.parse(await fs.readFile(options.manifest, 'utf8'));
  const unresolvedRoutes = new Set(
    (manifest.providers || [])
      .filter((provider) => provider.publicationStatus === 'under_review')
      .map((provider) => `/appraiser/${provider.slug}/`)
  );
  const blockedPublicTerms = (manifest.providers || []).flatMap((provider) =>
    (provider.claimReviewHolds || []).flatMap((hold) =>
      (hold.blockedPublicTerms || []).map((term) => ({
        provider: provider.slug,
        kind: hold.kind,
        term,
      }))
    )
  );
  const failures = [];
  const allFiles = await walk(options.publicDir);
  const retiredReferences = [];
  for (const filename of allFiles) {
    const contents = await fs.readFile(filename, 'utf8');
    for (const host of RETIRED_HOSTS) {
      if (contents.toLowerCase().includes(host)) {
        retiredReferences.push({
          file: path.relative(options.publicDir, filename),
          host,
        });
      }
    }
  }
  for (const reference of retiredReferences) {
    add(
      failures,
      'RETIRED_HOST_REFERENCE',
      reference.file,
      reference.host
    );
  }
  for (const filename of allFiles) {
    const content = await fs.readFile(filename, 'utf8');
    for (const blocked of blockedPublicTerms) {
      if (!content.toLowerCase().includes(blocked.term.toLowerCase())) continue;
      add(
        failures,
        'HELD_PROVIDER_CLAIM_PUBLIC',
        path.relative(options.publicDir, filename),
        `${blocked.provider}:${blocked.kind}:${blocked.term}`
      );
    }
  }

  const limitedProfileAudits = [];
  for (const provider of (manifest.providers || []).filter(
    (entry) => entry.publicationStatus === 'limited'
  )) {
    const route = `/appraiser/${provider.slug}/`;
    const filename = path.join(
      options.publicDir,
      'appraiser',
      provider.slug,
      'index.html'
    );
    let html = '';
    try {
      html = await fs.readFile(filename, 'utf8');
    } catch {
      const audit = {
        route,
        slug: provider.slug,
        sourceUrl: provider.sourceUrl,
        verifiedAt: provider.verifiedAt,
        claimScope: provider.claimScope,
        violations: ['missing-profile'],
      };
      limitedProfileAudits.push(audit);
      add(
        failures,
        'LIMITED_PROFILE_CLAIM_SCOPE_EXCEEDED',
        route,
        audit.violations.join(';')
      );
      continue;
    }
    const audit = limitedProfileScopeAudit({ html, provider });
    limitedProfileAudits.push(audit);
    if (audit.violations.length) {
      add(
        failures,
        'LIMITED_PROFILE_CLAIM_SCOPE_EXCEEDED',
        route,
        audit.violations.join(';')
      );
    }
  }

  const cityRoot = path.join(options.publicDir, 'location');
  const cityFiles = (await walk(cityRoot)).filter(
    (filename) =>
      path.basename(filename) === 'index.html' &&
      path.dirname(filename) !== cityRoot &&
      path
        .relative(cityRoot, filename)
        .split(path.sep)
        .filter(Boolean).length === 2
  );
  const cities = [];
  for (const filename of cityFiles) {
    cities.push(
      await inspectCity({
        filename,
        publicDir: options.publicDir,
        unresolvedRoutes,
        failures,
      })
    );
  }
  const indexableCities = cities.filter(
    (city) => city.indexable && city.paragraphs.length >= 3
  );
  for (let right = 1; right < indexableCities.length; right += 1) {
    let closest = null;
    for (let left = 0; left < right; left += 1) {
      const similarity = cityBodySimilarity(
        indexableCities[left].paragraphs,
        indexableCities[right].paragraphs
      );
      if (!closest || similarity.score > closest.similarity.score) {
        closest = { city: indexableCities[left], similarity };
      }
    }
    if (
      closest &&
      closest.similarity.matchedParagraphs >= 3 &&
      closest.similarity.score >= options.similarityThreshold
    ) {
      add(
        failures,
        'NEAR_DUPLICATE_CITY_BODY',
        indexableCities[right].route,
        `closest=${closest.city.route} score=${closest.similarity.score.toFixed(3)} matched=${closest.similarity.matchedParagraphs} avgParagraph=${closest.similarity.averageParagraphSimilarity.toFixed(3)}`
      );
    }
  }

  for (const slug of MIGRATED_PROFILES) {
    await inspectMigratedProfile({
      filename: path.join(options.publicDir, 'appraiser', slug, 'index.html'),
      publicDir: options.publicDir,
      failures,
    });
  }

  const homepage = await fs.readFile(
    path.join(options.publicDir, 'index.html'),
    'utf8'
  );
  if (
    /\b(?:all\s+)?certified\s+(?:antique\s+|art\s+)?appraisers?\b/i.test(
      visibleText(homepage)
    )
  ) {
    add(
      failures,
      'UNIVERSAL_CREDENTIAL_CLAIM',
      '/',
      'Homepage describes the mixed-status cohort as certified.'
    );
  }
  const homepageSchemas = schemas(homepage);
  if (
    !homepageSchemas.some((record) =>
      ['Organization', 'AboutPage'].includes(record?.['@type'])
    )
  ) {
    add(
      failures,
      'HOMEPAGE_TRUST_SCHEMA_MISSING',
      '/',
      'Organization or AboutPage schema is required.'
    );
  }

  const countsByCode = {};
  for (const failure of failures) {
    countsByCode[failure.code] = (countsByCode[failure.code] || 0) + 1;
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ok: failures.length === 0,
    publicDir: options.publicDir,
    policy: {
      retiredHosts: RETIRED_HOSTS,
      similarityThreshold: options.similarityThreshold,
      explicitlyMarkedSharedModulesExcluded: true,
      migratedProfileCount: MIGRATED_PROFILES.size,
      limitedProfileClaimScope: ['identity', 'website'],
      limitedProfileCount: limitedProfileAudits.length,
    },
    counts: {
      scannedFiles: allFiles.length,
      cityPages: cities.length,
      indexableCities: cities.filter((city) => city.indexable).length,
      failures: failures.length,
    },
    countsByCode,
    cities,
    limitedProfileAudits,
    retiredReferences,
    failures,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await checkDirectoryEnrichmentContract(options);
    const serialized = `${JSON.stringify(result, null, 2)}\n`;
    if (options.output) {
      await fs.mkdir(path.dirname(options.output), { recursive: true });
      await fs.writeFile(options.output, serialized);
    }
    process.stdout.write(serialized);
    if (options.enforce && !result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  }
}
