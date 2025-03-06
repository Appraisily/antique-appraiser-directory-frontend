/**
 * Netlify Preparation Script
 * 
 * This script prepares a pre-built dist directory for Netlify deployment
 * by ensuring all required files and configurations are in place.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const NETLIFY_DIST_CONFIG = path.join(__dirname, 'netlify-dist.toml');
const NETLIFY_CONFIG = path.join(ROOT_DIR, 'netlify.toml');

console.log('🚀 Preparing pre-built files for Netlify deployment...');

try {
  // Verify that the dist directory exists and contains required files
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('Dist directory not found! Run a build first.');
  }

  // Check if index.html exists
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error('index.html not found in dist directory');
  }
  
  // Check if robots.txt exists, if not, create a basic one
  const robotsPath = path.join(DIST_DIR, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    console.log('📝 Creating robots.txt...');
    fs.writeFileSync(
      robotsPath,
      'User-agent: *\nAllow: /\nSitemap: https://art-appraiser-directory.appraisily.com/sitemap.xml'
    );
  }

  // Check if sitemap.xml exists
  const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    console.warn('⚠️ Warning: sitemap.xml not found. Run the sitemap generator script.');
  }

  // Update the netlify.toml file to use the pre-built dist directory
  console.log('📝 Updating Netlify configuration for static deployment...');
  
  // Use the netlify-dist.toml as a template if it exists
  if (fs.existsSync(NETLIFY_DIST_CONFIG)) {
    fs.copyFileSync(NETLIFY_DIST_CONFIG, NETLIFY_CONFIG);
  } else {
    // Create a simplified netlify.toml that doesn't run build commands
    const netlifyConfig = `
# Netlify configuration for pre-built static site
[build]
  # The directory to publish
  publish = "dist"
  # Skip the build command since files are pre-built
  command = "echo 'Using pre-built static files for Netlify deployment'"
  
  # Environment variables
  [build.environment]
    NODE_VERSION = "18"
    SITE_URL = "https://art-appraiser-directory.appraisily.com"

# Explicitly handle asset files with correct MIME types
[[headers]]
  for = "/assets/*.css"
    [headers.values]
    Content-Type = "text/css"
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/assets/*.js"
    [headers.values]
    Content-Type = "application/javascript"
    Cache-Control = "public, max-age=31536000, immutable"

# Handle routes properly for static site
[[redirects]]
  from = "/assets/*"
  to = "/assets/:splat"
  status = 200

[[redirects]]
  from = "/location/*"
  to = "/location/:splat/index.html"
  status = 200

[[redirects]]
  from = "/appraiser/*"
  to = "/appraiser/:splat/index.html"
  status = 200

# Fallback to index.html for client-side routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Additional headers for security
[[headers]]
  for = "/*"
    [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
`;
    fs.writeFileSync(NETLIFY_CONFIG, netlifyConfig.trim());
  }

  // Create a Netlify badge for the project
  const badgeContent = `
# Deployment Status
[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://app.netlify.com/sites/your-site-name/deploys)

This project is automatically deployed to Netlify whenever changes are pushed to the main branch.
`;

  const readmePath = path.join(ROOT_DIR, 'NETLIFY-DEPLOY.md');
  if (!fs.existsSync(readmePath)) {
    console.log('📝 Creating Netlify deployment documentation...');
    fs.writeFileSync(readmePath, badgeContent.trim());
  }

  console.log('✅ Preparation complete! Your project is ready for Netlify deployment.');
  console.log('📋 Next steps:');
  console.log('  1. Commit these changes to your repository');
  console.log('  2. Push to your Git repository');
  console.log('  3. Connect your repository to Netlify');
  console.log('  4. Netlify will use your pre-built files without running build commands');
} catch (error) {
  console.error('❌ Preparation failed:', error.message);
  process.exit(1);
}