/**
 * Build with ImageKit Images
 * 
 * This script:
 * 1. Lists all available images from ImageKit
 * 2. Randomizes appraiser images using ImageKit URLs
 * 3. Builds the site locally with these random images
 * 4. Generates all static pages
 * 5. Fixes any page issues
 * 
 * This produces a production-ready build using only existing ImageKit images
 * (no image generation)
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

// Helper to run shell commands
async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

// Main build function
async function buildWithImageKit() {
  try {
    console.log('📋 Starting production build with ImageKit images...');
    
    // 1. First list and randomize ImageKit images
    console.log('🖼️ Fetching and randomizing ImageKit images...');
    await runCommand('node', [path.join(__dirname, 'randomize-imagekit-images.js')]);
    
    // 2. Run the TypeScript compiler
    console.log('🔍 Running TypeScript compiler...');
    await runCommand('tsc');
    
    // 3. Build with Vite
    console.log('🏗️ Building with Vite...');
    await runCommand('vite', ['build']);
    
    // 4. Generate static pages
    console.log('📄 Generating static pages...');
    await runCommand('node', [path.join(__dirname, 'generate-static.js')]);
    
    // 5. Copy static assets
    console.log('📦 Copying static assets...');
    await runCommand('node', [path.join(__dirname, 'copy-static.js')]);
    
    // 6. Fix any page issues
    console.log('🔧 Fixing page issues...');
    
    // Check if we should skip hydration fixes (for faster testing)
    const skipHydrationFixes = process.argv.includes('--skip-hydration');
    if (skipHydrationFixes) {
      console.log('⚠️ Skipping hydration fixes (faster build for testing)');
      // Just apply fallback image handler without hydration fixes
      await runCommand('node', [path.join(__dirname, 'inject-fallback-image-handler.js')]);
    } else {
      await runCommand('node', [path.join(__dirname, 'fix-all-pages.js')]);
    }
    
    // 7. Generate sitemap for SEO
    console.log('🗺️ Generating sitemap...');
    await runCommand('node', [path.join(__dirname, 'generate-sitemap.js')]);
    
    // 8. Create image inventory for reference
    console.log('📝 Creating image inventory...');
    await runCommand('node', [path.join(__dirname, 'create-image-inventory.js')]);
    
    console.log('✅ Build complete! The site is ready in the dist folder.');
    console.log('📊 To test the build locally, run: npm run serve:static');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build process
buildWithImageKit();