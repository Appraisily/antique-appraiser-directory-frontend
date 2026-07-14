#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';

async function importBundled(relativePath) {
  const output = await build({
    entryPoints: [path.resolve(relativePath)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    define: { 'import.meta.env': '{}' },
    write: false,
  });
  const source = output.outputFiles[0].text.replaceAll('import.meta.env', '({})');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const { normalizeAssetUrl } = await importBundled('src/utils/assetUrls.ts');
const { generateAppraiserSchema, generateArticleSchema, generateHowToSchema } = await importBundled('src/utils/schemaGenerators.ts');
const placeholder = 'https://assets.appraisily.com/assets/directory/placeholder.jpg';
const retiredHost = ['ik', ['image', 'kit'].join(''), 'io'].join('.');

assert.equal(normalizeAssetUrl(), placeholder);
assert.equal(normalizeAssetUrl('  '), placeholder);
assert.equal(normalizeAssetUrl('/images/local.webp'), '/images/local.webp');
assert.equal(normalizeAssetUrl('//third-party.example/image.jpg'), placeholder);
assert.equal(normalizeAssetUrl('/placeholder-image.jpg'), placeholder);
assert.equal(normalizeAssetUrl(placeholder), placeholder);
assert.equal(
  normalizeAssetUrl('https://assets.appraisily.com/directory/appraisers/reviewed.jpg'),
  'https://assets.appraisily.com/directory/appraisers/reviewed.jpg',
);
assert.equal(normalizeAssetUrl('https://placehold.co/300x300'), placeholder);
assert.equal(normalizeAssetUrl('https://assets.appraisily.com.evil.example/reviewed.jpg'), placeholder);
assert.equal(normalizeAssetUrl('http://assets.appraisily.com/reviewed.jpg'), placeholder);
assert.equal(normalizeAssetUrl('not a valid URL'), placeholder);
assert.equal(normalizeAssetUrl('https://images.example.com/unreviewed.jpg'), placeholder);
assert.equal(normalizeAssetUrl(`https://${retiredHost}/appraisily/old.jpg`), placeholder);

const appraiserSchema = generateAppraiserSchema({ name: 'Asset Contract Test', image: 'https://images.example.com/unreviewed.jpg' });
assert.equal(appraiserSchema.image.url, placeholder);
const protocolRelativeSchema = generateAppraiserSchema({ name: 'Protocol Relative Asset Test', image: '//third-party.example/image.jpg' });
assert.equal(protocolRelativeSchema.image.url, placeholder);
const articleSchema = generateArticleSchema('Title', 'Description', 'https://example.test/article', 'https://images.example.com/unreviewed.jpg');
assert.equal(articleSchema.image, placeholder);
for (const step of generateHowToSchema().step) {
  assert.match(step.image, /^https:\/\/assets\.appraisily\.com\//);
}

console.log('[asset-url-contract] URL normalization and generated schema image cases passed.');
