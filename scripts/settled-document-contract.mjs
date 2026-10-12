// Authored-versus-settled document contract for the Antique directory.
//
// captureDocument runs unchanged in JSDOM (the authored response) and inside
// agent-browser (the settled DOM). Keep it DOM-only and self-contained.
export function captureDocument(document, canonicalOrigin) {
  const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const flatten = (value, result = []) => {
    if (Array.isArray(value)) value.forEach((child) => flatten(child, result));
    else if (value && typeof value === 'object') {
      if (value['@type']) result.push(value);
      Object.values(value).forEach((child) => flatten(child, result));
    }
    return result;
  };
  const resolve = (href) => {
    let url;
    // A malformed href is recorded as such rather than aborting the capture.
    try { url = new URL(href, document.location.href); } catch { return new URL(`invalid:${encodeURIComponent(href)}`); }
    // Local candidates serve the same documents from another origin.
    if (url.origin === document.location.origin) return new URL(`${url.pathname}${url.search}${url.hash}`, canonicalOrigin);
    return url;
  };
  const root = document.getElementById('root') || document.body;
  const content = root.cloneNode(true);
  content.querySelectorAll('script, style').forEach((node) => node.remove());
  // Chrome parses noscript as raw text with scripting enabled; JSDOM/no-JS
  // parses its elements. Normalize only the zero-size hidden GTM fallback.
  content.querySelectorAll('noscript').forEach((node) => {
    const text = node.children.length ? node.innerHTML : node.textContent;
    if (/^\s*<iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-PSLHDGM"[^>]*><\/iframe>\s*$/.test(text)) node.remove();
  });
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => {
    try { return JSON.parse(node.textContent); } catch { return { invalid: compact(node.textContent).slice(0, 200) }; }
  });
  const nodes = flatten(jsonLd);
  // Sorted name=value pairs: the browser bridge does not preserve object key order.
  const trackingAttributes = (node) => [...node.attributes]
    .filter((attribute) => /^data-(gtm-|cta-|clarity-|provider-|appraisily-)/.test(attribute.name))
    .map((attribute) => `${attribute.name}=${attribute.value}`).sort();
  const anchors = [...document.querySelectorAll('a[href]')].map((node) => {
    const url = resolve(node.getAttribute('href'));
    return {
      // tel:, mailto: and malformed links have no origin; keep their full value.
      destination: url.origin === 'null' ? url.href : `${url.origin}${url.pathname}${url.hash}`,
      href: url.href,
      text: compact(node.textContent),
      tracking: trackingAttributes(node),
      inRoot: root.contains(node),
    };
  });
  const headText = [...document.querySelectorAll('title, meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')]
    .map((node) => node.content || node.textContent).join(' ');
  return {
    title: document.title,
    descriptions: [...document.querySelectorAll('meta[name="description"]')].map((node) => node.content),
    socialDescriptions: [...document.querySelectorAll('meta[property="og:description"],meta[name="twitter:description"]')]
      .map((node) => `${node.getAttribute('property') || node.getAttribute('name')}=${node.content}`),
    canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map((node) => resolve(node.getAttribute('href')).href),
    robots: [...document.querySelectorAll('meta[name="robots"]')].map((node) => node.content),
    providerSource: [...document.querySelectorAll('meta[name^="appraisily:provider-"]')].map((node) => `${node.name}=${node.content}`),
    h1: [...document.querySelectorAll('h1')].map((node) => compact(node.textContent)),
    jsonLd: jsonLd.map((value) => JSON.stringify(value)),
    schemaTypes: nodes.map((node) => [].concat(node['@type']).join('|')),
    providerEntities: jsonLd.flat().filter((node) => node && ['ProfessionalService', 'LocalBusiness', 'Organization', 'Person']
      .includes([].concat(node['@type'])[0])).map((node) => ({ type: node['@type'], name: node.name, url: node.url })),
    mainText: compact(content.textContent),
    trustText: `${headText} ${compact(content.textContent)} ${jsonLd.map((value) => JSON.stringify(value)).join(' ')}`,
    anchors,
    moduleScripts: [...document.querySelectorAll('script[type="module"]')].map((node) => node.getAttribute('src')),
    telemetryBootstraps: [...document.querySelectorAll('script[data-appraisily-directory-telemetry]')].map((node) => node.getAttribute('src')),
    spaRoots: document.querySelectorAll('[data-spa-root]').length,
    interactiveControls: document.querySelectorAll('#root input, #root select, #root textarea, #root button').length,
  };
}

// Phrases the legacy renderer manufactured. A settled document may repeat what
// the reviewed author wrote, but must never add new occurrences.
export const UNSUPPORTED_TRUST_TERMS = [
  ['certified', /\bcertified\b/gi],
  ['verified review', /\bverified reviews?\b/gi],
  ['accredited', /\baccredited\b/gi],
  ['licensed', /\blicensed\b/gi],
  ['rating', /\b(?:aggregateRating|ratingValue|star rating)\b/gi],
  ['fee amount', /\$\s?\d/g],
  ['years of experience', /\byears of experience\b/gi],
];

export function addedTrustTerms(initial, settled) {
  const added = [];
  for (const [label, pattern] of UNSUPPORTED_TRUST_TERMS) {
    const before = (initial.trustText.match(pattern) || []).length;
    const after = (settled.trustText.match(pattern) || []).length;
    if (after > before) added.push(`${label} (+${after - before})`);
  }
  return added;
}

