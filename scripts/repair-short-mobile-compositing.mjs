#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MARKER = 'data-appraisily-short-mobile-compositing="1"';
const STYLE = `<style ${MARKER}>@media (max-width:500px){nav.fixed{background-color:#fff!important}.backdrop-blur-md{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}.bg-gradient-to-r.from-blue-50.to-white{background-image:none!important;background-color:#eff6ff!important}}</style>`;

function parseArgs(argv) {
  const options = { publicDir: path.resolve(process.cwd(), 'public_site'), write: false, check: false };
  const args = [...argv];
  while (args.length) {
    const token = args.shift();
    const [flag, inline] = String(token || '').split('=');
    const value = () => inline ?? args.shift();
    if (flag === '--public-dir') options.publicDir = path.resolve(process.cwd(), String(value() || ''));
    else if (flag === '--write') options.write = true;
    else if (flag === '--dry-run') options.write = false;
    else if (flag === '--check') options.check = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  return options;
}

async function listHtml(root) {
  const files = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listHtml(filePath));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(filePath);
  }
  return files;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = await listHtml(options.publicDir);
  let changedFiles = 0;
  for (const filePath of files) {
    const html = await fs.readFile(filePath, 'utf8');
    const rewritten = html.includes(MARKER)
      ? html.replace(/<style\s+data-appraisily-short-mobile-compositing=["']1["']>[\s\S]*?<\/style>/i, STYLE)
      : html.replace(/<\/head>/i, `${STYLE}</head>`);
    if (rewritten === html) continue;
    changedFiles += 1;
    if (options.write) await fs.writeFile(filePath, rewritten, 'utf8');
  }
  console.log(JSON.stringify({ action: options.write ? 'repaired-short-mobile-compositing' : 'planned-short-mobile-compositing-repair', publicDir: options.publicDir, files: files.length, changedFiles }, null, 2));
  if (options.check && changedFiles > 0) process.exit(1);
}

main().catch((error) => {
  console.error('[repair-short-mobile-compositing] Failed:', error?.stack || error?.message || error);
  process.exit(1);
});
