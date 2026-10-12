#!/usr/bin/env node
// Authored-versus-settled browser contract (A01/A02/A07).
//
// Serves a public directory through the production nginx image and repository
// nginx.conf in an isolated container, captures each authored response with
// JSDOM, then compares the real-browser settled DOM at desktop, 390px and
// 320px with JavaScript enabled and genuinely disabled.
//
// The browser cannot reach other hosts: every non-local request goes to a
// closed local proxy port and agent-browser only fulfils the first-party
// collector locally so click payloads can be inspected. Clicks are default
// prevented, so no provider site is contacted and no form is submitted.
//
//   node scripts/test-settled-browser-contract.mjs --mode focal
//   node scripts/test-settled-browser-contract.mjs --mode sweep --receipt out.json
//   node scripts/test-settled-browser-contract.mjs --mode static   # the other header-bearing pages
//   node scripts/test-settled-browser-contract.mjs --mode sweep --routes /location/denver/
//   node scripts/test-settled-browser-contract.mjs --mode focal --base https://antique-appraiser-directory.appraisily.com
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';
import { captureDocument, clickAnnotationFailures, documentParityFailures } from './settled-document-contract.mjs';
import { headerTargets } from './inject-directory-site-header.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const origin = 'https://antique-appraiser-directory.appraisily.com';
const collector = 'https://appraisily.com/api/public/analytics/collect';
const options = { mode: 'focal', publicDir: path.join(repoRoot, 'public_site'), base: '', receipt: '', artifactDir: '', concurrency: 4, routes: '' };
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  const value = process.argv[index + 1];
  const key = { '--mode': 'mode', '--public-dir': 'publicDir', '--base': 'base', '--receipt': 'receipt', '--artifact-dir': 'artifactDir', '--concurrency': 'concurrency', '--routes': 'routes' }[flag];
  if (!key || value === undefined) throw new Error(`Unknown or incomplete argument: ${flag}`);
  options[key] = ['publicDir', 'receipt', 'artifactDir'].includes(key) ? path.resolve(value) : key === 'concurrency' ? Number(value) : key === 'routes' ? value : value.replace(/\/$/, '');
}
if (!['focal', 'sweep', 'static'].includes(options.mode)) throw new Error('--mode must be focal, sweep or static');

// Static site header (inject-directory-site-header.mjs): one directory_cta per click.
const HEADER_CLICKS = [
  { selector: 'header[data-appraisily-directory-site-header] a.adh-start', destinationPrefix: 'https://appraisily.com/start', cta_kind: 'signed_report', placement: 'header' },
  { selector: 'header[data-appraisily-directory-site-header] a.adh-browse', destination: '/location/', cta_kind: 'navigation', placement: 'header' },
];
const FOCAL = {
  '/appraiser/a-coin-and-stamp-gallery-estate-appraisal/': {
    clicks: [
      { selector: 'a[data-gtm-cta="website"][data-gtm-surface="contact_card"]', destination: 'https://www.a-coin.com/', gtm_cta: 'website' },
      { selector: 'a[data-gtm-cta="request_appraisal"][data-gtm-surface="contact_sidebar"]', destinationPrefix: 'https://appraisily.com/start', gtm_cta: 'request_appraisal' },
      ...HEADER_CLICKS,
    ],
  },
  // Fine-art specialist website links (02c169e9) use the provider-contact pattern.
  '/location/los-angeles/': {
    clicks: [
      { selector: 'a[data-gtm-surface="fine_art_specialist"]', destinationPrefix: 'https://', cta_kind: 'provider_contact', placement: 'fine_art_specialist' },
    ],
  },
  '/location/albuquerque/': {
    clicks: [
      { selector: 'a[data-cta-kind="signed_report"][data-gtm-placement="intent_chooser"]', destinationPrefix: 'https://appraisily.com/start', cta_kind: 'signed_report' },
      { selector: 'a[data-cta-kind="screener"][data-gtm-placement="intent_chooser"]', destinationPrefix: 'https://appraisily.com/screener', cta_kind: 'screener' },
      ...HEADER_CLICKS,
    ],
  },
};
const cohort = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests/fixtures/legacy-client-module-cohort.json'), 'utf8')).routes;
// --routes a,b narrows either mode to named cohort routes (for re-checking one document).
// static: the already-static sitemap pages that also carry the site header.
const staticRoutes = () => headerTargets(fs.readFileSync(path.join(options.publicDir, 'sitemap.xml'), 'utf8'))
  .filter((route) => !cohort.includes(route));
