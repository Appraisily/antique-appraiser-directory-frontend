#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEARCH_ANALYTICS_SCRIPT = '/srv/repos/tools/search-console-inspector/search-analytics.mjs';
const DEFAULT_PROPERTY = 'sc-domain:appraisily.com';
const DEFAULT_OUTPUT_DIR = `/srv/manager/seo/${new Date().toISOString().slice(0, 10)}-location-ctr-cohort`;

const PRIORITY_SLUGS = [
  'des-moines',
  'chicago',
  'columbus',
  'denver',
  'baltimore',
  'new-orleans',
  'tucson',
  'seattle',
  'boston',
];

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange(days = 7) {
  const currentEnd = new Date();
  currentEnd.setUTCDate(currentEnd.getUTCDate() - 1);
  const currentStart = new Date(currentEnd);
  currentStart.setUTCDate(currentStart.getUTCDate() - Math.max(1, days) + 1);
  const baselineEnd = new Date(currentStart);
  baselineEnd.setUTCDate(baselineEnd.getUTCDate() - 1);
  const baselineStart = new Date(baselineEnd);
  baselineStart.setUTCDate(baselineStart.getUTCDate() - Math.max(1, days) + 1);
  return {
    currentStart: isoDate(currentStart),
    currentEnd: isoDate(currentEnd),
    baselineStart: isoDate(baselineStart),
    baselineEnd: isoDate(baselineEnd),
  };
}

