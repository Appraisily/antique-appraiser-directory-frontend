#!/usr/bin/env node

/**
 * Check Image Coverage Percentage
 * 
 * This script:
 * 1. Scans all standardized appraiser data
 * 2. Counts total number of appraisers
 * 3. Counts how many have valid images
 * 4. Reports percentage coverage
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');

// Constants
const BATCH_SIZE = 5; // Number of image URLs to check in parallel
const PLACEHOLDER_INDICATORS = ['placeholder', 'undefined', 'null', 'missing'];

/**
 * Check if an image URL is valid
 * @param {string} url - Image URL to check
 * @returns {Promise<boolean>} Whether the URL is valid
 */
async function isImageValid(url) {
  // If URL is empty, undefined, or contains placeholder indicators, it's invalid
  if (!url || PLACEHOLDER_INDICATORS.some(indicator => url.toLowerCase().includes(indicator))) {
    return false;
  }

  try {
    // Just do a HEAD request to check if image exists
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Checking appraiser image coverage...');
  
  try {
    const stats = {
      totalAppraisers: 0,
      validImages: 0,
      invalidImages: 0,
      validPercentage: 0,
      byCity: {}
    };
    
    // Get all JSON files in the standardized directory
    const files = await fs.readdir(STANDARDIZED_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('README'));
    
    console.log(`Found ${jsonFiles.length} standardized data files`);
    
    // Collect all appraiser data
    const appraisers = [];
    for (const file of jsonFiles) {
      const filePath = path.join(STANDARDIZED_DIR, file);
      const cityName = path.basename(file, '.json');
      
      try {
        const data = await fs.readJson(filePath);
        
        if (!data.appraisers || !Array.isArray(data.appraisers)) {
          continue;
        }
        
        const cityAppraisers = data.appraisers.map(appraiser => ({
          id: appraiser.id,
          name: appraiser.name,
          city: cityName,
          imageUrl: appraiser.imageUrl
        }));
        
        appraisers.push(...cityAppraisers);
        
        // Initialize city stats
        stats.byCity[cityName] = {
          total: cityAppraisers.length,
          valid: 0,
          invalid: 0,
          percentage: 0
        };
      } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
      }
    }
    
    stats.totalAppraisers = appraisers.length;
    console.log(`Found ${stats.totalAppraisers} total appraisers`);
    
    // Process appraisers in batches to check images
    const batches = [];
    for (let i = 0; i < appraisers.length; i += BATCH_SIZE) {
      batches.push(appraisers.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Checking ${batches.length} batches of appraiser images...`);
    
    let processedCount = 0;
    for (const batch of batches) {
      // Check all images in the batch in parallel
      const results = await Promise.all(
        batch.map(async (appraiser) => {
          const isValid = await isImageValid(appraiser.imageUrl);
          return { appraiser, isValid };
        })
      );
      
      // Update stats
      for (const { appraiser, isValid } of results) {
        if (isValid) {
          stats.validImages++;
          stats.byCity[appraiser.city].valid++;
        } else {
          stats.invalidImages++;
          stats.byCity[appraiser.city].invalid++;
        }
      }
      
      processedCount += batch.length;
      if (processedCount % 50 === 0 || processedCount === appraisers.length) {
        console.log(`Checked ${processedCount}/${appraisers.length} appraiser images`);
      }
    }
    
    // Calculate percentages
    stats.validPercentage = Number((stats.validImages / stats.totalAppraisers * 100).toFixed(2));
    for (const city in stats.byCity) {
      const cityStats = stats.byCity[city];
      cityStats.percentage = Number((cityStats.valid / cityStats.total * 100).toFixed(2));
    }
    
    // Sort cities by lowest percentage first
    const sortedCities = Object.entries(stats.byCity)
      .sort(([, a], [, b]) => a.percentage - b.percentage)
      .map(([city, cityStats]) => ({
        city,
        ...cityStats
      }));
    
    // Display results
    console.log('\n======= APPRAISER IMAGE COVERAGE REPORT =======');
    console.log(`Total Appraisers: ${stats.totalAppraisers}`);
    console.log(`Valid Images: ${stats.validImages}`);
    console.log(`Invalid/Missing Images: ${stats.invalidImages}`);
    console.log(`Coverage Percentage: ${stats.validPercentage}%`);
    
    console.log('\nCities with lowest coverage:');
    const worstCities = sortedCities.slice(0, 10);
    worstCities.forEach(city => {
      console.log(`- ${city.city}: ${city.percentage}% (${city.valid}/${city.total})`);
    });
    
    console.log('\nCities with 100% coverage:');
    const perfectCities = sortedCities.filter(city => city.percentage === 100);
    console.log(`${perfectCities.length} cities have 100% coverage`);
    
    console.log('\nCities with 0% coverage:');
    const zeroCities = sortedCities.filter(city => city.percentage === 0);
    zeroCities.forEach(city => {
      console.log(`- ${city.city}: ${city.total} appraisers`);
    });
    
    // Save report
    await fs.writeJson(
      path.join(ROOT_DIR, 'image-coverage-report.json'),
      {
        summary: {
          total: stats.totalAppraisers,
          valid: stats.validImages,
          invalid: stats.invalidImages,
          percentage: stats.validPercentage,
          reportDate: new Date().toISOString()
        },
        cityDetails: sortedCities
      },
      { spaces: 2 }
    );
    
    console.log('\nReport saved to image-coverage-report.json');
  } catch (error) {
    console.error(`Error in main process: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});