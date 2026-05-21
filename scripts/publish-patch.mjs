#!/usr/bin/env node
import { runDirectorySiteUtil } from './run-directory-site-util.mjs';

runDirectorySiteUtil('publish-patch.mjs', [
  '--release-root',
  '/mnt/srv-storage/antique-appraiser-directory/releases',
  '--container',
  'antique-appraiser-directory',
]);
