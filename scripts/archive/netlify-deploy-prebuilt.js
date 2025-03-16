/**
 * Netlify Deployment Script for Pre-built Site
 * 
 * This script helps deploy the pre-built static files to Netlify.
 * It verifies that all necessary files exist and sets up the proper
 * Netlify configuration for a static site deployment.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const NETLIFY_CONFIG = path.join(ROOT_DIR, 'netlify.toml');

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

// Main function
async function deployToNetlify() {
  try {
    console.log('🚀 Preparing pre-built files for Netlify deployment...');
    
    // Verify that the dist directory exists and contains required files
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error('Dist directory not found! Run a build first.');
    }

    // Check if index.html exists
    if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
      throw new Error('index.html not found in dist directory');
    }
    
    // Verify netlify.toml exists and contains the right configuration
    if (!fs.existsSync(NETLIFY_CONFIG)) {
      throw new Error('netlify.toml not found! Make sure it exists in the root directory.');
    }
    
    const netlifyConfig = fs.readFileSync(NETLIFY_CONFIG, 'utf8');
    if (!netlifyConfig.includes('pre-built') && !netlifyConfig.includes('echo')) {
      console.warn('⚠️ Warning: netlify.toml may not be configured for pre-built deployment.');
      console.warn('Check that it uses "echo" in the command field instead of a build command.');
    }
    
    // Check if sitemap.xml exists
    const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
      console.warn('⚠️ Warning: sitemap.xml not found. Site may have SEO issues.');
    }
    
    // Check if robots.txt exists
    const robotsPath = path.join(DIST_DIR, 'robots.txt');
    if (!fs.existsSync(robotsPath)) {
      console.warn('⚠️ Warning: robots.txt not found. Creating basic robots.txt...');
      fs.writeFileSync(
        robotsPath,
        'User-agent: *\nAllow: /\nSitemap: https://art-appraiser-directory.appraisily.com/sitemap.xml'
      );
    }
    
    // Count number of HTML files to ensure all pages are built
    const appraiserHtmlFiles = await countFiles(path.join(DIST_DIR, 'appraiser'), '.html');
    const locationHtmlFiles = await countFiles(path.join(DIST_DIR, 'location'), '.html');
    
    console.log(`📊 Site statistics:`);
    console.log(`  - Appraiser pages: ${appraiserHtmlFiles}`);
    console.log(`  - Location pages: ${locationHtmlFiles}`);
    console.log(`  - Total HTML pages: ${appraiserHtmlFiles + locationHtmlFiles + 1} (including index)`);
    
    if (appraiserHtmlFiles < 300) {
      console.warn('⚠️ Warning: Fewer than 300 appraiser pages found. This may indicate incomplete build.');
    }
    
    if (locationHtmlFiles < 30) {
      console.warn('⚠️ Warning: Fewer than 30 location pages found. This may indicate incomplete build.');
    }
    
    console.log('✅ Preparation complete! Your project is ready for Netlify deployment.');
    console.log('📋 Next steps:');
    console.log('  1. Push your repository to GitHub or GitLab');
    console.log('  2. Create a new site on Netlify and connect it to your repository');
    console.log('  3. Use the following settings:');
    console.log('     - Build command: No need to set (netlify.toml is configured)');
    console.log('     - Publish directory: dist');
    console.log('  4. Deploy!');
    
  } catch (error) {
    console.error('❌ Preparation failed:', error.message);
    process.exit(1);
  }
}

// Helper to count files with a specific extension in a directory recursively
async function countFiles(dir, extension) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  
  let count = 0;
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      count += await countFiles(filePath, extension);
    } else if (path.extname(file) === extension) {
      count++;
    }
  }
  
  return count;
}

// Run the deployment preparation
deployToNetlify();