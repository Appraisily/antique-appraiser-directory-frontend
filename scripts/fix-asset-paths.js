/**
 * Script to fix asset paths in HTML files
 * This script removes "/directory" from asset paths in HTML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all HTML files
function findHtmlFiles(dir) {
  return glob.sync(`${dir}/**/*.html`);
}

// Function to fix asset paths in a file
function fixAssetPaths(filePath) {
  console.log(`Processing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace all instances of /directory/assets/ with /assets/
  const originalContent = content;
  content = content.replace(/\/directory\/assets\//g, '/assets/');
  
  // Only write the file if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Updated ${filePath}`);
    return true;
  }
  
  return false;
}

// Main execution
const distDir = path.resolve(__dirname, '../dist');
const htmlFiles = findHtmlFiles(distDir);
console.log(`Found ${htmlFiles.length} HTML files`);

let updatedCount = 0;
htmlFiles.forEach(file => {
  if (fixAssetPaths(file)) {
    updatedCount++;
  }
});

console.log(`Updated ${updatedCount} files out of ${htmlFiles.length}`);