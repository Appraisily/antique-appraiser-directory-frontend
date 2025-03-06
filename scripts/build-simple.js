#!/usr/bin/env node
/**
 * Enhanced build script for art-appraiser-directory-frontend
 * Fixes hydration issues and prevents unwanted script injection
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { injectCSPToDirectory } from './utils/inject-csp.js';

// Get the current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

async function build() {
  try {
    log('Starting enhanced build process...', 'info');
    
    // Step 1: Clean the build directory
    log('Cleaning dist directory...', 'info');
    await fs.emptyDir(path.join(rootDir, 'dist'));
    
    // Step 2: Run TypeScript compiler
    log('Running TypeScript compiler...', 'info');
    execSync('tsc', { stdio: 'inherit', cwd: rootDir });
    
    // Step 3: Run Vite build
    log('Running Vite build...', 'info');
    execSync('npx vite build', { stdio: 'inherit', cwd: rootDir });
    
    // Step 4: Run the hydration fix script
    log('Fixing React hydration issues...', 'info');
    execSync('node scripts/fix-react-hydration.js', { stdio: 'inherit', cwd: rootDir });
    
    // Step 5: Generate static files for SEO
    log('Generating static files...', 'info');
    execSync('node scripts/generate-static.js', { stdio: 'inherit', cwd: rootDir });
    
    // Step 6: Generate sitemap
    log('Generating sitemap...', 'info');
    execSync('node scripts/generate-sitemap.js', { stdio: 'inherit', cwd: rootDir });
    
    // Step 7: Inject CSP directly into the HTML files
    log('Injecting Content Security Policy into HTML files...', 'info');
    const distPath = path.join(rootDir, 'dist');
    const processedCount = await injectCSPToDirectory(distPath);
    log(`Injected CSP into ${processedCount} HTML files`, 'success');
    
    log('Build completed successfully!', 'success');
  } catch (error) {
    log(`Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the build process
build(); 