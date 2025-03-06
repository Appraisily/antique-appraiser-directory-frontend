import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const IMAGE_GENERATION_API = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';
const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/300x400?text=Art+Appraiser';

// Helper function to sleep to avoid overwhelming the API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to generate a filename for the image
function generateImageFilename(appraiserId) {
  const timestamp = Date.now();
  const filename = `appraiser-${appraiserId}-${timestamp}.jpg`;
  return filename;
}

// Function to generate an image for an appraiser
async function generateImage(appraiser, cityName, retries = 0) {
  try {
    const appraiserId = appraiser.id;
    const specialties = appraiser.specialties || [];
    const specialty = specialties.length > 0 ? specialties[0] : 'art';
    
    // Generate a unique filename
    const filename = generateImageFilename(appraiserId);
    
    // Generate the prompt based on specialties
    const name = appraiser.name;
    const specialtiesText = specialties.join(', ').replace(/,([^,]*)$/, ' and$1');
    const prompt = `Professional portrait of ${name}, an art appraiser specializing in ${specialtiesText} in ${cityName}. neutral background, high quality portrait, professional lighting.`;
    
    console.log(`Generating image for ${name} (ID: ${appraiserId})`);
    console.log(`Prompt: ${prompt}`);
    
    // Make the API call to the image generation service
    const response = await fetch(IMAGE_GENERATION_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        filename,
        style: 'professional',
        appraiser: {
          id: appraiserId,
          name
        },
        location: cityName
      }),
    });
    
    // Get the response as text first
    const responseText = await response.text();
    let data;
    
    try {
      // Try to parse as JSON
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse API response:', responseText);
      throw new Error(`API returned invalid JSON: ${responseText.substring(0, 100)}...`);
    }
    
    if (!response.ok) {
      // Check for 402 payment required error specifically
      if (response.status === 402 || 
          (data.error && data.error.includes('402')) || 
          (data.error && data.error.toLowerCase().includes('payment required'))) {
        console.error('\n======= BLACK FOREST AI PAYMENT ISSUE DETECTED =======');
        console.error('The image generation service has exhausted its credits or requires payment.');
        console.error('Will use existing images as fallbacks.');
        console.error('Error details:', data.error || 'Unknown error');
        console.error('====================================================\n');
        throw new Error('Payment required for image generation service');
      }
      
      // For 500 errors that mention 402, they're likely payment issues as well
      if (response.status === 500 && data.error && data.error.includes('402')) {
        console.error('\n======= BLACK FOREST AI PAYMENT ISSUE DETECTED =======');
        console.error('The image generation service has exhausted its credits or requires payment.');
        console.error('Will use existing images as fallbacks.');
        console.error('Error details:', data.error || 'Unknown error');
        console.error('====================================================\n');
        throw new Error('Payment required for image generation service (via 500 error)');
      }
      
      throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
    }
    
    // Extract the image URL from the response
    const imageUrl = data.data?.imageUrl || data.imageUrl;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from API');
    }
    
    console.log(`Successfully generated image: ${imageUrl}`);
    return imageUrl;
    
  } catch (error) {
    console.error(`Error generating image for ${appraiser.name}:`, error.message);
    
    // Handle retry logic
    if (retries < 2 && !error.message.includes('Payment required')) {
      console.log(`Retrying (${retries + 1}/2)...`);
      await sleep(2000); // Wait 2 seconds before retrying
      return generateImage(appraiser, cityName, retries + 1);
    }
    
    return null;
  }
}

// Function to collect all existing valid images from JSON files
async function collectExistingImages() {
  console.log('Collecting existing images to use as fallbacks...');
  const imageUrls = [];
  
  try {
    const files = await fs.readdir(LOCATIONS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const locationPath = path.join(LOCATIONS_DIR, file);
      const locationData = await fs.readJson(locationPath);
      
      if (locationData.appraisers && Array.isArray(locationData.appraisers)) {
        for (const appraiser of locationData.appraisers) {
          if (appraiser.imageUrl && 
              !appraiser.imageUrl.includes('placeholder') && 
              !appraiser.imageUrl.includes('via.placeholder.com')) {
            imageUrls.push(appraiser.imageUrl);
          }
        }
      }
    }
    
    console.log(`Found ${imageUrls.length} existing images to use as fallbacks.`);
    return imageUrls;
  } catch (error) {
    console.error('Error collecting existing images:', error.message);
    return [];
  }
}

// Get a random image from the collection
function getRandomImage(imageUrls) {
  if (imageUrls.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * imageUrls.length);
  return imageUrls[randomIndex];
}

