#!/usr/bin/env node

/**
 * Fix Appraiser Links
 * 
 * This script updates all references to appraiser links in the source code
 * to use the subdomain instead of the main domain
 */

import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Configuration
const MAIN_DOMAIN = 'https://appraisily.com';
const SUBDOMAIN = 'https://antique-appraiser-directory.appraisily.com';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
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
 * Get all TypeScript/JavaScript/JSX/TSX files
 */
function getAllSourceFiles() {
  const files = glob.sync(path.join(SRC_DIR, '**/*.{ts,tsx,js,jsx}'));
  return files;
}

/**
 * Fix appraiser links in source files
 */
async function fixSourceLinks() {
  log('Fixing appraiser links in source files...', 'info');
  
  try {
    const files = getAllSourceFiles();
    log(`Found ${files.length} source files to process.`, 'info');
    
    let processedCount = 0;
    let modifiedCount = 0;
    
    for (const filePath of files) {
      let content = await fs.readFile(filePath, 'utf8');
      const originalContent = content;
      
      // Update appraiser links to use subdomain in various contexts
      
      // 1. Fix string literals like: `${MAIN_DOMAIN}/appraiser/${id}`
      content = content.replace(
        new RegExp(`\`${MAIN_DOMAIN}/appraiser/\\$\\{([^}]+)\\}\``, 'g'),
        `\`${SUBDOMAIN}/appraiser/\${$1}\``
      );
      
      // 2. Fix hardcoded URLs
      content = content.replace(
        new RegExp(`["']${MAIN_DOMAIN}/appraiser/["']`, 'g'),
        `"${SUBDOMAIN}/appraiser/"`
      );
      
      // 3. Fix inline JSX URLs like: href={`${MAIN_DOMAIN}/appraiser/${id}`}
      content = content.replace(
        new RegExp(`href=\\{\\s*\`${MAIN_DOMAIN}/appraiser/\\$\\{([^}]+)\\}\`\\s*\\}`, 'g'),
        `href={\`${SUBDOMAIN}/appraiser/\${$1}\`}`
      );
      
      // 4. Fix canonicalUrl= prop 
      content = content.replace(
        new RegExp(`canonicalUrl=\\{\\s*\`${MAIN_DOMAIN}/appraiser/\\$\\{([^}]+)\\}\`\\s*\\}`, 'g'),
        `canonicalUrl={\`${SUBDOMAIN}/appraiser/\${$1}\`}`
      );
      
      // 5. Fix schema generation (for breadcrumbs)
      content = content.replace(
        new RegExp(`"item":\\s*\`${MAIN_DOMAIN}/appraiser/\\$\\{([^}]+)\\}\``, 'g'),
        `"item": \`${SUBDOMAIN}/appraiser/\${$1}\``
      );
      
      // 6. Fix hardcoded string in href attribute
      content = content.replace(
        new RegExp(`href="${MAIN_DOMAIN}/appraiser/`, 'g'),
        `href="${SUBDOMAIN}/appraiser/`
      );
      
      // Write the updated content back to the file if changed
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf8');
        log(`Modified: ${path.relative(ROOT_DIR, filePath)}`, 'success');
        modifiedCount++;
      }
      
      processedCount++;
      
      if (processedCount % 10 === 0) {
        log(`Processed ${processedCount}/${files.length} files... Modified: ${modifiedCount}`, 'info');
      }
    }
    
    log(`Successfully processed ${processedCount} source files. Modified: ${modifiedCount}`, 'success');
    return { processedCount, modifiedCount };
  } catch (error) {
    log(`Error fixing source links: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting appraiser link fix process...', 'info');
    const { processedCount, modifiedCount } = await fixSourceLinks();
    log(`Completed! Processed ${processedCount} files, modified ${modifiedCount} files.`, 'success');
  } catch (error) {
    log(`Failed to fix appraiser links: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute the main function
main();