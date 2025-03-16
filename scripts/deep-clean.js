#!/usr/bin/env node

/**
 * Deep Clean Script
 * 
 * This script performs a thorough cleaning of the dist directory,
 * ensuring all subdirectories are properly removed.
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
 * Completely remove the dist directory and recreate it empty
 */
async function deepClean() {
  log('Starting deep clean process...', 'info');
  
  try {
    if (fs.existsSync(DIST_DIR)) {
      log(`Removing existing dist directory: ${DIST_DIR}`, 'info');
      await fs.remove(DIST_DIR);
      log('Dist directory successfully removed', 'success');
    } else {
      log('Dist directory does not exist, nothing to clean', 'info');
    }
    
    // Create an empty dist directory
    log('Creating empty dist directory', 'info');
    await fs.ensureDir(DIST_DIR);
    log('Empty dist directory created', 'success');
    
    return true;
  } catch (error) {
    log(`Error during deep clean: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting deep clean operation...', 'info');
    await deepClean();
    log('Deep clean completed successfully!', 'success');
  } catch (error) {
    log(`Deep clean operation failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute the main function
main();