import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Owner decision 13 Nov 2026: the one delivery promise for every Appraisily report is
// "within 24 hours of receiving your photos" (short form "within 24 hours").
// Never 48 h, "in hours", "within hours", same day or 6 hours.
// Third-party listings that describe a provider's own turnaround are not our promise.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPROVED = 'within 24 hours of receiving your photos';
const RETIRED = [
  /delivered in hours/i,
  /hours once we have/i,
  /within hours/i,
  /certified experts within 48 hours/i,
  /Faster turnaround for most items/,
  /Timing varies by item type and complexity/,
];

test('location page Appraisily FAQ and online card state the 24-hour promise', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src/pages/StandardizedLocationPage.tsx'), 'utf8');
  const faq = source.match(/How fast is the online appraisal turnaround\?[\s\S]{0,200}?text: '([^']+)'/);
  assert.ok(faq, 'FAQ entry present');
  assert.match(faq[1], new RegExp(APPROVED));
  assert.match(source, /<li>Delivered within 24 hours of receiving your photos<\/li>/);
  for (const pattern of RETIRED) assert.doesNotMatch(source, pattern);
});

test('served HTML carries no retired Appraisily delivery wording', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        const html = fs.readFileSync(full, 'utf8');
        if (RETIRED.some((pattern) => pattern.test(html))) offenders.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(path.join(repoRoot, 'public_site'));
  assert.deepEqual(offenders, []);
});
