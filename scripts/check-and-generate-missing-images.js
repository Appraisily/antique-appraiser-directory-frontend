#!/usr/bin/env node

/**
 * Check and Generate Missing Appraiser Images
 * 
 * This script:
 * 1. Scans all appraiser data for image URLs
 * 2. Checks which URLs are missing, broken, or using placeholders
 * 3. Generates new images only for those appraisers with missing/broken images
 */

import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fetch from 'node-fetch';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');
const TRACKING_FILE = path.join(ROOT_DIR, 'image-generation-progress.json');

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
 * Get a list of all appraisers from standardized data files
 * @returns {Promise<Array>} List of appraiser objects
 */
async function getAllAppraisers() {
  try {
    const appraisers = [];
    
    // Get all JSON files in the standardized directory
    const files = await fs.readdir(STANDARDIZED_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('README'));
    
    log(`Found ${jsonFiles.length} standardized data files`, 'info');
    
    // Process each file
    for (const file of jsonFiles) {
      const filePath = path.join(STANDARDIZED_DIR, file);
      const cityName = path.basename(file, '.json');
      
      try {
        // Read the file content
        const data = await fs.readJson(filePath);
        
        // Skip if no appraisers array
        if (!data.appraisers || !Array.isArray(data.appraisers)) {
          continue;
        }
        
        // Add each appraiser to the list
        for (const appraiser of data.appraisers) {
          if (appraiser.id) {
            appraisers.push({
              id: appraiser.id,
              name: appraiser.name,
              city: cityName,
              filePath,
              imageUrl: appraiser.imageUrl,
              state: appraiser.address?.state || '',
              expertise: appraiser.expertise || {}
            });
          }
        }
      } catch (error) {
        log(`Error reading file ${filePath}: ${error.message}`, 'error');
      }
    }
    
    log(`Found ${appraisers.length} total appraisers`, 'success');
    return appraisers;
  } catch (error) {
    log(`Error getting appraisers: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Check which appraisers have missing, invalid or placeholder images
 * @param {Array} appraisers - List of appraiser objects
 * @returns {Promise<Array>} List of appraisers needing image generation
 */
async function checkAppraisersImages(appraisers) {
  const needingImages = [];
  const total = appraisers.length;
  
  log(`Checking image validity for ${total} appraisers...`, 'info');
  
  for (let i = 0; i < total; i++) {
    const appraiser = appraisers[i];
    
    // Log progress every 20 appraisers
    if (i % 20 === 0) {
      log(`Checking appraiser ${i + 1}/${total}...`, 'info');
    }
    
    // Check if appraiser has a valid image URL
    const hasValidImage = await isImageValid(appraiser.imageUrl);
    
    if (!hasValidImage) {
      log(`Appraiser "${appraiser.name}" has missing or invalid image: ${appraiser.imageUrl || 'none'}`, 'warning');
      needingImages.push(appraiser);
    }
  }
  
  log(`Found ${needingImages.length} appraisers needing images`, 'info');
  return needingImages;
}

/**
 * Generate an image for an appraiser
 * @param {Object} appraiser - Appraiser object
 * @returns {Promise<string|null>} Generated image URL or null if failed
 */
async function generateImageForAppraiser(appraiser) {
  try {
    const cityName = appraiser.city;
    let stateName = appraiser.state;
    
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
 * @param {Object} appraiser - Appraiser object
 * @param {string} imageUrl - New image URL
 * @returns {Promise<boolean>} Success status
 */
async function updateAppraiserImage(appraiser, imageUrl) {
  try {
    const filePath = appraiser.filePath;
    
    // Read the standardized JSON file
    const data = await fs.readJson(filePath);
    
    // Find the appraiser by ID
    const appraiserIndex = data.appraisers.findIndex(a => a.id === appraiser.id);
    
    if (appraiserIndex === -1) {
      throw new Error(`Appraiser with ID ${appraiser.id} not found in ${filePath}`);
    }
    
    // Update the image URL
    data.appraisers[appraiserIndex].imageUrl = imageUrl;
    
    // Write the updated JSON back to the file
    await fs.writeJson(filePath, data, { spaces: 2 });
    
    log(`Updated image URL for ${appraiser.name} in ${filePath}`, 'success');
    
    return true;
  } catch (error) {
    log(`Error updating appraiser image: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting check and generation of missing appraiser images...', 'info');
    
    // Get all appraisers
    const allAppraisers = await getAllAppraisers();
    
    // Check which appraisers need images
    const appraisersNeedingImages = await checkAppraisersImages(allAppraisers);
    
    if (appraisersNeedingImages.length === 0) {
      log('No appraisers need images. All images are valid!', 'success');
      return;
    }
    
    log(`Generating images for ${appraisersNeedingImages.length} appraisers...`, 'info');
    
    // Count of successfully processed appraisers
    let successCount = 0;
    
    // Generate images for each appraiser needing one
    for (let i = 0; i < appraisersNeedingImages.length; i++) {
      const appraiser = appraisersNeedingImages[i];
      
      log(`Processing appraiser ${i + 1}/${appraisersNeedingImages.length}: ${appraiser.name}`, 'info');
      
      // Generate the image
      const imageUrl = await generateImageForAppraiser(appraiser);
      
      if (imageUrl) {
        // Update the appraiser's record with the new image URL
        const updated = await updateAppraiserImage(appraiser, imageUrl);
        
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
    
    log(`Image generation completed. Successfully generated ${successCount}/${appraisersNeedingImages.length} images.`, 'success');
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