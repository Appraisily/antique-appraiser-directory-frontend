#!/usr/bin/env node
import { runDirectorySiteUtil } from './run-directory-site-util.mjs';

runDirectorySiteUtil('check-indexing-contract.mjs', [
  '--origin',
  'https://antique-appraiser-directory.appraisily.com',
]);
