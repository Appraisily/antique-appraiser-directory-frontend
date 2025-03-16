import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

// Placeholder image URL - this should be a valid and accessible image
const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/300x400?text=Art+Appraiser';

// Function to check if an image URL exists
async function checkImage(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to update the image URL in the location file
async function updateImageUrl(locationFile, appraiserId, newImageUrl) {
  try {
    const locationPath = path.join(LOCATIONS_DIR, locationFile);
    const locationData = await fs.readJson(locationPath);
    
    // Find the appraiser and update the imageUrl
    let updated = false;
    for (const appraiser of locationData.appraisers) {
      if (appraiser.id === appraiserId) {
        // Store the old URL for reference
        appraiser.oldImageUrl = appraiser.imageUrl;
        appraiser.imageUrl = newImageUrl;
        updated = true;
        break;
      }
    }
    
    if (updated) {
      // Write the updated data back to the file
      await fs.writeJson(locationPath, locationData, { spaces: 2 });
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`Error updating image URL in ${locationFile}:`, error.message);
    return false;
  }
}

// Main function to process all location files
async function processAllLocations() {
  try {
    console.log('Starting process to replace broken image URLs with placeholder...');
    
    // Get all location files
    const locationFiles = await fs.readdir(LOCATIONS_DIR);
    const jsonFiles = locationFiles.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} location files to process.`);
    
    let totalAppraisers = 0;
    let totalChecked = 0;
    let totalBroken = 0;
    let totalReplaced = 0;
    
    // Process each location file
    for (const [index, locationFile] of jsonFiles.entries()) {
      try {
        const locationPath = path.join(LOCATIONS_DIR, locationFile);
        const locationData = await fs.readJson(locationPath);
        const locationName = locationFile.replace('.json', '');
        
        console.log(`\nProcessing ${locationFile} (${index + 1}/${jsonFiles.length}) with ${locationData.appraisers?.length || 0} appraisers`);
        
        if (!locationData.appraisers || locationData.appraisers.length === 0) {
          console.log(`No appraisers found in ${locationFile}`);
          continue;
        }
        
        totalAppraisers += locationData.appraisers.length;
        
        // Process each appraiser in the location
        for (const appraiser of locationData.appraisers) {
          if (!appraiser.imageUrl) {
            console.log(`Appraiser ${appraiser.id || appraiser.name} has no imageUrl`);
            appraiser.imageUrl = PLACEHOLDER_IMAGE_URL;
            totalReplaced++;
            continue;
          }
          
          totalChecked++;
          
          // Check if the image is accessible
          const result = await checkImage(appraiser.imageUrl);
          
          if (!result.success) {
            console.log(`${appraiser.name} (${appraiser.id}): Image is broken. Status: ${result.status || 'Error: ' + result.error}`);
            totalBroken++;
            
            // Update the image URL with placeholder
            const updated = await updateImageUrl(locationFile, appraiser.id, PLACEHOLDER_IMAGE_URL);
            if (updated) {
              totalReplaced++;
              console.log(`Updated image URL for ${appraiser.name} (${appraiser.id})`);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing location file ${locationFile}:`, error.message);
      }
    }
    
    console.log('\nProcess complete:');
    console.log(`- Total appraisers processed: ${totalAppraisers}`);
    console.log(`- Total image URLs checked: ${totalChecked}`);
    console.log(`- Total broken images found: ${totalBroken}`);
    console.log(`- Total images replaced with placeholder: ${totalReplaced}`);
    
    console.log('\nNext steps:');
    console.log('1. Run `npm run rebuild-static` to rebuild the static files with the updated image URLs');
    console.log('2. Run `npm run build:with-image-validation` to build the site with the updated images');
    
  } catch (error) {
    console.error('Error in processAllLocations:', error.message);
  }
}

// Run the main function
processAllLocations().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 