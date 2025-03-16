#!/usr/bin/env node

/**
 * Count Appraisers
 * 
 * This script counts the total number of appraisers across all standardized location files.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');

async function countAppraisers() {
  try {
    // Make sure the standardized directory exists
    if (!fs.existsSync(STANDARDIZED_DIR)) {
      throw new Error(`Standardized directory not found: ${STANDARDIZED_DIR}`);
    }
    
    // Read all standardized files
    const files = (await fs.readdir(STANDARDIZED_DIR))
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(STANDARDIZED_DIR, file));
    
    console.log(`Found ${files.length} standardized location files.`);
    
    // Count appraisers in each file
    let totalAppraisers = 0;
    const locationCounts = [];
    
    for (const file of files) {
      const locationName = path.basename(file, '.json');
      const data = await fs.readJson(file);
      const count = data.appraisers ? data.appraisers.length : 0;
      totalAppraisers += count;
      locationCounts.push({ location: locationName, count });
    }
    
    // Sort locations by count (descending)
    locationCounts.sort((a, b) => b.count - a.count);
    
    // Output results
    console.log(`\nTotal appraisers: ${totalAppraisers}`);
    console.log('\nTop 10 locations by appraiser count:');
    locationCounts.slice(0, 10).forEach(loc => {
      console.log(`${loc.location}: ${loc.count} appraisers`);
    });
    
    // Output locations with few appraisers
    console.log('\nLocations with 5 or fewer appraisers:');
    locationCounts.filter(loc => loc.count <= 5).forEach(loc => {
      console.log(`${loc.location}: ${loc.count} appraisers`);
    });
    
    // Calculate average appraisers per location
    const average = totalAppraisers / files.length;
    console.log(`\nAverage appraisers per location: ${average.toFixed(2)}`);
    
  } catch (error) {
    console.error(`Error counting appraisers: ${error.message}`);
    process.exit(1);
  }
}

// Run the count
countAppraisers();