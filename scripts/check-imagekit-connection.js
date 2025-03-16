/**
 * This script verifies connection to ImageKit and tests image availability
 * Run this before building to ensure ImageKit integration is working properly
 */

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

// ImageKit credentials
const IMAGEKIT_API_KEY = 'private_GkCvw4iz/87VKhaA3yKq8PDEXZc=';
const IMAGEKIT_PRIVATE_KEY = 'private_GkCvw4iz/87VKhaA3yKq8PDEXZc=';
const IMAGEKIT_PUBLIC_KEY = 'public_Fery2ZwWTLsaHSwfVwvvjvK+d+o=';
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/appraisily';
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
 * Verify connection to ImageKit
 */
async function checkImageKitConnection() {
  console.log(chalk.blue('🔄 Testing connection to ImageKit API...'));
  
  try {
    // Test API connection
    const headers = generateAuthHeaders();
    const response = await axios.get(
      'https://api.imagekit.io/v1/files', {
        params: {
          limit: 1
        },
        headers
      }
    );
    
    if (response.status === 200) {
      console.log(chalk.green('✅ Successfully connected to ImageKit API'));
    }
    
    // Check the appraiser-images folder
    console.log(chalk.blue(`🔄 Checking the '${FOLDER_PATH}' folder...`));
    
    const folderResponse = await axios.get(
      'https://api.imagekit.io/v1/files', {
        params: {
          path: FOLDER_PATH,
          type: 'file',
          limit: 10
        },
        headers
      }
    );
    
    const imageCount = folderResponse.data.length;
    
    if (imageCount > 0) {
      console.log(chalk.green(`✅ Found ${imageCount} images in the '${FOLDER_PATH}' folder`));
      
      // Test a random image from the folder
      const randomIndex = Math.floor(Math.random() * imageCount);
      const randomImage = folderResponse.data[randomIndex];
      const imageUrl = `${IMAGEKIT_BASE_URL}${randomImage.filePath}`;
      
      console.log(chalk.blue(`🔄 Testing image access for: ${randomImage.name}`));
      const imageResponse = await axios.head(imageUrl);
      
      if (imageResponse.status === 200) {
        console.log(chalk.green(`✅ Successfully accessed image: ${imageUrl.substring(0, 80)}...`));
        console.log(chalk.green('🎉 ImageKit connection is working properly!'));
      }
    } else {
      console.warn(chalk.yellow(`⚠️ Warning: No images found in the '${FOLDER_PATH}' folder`));
      console.warn(chalk.yellow(`⚠️ Please make sure you have uploaded images to the correct folder in ImageKit`));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error connecting to ImageKit:'));
    console.error(chalk.red(error.response?.data?.message || error.message));
    console.error(chalk.yellow('⚠️ Please check your ImageKit credentials and try again'));
    process.exit(1);
  }
}

// Run the check
checkImageKitConnection();