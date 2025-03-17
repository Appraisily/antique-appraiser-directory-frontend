#!/usr/bin/env node

/**
 * Fix Appraiser Directories
 * 
 * This script ensures all appraiser pages are accessible by both their slug and ID
 * by creating redirects or copying directories as needed
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const APPRAISER_DIR = path.join(DIST_DIR, 'appraiser');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');

// Log with color and timestamp
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toISOString();
  let coloredMessage;

  switch (type) {
    case 'warning':
      coloredMessage = chalk.yellow(message);
      break;
    case 'error':
      coloredMessage = chalk.red(message);
      break;
    case 'success':
      coloredMessage = chalk.green(message);
      break;
    default:
      coloredMessage = chalk.blue(message);
  }

  console.log(`[${timestamp}] ${coloredMessage}`);
}

/**
 * Get all appraisers in the standardized data
 */
async function getAllAppraisers() {
  const appraisers = [];
  
  // Get list of all city files
  const cityFiles = (await fs.readdir(STANDARDIZED_DIR))
    .filter(file => file.endsWith('.json') && !file.includes('README'))
    .map(file => path.join(STANDARDIZED_DIR, file));
  
  // Process each city file
  for (const cityFile of cityFiles) {
    const cityName = path.basename(cityFile, '.json');
    try {
      // Read the city data
      const cityData = await fs.readJson(cityFile);
      
      // If no appraisers in this city, skip
      if (!cityData.appraisers || cityData.appraisers.length === 0) {
        continue;
      }
      
      // Add each appraiser to the list
      cityData.appraisers.forEach(appraiser => {
        appraisers.push({
          id: appraiser.id,
          name: appraiser.name,
          slug: appraiser.slug,
          city: cityName
        });
      });
    } catch (error) {
      log(`Error reading city file ${cityFile}: ${error.message}`, 'error');
    }
  }
  
  return appraisers;
}

/**
 * Fix appraiser directories
 */
async function fixAppraiserDirectories() {
  try {
    log('Starting to fix appraiser directories...');
    
    // Check if appraiser directory exists
    if (!fs.existsSync(APPRAISER_DIR)) {
      log(`Appraiser directory not found: ${APPRAISER_DIR}`, 'error');
      return;
    }
    
    // Get all appraisers
    const appraisers = await getAllAppraisers();
    log(`Found ${appraisers.length} appraisers to process.`, 'info');
    
    // Process each appraiser
    for (const appraiser of appraisers) {
      const slugDir = path.join(APPRAISER_DIR, appraiser.slug);
      const idDir = path.join(APPRAISER_DIR, appraiser.id);
      
      // Check if directories exist
      const slugDirExists = fs.existsSync(slugDir);
      const idDirExists = fs.existsSync(idDir);
      
      if (slugDirExists && !idDirExists) {
        // Slug directory exists but ID directory doesn't
        log(`Creating ID directory for ${appraiser.name} (${appraiser.id})`, 'info');
        await fs.ensureDir(idDir);
        await fs.copy(slugDir, idDir);
        log(`Created ID directory: ${idDir}`, 'success');
      } else if (!slugDirExists && idDirExists) {
        // ID directory exists but slug directory doesn't
        log(`Creating slug directory for ${appraiser.name} (${appraiser.slug})`, 'info');
        await fs.ensureDir(slugDir);
        await fs.copy(idDir, slugDir);
        log(`Created slug directory: ${slugDir}`, 'success');
      } else if (!slugDirExists && !idDirExists) {
        // Neither directory exists - this is a problem
        log(`Neither directory exists for ${appraiser.name} (${appraiser.id}, ${appraiser.slug})`, 'warning');
      } else {
        // Both directories exist - check if they're the same
        log(`Both directories exist for ${appraiser.name} (${appraiser.id}, ${appraiser.slug})`, 'info');
      }
    }
    
    // Create an .htaccess file for Apache servers
    const htaccessContent = `
# Redirect rules for appraiser pages
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Rewrite appraiser/CITYNAME-SLUG to appraiser/SLUG
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^appraiser/([a-z-]+)-([a-z0-9-]+)/?$ /appraiser/$2/ [R=301,L]
  
  # Rewrite appraiser/SLUG to appraiser/SLUG/index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^appraiser/([a-z0-9-]+)/?$ /appraiser/$1/index.html [L]
</IfModule>
`;
    
    // Write .htaccess file
    await fs.writeFile(path.join(DIST_DIR, '.htaccess'), htaccessContent);
    log('Created .htaccess file with redirect rules', 'success');
    
    // Update netlify.toml with better redirects
    const netlifyPath = path.join(ROOT_DIR, 'netlify.toml');
    if (fs.existsSync(netlifyPath)) {
      let netlifyContent = await fs.readFile(netlifyPath, 'utf8');
      
      // Add a specific redirect for missing appraiser pages
      if (!netlifyContent.includes('from = "/appraiser/:city-:slug"')) {
        const redirectContent = `
# Redirect from city-prefixed slug to just slug
[[redirects]]
  from = "/appraiser/:city-:slug"
  to = "/appraiser/:slug"
  status = 301
  force = true
`;
        
        // Insert before the last redirect
        const lastRedirectIndex = netlifyContent.lastIndexOf('[[redirects]]');
        if (lastRedirectIndex !== -1) {
          netlifyContent = 
            netlifyContent.substring(0, lastRedirectIndex) + 
            redirectContent + 
            netlifyContent.substring(lastRedirectIndex);
          
          await fs.writeFile(netlifyPath, netlifyContent);
          log('Updated netlify.toml with new redirect rules', 'success');
        }
      }
    }
    
    log('Successfully fixed appraiser directories!', 'success');
  } catch (error) {
    log(`Error fixing appraiser directories: ${error.message}`, 'error');
  }
}

// Run the script
fixAppraiserDirectories();