#!/usr/bin/env node
import { runDirectorySiteUtil } from './run-directory-site-util.mjs';

runDirectorySiteUtil('suppress-provider-cohort.mjs', [
  '--manifest', 'data/provider-publication-manifest.json',
  '--cohort', '../../tools/directory-site-utils/data/art-antique-unresolved-provider-conflicts-2026-07-15.json',
]);
