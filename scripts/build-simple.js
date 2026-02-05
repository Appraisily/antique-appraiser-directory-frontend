#!/usr/bin/env node
/**
 * Simplified build script for Art Appraiser Directory
 * This script handles the entire process of:
 * 1. Fetching images from ImageKit
 * 2. Randomizing images for appraisers
 * 3. Generating static HTML files
 * 4. Preparing for Netlify deployment
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const DIST_DIR = path.join(rootDir, 'dist');
const IMAGEKIT_INVENTORY_FILE = path.join(rootDir, 'imagekit-inventory.json');

// Log with colors
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toISOString();
  let coloredMessage;

  switch (type) {
    case 'success':
      coloredMessage = chalk.green(message);
      break;
    case 'warning':
      coloredMessage = chalk.yellow(message);
      break;
    case 'error':
      coloredMessage = chalk.red(message);
      break;
    default:
      coloredMessage = chalk.blue(message);
  }

  console.log(`[${timestamp}] ${coloredMessage}`);
}

function runCommand(command, message) {
  log(message, 'info');
  try {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
  } catch (error) {
    log(`Error executing "${command}": ${error.message}`, 'error');
    throw error;
  }
}

async function buildDirectory() {
  log('🚀 Starting simplified build process for Art Appraiser Directory', 'success');

  try {
    // Step 1: Clean the dist directory if it exists
    if (fs.existsSync(DIST_DIR)) {
      await fs.emptyDir(DIST_DIR);
      log('🧹 Cleaned dist directory', 'info');
    }

    // Step 2: List available images from ImageKit
    runCommand('node scripts/list-imagekit-images.js', '🖼️ Fetching images from ImageKit');

    // Step 3: Randomize appraiser images with ImageKit images
    log('🎲 Randomizing appraiser images with ImageKit images...', 'info');
    if (fs.existsSync(IMAGEKIT_INVENTORY_FILE)) {
      runCommand('node scripts/randomize-imagekit-images.js', 'Randomizing appraiser images');
    } else {
      log('⚠️ ImageKit inventory not found. Skipping image randomization.', 'warning');
    }

    // Step 4: Build the React app with npx to avoid PATH issues
    runCommand('npx tsc && npx vite build', '🔨 Building React app');

    // Step 5: Generate static HTML pages for locations and appraisers
    runCommand('node scripts/generate-static.js', '📄 Generating static HTML pages');

    // Step 6: Copy static files
    runCommand('node scripts/copy-static.js', '📁 Copying static files');

    // Step 7: Generate sitemap
    runCommand('node scripts/generate-sitemap.js', '🗺️ Generating sitemap');

    // Step 8: Fix any page issues
    runCommand('node scripts/fix-all-pages.js', '🔧 Fixing pages');
    
    // Step 9: Fix domain links to point to main domain
    runCommand('node scripts/fix-domain-links.js', '🔗 Updating links to point to main domain');

    // Step 9b: Ensure the client bundle does NOT attempt to hydrate pre-rendered HTML.
    // Static pages do not ship a matching serialized state snapshot, so hydration can
    // trigger React recoverable hydration mismatch errors (#418/#423).
    runCommand(
      'node scripts/fix-client-entry-hydration-mode.mjs --public-dir dist',
      '🧯 Disabling client hydration (client render only)'
    );

    // Step 10: Prepare for Netlify deployment
    runCommand('node scripts/prepare-for-netlify.js', '🚀 Preparing for Netlify deployment');

    log('✅ Build completed successfully!', 'success');
    log('📂 Static files generated in the dist/ directory', 'success');
    log('🌐 To preview locally: npm run serve:static', 'info');
    log('🚀 To deploy to Netlify: push to your repository with the updated netlify.toml', 'info');

  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the build process
buildDirectory();
