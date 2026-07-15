import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/components/DecisionRouter.tsx'), 'utf8');
const failures = [];

if (source.includes('data-appraisily-directory-sample-proof="1"\n        role="link"')) {
  failures.push('The sample-proof container must not duplicate its nested link interaction.');
}
if (!source.includes('data-clarity-action="directory_sample_report_open"')) {
  failures.push('The sample-report link needs a stable Clarity action.');
}

if (failures.length) {
  console.error('Directory interaction contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Directory interaction contract passed.');
