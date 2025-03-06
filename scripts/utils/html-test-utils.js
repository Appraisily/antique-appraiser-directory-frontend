/**
 * HTML Testing Utilities
 * Provides functions for testing and validating HTML files
 */

import fs from 'fs-extra';
import path from 'path';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';

/**
 * Log with color and timestamp
 * @param {string} message - The message to log
 * @param {string} type - Type of log (info, warning, error, success)
 */
export function log(message, type = 'info') {
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
 * Get all HTML files in a directory recursively
 * @param {string} dir - Directory to scan
 * @returns {Promise<string[]>} - Array of file paths
 */
export async function getAllHtmlFiles(dir) {
  let results = [];
  const items = await fs.readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      const subResults = await getAllHtmlFiles(fullPath);
      results = results.concat(subResults);
    } else if (item.endsWith('.html')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Validate a single HTML file
 * @param {string} filePath - Path to the HTML file
 * @returns {Object} - Validation results
 */
export async function validateHtmlFile(filePath) {
  const results = {
    file: filePath,
    valid: true,
    errors: [],
    warnings: [],
    missingResources: [],
  };

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const dom = new JSDOM(content);
    const { document } = dom.window;

    // Check for broken image links
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (!src) {
        results.errors.push('Image without src attribute found');
        results.valid = false;
      } else if (src.startsWith('/')) {
        // For local resources, check if they exist
        const localPath = path.join(path.dirname(filePath), '..', src);
        if (!fs.existsSync(localPath)) {
          results.missingResources.push(`Missing image: ${src}`);
          results.valid = false;
        }
      }
    });

    // Check for script tags and verify they exist
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && src.startsWith('/')) {
        const localPath = path.join(path.dirname(filePath), '..', src);
        if (!fs.existsSync(localPath)) {
          results.missingResources.push(`Missing script: ${src}`);
          results.valid = false;
        }
      }
    });

    // Check for CSS links and verify they exist
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    cssLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('/')) {
        const localPath = path.join(path.dirname(filePath), '..', href);
        if (!fs.existsSync(localPath)) {
          results.missingResources.push(`Missing CSS: ${href}`);
          results.valid = false;
        }
      }
    });

    // Check for React mounting point
    if (!document.getElementById('location-content') && !document.getElementById('appraiser-content')) {
      results.warnings.push('No main content container found (#location-content or #appraiser-content)');
    }

    // Check for proper meta tags
    if (!document.querySelector('meta[name="viewport"]')) {
      results.warnings.push('No viewport meta tag found');
    }

    // Check for proper HTML structure
    if (!document.querySelector('main')) {
      results.warnings.push('No <main> element found');
    }

    if (!document.querySelector('header')) {
      results.warnings.push('No <header> element found');
    }

    if (!document.querySelector('footer')) {
      results.warnings.push('No <footer> element found');
    }

  } catch (error) {
    results.valid = false;
    results.errors.push(`Failed to parse HTML: ${error.message}`);
  }

  return results;
}

/**
 * Fix common issues in HTML files
 * @param {string} filePath - Path to the HTML file
 * @param {Object} validationResults - Results from validation
 * @returns {Promise<boolean>} - True if fixes were applied
 */
export async function fixHtmlIssues(filePath, validationResults) {
  if (validationResults.valid) {
    return false; // No fixes needed
  }

  try {
    let content = await fs.readFile(filePath, 'utf8');
    let modified = false;
    
    // Fix resource paths if needed
    if (validationResults.missingResources.length > 0) {
      validationResults.missingResources.forEach(resource => {
        const resourcePath = resource.split(': ')[1];
        if (resourcePath) {
          // Try to fix common path issues
          if (resourcePath.startsWith('/assets/')) {
            const newPath = resourcePath.replace('/assets/', './assets/');
            content = content.replace(new RegExp(resourcePath, 'g'), newPath);
            modified = true;
            log(`Fixed resource path in ${filePath}: ${resourcePath} -> ${newPath}`, 'success');
          }
        }
      });
    }
    
    if (modified) {
      await fs.writeFile(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    log(`Failed to fix issues in ${filePath}: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Generate a visual report of HTML validation
 * @param {Object[]} allResults - Array of validation results
 * @returns {string} - HTML report
 */
export function generateHtmlReport(allResults) {
  const totalFiles = allResults.length;
  const validFiles = allResults.filter(r => r.valid).length;
  const invalidFiles = totalFiles - validFiles;
  
  let report = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Validation Report</title>
  <style>
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.5;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .summary {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .valid-count {
      color: #198754;
      font-weight: bold;
    }
    .invalid-count {
      color: #dc3545;
      font-weight: bold;
    }
    .file-result {
      border: 1px solid #dee2e6;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .file-result.valid {
      border-left: 5px solid #198754;
    }
    .file-result.invalid {
      border-left: 5px solid #dc3545;
    }
    .error {
      color: #dc3545;
    }
    .warning {
      color: #ffc107;
    }
    .missing {
      color: #0dcaf0;
    }
    h1, h2, h3 {
      color: #212529;
    }
    a {
      color: #0d6efd;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul {
      padding-left: 20px;
    }
  </style>
</head>
<body>
  <h1>HTML Validation Report</h1>
  
  <div class="summary">
    <p>Total files: <strong>${totalFiles}</strong></p>
    <p>Valid files: <span class="valid-count">${validFiles}</span></p>
    <p>Invalid files: <span class="invalid-count">${invalidFiles}</span></p>
  </div>
  
  <h2>Results by File</h2>
  
  ${allResults.map(result => {
    const fileRelativePath = result.file.split('/dist/')[1] || result.file;
    return `
    <div class="file-result ${result.valid ? 'valid' : 'invalid'}">
      <h3>${fileRelativePath}</h3>
      <p>Status: <strong>${result.valid ? 'Valid' : 'Invalid'}</strong></p>
      
      ${result.errors.length > 0 ? `
      <div>
        <h4>Errors:</h4>
        <ul>
          ${result.errors.map(err => `<li class="error">${err}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${result.warnings.length > 0 ? `
      <div>
        <h4>Warnings:</h4>
        <ul>
          ${result.warnings.map(warn => `<li class="warning">${warn}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${result.missingResources.length > 0 ? `
      <div>
        <h4>Missing Resources:</h4>
        <ul>
          ${result.missingResources.map(res => `<li class="missing">${res}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      <p><a href="/view/${fileRelativePath}" target="_blank">View Page</a></p>
    </div>
    `;
  }).join('')}
</body>
</html>`;

  return report;
} 