function parseArgs(argv) {
  const defaults = defaultRange(7);
  const options = {
    property: DEFAULT_PROPERTY,
    baselineStart: defaults.baselineStart,
    baselineEnd: defaults.baselineEnd,
    currentStart: defaults.currentStart,
    currentEnd: defaults.currentEnd,
    rowLimit: 25000,
    outputDir: DEFAULT_OUTPUT_DIR,
    slugs: PRIORITY_SLUGS,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const [flag, inlineValue] = token.split('=');
    const readValue = () => (inlineValue !== undefined ? inlineValue : argv[++index]);

    switch (flag) {
      case '--property':
        options.property = String(readValue() || '').trim() || options.property;
        break;
      case '--baseline-start':
        options.baselineStart = String(readValue() || '').trim();
        break;
      case '--baseline-end':
        options.baselineEnd = String(readValue() || '').trim();
        break;
      case '--current-start':
        options.currentStart = String(readValue() || '').trim();
        break;
      case '--current-end':
        options.currentEnd = String(readValue() || '').trim();
        break;
      case '--row-limit':
        options.rowLimit = Number.parseInt(String(readValue() || '').trim(), 10) || options.rowLimit;
        break;
      case '--output-dir':
        options.outputDir = path.resolve(process.cwd(), String(readValue() || ''));
        break;
      case '--slugs':
        options.slugs = String(readValue() || '')
          .split(',')
          .map((slug) => slug.trim())
          .filter(Boolean);
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown flag ${flag}`);
    }
  }

  for (const key of ['baselineStart', 'baselineEnd', 'currentStart', 'currentEnd']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options[key])) {
      throw new Error(`${key} must be YYYY-MM-DD`);
    }
  }
  if (!options.slugs.length) throw new Error('--slugs produced an empty cohort');
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/gsc-location-ctr-cohort.mjs \\
    --baseline-start 2026-06-16 --baseline-end 2026-06-29 \\
    --current-start 2026-07-01 --current-end 2026-07-14
  node scripts/gsc-location-ctr-cohort.mjs --self-test

Generates a read-only Search Console CTR cohort report for the priority
location pages refreshed by the June 29 GSC/GA4 ROI action plan.

Default cohort:
${PRIORITY_SLUGS.map((slug) => `  - ${slug}`).join('\n')}`);
}

function pageForSlug(slug) {
  return `https://antique-appraiser-directory.appraisily.com/location/${slug}/`;
}

function slugFromPage(page) {
  const match = String(page || '').match(/\/location\/([^/?#]+)\/?$/i);
  return match ? match[1] : '';
}

function runSearchAnalytics({ options, start, end }) {
  const rows = [];

  for (const slug of options.slugs) {
    const cmd = [
      SEARCH_ANALYTICS_SCRIPT,
      '--property', options.property,
      '--dimensions', 'page,device',
      '--start', start,
      '--end', end,
      '--row-limit', String(options.rowLimit),
      '--format', 'json',
      '--filter-page', pageForSlug(slug),
    ];

    const result = spawnSync(process.execPath, cmd, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    if (result.status !== 0) {
      throw new Error(`search-analytics failed for ${slug} ${start}..${end}: ${result.stderr || result.stdout}`);
    }

    const payload = JSON.parse(result.stdout || '{}');
    rows.push(...(payload.rows || []));
  }

  return { rows };
}

function emptyMetric() {
  return {
    clicks: 0,
    impressions: 0,
    positionWeighted: 0,
  };
}

function addMetric(metric, row) {
  const clicks = Number(row.clicks || 0);
  const impressions = Number(row.impressions || 0);
  const position = Number(row.position || 0);
  metric.clicks += Number.isFinite(clicks) ? clicks : 0;
  metric.impressions += Number.isFinite(impressions) ? impressions : 0;
  metric.positionWeighted += (Number.isFinite(position) ? position : 0) * (Number.isFinite(impressions) ? impressions : 0);
}

function finalizeMetric(metric) {
  const impressions = metric.impressions || 0;
  return {
    clicks: Math.round(metric.clicks),
    impressions: Math.round(impressions),
    ctr: impressions > 0 ? metric.clicks / impressions : 0,
    position: impressions > 0 ? metric.positionWeighted / impressions : 0,
  };
}

function aggregateRows(rows, slugs) {
  const bySlug = new Map();
  const ensure = (slug) => {
    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        slug,
        page: pageForSlug(slug),
        devices: new Map(),
        total: emptyMetric(),
      });
    }
    return bySlug.get(slug);
  };

  for (const slug of slugs) ensure(slug);

  for (const row of rows || []) {
    const slug = slugFromPage(row.page);
    if (!slug || !slugs.includes(slug)) continue;
    const device = String(row.device || 'UNKNOWN').toUpperCase();
    const bucket = ensure(slug);
    if (!bucket.devices.has(device)) bucket.devices.set(device, emptyMetric());
    addMetric(bucket.devices.get(device), row);
    addMetric(bucket.total, row);
  }

  return [...bySlug.values()].map((bucket) => ({
    slug: bucket.slug,
    page: bucket.page,
    total: finalizeMetric(bucket.total),
    desktop: finalizeMetric(bucket.devices.get('DESKTOP') || emptyMetric()),
    mobile: finalizeMetric(bucket.devices.get('MOBILE') || emptyMetric()),
    tablet: finalizeMetric(bucket.devices.get('TABLET') || emptyMetric()),
  }));
}

function compareMetric(current, baseline) {
  return {
    clicks_delta: current.clicks - baseline.clicks,
    impressions_delta: current.impressions - baseline.impressions,
    ctr_delta_pp: (current.ctr - baseline.ctr) * 100,
    position_delta: current.position - baseline.position,
  };
}

function buildComparison({ options, baselinePayload, currentPayload }) {
  const baseline = aggregateRows(baselinePayload.rows || [], options.slugs);
  const current = aggregateRows(currentPayload.rows || [], options.slugs);
  const baselineBySlug = new Map(baseline.map((row) => [row.slug, row]));
  const currentBySlug = new Map(current.map((row) => [row.slug, row]));

  const rows = options.slugs.map((slug) => {
    const before = baselineBySlug.get(slug);
    const after = currentBySlug.get(slug);
    return {
      slug,
      page: pageForSlug(slug),
      baseline: before,
      current: after,
      total_delta: compareMetric(after.total, before.total),
      desktop_delta: compareMetric(after.desktop, before.desktop),
    };
  });

  const sumMetric = (selector) => {
    const metric = emptyMetric();
    for (const row of rows) {
      const selected = selector(row);
      metric.clicks += selected.clicks;
      metric.impressions += selected.impressions;
      metric.positionWeighted += selected.position * selected.impressions;
    }
    return finalizeMetric(metric);
  };

  const totals = {
    baseline_total: sumMetric((row) => row.baseline.total),
    current_total: sumMetric((row) => row.current.total),
    baseline_desktop: sumMetric((row) => row.baseline.desktop),
    current_desktop: sumMetric((row) => row.current.desktop),
  };
  totals.total_delta = compareMetric(totals.current_total, totals.baseline_total);
  totals.desktop_delta = compareMetric(totals.current_desktop, totals.baseline_desktop);

  return {
    generatedAt: new Date().toISOString(),
    options,
    source: {
      baseline: {
        start: options.baselineStart,
        end: options.baselineEnd,
        rows: baselinePayload.total || 0,
      },
      current: {
        start: options.currentStart,
        end: options.currentEnd,
        rows: currentPayload.total || 0,
      },
    },
    totals,
    rows,
  };
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function pp(value) {
  const sign = Number(value || 0) > 0 ? '+' : '';
  return `${sign}${Number(value || 0).toFixed(2)} pp`;
}

function num(value, digits = 1) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '0.0';
}

function csvEscape(value = '') {
  const text = String(value ?? '');
  if (/[,"\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Location CTR Cohort Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Property: ${report.options.property}`);
  lines.push(`Baseline: ${report.options.baselineStart}..${report.options.baselineEnd}`);
  lines.push(`Current: ${report.options.currentStart}..${report.options.currentEnd}`);
  lines.push('');
  lines.push('## Cohort Totals');
  lines.push('');
  lines.push('| Scope | Baseline clicks | Baseline impr | Baseline CTR | Baseline pos | Current clicks | Current impr | Current CTR | Current pos | CTR delta | Pos delta |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  const total = report.totals;
  lines.push(`| All devices | ${total.baseline_total.clicks} | ${total.baseline_total.impressions} | ${pct(total.baseline_total.ctr)} | ${num(total.baseline_total.position)} | ${total.current_total.clicks} | ${total.current_total.impressions} | ${pct(total.current_total.ctr)} | ${num(total.current_total.position)} | ${pp(total.total_delta.ctr_delta_pp)} | ${num(total.total_delta.position_delta)} |`);
  lines.push(`| Desktop | ${total.baseline_desktop.clicks} | ${total.baseline_desktop.impressions} | ${pct(total.baseline_desktop.ctr)} | ${num(total.baseline_desktop.position)} | ${total.current_desktop.clicks} | ${total.current_desktop.impressions} | ${pct(total.current_desktop.ctr)} | ${num(total.current_desktop.position)} | ${pp(total.desktop_delta.ctr_delta_pp)} | ${num(total.desktop_delta.position_delta)} |`);
  lines.push('');
  lines.push('## Priority Pages');
  lines.push('');
  lines.push('| Page | Desktop baseline CTR | Desktop current CTR | Desktop CTR delta | Desktop pos delta | Desktop impr delta | All-device current CTR |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of report.rows) {
    lines.push(`| ${row.slug} | ${pct(row.baseline.desktop.ctr)} | ${pct(row.current.desktop.ctr)} | ${pp(row.desktop_delta.ctr_delta_pp)} | ${num(row.desktop_delta.position_delta)} | ${row.desktop_delta.impressions_delta} | ${pct(row.current.total.ctr)} |`);
  }
  lines.push('');
  lines.push('## Closeout Rule');
  lines.push('');
  lines.push('- Rank 5 passes only if desktop CTR improves by 0.5-1.0 percentage points on the rewritten cohort without material rank loss.');
  lines.push('- Use a 7-day read for early signal and a 28-day read for closeout.');
  lines.push('- Pair this GSC readout with downstream `/screener` or `/start` reach from first-party analytics before expanding more local rewrites.');
  return `${lines.join('\n')}\n`;
}

function renderCsv(report) {
  const header = [
    'slug',
    'page',
    'baseline_desktop_clicks',
    'baseline_desktop_impressions',
    'baseline_desktop_ctr',
    'baseline_desktop_position',
    'current_desktop_clicks',
    'current_desktop_impressions',
    'current_desktop_ctr',
    'current_desktop_position',
    'desktop_ctr_delta_pp',
    'desktop_position_delta',
    'all_current_ctr',
  ];
  const lines = [header.join(',')];
  for (const row of report.rows) {
    lines.push([
      row.slug,
      row.page,
      row.baseline.desktop.clicks,
      row.baseline.desktop.impressions,
      row.baseline.desktop.ctr,
      row.baseline.desktop.position,
      row.current.desktop.clicks,
      row.current.desktop.impressions,
      row.current.desktop.ctr,
      row.current.desktop.position,
      row.desktop_delta.ctr_delta_pp,
      row.desktop_delta.position_delta,
      row.current.total.ctr,
    ].map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectApprox(actual, expected, label, epsilon = 0.000001) {
  if (Math.abs(Number(actual) - Number(expected)) > epsilon) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function expectFail(name, fn, expectedMessage) {
  try {
    fn();
  } catch (error) {
    const message = error?.message || String(error);
    if (message.includes(expectedMessage)) {
      return { name, status: 'pass' };
    }
    throw new Error(`${name}: expected error containing "${expectedMessage}", got "${message}"`);
  }
  throw new Error(`${name}: expected failure`);
}

function expectPass(name, fn) {
  fn();
  return { name, status: 'pass' };
}

function runSelfTest() {
  const options = {
    property: DEFAULT_PROPERTY,
    baselineStart: '2026-06-16',
    baselineEnd: '2026-06-22',
    currentStart: '2026-06-23',
    currentEnd: '2026-06-29',
    rowLimit: 100,
    outputDir: '/tmp/gsc-location-ctr-cohort-self-test',
    slugs: ['boston', 'denver'],
    selfTest: true,
  };
  const baselinePayload = {
    total: 3,
    rows: [
      { page: pageForSlug('boston'), device: 'DESKTOP', clicks: 10, impressions: 100, position: 4 },
      { page: pageForSlug('boston'), device: 'MOBILE', clicks: 5, impressions: 50, position: 8 },
      { page: 'https://antique-appraiser-directory.appraisily.com/location/not-in-cohort/', device: 'DESKTOP', clicks: 99, impressions: 99, position: 1 },
    ],
  };
  const currentPayload = {
    total: 2,
    rows: [
      { page: pageForSlug('boston'), device: 'DESKTOP', clicks: 20, impressions: 100, position: 3 },
      { page: pageForSlug('denver'), device: 'MOBILE', clicks: 1, impressions: 20, position: 12 },
    ],
  };

  const report = buildComparison({ options, baselinePayload, currentPayload });
  const boston = report.rows.find((row) => row.slug === 'boston');
  const denver = report.rows.find((row) => row.slug === 'denver');
  const tests = [
    expectPass('parse-self-test-does-not-require-search-console', () => {
      const parsed = parseArgs(['--self-test']);
      expect(parsed.selfTest === true, '--self-test should parse');
      expect(parsed.property === DEFAULT_PROPERTY, 'default property should remain available');
    }),
    expectFail('invalid-date-refuses', () => parseArgs(['--baseline-start', '2026/06/16']), 'baselineStart must be YYYY-MM-DD'),
    expectPass('unknown-pages-are-filtered-from-cohort', () => {
      expectApprox(report.totals.baseline_total.clicks, 15, 'baseline clicks');
      expectApprox(report.totals.baseline_total.impressions, 150, 'baseline impressions');
    }),
    expectPass('desktop-ctr-and-position-deltas-are-weighted', () => {
      expectApprox(report.totals.desktop_delta.ctr_delta_pp, 10, 'desktop ctr delta');
      expectApprox(report.totals.desktop_delta.position_delta, -1, 'desktop position delta');
    }),
    expectPass('empty-baseline-slug-is-preserved', () => {
      expect(denver, 'denver row missing');
      expectApprox(denver.baseline.total.impressions, 0, 'denver baseline impressions');
      expectApprox(denver.current.total.impressions, 20, 'denver current impressions');
    }),
    expectPass('priority-page-row-deltas-are-rendered', () => {
      expect(boston, 'boston row missing');
      expectApprox(boston.desktop_delta.ctr_delta_pp, 10, 'boston desktop ctr delta');
      expect(renderMarkdown(report).includes('Rank 5 passes only if desktop CTR improves'), 'closeout rule missing');
    }),
    expectPass('csv-output-includes-cohort-pages', () => {
      const csv = renderCsv(report);
      expect(csv.includes('boston,https://antique-appraiser-directory.appraisily.com/location/boston/'), 'boston csv row missing');
      expect(csv.includes('denver,https://antique-appraiser-directory.appraisily.com/location/denver/'), 'denver csv row missing');
    }),
  ];
  return {
    status: 'pass',
    tests,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    console.log(JSON.stringify(runSelfTest(), null, 2));
    return;
  }
  await fs.mkdir(options.outputDir, { recursive: true });

  const baselinePayload = runSearchAnalytics({
    options,
    start: options.baselineStart,
    end: options.baselineEnd,
  });
  const currentPayload = runSearchAnalytics({
    options,
    start: options.currentStart,
    end: options.currentEnd,
  });
  const report = buildComparison({ options, baselinePayload, currentPayload });

  const jsonPath = path.join(options.outputDir, 'location-ctr-cohort.json');
  const mdPath = path.join(options.outputDir, 'location-ctr-cohort.md');
  const csvPath = path.join(options.outputDir, 'location-ctr-cohort.csv');
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, renderMarkdown(report), 'utf8');
  await fs.writeFile(csvPath, renderCsv(report), 'utf8');

  console.log(JSON.stringify({
    status: 'ok',
    outputDir: options.outputDir,
    files: { jsonPath, mdPath, csvPath },
    slugs: options.slugs,
    desktopCtrDeltaPp: report.totals.desktop_delta.ctr_delta_pp,
    desktopPositionDelta: report.totals.desktop_delta.position_delta,
  }, null, 2));
}

main().catch((error) => {
  console.error('[gsc-location-ctr-cohort] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
