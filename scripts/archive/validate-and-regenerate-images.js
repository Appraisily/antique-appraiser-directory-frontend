import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const IMAGE_CACHE_FILE = path.join(__dirname, '../src/data/image-cache.json');
const IMAGE_GEN_API = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';
const MAX_IMAGES_TO_GENERATE = 20; // Generate 20 images per run
const PLACEHOLDER_URL = '/images/placeholder-appraiser.jpg';

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load all appraisers data
const loadAllAppraisers = async () => {
  const appraisers = [];
  
  try {
    // Read all location files
    const files = await fs.readdir(LOCATIONS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('copy'));
    
    for (const file of jsonFiles) {
      const locationPath = path.join(LOCATIONS_DIR, file);
      const locationData = await fs.readJson(locationPath);
      const locationName = file.replace('.json', '');
      
      if (locationData.appraisers && Array.isArray(locationData.appraisers)) {
        for (const appraiser of locationData.appraisers) {
          if (appraiser.id) {
            // Add the appraiser with its location name
            appraisers.push({
              ...appraiser,
              locationName
            });
          }
        }
      }
    }
    
    return appraisers;
  } catch (error) {
    console.error('Error loading appraisers:', error.message);
    return [];
  }
};

// Check if an image URL is valid (can be accessed)
const checkImageUrl = async (url) => {
  try {
    // If it's a placeholder, it's not valid
    if (url === PLACEHOLDER_URL) {
      return false;
    }
    
    if (!url || !url.startsWith('http')) {
      return false;
    }
    
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.log(`Error checking image URL ${url}: ${error.message}`);
    return false;
  }
};

// Load image cache
const loadImageCache = async () => {
  try {
    if (await fs.pathExists(IMAGE_CACHE_FILE)) {
      const cacheData = await fs.readJson(IMAGE_CACHE_FILE);
      return cacheData;
    }
    return {};
  } catch (error) {
    console.error('Error loading image cache:', error.message);
    return {};
  }
};

// Save image cache
const saveImageCache = async (cache) => {
  try {
    await fs.writeJson(IMAGE_CACHE_FILE, cache, { spaces: 2 });
    console.log('Image cache saved successfully.');
    return true;
  } catch (error) {
    console.error('Error saving image cache:', error.message);
    return false;
  }
};

// Generate image with the improved prompt format
const generateImage = async (appraiser, locationName) => {
  try {
    // Create a detailed description from appraiser data
    const specialties = appraiser.specialties?.join(', ') || '';
    const certifications = appraiser.certifications?.join(', ') || '';
    const yearsInBusiness = appraiser.years_in_business || '';
    
    // New prompt format
    const details = `${appraiser.name} based in ${locationName}${specialties ? `, specializing in ${specialties}` : ''}${certifications ? `, certified in ${certifications}` : ''}${yearsInBusiness ? ` with ${yearsInBusiness}` : ''}.`;
    
    const prompt = `An image to promote business: Professional portrait photograph of an art appraiser named ${appraiser.name}, a professional art specialist ${details} The image should show them in a professional setting with fine art visible in the background.`;
    
    console.log(`Using prompt: ${prompt}`);
    
    const response = await fetch(IMAGE_GEN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        style: 'realistic',
        appraiser: {
          id: appraiser.id,
          name: appraiser.name,
          location: locationName
        }
      }),
    });
    
    const data = await response.json();
    
    if (data.success && data.imageUrl) {
      console.log(`Successfully generated image for ${appraiser.name}`);
      return {
        success: true,
        imageUrl: data.imageUrl,
        originalUrl: data.originalUrl,
        prompt: prompt
      };
    } else {
      console.error(`Error generating image for ${appraiser.name}: ${data.error || 'Unknown error'}`);
      return { success: false, error: data.error || 'Unknown error' };
    }
  } catch (error) {
    console.error(`Error generating image for ${appraiser.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Update appraiser data in JSON file
const updateAppraiserImage = async (appraiser, imageUrl, locationName) => {
  try {
    const locationPath = path.join(LOCATIONS_DIR, `${locationName}.json`);
    const locationData = await fs.readJson(locationPath);
    
    // Find and update the appraiser
    let updated = false;
    if (locationData.appraisers && Array.isArray(locationData.appraisers)) {
      for (let i = 0; i < locationData.appraisers.length; i++) {
        if (locationData.appraisers[i].id === appraiser.id) {
          // Store old image URL if it exists and is not a placeholder
          if (locationData.appraisers[i].imageUrl && 
              locationData.appraisers[i].imageUrl !== PLACEHOLDER_URL) {
            locationData.appraisers[i].oldImageUrl = locationData.appraisers[i].imageUrl;
          }
          
          // Update image URL
          locationData.appraisers[i].imageUrl = imageUrl;
          updated = true;
          break;
        }
      }
    }
    
    if (updated) {
      await fs.writeJson(locationPath, locationData, { spaces: 2 });
      console.log(`Updated image URL for ${appraiser.name} in ${locationName}.json`);
      return true;
    } else {
      console.error(`Could not find appraiser ${appraiser.name} in ${locationName}.json`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating appraiser data for ${appraiser.name}: ${error.message}`);
    return false;
  }
};

