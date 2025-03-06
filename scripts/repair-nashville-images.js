import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const PLACEHOLDER_URL = '/images/placeholder-appraiser.jpg';

// Check if an image URL is valid (can be accessed)
const checkImageUrl = async (url) => {
  try {
    // If it's a placeholder, it's not valid
    if (!url || url === PLACEHOLDER_URL || !url.startsWith('http')) {
      return false;
    }
    
    // Using a simple HEAD request to check if the URL is accessible
    const response = await fetch(url, { 
      method: 'HEAD',
      // Add a timeout to avoid hanging on slow responses
      timeout: 5000
    });
    
    // Only consider 2xx status codes as valid
    if (response.ok) {
      return true;
    } else {
      console.log(`URL returned status ${response.status}: ${url}`);
      return false;
    }
  } catch (error) {
    console.log(`Error checking image URL ${url}: ${error.message}`);
    return false;
  }
};

const repairLocationFile = async (locationName) => {
  try {
    const locationPath = path.join(LOCATIONS_DIR, `${locationName}.json`);
    
    if (!await fs.pathExists(locationPath)) {
      console.error(`Location file ${locationName}.json not found.`);
      return;
    }
    
    const locationData = await fs.readJson(locationPath);
    
    if (!locationData.appraisers || !Array.isArray(locationData.appraisers)) {
      console.error(`No appraisers found in ${locationName}.json.`);
      return;
    }
    
    let updatedCount = 0;
    
    // Check and repair each appraiser
    for (const appraiser of locationData.appraisers) {
      if (!appraiser.imageUrl) {
        appraiser.imageUrl = PLACEHOLDER_URL;
        updatedCount++;
        continue;
      }
      
      const isValid = await checkImageUrl(appraiser.imageUrl);
      
      if (!isValid) {
        console.log(`Invalid image URL for ${appraiser.name}: ${appraiser.imageUrl}`);
        
        // Store the broken URL as oldImageUrl if it's not already there
        if (!appraiser.oldImageUrl && appraiser.imageUrl !== PLACEHOLDER_URL) {
          appraiser.oldImageUrl = appraiser.imageUrl;
        }
        
        // Set to placeholder
        appraiser.imageUrl = PLACEHOLDER_URL;
        updatedCount++;
      } else {
        console.log(`Valid image URL for ${appraiser.name}: ${appraiser.imageUrl}`);
      }
    }
    
    if (updatedCount > 0) {
      await fs.writeJson(locationPath, locationData, { spaces: 2 });
      console.log(`Updated ${updatedCount} appraisers in ${locationName}.json.`);
    } else {
      console.log(`No updates needed for ${locationName}.json.`);
    }
    
    return updatedCount;
  } catch (error) {
    console.error(`Error repairing ${locationName}.json:`, error.message);
  }
};

const main = async () => {
  try {
    console.log('Repairing image URLs in location data...');
    
    // Fix the Nashville location
    await repairLocationFile('nashville');
    
    console.log('Repair complete!');
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
};

main(); 