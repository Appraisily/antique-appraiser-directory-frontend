#!/usr/bin/env node

/**
 * Fix JS URLs
 * 
 * This script updates links in the JavaScript bundle files to point to the subdomain (art-appraiser-directory.appraisily.com)
 * instead of the main domain (appraisily.com) for appraiser pages
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Configuration
const MAIN_DOMAIN = 'https://appraisily.com';
const SUBDOMAIN = 'https://art-appraiser-directory.appraisily.com';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');

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
 * Fix URLs in JavaScript files
 */
async function fixJsUrls() {
  try {
    // Check if assets directory exists
    if (!await fs.pathExists(ASSETS_DIR)) {
      log(`Assets directory not found: ${ASSETS_DIR}`, 'warning');
      return { processedCount: 0, modifiedCount: 0 };
    }

    // Get all JS files in the assets directory
    const files = await fs.readdir(ASSETS_DIR);
    const jsFiles = files.filter(file => file.endsWith('.js'));
    
    log(`Found ${jsFiles.length} JavaScript files to process`, 'info');
    
    let processedCount = 0;
    let modifiedCount = 0;
    
    for (const jsFile of jsFiles) {
      const filePath = path.join(ASSETS_DIR, jsFile);
      
      log(`Processing ${jsFile}`, 'info');
      
      // Read the file content
      let content = await fs.readFile(filePath, 'utf8');
      const originalContent = content;
      
      // 1. Fix relative URLs (href="/appraiser/)
      content = content.replace(
        /href="\/appraiser\//g, 
        `href="${SUBDOMAIN}/appraiser/`
      );
      
      // 2. Fix absolute URLs (href="https://appraisily.com/appraiser/)
      content = content.replace(
        new RegExp(`href="${MAIN_DOMAIN}/appraiser/`, 'g'), 
        `href="${SUBDOMAIN}/appraiser/`
      );
      
      // 3. Fix canonical URLs
      content = content.replace(
        new RegExp(`"canonicalUrl":"${MAIN_DOMAIN}/appraiser/`, 'g'),
        `"canonicalUrl":"${SUBDOMAIN}/appraiser/`
      );
      
      // 4. Fix schema URLs
      content = content.replace(
        new RegExp(`"item":"${MAIN_DOMAIN}/appraiser/`, 'g'),
        `"item":"${SUBDOMAIN}/appraiser/`
      );
      
      // 5. Fix string literals in the JS like: `${MAIN_DOMAIN}/appraiser/${id}`
      content = content.replace(
        new RegExp(`\`${MAIN_DOMAIN}/appraiser/`, 'g'),
        `\`${SUBDOMAIN}/appraiser/`
      );
      
      // 6. Fix any other occurrences
      content = content.replace(
        new RegExp(`${MAIN_DOMAIN}/appraiser/`, 'g'),
        `${SUBDOMAIN}/appraiser/`
      );
      
      // Write the updated content back only if changes were made
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf8');
        modifiedCount++;
        log(`Fixed links in ${jsFile}`, 'success');
      } else {
        log(`No links to fix in ${jsFile}`, 'info');
      }
      
      processedCount++;
    }
    
    log(`Successfully processed ${processedCount} JavaScript files. Modified ${modifiedCount} files.`, 'success');
    return { processedCount, modifiedCount };
  } catch (error) {
    log(`Error fixing JS URLs: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting JS URL fix process...', 'info');
    const result = await fixJsUrls();
    log(`Completed! Processed ${result.processedCount} files, modified ${result.modifiedCount} files.`, 'success');
  } catch (error) {
    log(`Failed to fix JS URLs: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute the main function
main();