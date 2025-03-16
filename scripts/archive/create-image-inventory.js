#!/usr/bin/env node

/**
 * Create-Image-Inventory.js
 * 
 * This script creates a comprehensive inventory of all images used in the site,
 * validates their accessibility, and produces a report that can be used as a
 * source of truth for working images.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const LOCATIONS_DIR = path.join(ROOT_DIR, 'src/data/locations');
const INVENTORY_FILE = path.join(ROOT_DIR, 'image-inventory.json');

// Constants
const TIMEOUT_MS = 5000;
const PLACEHOLDER_PATTERNS = ['placeholder', 'placehold.co', 'default-image'];

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
 * Collect all image URLs from all appraiser data files
 */
async function collectAllImageUrls() {
  log('Collecting all image URLs from appraiser data files...', 'info');
  
  const imageUrls = new Map();
  const locationFiles = await fs.readdir(LOCATIONS_DIR);
  
  for (const file of locationFiles) {
    if (!file.endsWith('.json')) continue;
    
    const locationPath = path.join(LOCATIONS_DIR, file);
    const locationData = await fs.readJson(locationPath);
    const locationName = file.replace('.json', '');
    
    log(`Processing ${locationName}...`, 'info');
    
    if (!locationData.appraisers || !Array.isArray(locationData.appraisers)) {
      log(`No appraisers found in ${file}`, 'warning');
      continue;
    }
    
    for (const appraiser of locationData.appraisers) {
      if (!appraiser.id) {
        log(`Appraiser without ID in ${locationName}: ${appraiser.name}`, 'warning');
        continue;
      }
      
      // Collect the current image URL
      if (appraiser.imageUrl) {
        // Use the appraiser ID as the key for the Map
        const key = appraiser.id;
        
        // Check if this URL is a placeholder
        const isPlaceholder = PLACEHOLDER_PATTERNS.some(pattern => 
          appraiser.imageUrl.toLowerCase().includes(pattern)
        );
        
        // Store the image data
        imageUrls.set(key, {
          id: appraiser.id,
          name: appraiser.name || 'Unknown',
          location: locationName,
          imageUrl: appraiser.imageUrl,
          isPlaceholder: isPlaceholder,
          oldImageUrl: appraiser.oldImageUrl || null,
          checked: false,
          valid: false,
          status: 'pending'
        });
      }
    }
  }
  
  log(`Collected ${imageUrls.size} unique appraiser images.`, 'success');
  return imageUrls;
}

/**
 * Check if an image URL is accessible
 */
async function checkImageUrl(url) {
  try {
    if (!url || !url.startsWith('http')) {
      return { valid: false, status: 'invalid-url', message: 'Invalid URL format' };
    }
    
    // Check if this is a placeholder URL
    if (PLACEHOLDER_PATTERNS.some(pattern => url.toLowerCase().includes(pattern))) {
      return { valid: false, status: 'placeholder', message: 'Placeholder image' };
    }
    
    // Set up a timeout to prevent hanging on slow connections
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    // Make the request
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeout);
    
    // Check if the response is OK
    const statusCode = response.status;
    const valid = statusCode >= 200 && statusCode < 300;
    
    // Check content type to ensure it's an image
    const contentType = response.headers.get('content-type');
    const isImage = contentType && contentType.startsWith('image/');
    
    if (valid && !isImage) {
      return { 
        valid: false, 
        status: `not-image-${statusCode}`, 
        message: `Not an image: ${contentType}` 
      };
    }
    
    return { 
      valid: valid, 
      status: statusCode.toString(), 
      message: valid ? 'OK' : `HTTP Error ${statusCode}` 
    };
  } catch (error) {
    let status = 'error';
    
    if (error.name === 'AbortError') {
      status = 'timeout';
      return { valid: false, status, message: 'Request timed out' };
    }
    
    return { valid: false, status, message: error.message };
  }
}

/**
 * Check all the collected image URLs
 */
async function validateAllImageUrls(imageUrls) {
  log(`Validating ${imageUrls.size} image URLs...`, 'info');
  
  let checkedCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  let placeholderCount = 0;
  
  // Create a copy of the Map to update during iteration
  const updatedImageUrls = new Map(imageUrls);
  
  // Use a batch approach to avoid overwhelming the server
  const BATCH_SIZE = 10;
  const keys = Array.from(imageUrls.keys());
  
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (key) => {
      const imageData = imageUrls.get(key);
      
      if (!imageData) return;
      
      // Update progress
      checkedCount++;
      if (checkedCount % 20 === 0) {
        log(`Checked ${checkedCount}/${imageUrls.size} images...`, 'info');
      }
      
      // Check the image URL
      const result = await checkImageUrl(imageData.imageUrl);
      
      // Update the image data
      const updatedData = {
        ...imageData,
        checked: true,
        valid: result.valid,
        status: result.status,
        message: result.message
      };
      
      // Count statistics
      if (result.valid) {
        validCount++;
      } else if (result.status === 'placeholder') {
        placeholderCount++;
      } else {
        invalidCount++;
      }
      
      // If current image is invalid but we have an old image URL, check that too
      if (!result.valid && imageData.oldImageUrl) {
        const oldResult = await checkImageUrl(imageData.oldImageUrl);
        updatedData.oldImageValid = oldResult.valid;
        updatedData.oldImageStatus = oldResult.status;
        updatedData.oldImageMessage = oldResult.message;
      }
      
      // Update the Map
      updatedImageUrls.set(key, updatedData);
    });
    
    // Wait for all promises in this batch to complete
    await Promise.all(promises);
    
    // Add a small delay between batches
    if (i + BATCH_SIZE < keys.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  log(`\nImage validation completed:`, 'success');
  log(`- Valid images: ${validCount}`, 'success');
  log(`- Invalid images: ${invalidCount}`, 'error');
  log(`- Placeholder images: ${placeholderCount}`, 'warning');
  
  return updatedImageUrls;
}

/**
 * Write the image inventory to a JSON file
 */
async function writeInventory(imageUrls) {
  try {
    // Convert Map to array
    const inventory = {
      timestamp: new Date().toISOString(),
      totalImages: imageUrls.size,
      images: Array.from(imageUrls.values())
    };
    
    // Write to file
    await fs.writeJson(INVENTORY_FILE, inventory, { spaces: 2 });
    log(`Image inventory written to ${INVENTORY_FILE}`, 'success');
    
    // Create separate files for quick reference
    const validImages = inventory.images.filter(img => img.valid);
    const invalidImages = inventory.images.filter(img => !img.valid);
    
    await fs.writeJson(path.join(ROOT_DIR, 'valid-images.json'), validImages, { spaces: 2 });
    await fs.writeJson(path.join(ROOT_DIR, 'invalid-images.json'), invalidImages, { spaces: 2 });
    
    log(`Created separate files for valid (${validImages.length}) and invalid (${invalidImages.length}) images.`, 'success');
    
    return inventory;
  } catch (error) {
    log(`Error writing inventory: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting image inventory process...', 'info');
    
    // Step 1: Collect all image URLs
    const imageUrls = await collectAllImageUrls();
    
    // Step 2: Validate all image URLs
    const validatedImageUrls = await validateAllImageUrls(imageUrls);
    
    // Step 3: Write the inventory to a file
    await writeInventory(validatedImageUrls);
    
    log('\nImage inventory process completed successfully!', 'success');
    log('You now have a comprehensive inventory of all images used in the site.', 'success');
    log('Use this inventory as a source of truth for working with images.', 'success');
  } catch (error) {
    log(`Error in image inventory process: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();