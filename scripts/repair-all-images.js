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
    // If it's a placeholder or not a full URL, it's not valid
    if (!url || url === PLACEHOLDER_URL || !url.startsWith('http')) {
      return false;
    }
    
    // Make a more robust check with proper error handling
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Log the status for debugging
      console.log(`URL ${url} returned status ${response.status}`);
      
      // Only consider 2xx status codes as valid
      return response.status >= 200 && response.status < 300;
    } catch (fetchError) {
      console.log(`Fetch error for ${url}: ${fetchError.message}`);
      return false;
    }
  } catch (error) {
    console.log(`General error checking image URL ${url}: ${error.message}`);
    return false;
  }
};

const repairLocationFiles = async () => {
  try {
    // Read all location files
    const files = await fs.readdir(LOCATIONS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('copy'));
    
    let totalUpdated = 0;
    
    for (const file of jsonFiles) {
      const locationName = file.replace('.json', '');
      const locationPath = path.join(LOCATIONS_DIR, file);
      
      console.log(`Processing ${locationName}...`);
      
      const locationData = await fs.readJson(locationPath);
      
      if (!locationData.appraisers || !Array.isArray(locationData.appraisers)) {
        console.log(`No appraisers found in ${file}.`);
        continue;
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
          console.log(`🔴 Invalid image URL for ${appraiser.name}: ${appraiser.imageUrl}`);
          
          // Store the broken URL as oldImageUrl if it's not already there
          if (!appraiser.oldImageUrl && appraiser.imageUrl !== PLACEHOLDER_URL) {
            appraiser.oldImageUrl = appraiser.imageUrl;
          }
          
          // Set to placeholder
          appraiser.imageUrl = PLACEHOLDER_URL;
          updatedCount++;
        } else {
          console.log(`✅ Valid image URL for ${appraiser.name}: ${appraiser.imageUrl}`);
        }
      }
      
      if (updatedCount > 0) {
        await fs.writeJson(locationPath, locationData, { spaces: 2 });
        console.log(`Updated ${updatedCount} appraisers in ${file}.`);
        totalUpdated += updatedCount;
      } else {
        console.log(`No updates needed for ${file}.`);
      }
    }
    
    return totalUpdated;
  } catch (error) {
    console.error('Error repairing location files:', error.message);
    return 0;
  }
};

const main = async () => {
  try {
    console.log('Repairing image URLs in all location data...');
    
    const totalUpdated = await repairLocationFiles();
    
    console.log(`Repair complete! Updated ${totalUpdated} appraisers across all locations.`);
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
};

main(); 