const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Returns categorized failures rather than throwing, so a sweep can count
// every defect class on every document.
export function documentParityFailures(initial, settled, url) {
  const failures = [];
  const add = (category, detail) => failures.push({ category, detail });
  for (const [label, state] of [['initial', initial], ['settled', settled]]) {
    if (!sameJson(state.canonicals, [url])) add('canonical', `${label}: ${state.canonicals.length} canonical(s) ${JSON.stringify(state.canonicals)}`);
    if (state.descriptions.length !== 1) add('description', `${label}: ${state.descriptions.length} descriptions`);
    if (state.robots.length > 1) add('robots', `${label}: ${state.robots.length} robots tags`);
    if (state.h1.length !== 1) add('h1', `${label}: ${state.h1.length} H1 elements`);
    if (!state.mainText) add('content', `${label}: no authored content`);
    // Some reviewed limited listings deliberately publish no provider entity;
    // none may describe the same provider twice.
    if (/\/appraiser\/[^/]+\/$/.test(new URL(url).pathname) && state.providerEntities.length > 1) {
      add('entity', `${label}: ${state.providerEntities.length} provider entities`);
    }
  }
  if (settled.title !== initial.title) add('title', `${JSON.stringify(initial.title)} -> ${JSON.stringify(settled.title)}`);
  if (!sameJson(settled.descriptions, initial.descriptions)) add('description', 'description set changed after rendering');
  if (!sameJson(settled.socialDescriptions, initial.socialDescriptions)) add('social', 'social descriptions changed after rendering');
  if (!sameJson(settled.robots, initial.robots)) add('robots', 'robots changed after rendering');
  if (!sameJson(settled.providerSource, initial.providerSource)) add('provider-source-meta', 'provider source metadata changed');
  if (!sameJson(settled.h1, initial.h1)) add('h1', `${JSON.stringify(initial.h1)} -> ${JSON.stringify(settled.h1)}`);
  if (!sameJson(settled.jsonLd, initial.jsonLd)) {
    add('schema', `schema types ${JSON.stringify(initial.schemaTypes)} -> ${JSON.stringify(settled.schemaTypes)}`);
  }
  if (settled.mainText !== initial.mainText) add('content', 'authored body text changed after rendering');
  const settledAnchors = new Set(settled.anchors.map((anchor) => JSON.stringify([anchor.destination, anchor.text])));
  const lost = initial.anchors.filter((anchor) => !settledAnchors.has(JSON.stringify([anchor.destination, anchor.text])));
  const lostExternal = lost.filter((anchor) => !new URL(anchor.destination).hostname.endsWith('appraisily.com'));
  if (lostExternal.length) add('source-link', `lost provider/external links: ${lostExternal.map((anchor) => anchor.destination).slice(0, 4).join(', ')}`);
  if (lost.length > lostExternal.length) add('native-link', `${lost.length - lostExternal.length} owned native link(s) disappeared`);
  const trust = addedTrustTerms(initial, settled);
  if (trust.length) add('trust', `added unsupported terms: ${trust.join(', ')}`);
  return failures;
}

// A07: the governed static bootstrap stays the single click owner, and every
// authored click annotation survives on the same destination.
export function clickAnnotationFailures(initial, settled, url, { javascript }) {
  const failures = [];
  const add = (detail) => failures.push({ category: 'click-annotation', detail });
  if (settled.telemetryBootstraps.length !== 1) add(`${settled.telemetryBootstraps.length} telemetry bootstraps`);
  const unused = [...settled.anchors];
  for (const anchor of initial.anchors.filter((item) => item.tracking.length)) {
    const same = (item) => item.destination === anchor.destination && item.text === anchor.text;
    const index = unused.findIndex((item) => same(item) && sameJson(item.tracking, anchor.tracking));
    if (index >= 0) { unused.splice(index, 1); continue; }
    add(settled.anchors.some(same) ? `annotation changed on ${anchor.destination}` : `annotated link lost: ${anchor.destination}`);
  }
  if (javascript) {
    const pathname = new URL(url).pathname;
    for (const anchor of settled.anchors) {
      const target = new URL(anchor.href);
      if (target.protocol !== 'https:' || !['appraisily.com', 'articles.appraisily.com'].includes(target.hostname)) continue;
      // Several authored links can share a destination and label with different tags.
      const originals = initial.anchors.filter((item) => item.destination === anchor.destination && item.text === anchor.text);
      if (!originals.length) continue;
      const params = target.searchParams;
      if (params.get('seo_site') !== 'antique_directory' || params.get('ref_path') !== pathname || !params.get('journey_id') ||
          params.get('appraisily_synthetic') !== 'synthetic_browser') {
        add(`handoff not stamped: ${anchor.destination}`);
        continue;
      }
      const preserves = (original) => [...new URL(original.href).searchParams].every(([key, value]) =>
        ['seo_site', 'ref_path', 'journey_id', 'appraisily_synthetic'].includes(key) ||
        params.get(key) === (key === 'utm_source' && value === 'directory' ? 'antique_directory' : value));
      if (!originals.some(preserves)) add(`handoff lost acquisition tags on ${anchor.destination}`);
    }
  }
  return failures;
}
