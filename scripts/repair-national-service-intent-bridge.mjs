import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preservationAsset = `(function preserveNationalServiceIntentBridge() {
  const selector = '[data-appraisily-national-service-bridge="1"]';
  const localResultsId = 'local-appraisers';
  let preservedBridge = null;
  let restoreQueued = false;

  function captureBridge() {
    const bridge = document.querySelector(selector);
    if (bridge && !preservedBridge) {
      preservedBridge = bridge.cloneNode(true);
    }
  }

  function restoreBridge() {
    restoreQueued = false;
    captureBridge();
    if (!preservedBridge || document.querySelector(selector)) return;

    const localHeading = document.getElementById(localResultsId);
    const emptyState = document.querySelector('[data-directory-empty-state="true"]');
    const firstResult = document.querySelector('article[data-gtm-surface="location_results"]');
    const insertionPoint = firstResult?.parentElement || emptyState || localHeading;
    if (!insertionPoint) return;
    insertionPoint.insertAdjacentElement('afterend', preservedBridge.cloneNode(true));
  }

  function queueRestore() {
    if (restoreQueued) return;
    restoreQueued = true;
    queueMicrotask(restoreBridge);
  }

  captureBridge();

  const observer = new MutationObserver(queueRestore);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', queueRestore);
  window.addEventListener('load', () => {
    queueRestore();
    window.setTimeout(queueRestore, 250);
    window.setTimeout(queueRestore, 1000);
  });
})();
`;

function parseArgs(argv) {
  const args = { publicDir: path.join(repoRoot, 'public_site'), write: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--public-dir') args.publicDir = path.resolve(argv[++index] ?? '');
    else if (argv[index] === '--write') args.write = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function replaceRobots(html, expected) {
  return html.replace(/<meta\b[^>]*\bname=(['"])robots\1[^>]*>/i, (tag) => {
    if (/\bcontent=(['"])[^'"]*\1/i.test(tag)) {
      return tag.replace(/\bcontent=(['"])[^'"]*\1/i, `content="${expected}"`);
    }
    return tag.replace(/>$/, ` content="${expected}">`);
  });
}

function supportingLinkHref(href, slug) {
  const separator = '&amp;';
  return `${href}?utm_source=directory${separator}utm_medium=location_page${separator}utm_campaign=${slug}${separator}utm_content=supporting_link`;
}

function cityBridge(page, manifest) {
  const slug = page.path.split('/')[1];
  const city = {
    'baltimore': 'Baltimore',
    'boston': 'Boston',
    'chicago': 'Chicago',
    'des-moines': 'Des Moines',
    'kansas-city': 'Kansas City',
    'new-york': 'New York',
    'philadelphia': 'Philadelphia',
    'seattle': 'Seattle',
    'toronto': 'Toronto',
  }[slug];
  if (!city) throw new Error(`Missing city label for ${page.path}`);
  const title = page.targets.length > 1
    ? 'Choose the appraisal route that fits your item'
    : page.targets[0] === 'art'
      ? 'Need an online art appraisal?'
      : 'Need an online antique appraisal?';
  const links = page.targets.map((target) => {
    const destination = manifest.destinations[target];
    return `          <a class="font-semibold text-blue-700 underline hover:no-underline" href="${destination.href}" data-analytics-event="directory_service_bridge_click" data-analytics-destination="${target}" data-analytics-location="national-service-bridge">${destination.label}</a>`;
  }).join('\n');
  return `
      <section class="bg-blue-50/70 border border-blue-100 rounded-xl p-6 shadow-sm space-y-3" data-appraisily-national-service-bridge="1">
        <p class="text-sm font-semibold uppercase tracking-wide text-blue-700">Local listings or an online service</p>
        <h2 class="text-2xl font-semibold text-gray-900">${title}</h2>
        <p class="text-gray-700 leading-relaxed">Use the local provider profiles above when you need an in-person specialist in ${city}. When an in-person visit is not required, choose the matching online service for a signed appraisal report.</p>
        <div class="flex flex-wrap gap-3">
${links}
        </div>
      </section>
`;
}

function hubBridge(manifest) {
  const links = ['antiques', 'art'].map((target) => {
    const destination = manifest.destinations[target];
    return `          <a href="${destination.href}" data-analytics-event="directory_service_bridge_click" data-analytics-destination="${target}" data-analytics-location="national-service-bridge">${destination.label}</a>`;
  }).join('\n');
  return `      <section class="card" data-appraisily-national-service-bridge="1" style="border-color:#bfdbfe;background:#eff6ff;">
        <h2 style="margin:0 0 10px;font-size:18px;">Choose a local provider or an online appraisal service</h2>
        <p style="margin:0 0 12px;">Use this directory to compare local providers by city. When an in-person visit is not required, choose the online service that matches your item and submit photos and documentation for a signed report.</p>
        <p style="display:flex;flex-wrap:wrap;gap:12px;margin:0;">
${links}
        </p>
      </section>
`;
}

function repairPage(html, page, manifest) {
  if (html.includes('data-appraisily-national-service-bridge="1"')) return html;
  let next = replaceRobots(html, page.robots);
  if (page.path === 'location/index.html') {
    const insertion = next.indexOf('      <div class="card">', next.indexOf('<main'));
    if (insertion === -1) throw new Error(`Hub insertion point missing in ${page.path}`);
    return `${next.slice(0, insertion)}${hubBridge(manifest)}${next.slice(insertion)}`;
  }

  const slug = page.path.split('/')[1];
  for (const target of Object.values(manifest.destinations)) {
    next = next.replaceAll(`href="${target.href}"`, `href="${supportingLinkHref(target.href, slug)}"`);
  }
  const localStart = next.indexOf('<section id="local-appraisers"');
  const localEnd = next.indexOf('</section>', localStart);
  if (localStart === -1 || localEnd === -1) throw new Error(`Local-results insertion point missing in ${page.path}`);
  const insertion = localEnd + '</section>'.length;
  next = `${next.slice(0, insertion)}${cityBridge(page, manifest)}${next.slice(insertion)}`;
  if (!next.includes('<script src="/assets/national-service-intent-bridge.js"></script>')) {
    next = next.replace('</body>', '<script src="/assets/national-service-intent-bridge.js"></script>\n</body>');
  }
  return next;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/national-service-intent-cohort.json'), 'utf8'));
  const updates = [];
  for (const page of manifest.pages) {
    const absolute = path.join(args.publicDir, page.path);
    const before = fs.readFileSync(absolute, 'utf8');
    const after = repairPage(before, page, manifest);
    if (after !== before) updates.push({ absolute, after, relative: page.path });
  }
  const assetPath = path.join(args.publicDir, 'assets/national-service-intent-bridge.js');
  if (!fs.existsSync(assetPath) || fs.readFileSync(assetPath, 'utf8') !== preservationAsset) {
    updates.push({ absolute: assetPath, after: preservationAsset, relative: 'assets/national-service-intent-bridge.js' });
  }
  if (updates.length && !args.write) {
    throw new Error(`${updates.length} national-service bridge artifact(s) require repair`);
  }
  if (args.write) {
    for (const update of updates) {
      fs.mkdirSync(path.dirname(update.absolute), { recursive: true });
      fs.writeFileSync(update.absolute, update.after);
    }
  }
  console.log(JSON.stringify({ action: args.write ? 'repaired' : 'checked', changed: updates.map((entry) => entry.relative) }, null, 2));
}

try {
  run();
} catch (error) {
  console.error(`National-service intent bridge repair failed: ${error.message}`);
  process.exit(1);
}
