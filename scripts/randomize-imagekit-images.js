/**
 * This script randomizes appraiser images using ImageKit
 * It first fetches an inventory of available images from ImageKit
 * Then randomly assigns those images to appraisers
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const APPRAISERS_FILE = path.join(ROOT_DIR, 'data', 'appraisers.json');
const INVENTORY_FILE = path.join(ROOT_DIR, 'imagekit-inventory.json');

// ImageKit credentials
const IMAGEKIT_API_KEY = 'private_GkCvw4iz/87VKhaA3yKq8PDEXZc=';
const IMAGEKIT_PRIVATE_KEY = 'private_GkCvw4iz/87VKhaA3yKq8PDEXZc=';
const IMAGEKIT_PUBLIC_KEY = 'public_Fery2ZwWTLsaHSwfVwvvjvK+d+o=';
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/appraisily';

// Folder path in ImageKit
const FOLDER_PATH = '/appraiser-images';

/**
 * Generate authentication signature for ImageKit API
 * @returns {Object} Auth headers
 */
function generateAuthHeaders() {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha1', IMAGEKIT_PRIVATE_KEY)
    .update(timestamp.toString())
    .digest('hex');

  return {
    'Authorization': `Basic ${Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64')}`,
    'X-ImageKit-Signature': signature,
    'X-ImageKit-Timestamp': timestamp
  };
}

/**
 * List all images in a folder
 * @param {string} folderPath - Folder path in ImageKit
 * @returns {Promise<Array>} List of images
 */
async function listImagesInFolder(folderPath) {
  try {
    const headers = generateAuthHeaders();
    
    const response = await axios.get(
      `https://api.imagekit.io/v1/files`, {
        params: {
          path: folderPath,
          type: 'file',
          limit: 1000 // Maximum limit allowed by ImageKit API
        },
        headers
      }
    );

    console.log(`Found ${response.data.length} images in ImageKit folder: ${folderPath}`);
    return response.data;
  } catch (error) {
    console.error('Error listing images from ImageKit:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Fetch images from ImageKit or use cached inventory
 * @returns {Promise<Array>} List of image URLs
 */
async function getImageKitImages() {
  try {
    // Check if inventory file exists and is recent
    let images = [];
    
    if (await fs.pathExists(INVENTORY_FILE)) {
      const inventory = await fs.readJSON(INVENTORY_FILE);
      const lastUpdated = new Date(inventory.lastUpdated);
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
      
      // Use cached inventory if less than 24 hours old
      if (hoursSinceUpdate < 24 && inventory.images && inventory.images.length > 0) {
        console.log(`Using cached ImageKit inventory (${inventory.images.length} images)`);
        return inventory.images.map(img => img.imageUrl);
      }
    }
    
    // If no recent inventory, fetch from ImageKit API
    console.log('Fetching fresh images from ImageKit...');
    const apiImages = await listImagesInFolder(FOLDER_PATH);
    
    // Process and format the image data
    const formattedImages = apiImages.map(image => ({
      id: image.fileId,
      name: image.name,
      url: image.url,
      imageUrl: `${IMAGEKIT_BASE_URL}${image.filePath}`,
      size: image.size,
      fileType: image.fileType,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt
    }));
    
    // Save to inventory file
    const inventory = {
      count: formattedImages.length,
      source: 'ImageKit',
      folder: FOLDER_PATH,
      lastUpdated: new Date().toISOString(),
      images: formattedImages
    };
    
    await fs.writeJSON(INVENTORY_FILE, inventory, { spaces: 2 });
    console.log(`Updated ImageKit inventory with ${formattedImages.length} images`);
    
    return formattedImages.map(img => img.imageUrl);
  } catch (error) {
    console.error('Error getting ImageKit images:', error);
    throw error;
  }
}

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Randomize appraiser images using ImageKit
 */
async function randomizeAppraiserImagesWithImageKit() {
  console.log('Starting appraiser image randomization using ImageKit...');

  try {
    // Load appraisers data
    const appraisersData = await fs.readJSON(APPRAISERS_FILE);
    
    // Get images from ImageKit
    const imageUrls = await getImageKitImages();
    
    if (!imageUrls || imageUrls.length === 0) {
      console.error('No ImageKit images found!');
      return;
    }

    console.log(`Using ${imageUrls.length} images from ImageKit for randomization`);
    
    // Shuffle the images
    const shuffledImages = shuffleArray(imageUrls);
    
    // Create a backup of the original file
    const backupFile = `${APPRAISERS_FILE}.backup-${Date.now()}.json`;
    await fs.copyFile(APPRAISERS_FILE, backupFile);
    console.log(`Original data backed up to ${backupFile}`);
    
    // Assign shuffled images to appraisers
    const updatedAppraisers = appraisersData.appraisers.map((appraiser, index) => {
      // Cycle through the shuffled images if we have more appraisers than images
      const imageIndex = index % shuffledImages.length;
      return {
        ...appraiser,
        imageUrl: shuffledImages[imageIndex]
      };
    });

    // Update the appraisers data with new image URLs
    const updatedData = {
      ...appraisersData,
      appraisers: updatedAppraisers
    };

    // Save the updated data
    await fs.writeJSON(APPRAISERS_FILE, updatedData, { spaces: 2 });
    
    console.log(`Successfully randomized images for ${updatedAppraisers.length} appraisers`);
    console.log('Images have been randomly reassigned to appraisers');
    
  } catch (error) {
    console.error('Error randomizing appraiser images:', error);
  }
}

// Run the function
randomizeAppraiserImagesWithImageKit();