// Function to update the appraiser data in the location file
async function updateAppraiserImage(locationFile, appraiser, newImageUrl) {
  try {
    const locationPath = path.join(LOCATIONS_DIR, locationFile);
    const locationData = await fs.readJson(locationPath);
    
    // Find the appraiser and update the imageUrl
    let updated = false;
    for (const a of locationData.appraisers) {
      if (a.id === appraiser.id) {
        // Save the old image URL if it's not already saved
        if (!a.oldImageUrl) {
          a.oldImageUrl = a.imageUrl || PLACEHOLDER_IMAGE_URL;
        }
        a.imageUrl = newImageUrl;
        updated = true;
        break;
      }
    }
    
    if (updated) {
      // Write the updated data back to the file
      await fs.writeJson(locationPath, locationData, { spaces: 2 });
      console.log(`Updated image URL for ${appraiser.id} in ${locationFile}`);
      return true;
    } else {
      console.warn(`Appraiser ${appraiser.id} not found in ${locationFile}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating appraiser data in ${locationFile}:`, error.message);
    return false;
  }
}

// Main function to process all locations
async function processAllLocations() {
  console.log('Starting process to replace placeholder images with generated images...');
  
  try {
    // Get command line arguments for targeted processing
    const args = process.argv.slice(2);
    const targetLocation = args[0] ? args[0].toLowerCase() : null;
    
    // Read all JSON files from the locations directory
    let files = await fs.readdir(LOCATIONS_DIR);
    files = files.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${files.length} location files.`);
    
    // Filter for the target location if specified
    if (targetLocation) {
      const targetFile = `${targetLocation}.json`;
      if (files.includes(targetFile)) {
        console.log(`Targeting only location: ${targetLocation}`);
        files = [targetFile];
      } else {
        console.log(`Warning: Location "${targetLocation}" not found. Available locations: ${files.map(f => f.replace('.json', '')).join(', ')}`);
        return;
      }
    }
    
    console.log(`Processing ${files.length} location files...`);
    
    let totalAppraisers = 0;
    let totalWithPlaceholder = 0;
    let totalProcessed = 0;
    let totalGenerated = 0;
    let totalUpdated = 0;
    let paymentIssueDetected = false;
    let existingImages = [];
    
    // Process each location file
    for (const file of files) {
      const locationFile = path.join(LOCATIONS_DIR, file);
      const locationName = file.replace('.json', '');
      
      try {
        // Read and parse the JSON file
        const locationData = await fs.readJson(locationFile);
        const appraisers = locationData.appraisers || [];
        
        console.log(`\nProcessing ${locationName}.json (${appraisers.length} appraisers)`);
        
        totalAppraisers += appraisers.length;
        
        // Find appraisers with placeholder images
        const appraisersWithPlaceholder = appraisers.filter(appraiser => {
          return (
            appraiser.imageUrl === PLACEHOLDER_IMAGE_URL ||
            appraiser.imageUrl?.includes('placeholder') ||
            !appraiser.imageUrl
          );
        });
        
        totalWithPlaceholder += appraisersWithPlaceholder.length;
        
        console.log(`Found ${appraisersWithPlaceholder.length} appraisers with placeholder images in ${locationName}`);
        
        // Process each appraiser with a placeholder
        for (const appraiser of appraisersWithPlaceholder) {
          totalProcessed++;
          
          // Wait a bit to avoid overwhelming the API
          await sleep(1000);
          
          try {
            console.log(`\nProcessing appraiser: ${appraiser.name} (${appraiser.id})`);
            
            let imageUrl = null;
            
            // Try to generate a new image if we don't have payment issues yet
            if (!paymentIssueDetected) {
              imageUrl = await generateImage(appraiser, locationName);
            }
            
            // If generation failed or we have payment issues, use an existing image
            if (!imageUrl) {
              if (existingImages.length === 0) {
                console.log('Collecting existing images for fallback use...');
                existingImages = await collectExistingImages();
              }
              
              if (existingImages.length > 0) {
                imageUrl = getRandomImage(existingImages);
                console.log(`Using fallback image from collection: ${imageUrl}`);
              } else {
                console.log('No fallback images available, keeping placeholder.');
                continue;
              }
            } else {
              totalGenerated++;
            }
            
            // Update the appraiser data
            const updated = await updateAppraiserImage(file, appraiser, imageUrl);
            if (updated) {
              totalUpdated++;
            }
          } catch (error) {
            if (error.message.includes('Payment required')) {
              paymentIssueDetected = true;
              console.log('Payment issue detected - switching to fallback images');
              
              // If we don't have the existing images yet, collect them now
              if (existingImages.length === 0) {
                existingImages = await collectExistingImages();
              }
            }
            console.error(`Failed to process appraiser ${appraiser.name}:`, error.message);
          }
        }
        
      } catch (error) {
        console.error(`Error processing location ${locationName}:`, error.message);
      }
    }
    
    // Print summary
    console.log('\n==== Image Replacement Summary ====');
    console.log(`Total appraisers: ${totalAppraisers}`);
    console.log(`Appraisers with placeholder images: ${totalWithPlaceholder}`);
    console.log(`Appraisers processed: ${totalProcessed}`);
    console.log(`New images generated: ${totalGenerated}`);
    console.log(`Appraiser records updated with fallback images: ${totalUpdated - totalGenerated}`);
    console.log(`Total appraiser records updated: ${totalUpdated}`);
    
    if (paymentIssueDetected) {
      console.log('\n======= FALLBACK MODE WAS USED =======');
      console.log('The image generation service requires payment or has exceeded its quota.');
      console.log('Used existing images as fallbacks for some or all requests.');
      console.log('========================================\n');
    }
    
    console.log('\nNext steps:');
    console.log('1. Rebuild static files: npm run build:static');
    console.log('2. Build the site with updated images: npm run build:production');
    
  } catch (error) {
    console.error('Error processing locations:', error.message);
  }
}

// Run the main function
processAllLocations().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 