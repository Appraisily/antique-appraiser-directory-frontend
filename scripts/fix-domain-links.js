#!/usr/bin/env node

/**
 * Fix Domain Links
 * 
 * This script normalizes domain references in generated HTML files:
 * - keeps canonical/social URLs pointed at the directory subdomain
 * - ensures navigation links point back to the primary marketing site
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const MAIN_DOMAIN = 'https://appraisily.com';
const DIRECTORY_DOMAIN = 'https://antique-appraiser-directory.appraisily.com';

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
 * Get all HTML files in the dist directory
 */
async function getAllHtmlFiles(dir = DIST_DIR) {
  const files = await fs.readdir(dir);
  let htmlFiles = [];
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      const nestedFiles = await getAllHtmlFiles(filePath);
      htmlFiles = [...htmlFiles, ...nestedFiles];
    } else if (file.endsWith('.html')) {
      htmlFiles.push(filePath);
    }
  }
  
  return htmlFiles;
}

/**
 * Fix links in all HTML files to point to main domain
 */
async function fixDomainLinks() {
  log('Fixing domain links in all HTML files...', 'info');
  
  try {
    const htmlFiles = await getAllHtmlFiles();
    log(`Found ${htmlFiles.length} HTML files to process.`, 'info');
    
    let processedCount = 0;
    
    for (const filePath of htmlFiles) {
      let html = await fs.readFile(filePath, 'utf8');
      
      // Update canonical URLs to remain on the directory subdomain
      html = html.replace(
        /<link rel="canonical" href="https:\/\/art-appraiser-directory\.appraisily\.com/g, 
        `<link rel="canonical" href="${DIRECTORY_DOMAIN}`
      );
      
      html = html.replace(
        /<link rel="canonical" href="https:\/\/art-appraiser\.appraisily\.com/g, 
        `<link rel="canonical" href="${DIRECTORY_DOMAIN}`
      );
      
      html = html.replace(
        /<link rel="canonical" href="https:\/\/appraisily\.com/g,
        `<link rel="canonical" href="${DIRECTORY_DOMAIN}`
      );
      
      // Update OG URLs to remain on the directory subdomain
      html = html.replace(
        /<meta property="og:url" content="https:\/\/art-appraiser-directory\.appraisily\.com/g, 
        `<meta property="og:url" content="${DIRECTORY_DOMAIN}`
      );
      
      html = html.replace(
        /<meta property="og:url" content="https:\/\/art-appraiser\.appraisily\.com/g, 
        `<meta property="og:url" content="${DIRECTORY_DOMAIN}`
      );
      
      html = html.replace(
        /<meta property="og:url" content="https:\/\/appraisily\.com/g,
        `<meta property="og:url" content="${DIRECTORY_DOMAIN}`
      );
      
      // Update Twitter URLs to remain on the directory subdomain
      html = html.replace(
        /<meta property="twitter:url" content="https:\/\/art-appraiser-directory\.appraisily\.com/g, 
        `<meta property="twitter:url" content="${DIRECTORY_DOMAIN}`
      );
      
      html = html.replace(
        /<meta property="twitter:url" content="https:\/\/art-appraiser\.appraisily\.com/g, 
        `<meta property="twitter:url" content="${DIRECTORY_DOMAIN}`
      );
      
      html = html.replace(
        /<meta property="twitter:url" content="https:\/\/appraisily\.com/g,
        `<meta property="twitter:url" content="${DIRECTORY_DOMAIN}`
      );
      
      // Update header nav links
      html = html.replace(
        /<a href="\/about"/g, 
        `<a href="${MAIN_DOMAIN}/about"`
      );
      
      html = html.replace(
        /<a href="\/services"/g, 
        `<a href="${MAIN_DOMAIN}/services"`
      );
      
      html = html.replace(
        /<a href="\/expertise"/g, 
        `<a href="${MAIN_DOMAIN}/expertise"`
      );
      
      html = html.replace(
        /<a href="\/team"/g, 
        `<a href="${MAIN_DOMAIN}/team"`
      );
      
      html = html.replace(
        /<a href="\/start"/g, 
        `<a href="${MAIN_DOMAIN}/start"`
      );
      
      // Update footer links
      html = html.replace(
        /<a href="\/how-it-works"/g, 
        '<a href="https://appraisily.com/how-it-works"'
      );
      
      html = html.replace(
        /<a href="\/screener"/g, 
        '<a href="https://appraisily.com/screener"'
      );
      
      html = html.replace(
        /<a href="\/terms"/g, 
        '<a href="https://appraisily.com/terms"'
      );
      
      html = html.replace(
        /<a href="\/privacy"/g, 
        '<a href="https://appraisily.com/privacy"'
      );
      
      // Update services button
      html = html.replace(
        /window\.location\.href = "https:\/\/services\.appraisily\.com"/g,
        'window.location.href = "https://appraisily.com/start"'
      );
      
      // Fix URLs in schema.org data
      html = html.replace(
        /"url":"https:\/\/art-appraiser\.appraisily\.com/g,
        '"url":"https://appraisily.com'
      );
      
      html = html.replace(
        /"item":"https:\/\/art-appraiser\.appraisily\.com/g,
        '"item":"https://appraisily.com'
      );
      
      // Write the updated content back to the file
      await fs.writeFile(filePath, html, 'utf8');
      processedCount++;
      
      if (processedCount % 50 === 0) {
        log(`Processed ${processedCount}/${htmlFiles.length} files...`, 'info');
      }
    }
    
    log(`Successfully processed all ${processedCount} HTML files`, 'success');
    return processedCount;
  } catch (error) {
    log(`Error fixing domain links: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting domain link fix process...', 'info');
    const count = await fixDomainLinks();
    log(`Completed updating domain links in ${count} files.`, 'success');
  } catch (error) {
    log(`Failed to fix domain links: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute the main function
main();
