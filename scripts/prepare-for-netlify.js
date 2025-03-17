/**
 * Netlify Preparation Script
 * 
 * This script prepares a pre-built dist directory for Netlify deployment
 * by ensuring all required files and configurations are in place.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
      'User-agent: *\nAllow: /\nSitemap: https://antique-appraiser-directory.appraisily.com/sitemap.xml'
    );
  }

  // Check if sitemap.xml exists
  const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    console.warn('⚠️ Warning: sitemap.xml not found. Run the sitemap generator script.');
  }

  // Update the netlify.toml file for module scripts
  console.log('📝 Updating Netlify configuration for static deployment...');
  
  // Create the improved netlify.toml
  const netlifyConfig = `
# Netlify configuration for pre-built distribution

[build]
  # Since the files are already built, we don't need to run a build command
  publish = "dist"
  command = "echo 'Using pre-built static files for Netlify deployment'"
  
  # Environment variables for the build
  [build.environment]
    # Set the site URL for sitemap generation
    SITE_URL = "https://antique-appraiser-directory.appraisily.com"
    NODE_VERSION = "18"

# Explicitly handle asset files with correct MIME types
[[headers]]
  for = "/assets/*.css"
    [headers.values]
    Content-Type = "text/css"
    Cache-Control = "public, max-age=31536000, immutable"

# Make sure JavaScript modules are served correctly - CRITICAL FIX
[[headers]]
  for = "/assets/*.js"
    [headers.values]
    Content-Type = "text/javascript"
    Cache-Control = "public, max-age=31536000, immutable"

# Make sure assets are served correctly
[[redirects]]
  from = "/assets/*"
  to = "/assets/:splat"
  status = 200

# Fix for directory assets path issue
[[redirects]]
  from = "/directory/assets/*"
  to = "/assets/:splat"
  status = 200
  
# Removed conflicting redirect that was causing issues
# [[redirects]]
#   from = "/assets/*"
#   to = "/directory/assets/:splat"
#   status = 200
#   force = false

# Don't redirect for static HTML pages that exist
[[redirects]]
  from = "/location/*"
  to = "/location/:splat/index.html"
  status = 200
  force = false

[[redirects]]
  from = "/appraiser/*"
  to = "/appraiser/:splat/index.html"
  status = 200
  force = true

# Redirect all remaining routes to index.html for client-side routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false

# Additional header configurations
[[headers]]
  # Define headers for all assets
  for = "/assets/*"
    [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  # Define headers for HTML files
  for = "/*.html"
    [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"

[[headers]]
  # Define headers for the sitemap
  for = "/sitemap.xml"
    [headers.values]
    Cache-Control = "public, max-age=3600"
    Content-Type = "application/xml"

# Add security headers for all pages
[[headers]]
  for = "/*"
    [headers.values]
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
`;

  // Write the netlify.toml file
  fs.writeFileSync(NETLIFY_CONFIG, netlifyConfig.trim());
  console.log('✅ Updated Netlify configuration with improved settings for modules');

  // Create a _headers file in the dist directory
  const headersPath = path.join(DIST_DIR, '_headers');
  const headersContent = `
# Netlify _headers file - ensures correct MIME types
/assets/*.js
  Content-Type: text/javascript

/assets/*.css
  Content-Type: text/css

/*
  X-Content-Type-Options: nosniff
`;
  fs.writeFileSync(headersPath, headersContent.trim());
  console.log('✅ Created _headers file for proper MIME types');

  // Create a Netlify badge for the project
  const badgeContent = `
# Deployment Status
[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://app.netlify.com/sites/your-site-name/deploys)

This project is automatically deployed to Netlify whenever changes are pushed to the main branch.

## Troubleshooting
If you encounter module loading issues, check:
1. Proper MIME types in netlify.toml
2. Correct path resolution in HTML files
3. Browser console for detailed errors
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