const routes = ({ focal: Object.keys(FOCAL), sweep: cohort, static: options.mode === 'static' ? staticRoutes() : [] }[options.mode])
  .filter((route) => !options.routes || options.routes.split(',').includes(route));
const viewports = [{ width: 1365, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 844 }];
const socketDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antique-parity-browser-'));
const container = `antique-settled-contract-${process.pid}`;
const result = { action: 'antique-settled-document-contract', mode: options.mode, ok: false, testedAt: new Date().toISOString(), publicDir: options.publicDir, rows: [] };
const sessions = new Set();
// A public --base (post-release check) is the only extra host the browser may reach.
const liveHost = options.base && !/^http:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(options.base) ? new URL(options.base).hostname : '';

const docker = (args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
function curl(url) {
  return new Promise((resolve, reject) => execFile('curl', ['--silent', '--show-error', '--max-time', '20', '--write-out', '\n%{http_code}', url],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, output) => {
      if (error) return reject(error);
      const end = output.lastIndexOf('\n');
      resolve({ status: Number(output.slice(end + 1)), body: output.slice(0, end) });
    }));
}
function browser(session, javascript, ...command) {
  sessions.add(`${session}|${javascript}`);
  const args = ['--no-sandbox', '--proxy-server=http://127.0.0.1:9', `--proxy-bypass-list=*.localhost;127.0.0.1${liveHost ? `;${liveHost}` : ''}`,
    ...(javascript ? [] : ['--blink-settings=scriptEnabled=false'])].join(',');
  return new Promise((resolve, reject) => execFile('agent-browser', ['--session', session, '--json', ...command], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDir, AGENT_BROWSER_ARGS: args },
  }, (error, stdout) => {
    let output;
    try { output = JSON.parse(stdout); } catch { return reject(new Error(`agent-browser ${command[0]} failed: ${error?.message || stdout}`)); }
    if (!output.success) return reject(new Error(`agent-browser ${command.join(' ').slice(0, 120)}: ${output.error}`));
    resolve(output.data);
  }));
}
const local = (url) => { const host = new URL(url).hostname; return host === '127.0.0.1' || host.endsWith('.localhost') || (liveHost && host === liveHost); };
const persist = () => {
  if (!options.receipt) return;
  fs.mkdirSync(path.dirname(options.receipt), { recursive: true });
  fs.writeFileSync(options.receipt, `${JSON.stringify(result, null, 2)}\n`);
};

function focalFailures(route, initial, settled) {
  const failures = [];
  const add = (detail) => failures.push({ category: 'focal-fixture', detail });
  if (settled.canonicals.length !== 1 || settled.descriptions.length !== 1) add('single canonical and description required');
  if (settled.title !== initial.title) add('authored title must win');
  if (JSON.stringify(settled.h1) !== JSON.stringify(initial.h1)) add('authored H1 must win');
  if (route.startsWith('/appraiser/a-coin')) {
    if (/certified expert|verified reviews?/i.test(settled.trustText)) add('unsupported "Certified expert with verified reviews" claim present');
    const official = settled.anchors.filter((anchor) => anchor.destination === 'https://www.a-coin.com/');
    if (official.length < 2) add(`expected both native a-coin.com website links, found ${official.length}`);
    if (!official.some((anchor) => anchor.text === 'Visit official website' && anchor.tracking.includes('data-gtm-cta=website'))) add('labelled official website action missing');
    if (!settled.anchors.some((anchor) => anchor.destination === 'https://www.a-coin.com/estate-services/')) add('reviewed source link missing');
    if (!settled.anchors.some((anchor) => anchor.text === 'Request an Appraisal' && anchor.destination === 'https://appraisily.com/start')) add('separate Appraisily action missing');
    if (settled.providerEntities.length !== 1 || settled.providerEntities[0].type !== 'ProfessionalService') add(`expected one ProfessionalService, found ${JSON.stringify(settled.providerEntities)}`);
    if (!settled.mainText.includes('Limited directory listing. Confirm provider details on the official website before engagement.')) add('limited-listing disclaimer missing');
  }
  return failures;
}

