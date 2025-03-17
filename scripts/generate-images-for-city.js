#!/usr/bin/env node

/**
 * Generate Images for Specific City
 * 
 * This script:
 * 1. Generates appraiser images for a specific city
 * 2. Updates the standardized data file
 * 
 * Usage: node generate-images-for-city.js <city-name>
 * Example: node generate-images-for-city.js edmonton
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fetch from 'node-fetch';
import axios from 'axios';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');

// Image generation service URL
const IMAGE_SERVICE_URL = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';

// Constants for identification
const PLACEHOLDER_INDICATORS = ['placeholder', 'undefined', 'null', 'missing'];

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
 * State abbreviation to state name mapping
 */
const STATE_MAP = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

/**
 * Check if an image URL is valid (returns 200 status)
 * @param {string} url - The image URL to check
 * @returns {Promise<boolean>} Whether the URL is valid
 */
async function isImageValid(url) {
  // If URL is empty, undefined, or contains placeholder indicators, it's invalid
  if (!url || PLACEHOLDER_INDICATORS.some(indicator => url.toLowerCase().includes(indicator))) {
    return false;
  }

  try {
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    log(`Error checking image URL ${url}: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Generate an image for an appraiser
 * @param {Object} appraiser - Appraiser object
 * @param {string} cityName - City name
 * @param {string} stateName - State name
 * @returns {Promise<string|null>} Generated image URL or null if failed
 */
async function generateImageForAppraiser(appraiser, cityName, stateName) {
  try {
    // Convert state code to full name if needed
    if (stateName.length === 2 && STATE_MAP[stateName]) {
      stateName = STATE_MAP[stateName];
    }
    
    log(`Generating image for ${appraiser.name} in ${cityName}, ${stateName || 'Unknown State'}...`);
    
    const payload = {
      appraiser: {
        id: appraiser.id,
        name: appraiser.name,
        specialties: appraiser.expertise?.specialties || [],
        city: cityName,
        state: stateName || 'Unknown'
      },
      customPrompt: `Make a photorealistic image of an antique appraiser located in ${cityName}, ${stateName || 'Unknown State'}`
    };
    
    const response = await fetch(IMAGE_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate image: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Image generation failed: ${data.error || 'Unknown error'}`);
    }
    
    log(`Successfully generated image for ${appraiser.name}: ${data.data.imageUrl}`, 'success');
    
    return data.data.imageUrl;
  } catch (error) {
    log(`Error generating image for ${appraiser.name}: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Update the appraiser's image URL in the standardized JSON file
 * @param {string} filePath - Path to the standardized JSON file
 * @param {string} appraiserId - Appraiser ID
 * @param {string} imageUrl - New image URL
 * @returns {Promise<boolean>} Success status
 */
async function updateAppraiserImage(filePath, appraiserId, imageUrl) {
  try {
    // Read the standardized JSON file
    const data = await fs.readJson(filePath);
    
    // Find the appraiser by ID
    const appraiserIndex = data.appraisers.findIndex(a => a.id === appraiserId);
    
    if (appraiserIndex === -1) {
      throw new Error(`Appraiser with ID ${appraiserId} not found in ${filePath}`);
    }
    
    // Update the image URL
    data.appraisers[appraiserIndex].imageUrl = imageUrl;
    
    // Write the updated JSON back to the file
    await fs.writeJson(filePath, data, { spaces: 2 });
    
    log(`Updated image URL for ${data.appraisers[appraiserIndex].name} in ${filePath}`, 'success');
    
    return true;
  } catch (error) {
    log(`Error updating appraiser image: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Generate images for a specific city
 * @param {string} cityName - Name of the city
 * @returns {Promise<void>}
 */
async function generateImagesForCity(cityName) {
  try {
    const filePath = path.join(STANDARDIZED_DIR, `${cityName}.json`);
    
    // Check if the city file exists
    if (!await fs.pathExists(filePath)) {
      throw new Error(`City file not found: ${filePath}`);
    }
    
    // Read the city data
    const cityData = await fs.readJson(filePath);
    
    if (!cityData.appraisers || !Array.isArray(cityData.appraisers) || cityData.appraisers.length === 0) {
      throw new Error(`No appraisers found in ${cityName}`);
    }
    
    log(`Found ${cityData.appraisers.length} appraisers in ${cityName}`);
    
    // Extract state name from first appraiser
    let stateName = cityData.appraisers[0].address?.state || '';
    
    // Check which appraisers need images
    const appraisersNeedingImages = [];
    
    for (const appraiser of cityData.appraisers) {
      const hasValidImage = await isImageValid(appraiser.imageUrl);
      
      if (!hasValidImage) {
        appraisersNeedingImages.push(appraiser);
      }
    }
    
    if (appraisersNeedingImages.length === 0) {
      log(`All appraisers in ${cityName} already have valid images`, 'success');
      return;
    }
    
    log(`Found ${appraisersNeedingImages.length} appraisers in ${cityName} needing images`, 'info');
    
    // Generate images for appraisers needing them
    let successCount = 0;
    
    for (let i = 0; i < appraisersNeedingImages.length; i++) {
      const appraiser = appraisersNeedingImages[i];
      
      log(`Processing appraiser ${i + 1}/${appraisersNeedingImages.length}: ${appraiser.name}`, 'info');
      
      // Generate the image
      const imageUrl = await generateImageForAppraiser(appraiser, cityName, stateName);
      
      if (imageUrl) {
        // Update the appraiser's record with the new image URL
        const updated = await updateAppraiserImage(filePath, appraiser.id, imageUrl);
        
        if (updated) {
          successCount++;
        }
      }
      
      // Add a small delay between requests to avoid rate limiting
      if (i < appraisersNeedingImages.length - 1) {
        log('Waiting 2 seconds before next image generation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    log(`Image generation for ${cityName} completed. Successfully generated ${successCount}/${appraisersNeedingImages.length} images.`, 'success');
  } catch (error) {
    log(`Error generating images for ${cityName}: ${error.message}`, 'error');
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  // Get the city name from command line arguments
  const cityName = process.argv[2];
  
  if (!cityName) {
    log('Please provide a city name as an argument', 'error');
    log('Usage: node generate-images-for-city.js <city-name>', 'info');
    log('Example: node generate-images-for-city.js edmonton', 'info');
    process.exit(1);
  }
  
  log(`Starting image generation for city: ${cityName}`, 'info');
  
  // Generate images for the specified city
  await generateImagesForCity(cityName);
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error.message}`, 'error');
  process.exit(1);
});