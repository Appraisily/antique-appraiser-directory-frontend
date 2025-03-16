/**
 * This script randomizes appraiser images by shuffling and reassigning
 * valid image URLs from the image inventory to appraisers.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const APPRAISERS_FILE = path.join(ROOT_DIR, 'data', 'appraisers.json');
const IMAGE_INVENTORY_FILE = path.join(ROOT_DIR, 'image-inventory.json');

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function randomizeAppraiserImages() {
  console.log('Starting appraiser image randomization...');

  try {
    // Load data files
    const appraisersData = await fs.readJSON(APPRAISERS_FILE);
    const imageInventory = await fs.readJSON(IMAGE_INVENTORY_FILE);

    // Get all valid images from inventory
    const validImages = imageInventory.images
      .filter(img => img.valid && img.status === "200")
      .map(img => img.imageUrl);

    console.log(`Found ${validImages.length} valid images in inventory`);
    
    if (validImages.length === 0) {
      console.error('No valid images found in inventory!');
      return;
    }

    // Shuffle the valid images
    const shuffledImages = shuffleArray(validImages);
    
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
    
    // Create a backup of the original file
    const backupFile = `${APPRAISERS_FILE}.backup-${Date.now()}.json`;
    await fs.copyFile(APPRAISERS_FILE, backupFile);
    console.log(`Original data backed up to ${backupFile}`);

  } catch (error) {
    console.error('Error randomizing appraiser images:', error);
  }
}

// Run the function
randomizeAppraiserImages();