/**
 * Netlify Build Script
 * 
 * This script is designed to be run by Netlify's build system.
 * It ensures all SEO optimizations are applied consistently.
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

// Setting up environment
const siteUrl = process.env.SITE_URL || 'https://art-appraiser.appraisily.com';
// Set environment variable for sitemap generation
process.env.SITE_URL = siteUrl;

console.log('Starting Netlify build process with SEO optimizations...');
console.log(`Using site URL: ${siteUrl}`);

try {
  // Pre-build: Make sure all dependencies are installed
  console.log('📦 Ensuring all dependencies are installed...');
  execSync('npm install', { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('✅ Dependencies verified');

  // Step 1: Clean up previous build artifacts
  console.log('🧹 Cleaning up previous build artifacts...');
  const distDir = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    fs.removeSync(distDir);
  }

  // Step 2: Run the TypeScript compiler
  console.log('🔄 Compiling TypeScript...');
  execSync('npx tsc', { cwd: ROOT_DIR, stdio: 'inherit' });

  // Right after step 2
  console.log('2. ✅ TypeScript compilation complete');

  // Add image placeholder fixing step
  console.log('3. 🖼️ Fixing placeholder images...');
  execSync('node scripts/fix-placeholder-images.js', { stdio: 'inherit' });
  console.log('3. ✅ Placeholder images fixed');

  // Step 4: Run Vite build
  console.log('🏗️ Building with Vite...');
  execSync('npx vite build', { cwd: ROOT_DIR, stdio: 'inherit' });

  // Step 5: Generate static HTML pages
  console.log('📄 Generating static HTML pages...');
  execSync('node scripts/generate-static.js', { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('4. ✅ Static HTML pages generated');

  // Add the static appraiser pages generation step
  console.log('5. 🏗️ Generating static appraiser pages...');
  execSync('node scripts/generate-static-appraiser-pages.js', { stdio: 'inherit' });
  console.log('5. ✅ Static appraiser pages generated');

  // Step 6: Copy static assets
  console.log('📋 Copying static assets...');
  execSync('node scripts/copy-static.js', { cwd: ROOT_DIR, stdio: 'inherit' });

  // Step 7: Optimize images
  console.log('🖼️ Optimizing images...');
  execSync('node scripts/optimize-images.js', { cwd: ROOT_DIR, stdio: 'inherit' });

  // Step 8: Generate sitemap
  console.log('🗺️ Generating sitemap...');
  execSync('node scripts/generate-sitemap.js', { cwd: ROOT_DIR, stdio: 'inherit' });

  // Step 9: Fix React hydration issues
  console.log('🔧 Fixing React hydration issues...');
  execSync('node scripts/fix-react-hydration.js', { cwd: ROOT_DIR, stdio: 'inherit' });

  // Step 10: Minify HTML files
  console.log('📐 Minifying HTML files...');
  execSync('npx html-minifier-terser --input-dir dist --output-dir dist --file-ext html ' +
    '--minify-css --minify-js --remove-comments --collapse-whitespace --conservative-collapse', 
    { cwd: ROOT_DIR, stdio: 'inherit' });

  // Right after minifying HTML files
  console.log('10. ✅ HTML files minified');

  // Add the fallback image handler
  console.log('11. 🔧 Injecting fallback image handler...');
  execSync('node scripts/inject-fallback-image-handler.js', { stdio: 'inherit' });
  console.log('11. ✅ Fallback image handler injected');

  // Validate the build
  console.log('12. 🧪 Validating build output...');
  validateBuild();
  console.log('12. ✅ Build validated successfully');

  console.log('🚀 Netlify build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}

// Validate the build output
function validateBuild() {
  const distDir = path.join(ROOT_DIR, 'dist');
  
  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    throw new Error('Dist directory does not exist after build');
  }
  
  // Check if index.html exists
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('index.html not found in dist directory');
  }
  
  // Check for assets directory
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    throw new Error('Assets directory not found in dist directory');
  }
  
  // Check for CSS and JS files
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find(file => file.endsWith('.css'));
  const jsFile = files.find(file => file.endsWith('.js'));
  
  if (!cssFile) {
    throw new Error('No CSS file found in assets directory');
  }
  
  if (!jsFile) {
    throw new Error('No JS file found in assets directory');
  }
  
  // Check if sitemap.xml exists
  if (!fs.existsSync(path.join(distDir, 'sitemap.xml'))) {
    throw new Error('sitemap.xml not found in dist directory');
  }
  
  // Check if robots.txt exists
  if (!fs.existsSync(path.join(distDir, 'robots.txt'))) {
    throw new Error('robots.txt not found in dist directory');
  }
  
  console.log('✓ Build validation passed!');
  console.log(`  - CSS file: ${cssFile}`);
  console.log(`  - JS file: ${jsFile}`);
} 