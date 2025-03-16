#!/usr/bin/env node

/**
 * Fix Missing Appraiser Images
 * 
 * This script:
 * 1. Scans appraiser data for all image URLs
 * 2. Checks which image URLs are valid (accessible)
 * 3. Creates a list of valid replacement images from ImageKit
 * 4. Updates appraiser data to replace broken images with valid ones
 */

import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'appraisers.json');
const LOCATIONS_DIR = path.join(ROOT_DIR, 'src', 'data', 'locations');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');
const INVENTORY_FILE = path.join(ROOT_DIR, 'imagekit-inventory.json');

// Configuration
const PLACEHOLDER_IMAGE = 'https://ik.imagekit.io/appraisily/placeholder-image.jpg';
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/appraisily';
const IMAGE_FOLDER = '/appraiser-images';

// Logging function with timestamp
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
 * Check if an image URL is valid (returns 200 status)
 * @param {string} url - The image URL to check
 * @returns {Promise<boolean>} Whether the URL is valid
 */
async function isImageValid(url) {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Get inventory of valid ImageKit images
 * @returns {Promise<Array>} List of valid images
 */
async function getValidImageKitImages() {
  try {
    // Check if inventory file exists
    if (await fs.pathExists(INVENTORY_FILE)) {
      const inventory = await fs.readJSON(INVENTORY_FILE);
      
      // Filter for only appraiser images
      const appraisersImages = inventory.images.filter(img => 
        img.url.includes('/appraiser-images/') && 
        img.url.includes('appraiser_')
      );
      
      log(`Found ${appraisersImages.length} appraiser images in inventory`, 'info');
      return appraisersImages;
    } else {
      log(`ImageKit inventory file not found: ${INVENTORY_FILE}`, 'warning');
      log('Please run npm run fetch:imagekit first', 'warning');
      throw new Error('ImageKit inventory file not found');
    }
  } catch (error) {
    log(`Error getting valid ImageKit images: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Collect all appraiser image URLs from the data
 * @returns {Promise<Map>} Map of appraiser IDs to their image URLs
 */
async function collectAppraisersImageUrls() {
  const appraisers = new Map();
  
  try {
    // Check main appraisers.json data file
    if (await fs.pathExists(DATA_FILE)) {
      const data = await fs.readJSON(DATA_FILE);
      
      if (Array.isArray(data.appraisers)) {
        data.appraisers.forEach(appraiser => {
          if (appraiser.id && appraiser.imageUrl) {
            appraisers.set(appraiser.id, {
              id: appraiser.id,
              imageUrl: appraiser.imageUrl,
              name: appraiser.firstName && appraiser.lastName 
                ? `${appraiser.firstName} ${appraiser.lastName}`
                : appraiser.company || appraiser.name || appraiser.id
            });
          }
        });
      }
    }
    
    // Check location data files
    if (await fs.pathExists(LOCATIONS_DIR)) {
      const locationFiles = await fs.readdir(LOCATIONS_DIR);
      
      for (const file of locationFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(LOCATIONS_DIR, file);
          const locationData = await fs.readJSON(filePath);
          
          if (locationData.appraisers && Array.isArray(locationData.appraisers)) {
            locationData.appraisers.forEach(appraiser => {
              if (appraiser.id && (appraiser.imageUrl || appraiser.image)) {
                appraisers.set(appraiser.id, {
                  id: appraiser.id,
                  imageUrl: appraiser.imageUrl || appraiser.image,
                  name: appraiser.name || appraiser.id
                });
              }
            });
          }
        }
      }
    }
    
    log(`Collected ${appraisers.size} unique appraiser image URLs`, 'info');
    return appraisers;
  } catch (error) {
    log(`Error collecting appraiser image URLs: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Check all appraiser images for validity
 * @param {Map} appraisers - Map of appraiser IDs to their data
 * @returns {Promise<Object>} Object with valid and invalid appraiser images
 */
async function checkAppraisersImages(appraisers) {
  const validImages = [];
  const invalidImages = [];
  
  let counter = 0;
  const total = appraisers.size;
  
  for (const [id, appraiser] of appraisers.entries()) {
    counter++;
    if (counter % 20 === 0) {
      log(`Checked ${counter}/${total} images...`, 'info');
    }
    
    const imageUrl = appraiser.imageUrl;
    
    // Skip placeholder images
    if (imageUrl === PLACEHOLDER_IMAGE) {
      validImages.push({ ...appraiser, valid: true });
      continue;
    }
    
    const isValid = await isImageValid(imageUrl);
    
    if (isValid) {
      validImages.push({ ...appraiser, valid: true });
    } else {
      log(`Invalid image URL for ${appraiser.name}: ${imageUrl}`, 'warning');
      invalidImages.push({ ...appraiser, valid: false });
    }
  }
  
  log(`Found ${validImages.length} valid and ${invalidImages.length} invalid images`, 'info');
  
  // Save reports for reference
  await fs.writeJSON(path.join(ROOT_DIR, 'valid-images.json'), validImages, { spaces: 2 });
  await fs.writeJSON(path.join(ROOT_DIR, 'invalid-images.json'), invalidImages, { spaces: 2 });
  
  return { validImages, invalidImages };
}

/**
 * Fix invalid appraiser images by replacing them with valid ones
 * @param {Array} invalidImages - List of appraiser entries with invalid images
 * @param {Array} validReplacements - List of valid replacement ImageKit images
 * @returns {Promise<Array>} Updated appraiser entries
 */
async function fixInvalidImages(invalidImages, validReplacements) {
  if (validReplacements.length === 0) {
    log('No valid replacement images available. Cannot fix invalid images.', 'error');
    return [];
  }
  
  const updatedAppraisers = [];
  
  // For each invalid image, assign a random valid replacement
  for (const appraiser of invalidImages) {
    const randomIndex = Math.floor(Math.random() * validReplacements.length);
    const replacement = validReplacements[randomIndex];
    
    updatedAppraisers.push({
      ...appraiser,
      originalImageUrl: appraiser.imageUrl,
      imageUrl: replacement.url
    });
    
    log(`Fixed image for ${appraiser.name}: ${replacement.url}`, 'success');
  }
  
  return updatedAppraisers;
}

/**
 * Update appraiser data files with fixed images
 * @param {Array} updatedAppraisers - List of appraiser entries with updated images
 * @returns {Promise<void>}
 */
async function updateAppraiserDataFiles(updatedAppraisers) {
  // Create a map for quick lookup
  const updatedImages = new Map();
  updatedAppraisers.forEach(appraiser => {
    updatedImages.set(appraiser.id, appraiser.imageUrl);
  });
  
  let updatedCount = 0;
  
  // Update the main appraisers.json file
  if (await fs.pathExists(DATA_FILE)) {
    const data = await fs.readJSON(DATA_FILE);
    let dataChanged = false;
    
    if (Array.isArray(data.appraisers)) {
      data.appraisers.forEach(appraiser => {
        if (appraiser.id && updatedImages.has(appraiser.id)) {
          const newUrl = updatedImages.get(appraiser.id);
          if (appraiser.imageUrl !== newUrl) {
            appraiser.imageUrl = newUrl;
            dataChanged = true;
            updatedCount++;
          }
        }
      });
    }
    
    if (dataChanged) {
      // Create a backup of the original file
      const backupFile = `${DATA_FILE}.backup-${Date.now()}.json`;
      await fs.copy(DATA_FILE, backupFile);
      log(`Created backup of original data file: ${backupFile}`, 'info');
      
      // Write the updated data
      await fs.writeJSON(DATA_FILE, data, { spaces: 2 });
      log(`Updated main appraisers.json with ${updatedCount} fixed images`, 'success');
    }
  }
  
  // Update location data files
  if (await fs.pathExists(LOCATIONS_DIR)) {
    const locationFiles = await fs.readdir(LOCATIONS_DIR);
    let locationUpdatedCount = 0;
    
    for (const file of locationFiles) {
      if (file.endsWith('.json')) {
        const filePath = path.join(LOCATIONS_DIR, file);
        const locationData = await fs.readJSON(filePath);
        let fileChanged = false;
        
        if (locationData.appraisers && Array.isArray(locationData.appraisers)) {
          locationData.appraisers.forEach(appraiser => {
            if (appraiser.id && updatedImages.has(appraiser.id)) {
              const newUrl = updatedImages.get(appraiser.id);
              
              // Update imageUrl or image property depending on what's available
              if (appraiser.imageUrl !== newUrl) {
                appraiser.imageUrl = newUrl;
                fileChanged = true;
                locationUpdatedCount++;
              }
              if (appraiser.image !== newUrl) {
                appraiser.image = newUrl;
                fileChanged = true;
              }
            }
          });
        }
        
        if (fileChanged) {
          await fs.writeJSON(filePath, locationData, { spaces: 2 });
        }
      }
    }
    
    log(`Updated location data files with ${locationUpdatedCount} fixed images`, 'success');
  }
  
  // Update standardized data files
  if (await fs.pathExists(STANDARDIZED_DIR)) {
    const standardizedFiles = await fs.readdir(STANDARDIZED_DIR);
    let standardizedUpdatedCount = 0;
    
    for (const file of standardizedFiles) {
      if (file.endsWith('.json')) {
        const filePath = path.join(STANDARDIZED_DIR, file);
        const standardizedData = await fs.readJSON(filePath);
        let fileChanged = false;
        
        if (standardizedData.appraisers && Array.isArray(standardizedData.appraisers)) {
          standardizedData.appraisers.forEach(appraiser => {
            if (appraiser.id && updatedImages.has(appraiser.id)) {
              const newUrl = updatedImages.get(appraiser.id);
              
              if (appraiser.imageUrl !== newUrl) {
                appraiser.imageUrl = newUrl;
                fileChanged = true;
                standardizedUpdatedCount++;
              }
            }
          });
        }
        
        if (fileChanged) {
          await fs.writeJSON(filePath, standardizedData, { spaces: 2 });
        }
      }
    }
    
    log(`Updated standardized data files with ${standardizedUpdatedCount} fixed images`, 'success');
  }
  
  log(`Total images fixed: ${updatedCount}`, 'success');
  return updatedCount;
}

/**
 * Main function to check and fix images
 */
async function fixMissingImages() {
  try {
    log('Starting appraiser image validation and fixing...', 'info');
    
    // Get valid ImageKit images for replacements
    const validImageKitImages = await getValidImageKitImages();
    
    if (validImageKitImages.length === 0) {
      log('No valid ImageKit images found. Please run npm run fetch:imagekit first', 'error');
      process.exit(1);
    }
    
    // Collect all appraiser image URLs
    const appraisers = await collectAppraisersImageUrls();
    
    // Check which images are valid
    const { validImages, invalidImages } = await checkAppraisersImages(appraisers);
    
    if (invalidImages.length === 0) {
      log('No invalid images found! All appraiser images are valid.', 'success');
      return;
    }
    
    // Fix invalid images with valid replacements
    const updatedAppraisers = await fixInvalidImages(invalidImages, validImageKitImages);
    
    // Update data files with fixed images
    const updatedCount = await updateAppraiserDataFiles(updatedAppraisers);
    
    log(`Successfully fixed ${updatedCount} invalid appraiser images`, 'success');
  } catch (error) {
    log(`Error fixing appraiser images: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Run the script
 */
fixMissingImages()
  .then(() => {
    log('Appraiser image fixing process completed successfully!', 'success');
    process.exit(0);
  })
  .catch(error => {
    log(`Failed to fix appraiser images: ${error.message}`, 'error');
    process.exit(1);
  });