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
const MAX_IMAGES_TO_GENERATE = Infinity; // Process all appraisers instead of just 10

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load appraiser data with placeholders
const loadAppraisersWithPlaceholders = async () => {
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
        // Find appraisers with placeholder images
        locationData.appraisers.forEach(appraiser => {
          if (
            (!appraiser.imageUrl || 
            appraiser.imageUrl.includes('placeholder') || 
            appraiser.imageUrl.includes('placehold.co')) &&
            appraiser.id // Only include appraisers with an ID
          ) {
            appraisers.push({
              ...appraiser,
              locationName: locationName
            });
          }
        });
      }
    }
    
    console.log(`Found ${appraisers.length} appraisers with placeholder images and valid IDs.`);
    return appraisers;
  } catch (error) {
    console.error('Error loading appraiser data:', error.message);
    return [];
  }
};

// Load or create image cache
const loadImageCache = async () => {
  try {
    if (await fs.pathExists(IMAGE_CACHE_FILE)) {
      return await fs.readJson(IMAGE_CACHE_FILE);
    }
  } catch (error) {
    console.error('Error loading image cache:', error.message);
  }
  
  // Create empty cache if it doesn't exist
  await fs.ensureDir(path.dirname(IMAGE_CACHE_FILE));
  await fs.writeJson(IMAGE_CACHE_FILE, {}, { spaces: 2 });
  return {};
};

// Save the image cache
const saveImageCache = async (cache) => {
  try {
    await fs.writeJson(IMAGE_CACHE_FILE, cache, { spaces: 2 });
    console.log('Image cache saved successfully.');
  } catch (error) {
    console.error('Error saving image cache:', error.message);
  }
};

// Generate an image for an appraiser
const generateImage = async (appraiser, locationName) => {
  try {
    // Format location name for the prompt
    const formattedLocation = locationName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Get appraiser specialties
    const specialties = Array.isArray(appraiser.specialties) && appraiser.specialties.length > 0
      ? appraiser.specialties.join(', ')
      : 'fine art';
    
    // Create a more descriptive prompt
    const prompt = `Generate a professional portrait photograph of an art appraiser named ${appraiser.name}, a professional art specialist based in ${formattedLocation}. They specialize in ${specialties}. The image should show them in a professional setting with fine art visible in the background.`;
    
    // Create the payload for the API
    const payload = {
      appraiser: {
        id: appraiser.id,
        name: appraiser.name,
        specialties: Array.isArray(appraiser.specialties) ? appraiser.specialties : [],
        city: appraiser.city || formattedLocation.split(',')[0] || '',
        state: appraiser.state || ''
      },
      customPrompt: prompt
    };
    
    console.log(`Generating image for ${appraiser.name} (${appraiser.id}) in ${formattedLocation}...`);
    console.log(`Using prompt: ${payload.customPrompt}`);
    
    // Call the image generation API
    const response = await fetch(IMAGE_GEN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    // Parse the response
    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse API response:', responseText);
      throw new Error(`API returned invalid JSON: ${responseText.substring(0, 100)}...`);
    }
    
    if (!response.ok) {
      throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
    }
    
    if (!data.success) {
      throw new Error(`API indicated failure: ${data.error || 'Unknown error'}`);
    }
    
    console.log(`Successfully generated image for ${appraiser.name}`);
    return {
      appraiserId: appraiser.id,
      imageUrl: data.data?.imageUrl,
      originalUrl: data.data?.originalUrl,
      prompt: data.data?.prompt,
      cached: data.data?.cached || false,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error generating image for ${appraiser.name}:`, error.message);
    return null;
  }
};

// Update the appraiser's image URL in the location file
const updateAppraiserImage = async (appraiser, imageUrl, locationName) => {
  try {
    const locationFile = path.join(LOCATIONS_DIR, `${locationName}.json`);
    const locationData = await fs.readJson(locationFile);
    
    // Find and update the appraiser
    let updated = false;
    
    if (locationData.appraisers && Array.isArray(locationData.appraisers)) {
      locationData.appraisers = locationData.appraisers.map(a => {
        if (a.id === appraiser.id) {
          // Preserve the old image URL if not already preserved
          return {
            ...a,
            oldImageUrl: a.oldImageUrl || a.imageUrl || '',
            imageUrl: imageUrl
          };
        }
        return a;
      });
      
      // Save the updated data
      await fs.writeJson(locationFile, locationData, { spaces: 2 });
      console.log(`Updated image URL for ${appraiser.name} in ${locationName}.json`);
      return true;
    }
  } catch (error) {
    console.error(`Error updating appraiser image in ${locationName}.json:`, error.message);
  }
  
  return false;
};

// Main function
const main = async () => {
  try {
    console.log('Starting image generation for ALL placeholder images...');
    
    // Load appraisers with placeholder images
    const appraisers = await loadAppraisersWithPlaceholders();
    
    if (appraisers.length === 0) {
      console.log('No placeholder images found. Nothing to do.');
      return;
    }
    
    console.log(`Found ${appraisers.length} appraisers with placeholder images and valid IDs.`);
    
    // Load image cache
    const imageCache = await loadImageCache();
    console.log(`Loaded image cache with ${Object.keys(imageCache).length} entries.`);
    
    // Process all appraisers instead of limiting to MAX_IMAGES_TO_GENERATE
    let successCount = 0;
    let processedCount = 0;
    
    // Process all appraisers in the array
    for (const appraiser of appraisers) {
      processedCount++;
      
      // Check if we already have a cached image for this appraiser
      if (imageCache[appraiser.id]) {
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
      const imageData = await generateImage(appraiser, appraiser.locationName);
      
      if (imageData && imageData.imageUrl) {
        // Cache the image data
        imageCache[appraiser.id] = imageData;
        
        // Update the appraiser
        const updated = await updateAppraiserImage(
          appraiser,
          imageData.imageUrl,
          appraiser.locationName
        );
        
        if (updated) {
          successCount++;
        }
        
        // Save the cache after each successful generation
        await saveImageCache(imageCache);
        
        // Add a small delay to avoid overwhelming the API
        await sleep(2000);
      }
    }
    
    console.log(`\nImage generation complete!`);
    console.log(`Successfully updated ${successCount} out of ${processedCount} total appraisers with placeholders.`);
    console.log(`The image cache now contains ${Object.keys(imageCache).length} entries.`);
    
  } catch (error) {
    console.error('An error occurred during image generation:', error.message);
  }
};

// Run the script
main();