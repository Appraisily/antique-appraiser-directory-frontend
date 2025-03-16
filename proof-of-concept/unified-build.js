/**
 * Unified Build Script
 * 
 * This demonstrates a simpler build process that combines the main site
 * and directory components into a single build, eliminating the need for
 * complex merge scripts and multiple build processes.
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

// Configuration
const config = {
  // Main site source and output directories
  mainSite: {
    root: path.resolve(process.cwd(), '../main_page'),
    outDir: path.resolve(process.cwd(), '../dist')
  },
  
  // Data directory (shared between main site and directory)
  dataDir: path.resolve(process.cwd(), '../data'),
  
  // Environment variables
  env: {
    NODE_ENV: 'production',
    VITE_PUBLIC_PATH: '/',
    VITE_APP_TITLE: 'Appraisily - Art Appraisal Services'
  }
};

// Helper for colored logs
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
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

// Build the project
async function buildProject() {
  try {
    log('Starting unified build process...', 'info');
    
    // Step 1: Clean output directory
    log('Cleaning output directory...', 'info');
    await fs.emptyDir(config.mainSite.outDir);
    
    // Step 2: Ensure the directory component is properly imported in the main site
    log('Checking for directory component imports...', 'info');
    // This step would verify/update imports - simplified for this example
    
    // Step 3: Copy shared data to the build data directory
    log('Copying shared data...', 'info');
    await fs.copy(
      config.dataDir, 
      path.join(config.mainSite.outDir, 'data'),
      { overwrite: true }
    );
    
    // Step 4: Build the main site with directory components included
    log('Building main site with integrated directory...', 'info');
    execSync('npm run build', { 
      cwd: config.mainSite.root,
      stdio: 'inherit',
      env: { ...process.env, ...config.env }
    });
    
    // Step 5: Generate sitemap that includes all pages
    log('Generating comprehensive sitemap...', 'info');
    // This would call a sitemap generation script - simplified for this example
    
    // Step 6: Run post-build optimizations
    log('Running post-build optimizations...', 'info');
    await optimizeImages();
    await optimizeHtml();
    
    log('Build completed successfully!', 'success');
    log(`Output directory: ${config.mainSite.outDir}`, 'success');
    
  } catch (error) {
    log(`Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Helper function to optimize images
async function optimizeImages() {
  try {
    log('Optimizing images...', 'info');
    // Image optimization logic would go here
    return true;
  } catch (error) {
    log(`Image optimization failed: ${error.message}`, 'warning');
    return false;
  }
}

// Helper function to optimize HTML
async function optimizeHtml() {
  try {
    log('Optimizing HTML files...', 'info');
    // HTML optimization logic would go here
    return true;
  } catch (error) {
    log(`HTML optimization failed: ${error.message}`, 'warning');
    return false;
  }
}

// Run the build
buildProject(); 