async function clickCheck(session, click) {
  // The bootstrap drops a second click of the same kind on a page within
  // 1.5s (event|path|cta_kind). Space the test clicks past that window.
  await browser(session, true, 'wait', '1600');
  await browser(session, true, 'network', 'requests', '--clear');
  await browser(session, true, 'eval', `(() => { const node = document.querySelector(${JSON.stringify(click.selector)}); if (!node) return false; node.scrollIntoView({ block: 'center' }); return true; })()`)
    .then((data) => { if (data.result !== true) throw new Error(`click target missing: ${click.selector}`); });
  await browser(session, true, 'click', click.selector);
  await browser(session, true, 'wait', '700');
  const requests = (await browser(session, true, 'network', 'requests', '--filter', 'analytics/collect')).requests || [];
  const events = requests.filter((request) => request.method === 'POST' && request.postData).map((request) => JSON.parse(request.postData));
  const location = (await browser(session, true, 'eval', 'location.href')).result;
  const ctas = events.filter((event) => event.event === 'directory_cta');
  const otherClicks = events.filter((event) => event.event !== 'directory_cta' && event.event !== 'surface_arrived');
  const payload = ctas[0]?.payload || {};
  const failures = [];
  if (ctas.length !== 1) failures.push(`expected exactly one directory_cta, saw ${ctas.length}`);
  if (otherClicks.length) failures.push(`second event owner: ${otherClicks.map((event) => event.event).join(', ')}`);
  if (ctas.length && payload.click_owner !== 'directory_static_bootstrap') failures.push(`click owner ${payload.click_owner}`);
  if (ctas.length && click.destination && payload.destination !== click.destination) failures.push(`destination ${payload.destination}`);
  if (ctas.length && click.destinationPrefix && !String(payload.destination).startsWith(click.destinationPrefix)) failures.push(`destination ${payload.destination}`);
  for (const key of ['gtm_cta', 'cta_kind', 'placement']) if (click[key] && payload[key] !== click[key]) failures.push(`${key} ${payload[key]}`);
  if (ctas.length && payload.qa_marker !== 'synthetic_browser') failures.push('synthetic QA marker missing from click payload');
  if (!local(location)) failures.push(`page navigated away to ${location}`);
  return { selector: click.selector, events: events.map((event) => ({ event: event.event, owner: event.payload?.click_owner, destination: event.payload?.destination, cta_kind: event.payload?.cta_kind, placement: event.payload?.placement, gtm_cta: event.payload?.gtm_cta })), failures };
}

