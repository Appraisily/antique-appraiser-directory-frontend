#!/usr/bin/env node

/**
 * Generate Missing City Images
 * 
 * This script:
 * 1. Finds cities with 0% image coverage
 * 2. Generates images for N cities (default 5)
 * 3. Updates the image coverage report
 * 
 * Usage: node generate-missing-city-images.js [number-of-cities]
 * Example: node generate-missing-city-images.js 10
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const COVERAGE_REPORT = path.join(ROOT_DIR, 'image-coverage-report.json');

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
 * Main function
 */
async function main() {
  try {
    // Get the number of cities to process from command line arguments
    const cityCount = process.argv[2] ? parseInt(process.argv[2], 10) : 5;
    
    log(`Starting image generation for ${cityCount} cities with missing images...`, 'info');
    
    // Check if coverage report exists
    if (!await fs.pathExists(COVERAGE_REPORT)) {
      log('Coverage report not found. Generating new report...', 'warning');
      execSync('node scripts/check-image-coverage.js', { stdio: 'inherit' });
    }
    
    // Read the coverage report
    const coverageReport = await fs.readJson(COVERAGE_REPORT);
    
    // Find cities with 0% coverage
    const zeroCoverageCities = coverageReport.cityDetails.filter(city => city.percentage === 0);
    
    if (zeroCoverageCities.length === 0) {
      log('No cities with 0% coverage found! All cities have at least some images.', 'success');
      return;
    }
    
    log(`Found ${zeroCoverageCities.length} cities with 0% image coverage`, 'info');
    
    // Sort by number of appraisers (process cities with more appraisers first)
    zeroCoverageCities.sort((a, b) => b.total - a.total);
    
    // Select cities to process
    const citiesToProcess = zeroCoverageCities.slice(0, cityCount);
    
    log(`Selected ${citiesToProcess.length} cities to process:`, 'info');
    citiesToProcess.forEach((city, index) => {
      log(`${index + 1}. ${city.city} (${city.total} appraisers)`, 'info');
    });
    
    // Process each city
    for (let i = 0; i < citiesToProcess.length; i++) {
      const city = citiesToProcess[i];
      
      log(`\nProcessing city ${i + 1}/${citiesToProcess.length}: ${city.city} (${city.total} appraisers)`, 'info');
      
      try {
        // Run the generate-images-for-city.js script
        execSync(`node scripts/generate-images-for-city.js ${city.city}`, { stdio: 'inherit' });
        
        log(`Completed image generation for ${city.city}`, 'success');
      } catch (error) {
        log(`Error processing city ${city.city}: ${error.message}`, 'error');
      }
      
      // Add a small delay between cities to avoid rate limiting
      if (i < citiesToProcess.length - 1) {
        log('Waiting 5 seconds before next city...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Update the coverage report after all processing
    log('\nUpdating image coverage report...', 'info');
    execSync('node scripts/check-image-coverage.js', { stdio: 'inherit' });
    
    log('All done! Check the updated image-coverage-report.json for results.', 'success');
  } catch (error) {
    log(`Error in main process: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error.message}`, 'error');
  process.exit(1);
});