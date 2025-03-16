/**
 * Fix location links to be relative instead of absolute
 * This script updates links that point to appraisily.com/location to be relative /location paths
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log(chalk.blue('🔄 Fixing location links to be relative...'));

// Process a single HTML file
function fixHtmlLinks(filePath) {
  try {
    console.log(chalk.blue(`📄 Processing ${path.relative(DIST_DIR, filePath)}`));
    
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Parse the HTML
    const dom = new JSDOM(content);
    const { document } = dom.window;
    
    let modified = false;
    
    // Find all links that point to appraisily.com/location
    const locationLinks = document.querySelectorAll('a[href^="https://appraisily.com/location/"]');
    
    if (locationLinks.length > 0) {
      console.log(chalk.yellow(`🔗 Found ${locationLinks.length} location links to fix in ${path.relative(DIST_DIR, filePath)}`));
      
      // Replace each link
      locationLinks.forEach(link => {
        const href = link.getAttribute('href');
        // Extract just the path part after the domain
        const relativePath = href.replace('https://appraisily.com', '');
        
        console.log(chalk.green(`  ${href} -> ${relativePath}`));
        
        // Update the link
        link.setAttribute('href', relativePath);
        modified = true;
      });
    }
    
    if (modified) {
      // Write the changes back to the file
      fs.writeFileSync(filePath, dom.serialize(), 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(chalk.red(`❌ Error processing ${filePath}: ${error.message}`));
    return false;
  }
}

// Process all HTML files
function processDirectory(dir) {
  let fixedCount = 0;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Recursively process subdirectories
        fixedCount += processDirectory(itemPath);
      } else if (item.endsWith('.html')) {
        // Process HTML files
        if (fixHtmlLinks(itemPath)) {
          fixedCount++;
        }
      }
    }
    
    return fixedCount;
  } catch (error) {
    console.error(chalk.red(`❌ Error reading directory ${dir}: ${error.message}`));
    return fixedCount;
  }
}

try {
  // Process all HTML files
  const fixedCount = processDirectory(DIST_DIR);
  
  if (fixedCount > 0) {
    console.log(chalk.green(`✅ Fixed location links in ${fixedCount} files`));
  } else {
    console.log(chalk.yellow('⚠️ No files needed fixing'));
  }
} catch (error) {
  console.error(chalk.red(`❌ Error: ${error.message}`));
  process.exit(1);
}