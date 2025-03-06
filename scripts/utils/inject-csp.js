/**
 * Utility to inject Content Security Policy meta tags into HTML files
 * This ensures that even when viewed directly, without server headers,
 * our HTML files will still block unwanted script injection
 */

import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';

// Log with color
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toISOString();
  let coloredMessage;

  switch (type) {
    case 'success':
      coloredMessage = chalk.green(message);
      break;
    case 'warning':
      coloredMessage = chalk.yellow(message);
      break;
    case 'error':
      coloredMessage = chalk.red(message);
      break;
    default:
      coloredMessage = chalk.blue(message);
  }

  console.log(`[${timestamp}] ${coloredMessage}`);
}

/**
 * CSP policy that blocks unwanted domains
 * This should match the policy in netlify.toml
 */
const CSP_POLICY = `
  default-src 'self' https: data: blob:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.tawk.to https://embed.tawk.to https://cdn.jsdelivr.net https://*.appraisily.com https://www.googleadservices.com https://www.google-analytics.com https://googleads.g.doubleclick.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to https://*.appraisily.com;
  img-src 'self' data: https: blob:;
  font-src 'self' data: https://fonts.gstatic.com https://*.tawk.to;
  connect-src 'self' https: wss://*.tawk.to wss://*.us-central1.run.app https://www.google-analytics.com https://stats.g.doubleclick.net;
  frame-src 'self' https://*.tawk.to https://www.youtube.com https://www.googletagmanager.com https://*.appraisily.com;
  worker-src 'self' blob:;
  child-src blob:;
  media-src 'self' https:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\s+/g, ' ').trim();

/**
 * Inject CSP meta tag into an HTML file
 * @param {string} filePath - Path to the HTML file
 * @returns {Promise<boolean>} - True if changes were made
 */
export async function injectCSP(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const dom = new JSDOM(content);
    const { document } = dom.window;

    // Check if CSP meta tag already exists
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    
    if (!cspMeta) {
      // Create and add CSP meta tag
      cspMeta = document.createElement('meta');
      cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
      cspMeta.setAttribute('content', CSP_POLICY);
      
      // Add after charset meta tag for best practice
      const charsetMeta = document.querySelector('meta[charset]');
      if (charsetMeta && charsetMeta.parentNode) {
        charsetMeta.parentNode.insertBefore(cspMeta, charsetMeta.nextSibling);
      } else {
        // If no charset meta, add to head
        const head = document.querySelector('head');
        if (head) {
          head.prepend(cspMeta);
        } else {
          log(`No <head> found in ${filePath}`, 'error');
          return false;
        }
      }
      
      // Save the changes
      await fs.writeFile(filePath, dom.serialize(), 'utf8');
      log(`Injected CSP into ${filePath}`, 'success');
      return true;
    }
    
    log(`CSP already exists in ${filePath}`, 'info');
    return false;
  } catch (error) {
    log(`Error injecting CSP into ${filePath}: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Inject CSP meta tags into all HTML files in a directory
 * @param {string} directory - Directory to process
 * @returns {Promise<number>} - Number of files processed
 */
export async function injectCSPToDirectory(directory) {
  try {
    const htmlFiles = glob.sync(path.join(directory, '**/*.html'));
    let processedCount = 0;
    
    log(`Processing ${htmlFiles.length} HTML files in ${directory}`, 'info');
    
    for (const filePath of htmlFiles) {
      const wasProcessed = await injectCSP(filePath);
      if (wasProcessed) {
        processedCount++;
      }
    }
    
    log(`Processed ${processedCount} of ${htmlFiles.length} HTML files`, 'success');
    return processedCount;
  } catch (error) {
    log(`Error processing directory ${directory}: ${error.message}`, 'error');
    return 0;
  }
}

/**
 * Main function to run the script directly
 */
export async function main(directory) {
  const targetDir = directory || process.argv[2] || './dist';
  try {
    const processedCount = await injectCSPToDirectory(targetDir);
    log(`Successfully injected CSP into ${processedCount} HTML files`, 'success');
  } catch (error) {
    log(`Failed to inject CSP: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 