#!/usr/bin/env node
/**
 * CTR pass 2 (2026-11-11): titles and meta descriptions for city pages and the
 * two "near me" hubs, from scripts/lib/directory-metadata.mjs.
 *
 * Same convention as the inject-* scripts: dry run by default, --write applies,
 * --check fails when a page differs from the builder. It only rewrites the
 * metadata copies of one page: <title>, meta description, og/twitter
 * title/description, and the Service JSON-LD description when it repeated the
 * old meta description. Body content is never touched. Review the git diff
 * before committing.
 *
 *   node scripts/apply-directory-metadata-pass2.mjs [--public-dir public_site] [--check | --write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { cityPageFacts, hubFacts, readSitemapProfiles } from './lib/city-page-facts.mjs';
import { buildCityMetadata, buildHubMetadata, isReplaceableDescription } from './lib/directory-metadata.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export function loadExclusions(file = path.join(repoRoot, 'data', 'directory-ctr-pass2-exclusions.json')) {
  return new Map(JSON.parse(fs.readFileSync(file, 'utf8')).excluded.map((entry) => [entry.slug, entry]));
}

const decode = (value) =>
  String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const encode = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function readHeadMetadata(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return { title: title ? decode(title[1].trim()) : null, description: description ? decode(description[1]) : null };
}

function setMetaContent(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key.replace(/:/g, '\\:')}"\\s+content=")([^"]*)(")`, 'gi');
  return html.replace(re, `$1${encode(value)}$3`);
}

export function applyMetadata(html, next) {
  const before = readHeadMetadata(html);
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${encode(next.title)}</title>`);
  out = setMetaContent(out, 'name', 'description', next.description);
  for (const attr of ['property', 'name']) {
    out = setMetaContent(out, attr, 'og:title', next.title);
    out = setMetaContent(out, attr, 'og:description', next.description);
    out = setMetaContent(out, attr, 'twitter:title', next.title);
    out = setMetaContent(out, attr, 'twitter:description', next.description);
  }
  // The Service JSON-LD repeats the meta description on most city pages. Update
  // it when it is the old meta copy or a template description this pass replaces;
  // reviewed custom schema copy is left alone.
  out = out.replace(/(<script type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi, (block, open, body, close) => {
    const serviceAt = body.indexOf('"@type":"Service"');
    if (serviceAt < 0) return block;
    const re = /"description":("(?:[^"\\]|\\.)*")/g;
    re.lastIndex = serviceAt;
    const match = re.exec(body);
    if (!match) return block;
    // Only the Service's own description: stop at the next schema object.
    const nextType = body.indexOf('"@type"', serviceAt + 1);
    if (nextType >= 0 && nextType < match.index) return block;
    const value = JSON.parse(match[1]);
    if (value === next.description) return block;
    if (value !== before.description && !isReplaceableDescription(value)) return block;
    const updated = body.slice(0, match.index) + `"description":${JSON.stringify(next.description)}` + body.slice(match.index + match[0].length);
    return `${open}${updated}${close}`;
  });
  return out;
}

/** City pages in scope: those listed in sitemap.xml (the honesty test's set). */
export function sitemapCitySlugs(publicDir) {
  const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>[^<]*\/location\/([^/<]+)\/<\/loc>/g)].map((match) => match[1]).sort();
}

export function planPages(publicDir) {
  const profiles = readSitemapProfiles(publicDir);
  const exclusions = loadExclusions();
  const pages = [];
  const locationRoot = path.join(publicDir, 'location');
  for (const slug of sitemapCitySlugs(publicDir)) {
    const file = path.join(locationRoot, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const route = `/location/${slug}/`;
    const html = fs.readFileSync(file, 'utf8');
    const current = readHeadMetadata(html);
    if (exclusions.has(slug)) {
      pages.push({ route, file, excluded: exclusions.get(slug).reason, current, next: current });
      continue;
    }
    const facts = cityPageFacts(html, profiles, route);
    pages.push({ route, file, facts, current, next: buildCityMetadata(facts, current) });
  }
  for (const [slug, kind] of [['art-appraisers-near-me', 'art'], ['antique-appraisers-near-me', 'antique']]) {
    const file = path.join(publicDir, slug, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    const facts = hubFacts(html);
    pages.push({ route: `/${slug}/`, file, facts, current: readHeadMetadata(html), next: buildHubMetadata(kind, facts) });
  }
  return pages;
}

function main() {
  const args = process.argv.slice(2);
  const publicDir = path.resolve(args.includes('--public-dir') ? args[args.indexOf('--public-dir') + 1] : path.join(repoRoot, 'public_site'));
  const write = args.includes('--write');
  const check = args.includes('--check');
  const pages = planPages(publicDir);
  const changed = [];
  for (const page of pages) {
    if (page.excluded) continue;
    const html = fs.readFileSync(page.file, 'utf8');
    const next = applyMetadata(html, page.next);
    if (next !== html) {
      changed.push(page.route);
      if (write) fs.writeFileSync(page.file, next);
    }
  }
  console.log(JSON.stringify({
    action: write ? 'directory-metadata-pass2-applied' : 'directory-metadata-pass2-planned',
    pages: pages.length,
    excluded: pages.filter((page) => page.excluded).map((page) => page.route),
    changed: changed.length,
  }, null, 2));
  if (check && changed.length) {
    console.error(`[directory-metadata-pass2] ${changed.length} page(s) differ from the builder: ${changed.slice(0, 10).join(', ')}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