// Main function
const main = async () => {
  try {
    console.log('Starting validation and regeneration of appraiser images...');
    
    // Load all appraisers
    const appraisers = await loadAllAppraisers();
    
    if (appraisers.length === 0) {
      console.log('No appraisers found. Nothing to do.');
      return;
    }
    
    console.log(`Found ${appraisers.length} total appraisers.`);
    
    // Load image cache
    const imageCache = await loadImageCache();
    console.log(`Loaded image cache with ${Object.keys(imageCache).length} entries.`);
    
    // Identify appraisers with invalid image URLs
    const appraisersWithInvalidImages = [];
    
    for (const appraiser of appraisers) {
      const isValid = await checkImageUrl(appraiser.imageUrl);
      if (!isValid) {
        appraisersWithInvalidImages.push(appraiser);
      }
    }
    
    console.log(`Found ${appraisersWithInvalidImages.length} appraisers with invalid or missing images.`);
    
    // Process appraisers with invalid images up to MAX_IMAGES_TO_GENERATE
    let successCount = 0;
    let processedCount = 0;
    
    // Process a limited number of appraisers per run
    const appraisersToProcess = appraisersWithInvalidImages.slice(0, MAX_IMAGES_TO_GENERATE);
    
    for (const appraiser of appraisersToProcess) {
      processedCount++;
      
      // Check if we already have a cached image for this appraiser
      if (imageCache[appraiser.id] && await checkImageUrl(imageCache[appraiser.id].imageUrl)) {
        console.log(`Using cached image for ${appraiser.name} (${appraiser.id})`);
        
        // Update the appraiser with the cached image URL
        const updated = await updateAppraiserImage(
          appraiser, 
          imageCache[appraiser.id].imageUrl, 
          appraiser.locationName
        );
        
        if (updated) {
          successCount++;
        }
        
        continue;
      }
      
      // Generate a new image
      console.log(`Generating image for ${appraiser.name} (${appraiser.id}) in ${appraiser.locationName}...`);
      const result = await generateImage(appraiser, appraiser.locationName);
      
      if (result.success) {
        // Update the appraiser data
        const updated = await updateAppraiserImage(
          appraiser, 
          result.imageUrl, 
          appraiser.locationName
        );
        
        if (updated) {
          successCount++;
          
          // Add to cache
          imageCache[appraiser.id] = {
            appraiserId: appraiser.id,
            imageUrl: result.imageUrl,
            originalUrl: result.originalUrl,
            prompt: result.prompt,
            cached: true,
            timestamp: new Date().toISOString()
          };
          
          // Save the cache after each successful generation
          await saveImageCache(imageCache);
        }
        
        // Add a small delay to avoid overwhelming the API
        await sleep(2000);
      }
    }
    
    console.log(`\nImage validation and regeneration complete!`);
    console.log(`Successfully updated ${successCount} out of ${processedCount} processed appraisers.`);
    console.log(`${appraisersWithInvalidImages.length - processedCount} invalid images remain to be processed in future runs.`);
    console.log(`The image cache now contains ${Object.keys(imageCache).length} entries.`);
    
  } catch (error) {
    console.error('An error occurred during image validation and regeneration:', error.message);
  }
};

// Run the script
main(); 