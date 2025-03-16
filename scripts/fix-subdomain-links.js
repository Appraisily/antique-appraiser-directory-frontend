#!/usr/bin/env node

/**
 * Fix Subdomain Links
 * 
 * This script updates all links in the location pages to point to the subdomain (art-appraiser-directory.appraisily.com)
 * instead of the main domain (appraisily.com) for appraiser pages
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

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
 * Get all HTML files in the dist/location directory
 */
async function getLocationHtmlFiles() {
  const locationDir = path.join(DIST_DIR, 'location');
  
  if (!fs.existsSync(locationDir)) {
    log(`Location directory not found: ${locationDir}`, 'warning');
    return [];
  }
  
  const files = await fs.readdir(locationDir);
  let htmlFiles = [];
  
  for (const file of files) {
    const filePath = path.join(locationDir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      const indexFile = path.join(filePath, 'index.html');
      if (fs.existsSync(indexFile)) {
        htmlFiles.push(indexFile);
      }
    }
  }
  
  return htmlFiles;
}

/**
 * Get all HTML files in the dist directory (recursive)
 */
async function getAllHtmlFiles() {
  const distDir = DIST_DIR;
  
  if (!fs.existsSync(distDir)) {
    log(`Dist directory not found: ${distDir}`, 'warning');
    return [];
  }
  
  // Recursive function to get all HTML files
  async function getFilesRecursive(dir) {
    let results = [];
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        // Recursively search subdirectories
        const subResults = await getFilesRecursive(filePath);
        results = results.concat(subResults);
      } else if (filePath.endsWith('.html')) {
        results.push(filePath);
      }
    }
    
    return results;
  }
  
  return getFilesRecursive(distDir);
}

/**
 * Fix appraiser links in all location HTML files to point to subdomain
 */
async function fixSubdomainLinks() {
  log('Fixing appraiser links in all HTML files...', 'info');
  
  try {
    const htmlFiles = await getAllHtmlFiles();
    log(`Found ${htmlFiles.length} HTML files to process.`, 'info');
    
    let processedCount = 0;
    let modifiedCount = 0;
    
    for (const filePath of htmlFiles) {
      let html = await fs.readFile(filePath, 'utf8');
      const originalHtml = html;
      
      // Update appraiser links to use subdomain
      html = html.replace(
        /https:\/\/appraisily\.com\/appraiser\//g, 
        'https://art-appraiser-directory.appraisily.com/appraiser/'
      );
      
      // Also fix links in JSON+LD schema data (which may be escaped)
      html = html.replace(
        /"item":"https:\/\/appraisily\.com\/appraiser\//g,
        '"item":"https://art-appraiser-directory.appraisily.com/appraiser/'
      );
      
      // Fix canonicalUrl in meta tags
      html = html.replace(
        /<link rel="canonical" href="https:\/\/appraisily\.com\/appraiser\//g,
        '<link rel="canonical" href="https://art-appraiser-directory.appraisily.com/appraiser/'
      );
      
      // Write the updated content back to the file if changed
      if (html !== originalHtml) {
        await fs.writeFile(filePath, html, 'utf8');
        modifiedCount++;
      }
      
      processedCount++;
      
      if (processedCount % 20 === 0) {
        log(`Processed ${processedCount}/${htmlFiles.length} files... Modified: ${modifiedCount}`, 'info');
      }
    }
    
    log(`Successfully processed ${processedCount} HTML files. Modified: ${modifiedCount}`, 'success');
    return { processedCount, modifiedCount };
  } catch (error) {
    log(`Error fixing subdomain links: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting subdomain link fix process...', 'info');
    const { processedCount, modifiedCount } = await fixSubdomainLinks();
    log(`Completed! Processed ${processedCount} files, modified ${modifiedCount} files.`, 'success');
  } catch (error) {
    log(`Failed to fix subdomain links: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute the main function
main();