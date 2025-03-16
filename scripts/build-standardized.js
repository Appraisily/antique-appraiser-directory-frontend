#!/usr/bin/env node

/**
 * Build Standardized
 * 
 * Simplified build script that uses standardized data for the Art Appraiser Directory.
 * This script handles the entire build process:
 * 1. Builds the React application
 * 2. Ensures standardized data is available
 * 3. Prepares for deployment with proper SEO and metadata
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
const STANDARDIZED_DIR = path.join(rootDir, 'src', 'data', 'standardized');

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

async function buildStandardized() {
  log('🚀 Starting standardized build process for Art Appraiser Directory', 'success');

  try {
    // Step 1: Verify standardized data exists
    if (!fs.existsSync(STANDARDIZED_DIR)) {
      log('⚠️ Standardized data directory not found!', 'warning');
      
      // Create the directory
      fs.ensureDirSync(STANDARDIZED_DIR);
      
      // Run the standardization script if the directory is empty
      log('🔄 Generating standardized data from source files...', 'info');
      runCommand('node scripts/standardize-appraiser-data.js', 'Standardizing appraiser data');
    } else {
      const files = fs.readdirSync(STANDARDIZED_DIR).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        log('⚠️ No standardized data files found!', 'warning');
        log('🔄 Generating standardized data from source files...', 'info');
        runCommand('node scripts/standardize-appraiser-data.js', 'Standardizing appraiser data');
      } else {
        log(`✅ Found ${files.length} standardized data files`, 'success');
      }
    }

    // Step 2: Clean the dist directory if it exists
    if (fs.existsSync(DIST_DIR)) {
      await fs.emptyDir(DIST_DIR);
      log('🧹 Cleaned dist directory', 'info');
    }

    // Step 3: Run TypeScript checks
    runCommand('npx tsc', '🔍 Checking TypeScript types');

    // Step 4: Build the React app
    runCommand('npx vite build', '🔨 Building React app');

    // Step 5: Generate SEO files
    runCommand('node scripts/generate-sitemap.js', '🗺️ Generating sitemap');

    // Step 6: Fix links to point to main domain
    runCommand('node scripts/fix-domain-links.js', '🔗 Updating links to point to main domain');

    // Step 7: Generate static location pages
    runCommand('node scripts/fix-all-pages.js', '📄 Generating static location pages');
    
    // Step 8: Generate static appraiser pages
    runCommand('node scripts/generate-appraiser-pages.js', '📄 Generating static appraiser pages');
    
    // Step 9: Fix HTML paths for deployment (fix for module loading issue)
    runCommand('node scripts/fix-html-paths.js', '🔧 Fixing HTML paths for module loading');

    // Step 10: Fix React hydration issues
    runCommand('node scripts/fix-react-hydration.js', '🔄 Fixing React hydration issues');
    
    // Step 11: Fix preloaded asset references
    runCommand('node scripts/fix-preload-refs.js', '🔄 Fixing preloaded asset references');

    // Step 12: Fix location links to be relative
    runCommand('node scripts/fix-relative-links.js', '🔄 Fixing location links to be relative');

    // Step 13: Prepare for Netlify deployment
    runCommand('node scripts/prepare-for-netlify.js', '🚀 Preparing for Netlify deployment');

    log('✅ Build completed successfully!', 'success');
    log('📂 Static files generated in the dist/ directory', 'success');
    log('🌐 To preview locally: npm run serve:static', 'info');
    log('🚀 To deploy to Netlify: git push to your repository with the updated netlify.toml', 'info');

  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the build process
buildStandardized();