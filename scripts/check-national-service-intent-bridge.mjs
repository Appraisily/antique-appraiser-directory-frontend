import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    publicDir: path.join(repoRoot, 'public_site'),
    cohort: path.join(repoRoot, 'data/national-service-intent-cohort.json'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--public-dir') {
      args.publicDir = path.resolve(argv[++index] ?? '');
    } else if (arg === '--cohort') {
      args.cohort = path.resolve(argv[++index] ?? '');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function normalizeText(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readAttribute(attributes, name) {
  const expression = new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i');
  return attributes.match(expression)?.[2] ?? null;
}

function extractTagAttribute(html, tag, identifyingAttribute, identifyingValue, targetAttribute) {
  const tagExpression = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  for (const match of html.matchAll(tagExpression)) {
    const attributes = match[0];
    if (readAttribute(attributes, identifyingAttribute)?.toLowerCase() === identifyingValue.toLowerCase()) {
      return readAttribute(attributes, targetAttribute);
    }
  }
  return null;
}

function extractBridge(html) {
  const marker = 'data-appraisily-national-service-bridge';
  const markerIndexes = [];
  let cursor = html.indexOf(marker);
  while (cursor !== -1) {
    markerIndexes.push(cursor);
    cursor = html.indexOf(marker, cursor + marker.length);
  }

  if (markerIndexes.length !== 1) {
    return { count: markerIndexes.length, html: null };
  }

  const start = html.lastIndexOf('<section', markerIndexes[0]);
  const close = html.indexOf('</section>', markerIndexes[0]);
  if (start === -1 || close === -1) {
    return { count: markerIndexes.length, html: null };
  }

  return { count: markerIndexes.length, html: html.slice(start, close + '</section>'.length) };
}

function extractAnchors(html) {
  const anchors = [];
  const expression = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(expression)) {
    anchors.push({
      attributes: match[1],
      text: normalizeText(match[2]),
      href: readAttribute(match[1], 'href'),
    });
  }
  return anchors;
}

function listHtmlFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      if (entry.isFile() && entry.name === 'index.html') files.push(absolute);
    }
  }
  return files;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(args.cohort, 'utf8'));
  const failures = [];
  const cohortPaths = new Set(manifest.pages.map((page) => page.path));
  const destinationByHref = new Map(
    Object.entries(manifest.destinations).map(([key, destination]) => [destination.href, { key, ...destination }]),
  );
  const locationSource = fs.readFileSync(path.join(repoRoot, 'src/pages/StandardizedLocationPage.tsx'), 'utf8');

  for (const snippet of [
    "import nationalServiceIntentCohort from '../../data/national-service-intent-cohort.json'",
    'data-appraisily-national-service-bridge="1"',
    "trackEvent('directory_service_bridge_click'",
    'data-analytics-destination={target}',
    'data-analytics-location="national-service-bridge"',
  ]) {
    if (!locationSource.includes(snippet)) {
      failures.push(`React hydration contract is missing ${JSON.stringify(snippet)}`);
    }
  }

  const preservationAsset = path.join(args.publicDir, 'assets/national-service-intent-bridge.js');
  if (!fs.existsSync(preservationAsset)) {
    failures.push('Hydration-preservation asset is missing');
  } else {
    const preservationSource = fs.readFileSync(preservationAsset, 'utf8');
    for (const snippet of [
      "const selector = '[data-appraisily-national-service-bridge=\"1\"]'",
      "document.querySelector('article[data-gtm-surface=\"location_results\"]')",
      "document.querySelector('[data-directory-empty-state=\"true\"]')",
      "insertionPoint.insertAdjacentElement('afterend'",
    ]) {
      if (!preservationSource.includes(snippet)) {
        failures.push(`Hydration-preservation asset is missing ${JSON.stringify(snippet)}`);
      }
    }
  }

  for (const page of manifest.pages) {
    const absolute = path.join(args.publicDir, page.path);
    if (!fs.existsSync(absolute)) {
      failures.push(`${page.path}: missing HTML file`);
      continue;
    }

    const html = fs.readFileSync(absolute, 'utf8');
    const canonical = extractTagAttribute(html, 'link', 'rel', 'canonical', 'href');
    const robots = extractTagAttribute(html, 'meta', 'name', 'robots', 'content');
    const h1 = normalizeText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
    const bridge = extractBridge(html);

    if (
      page.path !== 'location/index.html'
      && !html.includes('<script src="/assets/national-service-intent-bridge.js"></script>')
    ) {
      failures.push(`${page.path}: hydration-preservation script is missing`);
    }

    if (canonical !== page.canonical) {
      failures.push(`${page.path}: canonical changed; expected ${page.canonical}, received ${canonical}`);
    }
    if ((robots ?? '').replace(/\s+/g, '').toLowerCase() !== page.robots.replace(/\s+/g, '').toLowerCase()) {
      failures.push(`${page.path}: robots changed; expected ${page.robots}, received ${robots}`);
    }
    if (h1 !== page.h1) {
      failures.push(`${page.path}: H1 changed; expected ${JSON.stringify(page.h1)}, received ${JSON.stringify(h1)}`);
    }
    if (bridge.count !== 1 || !bridge.html) {
      failures.push(`${page.path}: expected one complete national-service bridge, found ${bridge.count}`);
      continue;
    }

    const bridgeText = normalizeText(bridge.html).toLowerCase();
    if (!bridgeText.includes('local') || !bridgeText.includes('online')) {
      failures.push(`${page.path}: bridge must explain both the local and online choices`);
    }

    const anchors = extractAnchors(bridge.html);
    const receivedTargetKeys = [];
    for (const anchor of anchors) {
      if (!anchor.href) {
        failures.push(`${page.path}: bridge anchor is missing href`);
        continue;
      }
      if (anchor.href.includes('?')) {
        failures.push(`${page.path}: bridge href must not contain query parameters: ${anchor.href}`);
      }

      const destination = destinationByHref.get(anchor.href);
      if (!destination) {
        failures.push(`${page.path}: bridge points to an unapproved destination: ${anchor.href}`);
        continue;
      }

      receivedTargetKeys.push(destination.key);
      if (anchor.text !== destination.label) {
        failures.push(
          `${page.path}: ${destination.key} label must be ${JSON.stringify(destination.label)}, received ${JSON.stringify(anchor.text)}`,
        );
      }
      if (/\bnear me\b/i.test(anchor.text)) {
        failures.push(`${page.path}: bridge label must not make a near-me promise`);
      }
      if (readAttribute(anchor.attributes, 'data-analytics-event') !== 'directory_service_bridge_click') {
        failures.push(`${page.path}: ${destination.key} link is missing the bridge analytics event`);
      }
      if (readAttribute(anchor.attributes, 'data-analytics-destination') !== destination.key) {
        failures.push(`${page.path}: ${destination.key} link has the wrong analytics destination`);
      }
      if (readAttribute(anchor.attributes, 'data-analytics-location') !== 'national-service-bridge') {
        failures.push(`${page.path}: ${destination.key} link has the wrong analytics location`);
      }
      if (destination.key === 'insurance' && !manifest.readiness.insurance) {
        failures.push(`${page.path}: insurance is linked before its readiness gate is enabled`);
      }
      if (destination.key === 'taxDeduction' && !manifest.readiness.taxDeduction) {
        failures.push(`${page.path}: tax deduction is linked before its readiness gate is enabled`);
      }
    }

    if (JSON.stringify(receivedTargetKeys) !== JSON.stringify(page.targets)) {
      failures.push(
        `${page.path}: targets must be [${page.targets.join(', ')}], received [${receivedTargetKeys.join(', ')}]`,
      );
    }

    for (const [key, destination] of Object.entries(manifest.destinations)) {
      const occurrences = html.split(`href="${destination.href}"`).length - 1;
      const expected = page.targets.includes(key) ? 1 : 0;
      if (occurrences !== expected) {
        failures.push(`${page.path}: expected ${expected} direct ${key} link(s), found ${occurrences}`);
      }
    }
  }

  const locationRoot = path.join(args.publicDir, 'location');
  if (!fs.existsSync(locationRoot)) {
    failures.push(`Missing location root: ${locationRoot}`);
  } else {
    for (const absolute of listHtmlFiles(locationRoot)) {
      const relative = path.relative(args.publicDir, absolute).split(path.sep).join('/');
      const html = fs.readFileSync(absolute, 'utf8');
      if (!cohortPaths.has(relative) && html.includes('data-appraisily-national-service-bridge')) {
        failures.push(`${relative}: non-cohort page contains a national-service bridge`);
      }
    }
  }

  if (failures.length) {
    console.error('National-service intent bridge contract failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`National-service intent bridge contract passed for ${manifest.pages.length} cohort pages.`);
}

try {
  run();
} catch (error) {
  console.error(`National-service intent bridge contract failed: ${error.message}`);
  process.exit(1);
}
