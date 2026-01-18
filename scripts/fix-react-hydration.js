#!/usr/bin/env node

/**
 * Fix React hydration issues in HTML files
 * Addresses the "Minified React error #299" by updating
 * the static HTML files to avoid hydration mismatches
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
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
 * Fix React hydration issues in a single HTML file
 * @param {string} filePath - Path to the HTML file
 * @returns {Promise<boolean>} - True if fixes were applied
 */
async function fixReactHydration(filePath) {
  try {
    // Read the file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Parse the HTML
    const dom = new JSDOM(content);
    const { document } = dom.window;
    
    let modified = false;
    
    // 1. Check if the root element exists, create it if it doesn't
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      log(`Creating missing root element in ${filePath.replace(DIST_DIR, '')}`, 'warning');
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      
      // Insert it at the beginning of the body
      const body = document.querySelector('body');
      if (body && body.firstChild) {
        body.insertBefore(rootElement, body.firstChild);
        modified = true;
      } else if (body) {
        body.appendChild(rootElement);
        modified = true;
      }
    }

    // 1b. Unwrap any nested root containers.
    // Some generated pages accidentally contain `<div id="root"><div id="root">...</div></div>`,
    // which is invalid HTML (duplicate IDs) and can trigger React hydration/runtime issues.
    // If we find a direct child root, move its children up and remove the nested container.
    if (rootElement) {
      const nestedRootChildren = Array.from(rootElement.children).filter(
        child => child instanceof dom.window.HTMLElement && child.id === 'root'
      );

      if (nestedRootChildren.length > 0) {
        log(`Unwrapping nested root element(s) in ${filePath.replace(DIST_DIR, '')}`, 'warning');

        for (const nestedRoot of nestedRootChildren) {
          while (nestedRoot.firstChild) {
            rootElement.insertBefore(nestedRoot.firstChild, nestedRoot);
          }
          nestedRoot.parentNode?.removeChild(nestedRoot);
        }

        modified = true;
      }
    }
    
    // 2. Move content containers inside root if they're not already
    const locationContent = document.getElementById('location-content');
    const appraiserContent = document.getElementById('appraiser-content');
    
    const contentElement = locationContent || appraiserContent;
    if (contentElement && rootElement) {
      // Check if the content element is already inside the root
      if (!rootElement.contains(contentElement)) {
        log(`Moving content into root element in ${filePath.replace(DIST_DIR, '')}`, 'warning');
        
        // Copy all child nodes from contentElement to rootElement
        while (contentElement.childNodes.length > 0) {
          rootElement.appendChild(contentElement.childNodes[0]);
        }
        
        // Remove the now-empty content element
        if (contentElement.parentNode) {
          contentElement.parentNode.removeChild(contentElement);
        }
        
        modified = true;
      }
    } else if (!contentElement && rootElement) {
      // If we don't find the specific content containers, move all top-level content inside root
      // But skip script tags, noscript tags, and the root element itself
      const body = document.querySelector('body');
      if (body) {
        const children = Array.from(body.children).filter(child => 
          child !== rootElement && 
          child.tagName.toLowerCase() !== 'script' && 
          child.tagName.toLowerCase() !== 'noscript'
        );
        
        if (children.length > 0) {
          log(`Moving top-level content into root element in ${filePath.replace(DIST_DIR, '')}`, 'warning');
          
          for (const child of children) {
            rootElement.appendChild(child);
          }
          
          modified = true;
        }
      }
    }
    
    // 3. Remove any scripts that match our blocklist (like the ones from unpkg.com)
    const scripts = Array.from(document.querySelectorAll('script'));
    const blockedDomains = [
      'unpkg.com',
      'tangerine-churros-e587f4.netlify.app',
      'widget.js'
    ];
    
    for (const script of scripts) {
      const src = script.getAttribute('src') || '';
      if (blockedDomains.some(domain => src.includes(domain))) {
        script.parentNode.removeChild(script);
        log(`Removed blocked script: ${src}`, 'warning');
        modified = true;
      }
    }
    
    // 4. Remove any injected styles from external domains
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const style of styles) {
      const href = style.getAttribute('href') || '';
      if (blockedDomains.some(domain => href.includes(domain))) {
        style.parentNode.removeChild(style);
        log(`Removed blocked stylesheet: ${href}`, 'warning');
        modified = true;
      }
    }
    
    // 5. Remove browser extension injected elements
    const extensionElements = Array.from(document.querySelectorAll('div[id^="veepn-"], div[id^="extension-"]'));
    for (const el of extensionElements) {
      el.parentNode.removeChild(el);
      log(`Removed browser extension element: ${el.id}`, 'warning');
      modified = true;
    }
    
    // 6. Ensure our script loading is correct
    const mainScript = document.querySelector('script[src*="index-"]');
    if (mainScript) {
      // Make sure script is loaded properly
      mainScript.setAttribute('defer', '');
      // Remove any duplicate loaders for the same script
      const duplicateScripts = Array.from(document.querySelectorAll(`script[src="${mainScript.getAttribute('src')}"]`))
        .filter(s => s !== mainScript);
      
      for (const dup of duplicateScripts) {
        dup.parentNode.removeChild(dup);
        log('Removed duplicate script', 'warning');
        modified = true;
      }
    }
    
    // 7. Normalise asset paths so they always resolve from the site root.
    const assetPaths = Array.from(
      document.querySelectorAll(
        'link[href^="/assets/"], link[href^="/directory/assets/"], script[src^="/assets/"], script[src^="/directory/assets/"], img[src^="/assets/"], img[src^="/directory/assets/"]'
      )
    );
    for (const element of assetPaths) {
      const attrName = element.hasAttribute('href') ? 'href' : 'src';
      const oldPath = element.getAttribute(attrName);
      if (!oldPath) {
        continue;
      }

      if (oldPath.startsWith('/directory/assets/')) {
        const newPath = oldPath.replace('/directory/assets/', '/assets/');
        if (newPath !== oldPath) {
          element.setAttribute(attrName, newPath);
          log(`Normalised asset path: ${oldPath} -> ${newPath}`, 'warning');
          modified = true;
        }
      } else if (oldPath.startsWith('/assets/')) {
        // Already in the correct format for our deployments; nothing to do.
        continue;
      }
    }
    
    if (modified) {
      // Write the modified HTML back to the file
      await fs.writeFile(filePath, dom.serialize(), 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    log(`Error fixing ${filePath}: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Fix React hydration issues in all HTML files in a directory
 * Using a more efficient batch processing approach
 * @param {string} dir - Directory to process
 * @returns {Promise<number>} - Number of files fixed
 */
async function fixAllHtmlFiles(dir) {
  try {
    const BATCH_SIZE = 10; // Process files in batches of 10
    const files = [];
    
    // Get all HTML files recursively
    async function collectHtmlFiles(directory) {
      const dirFiles = await fs.readdir(directory);
      
      for (const file of dirFiles) {
        const fullPath = path.join(directory, file);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively process subdirectories
          await collectHtmlFiles(fullPath);
        } else if (file.endsWith('.html')) {
          // Add HTML files to the list
          files.push(fullPath);
        }
      }
    }
    
    await collectHtmlFiles(dir);
    log(`Found ${files.length} HTML files to process`, 'info');
    
    // Process files in batches
    let fixedCount = 0;
    let processedCount = 0;
    
    // Process files in batches to avoid memory issues
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(file => fixReactHydration(file)));
      
      // Count fixed files in this batch
      const batchFixedCount = batchResults.filter(Boolean).length;
      fixedCount += batchFixedCount;
      processedCount += batch.length;
      
      // Log progress
      log(`Processed ${processedCount}/${files.length} files (${batchFixedCount} fixed in current batch)`, 'info');
    }
    
    return fixedCount;
  } catch (error) {
    log(`Error processing directory ${dir}: ${error.message}`, 'error');
    return 0;
  }
}

/**
 * Main function to fix React hydration issues
 */
async function main() {
  try {
    log('Starting to fix React hydration issues...', 'info');
    
    // Check if a specific file was provided
    const specificFile = process.argv[2];
    let fixedCount = 0;
    
    if (specificFile) {
      let filePath;
      if (path.isAbsolute(specificFile)) {
        filePath = specificFile;
      } else {
        filePath = path.join(DIST_DIR, specificFile);
      }
      
      if (fs.existsSync(filePath)) {
        log(`Processing specific file: ${specificFile}`, 'info');
        const fixed = await fixReactHydration(filePath);
        fixedCount = fixed ? 1 : 0;
      } else {
        log(`File not found: ${specificFile}`, 'error');
      }
    } else {
      // Process all HTML files efficiently
      fixedCount = await fixAllHtmlFiles(DIST_DIR);
    }
    
    log(`Completed! Fixed hydration issues in ${fixedCount} files.`, 'success');
    return fixedCount;
  } catch (error) {
    log(`Error fixing hydration issues: ${error.message}`, 'error');
    throw error;
  }
}

// Run the main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Error in main function: ${error}`);
    process.exit(1);
  });
}

// Export for module usage
export default main;