async function visit(session, javascript, viewport, route, initial, browserBase) {
  const row = { route, javascript, width: viewport.width, failures: [] };
  await browser(session, javascript, 'network', 'requests', '--clear');
  await browser(session, javascript, 'open', `${browserBase}${route}?appraisily_qa=1`);
  await browser(session, javascript, 'wait', javascript ? '1500' : '300');
  const settled = (await browser(session, javascript, 'eval', `(${captureDocument.toString()})(document, ${JSON.stringify(origin)})`)).result;
  const layout = (await browser(session, javascript, 'eval', '({innerWidth: window.innerWidth, scriptsRan: window.__appraisilyDirectoryTelemetryV1 === true, scrollWidth: document.documentElement.scrollWidth, h1Visible: !!document.querySelector("h1")?.getClientRects().length, qa: (() => { try { return sessionStorage.getItem("appraisily_qa_marker"); } catch { return null; } })()})')).result;
  row.settled = { title: settled.title, canonicals: settled.canonicals.length, descriptions: settled.descriptions.length, h1: settled.h1, providerEntities: settled.providerEntities.length, schemaTypes: settled.schemaTypes, moduleScripts: settled.moduleScripts, spaRoots: settled.spaRoots, interactiveControls: settled.interactiveControls, anchors: settled.anchors.length };
  row.layout = layout;
  if (layout.scriptsRan !== javascript) row.failures.push({ category: 'mode', detail: `JavaScript ${javascript ? 'did not run' : 'ran while disabled'}` });
  if (layout.innerWidth !== viewport.width) row.failures.push({ category: 'harness', detail: `viewport ${layout.innerWidth}px, expected ${viewport.width}px` });
  if (layout.scrollWidth > viewport.width + 1) row.failures.push({ category: 'layout', detail: `horizontal overflow ${layout.scrollWidth}px` });
  if (!layout.h1Visible) row.failures.push({ category: 'layout', detail: 'H1 not visible' });
  if (javascript && layout.qa !== 'synthetic_browser') row.failures.push({ category: 'click-annotation', detail: 'synthetic QA marker missing' });
  row.failures.push(...documentParityFailures(initial, settled, `${origin}${route}`));
  row.failures.push(...clickAnnotationFailures(initial, settled, `${origin}${route}`, { javascript }));
  if (FOCAL[route]) row.failures.push(...focalFailures(route, initial, settled));
  const errors = (await browser(session, javascript, 'errors', '--clear')).errors || [];
  if (errors.length) row.failures.push({ category: 'errors', detail: JSON.stringify(errors).slice(0, 300) });
  const requests = (await browser(session, javascript, 'network', 'requests')).requests || [];
  const external = requests.filter((request) => !local(request.url) && request.url !== collector);
  row.externalAttempts = external.length;
  const answered = external.filter((request) => request.status);
  if (answered.length) row.failures.push({ category: 'containment', detail: `external responses: ${answered.map((request) => request.url).slice(0, 3).join(', ')}` });
  if (FOCAL[route] && javascript) {
    row.clicks = [];
    await browser(session, true, 'eval', 'window.addEventListener("click", (event) => event.preventDefault()); true');
    for (const click of FOCAL[route].clicks) {
      try {
        const outcome = await clickCheck(session, click);
        row.clicks.push(outcome);
        outcome.failures.forEach((detail) => row.failures.push({ category: 'click-event', detail: `${click.selector}: ${detail}` }));
      } catch (error) {
        row.failures.push({ category: 'click-event', detail: error.message });
      }
    }
  }
  if (options.artifactDir && FOCAL[route]) {
    fs.mkdirSync(options.artifactDir, { recursive: true });
    row.screenshot = path.join(options.artifactDir, `${javascript ? 'js' : 'nojs'}-${viewport.width}-${route.replace(/[^a-z0-9-]/g, '_')}.png`);
    // Screenshots are review evidence, not a contract check; retry once under load.
    try { await browser(session, javascript, 'screenshot', row.screenshot); }
    catch { try { await browser(session, javascript, 'screenshot', row.screenshot); } catch (error) { row.screenshotError = error.message.slice(0, 200); delete row.screenshot; } }
  }
  row.ok = row.failures.length === 0;
  return row;
}

function summarize(rows) {
  const summary = {};
  for (const row of rows) {
    const key = `${row.javascript ? 'js' : 'nojs'}-${row.width}`;
    summary[key] ??= { documents: 0, failingDocuments: 0, byCategory: {} };
    const bucket = summary[key];
    bucket.documents += 1;
    if (!row.ok) bucket.failingDocuments += 1;
    for (const category of new Set(row.failures.map((failure) => failure.category))) bucket.byCategory[category] = (bucket.byCategory[category] || 0) + 1;
  }
  const failingRoutes = new Set(rows.filter((row) => !row.ok).map((row) => row.route));
  return { states: summary, documents: new Set(rows.map((row) => row.route)).size, documentsFailingAnyState: failingRoutes.size };
}

