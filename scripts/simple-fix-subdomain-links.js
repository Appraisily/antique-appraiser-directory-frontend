#!/usr/bin/env node

/**
 * Simple Fix Subdomain Links
 * 
 * This script updates all links in the location pages to point to the subdomain 
 * instead of the main domain for appraiser pages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const LOCATION_DIR = path.join(DIST_DIR, 'location');

// Check if location directory exists
if (!fs.existsSync(LOCATION_DIR)) {
  console.log('Location directory not found:', LOCATION_DIR);
  process.exit(1);
}

// Get all city directories
const cityDirs = fs.readdirSync(LOCATION_DIR)
  .filter(dir => fs.statSync(path.join(LOCATION_DIR, dir)).isDirectory());

console.log(`Found ${cityDirs.length} city directories`);

// Process each city's index.html file
let fixedCount = 0;
for (const cityDir of cityDirs) {
  const indexPath = path.join(LOCATION_DIR, cityDir, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    console.log(`Processing ${cityDir}/index.html`);
    
    // Read the file content
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Update appraiser links to use subdomain
    const originalHtml = html;
    html = html.replace(
      /https:\/\/appraisily\.com\/appraiser\//g, 
      'https://art-appraiser-directory.appraisily.com/appraiser/'
    );
    
    // Write the updated content back only if changes were made
    if (html !== originalHtml) {
      fs.writeFileSync(indexPath, html, 'utf8');
      fixedCount++;
      console.log(`Fixed links in ${cityDir}/index.html`);
    } else {
      console.log(`No links to fix in ${cityDir}/index.html`);
    }
  }
}

console.log(`\nCompleted! Fixed links in ${fixedCount} files out of ${cityDirs.length} city pages.`);