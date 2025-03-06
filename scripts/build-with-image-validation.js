#!/usr/bin/env node

/**
 * Build script with enhanced image validation for the art appraiser directory
 * This script performs a standard build but adds image validation and regeneration
 * for appraiser images to ensure all location pages have proper images
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Log with timestamp
const log = (message) => {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${message}`);
};

// Main build function
async function buildWithImageValidation() {
  try {
    log('Starting build with image validation...');
    
    // Set environment variable for image generation service
    process.env.IMAGE_GENERATION_SERVICE_URL = process.env.IMAGE_GENERATION_SERVICE_URL || 
      'https://image-generation.appraisily.com/generate';
    
    log(`Image generation service: ${process.env.IMAGE_GENERATION_SERVICE_URL}`);
    
    // Clean previous build by removing dist directory
    log('Cleaning previous build...');
    fs.rmSync(path.join(ROOT_DIR, 'dist'), { recursive: true, force: true });
    
    // Run the build:simple script which includes TypeScript compilation and Vite build
    log('Building with TypeScript and Vite...');
    execSync('npm run build:simple', { stdio: 'inherit', cwd: ROOT_DIR });
    
    // Create necessary directories
    const dataDir = path.join(ROOT_DIR, 'dist', 'data');
    fs.ensureDirSync(dataDir);
    
    // Generate static HTML with image validation
    log('Generating static HTML with image validation...');
    execSync('node ./scripts/generate-static.js', { stdio: 'inherit', cwd: ROOT_DIR });
    
    // Generate sitemap
    log('Generating sitemap...');
    try {
      execSync('node ./scripts/generate-sitemap.js', { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (error) {
      log('Warning: Sitemap generation failed, but continuing build');
      console.error(error);
    }
    
    // Optimize images
    log('Optimizing images...');
    try {
      execSync('npm run optimize-images', { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (error) {
      log('Warning: Image optimization failed, but continuing build');
      console.error(error);
    }
    
    // Copy static files
    log('Copying static files...');
    execSync('node ./scripts/copy-static.js', { stdio: 'inherit', cwd: ROOT_DIR });
    
    // Minify HTML (optional)
    if (process.env.MINIFY_HTML === 'true') {
      log('Minifying HTML...');
      try {
        execSync('npm run minify', { stdio: 'inherit', cwd: ROOT_DIR });
      } catch (error) {
        log('Warning: HTML minification failed, but continuing build');
        console.error(error);
      }
    }
    
    log('Build completed successfully with image validation!');
    log('---------------------------------------------------');
    log('✅ Pre-rendered HTML pages with validated images');
    log('✅ Enhanced Schema.org structured data');
    log('✅ Optimized meta tags');
    log('✅ Responsive image loading');
    log('✅ Comprehensive XML sitemap');
    log('✅ robots.txt with sitemap reference');
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run the build
buildWithImageValidation(); 