let started = false;
// An interrupted run must not leave its container or browser daemons behind.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const entry of sessions) {
      try {
        execFileSync('agent-browser', ['--session', entry.split('|')[0], 'close'], { timeout: 10000, stdio: 'ignore',
          env: { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDir } });
      } catch { /* already gone */ }
    }
    if (started) { try { docker(['rm', '-f', container]); } catch { /* already removed */ } }
    fs.rmSync(socketDir, { recursive: true, force: true });
    process.exit(130);
  });
}
try {
  let base = options.base;
  if (!base) {
    const image = docker(['inspect', 'antique-appraiser-directory', '--format', '{{.Image}}']);
    docker(['run', '--rm', '-d', '--name', container, '-p', '127.0.0.1::8080',
      '-v', `${path.join(repoRoot, 'nginx.conf')}:/etc/nginx/nginx.conf:ro`, '-v', `${options.publicDir}:/usr/share/nginx/html:ro`, image]);
    started = true;
    base = `http://127.0.0.1:${docker(['port', container, '8080/tcp']).match(/:(\d+)\s*$/)[1]}`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { if ((await curl(`${base}/health`)).status === 200) break; } catch { /* still starting */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    result.candidate = { image, nginx: path.join(repoRoot, 'nginx.conf') };
  }
  const browserBase = liveHost ? base : `http://antique-appraiser-directory.localhost:${new URL(base).port}`;
  result.base = base;
  result.browserBase = browserBase;
  const sitemap = (await curl(`${base}/sitemap.xml`)).body;
  const published = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname));
  const initial = new Map();
  for (const route of routes) {
    if (!published.has(route)) throw new Error(`${route} is not in the served sitemap`);
    const response = await curl(`${base}${route}`);
    if (response.status !== 200) throw new Error(`${route}: HTTP ${response.status}`);
    const dom = new JSDOM(response.body, { url: `${origin}${route}` });
    try { initial.set(route, captureDocument(dom.window.document, origin)); } finally { dom.window.close(); }
  }
  result.servedModuleDocuments = [...initial.values()].filter((snapshot) => snapshot.moduleScripts.length).length;
  for (const javascript of [true, false]) {
    const queue = viewports.flatMap((viewport) => routes.map((route) => ({ viewport, route })));
    const workers = Array.from({ length: Math.max(1, Math.min(options.concurrency, queue.length)) }, async (_, index) => {
      const session = `antique-parity-${process.pid}-${javascript ? 'js' : 'nojs'}-${index}`;
      const probe = await browser(session, javascript, 'open', 'data:text/html,<h1>probe</h1><script>window.__probe=true</script>')
        .then(() => browser(session, javascript, 'eval', 'window.__probe === true'));
      if (probe.result !== javascript) throw new Error(`JavaScript mode probe failed for ${session}`);
      if (javascript) await browser(session, true, 'network', 'route', collector, '--body', '{}');
      while (queue.length) {
        const { viewport, route } = queue.shift();
        let row;
        // A CLI/daemon failure under load is retried once; contract failures are never retried.
        for (let attempt = 1; attempt <= 2 && !row; attempt += 1) {
          try {
            // Set the viewport on every visit: a restarted browser daemon falls back to its default window.
            await browser(session, javascript, 'set', 'viewport', String(viewport.width), String(viewport.height));
            row = await visit(session, javascript, viewport, route, initial.get(route), browserBase);
            if (attempt > 1) row.retried = true;
          }
          catch (error) {
            if (attempt === 2) row = { route, javascript, width: viewport.width, ok: false, failures: [{ category: 'harness', detail: error.message }] };
            else await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        result.rows.push(row);
        if (result.rows.length % 50 === 0) { persist(); process.stderr.write(`${result.rows.length} states\n`); }
      }
    });
    await Promise.all(workers);
  }
  result.summary = summarize(result.rows);
  result.ok = result.rows.every((row) => row.ok);
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  result.error = error.stack || error.message;
  process.exitCode = 1;
} finally {
  for (const entry of sessions) {
    const [session, javascript] = entry.split('|');
    try { await browser(session, javascript === 'true', 'close'); } catch { /* only this run's sessions */ }
  }
  if (started) { try { docker(['rm', '-f', container]); } catch { /* --rm may already have removed it */ } }
  fs.rmSync(socketDir, { recursive: true, force: true });
  persist();
}
const failing = result.rows.filter((row) => !row.ok);
console.log(JSON.stringify({ ok: result.ok, mode: result.mode, error: result.error, summary: result.summary,
  firstFailures: failing.slice(0, 12).map((row) => ({ route: row.route, javascript: row.javascript, width: row.width, failures: row.failures.slice(0, 6) })) }, null, 2));
