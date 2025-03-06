/**
 * This script lists available images from ImageKit
 * Used to choose random images for appraisers instead of generating them
 */

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'imagekit-inventory.json');

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
 * Create inventory with ImageKit URLs
 */
async function createImageKitInventory() {
  try {
    console.log('Fetching images from ImageKit...');
    
    // List images in the folder
    const images = await listImagesInFolder(FOLDER_PATH);
    
    // Process and format the image data
    const formattedImages = images.map(image => ({
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
    
    await fs.writeJSON(OUTPUT_FILE, inventory, { spaces: 2 });
    console.log(`Successfully saved ${formattedImages.length} images to ${OUTPUT_FILE}`);
    
    return formattedImages;
  } catch (error) {
    console.error('Error creating ImageKit inventory:', error);
    throw error;
  }
}

// Run the script
createImageKitInventory()
  .then(images => {
    console.log(`Successfully retrieved ${images.length} images from ImageKit`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error executing script:', error);
    process.exit(1);
  });