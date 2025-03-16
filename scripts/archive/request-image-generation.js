import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

// Replace with your actual image generation API endpoint
const IMAGE_GENERATION_API = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';

// Function to generate a standardized image filename for the image generator
function generateImageFilename(appraiser, citySlug) {
  // Create a base filename using the appraiser ID
  const baseFilename = `appraiser_${appraiser.id}`;
  
  // Add timestamp and random ID to match the pattern
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  
  // Final filename in the format: appraiser_[id]_[timestamp]_V[randomId].jpg
  return `${baseFilename}_${timestamp}_V${randomId}.jpg`;
}

// Function to request image generation with a specific filename
async function requestImageGeneration(prompt, style, filename, appraiser_id = null, locationName = null) {
  try {
    console.log(`Requesting image generation for: ${filename}`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Style: ${style}`);
    
    // Create the request body
    const requestBody = {
      prompt,
      filename,
      style,
      debug: true
    };
    
    // Add appraiser info if available
    if (appraiser_id) {
      requestBody.appraiser = { 
        id: appraiser_id,
        name: appraiser_id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      };
    }
    
    // Add location if available
    if (locationName) {
      requestBody.location = locationName;
    }
    
    // Make the actual API call to the image generation service
    const response = await fetch(IMAGE_GENERATION_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse API response as JSON:', responseText);
      throw new Error(`API returned invalid JSON: ${responseText.substring(0, 100)}...`);
    }
    
    if (!response.ok) {
      // Enhanced error handling with root cause
      const errorMessage = data.error || responseText;
      const rootCause = data.rootCause || 'Unknown';
      
      if (rootCause.includes('402') || rootCause.includes('Payment Required')) {
        throw new Error(`API payment required error: ${rootCause}. The image generation service has exceeded its quota or requires payment.`);
      } else {
        throw new Error(`API error (${response.status}): ${errorMessage}. Root cause: ${rootCause}`);
      }
    }
    
    console.log(`Image generated successfully: ${data.data?.imageUrl || data.imageUrl || 'URL not returned'}`);
    
    return {
      success: true,
      imageUrl: data.data?.imageUrl || data.imageUrl || `https://ik.imagekit.io/appraisily/appraiser-images/${filename}`,
      filename: filename
    };
  } catch (error) {
    console.error('Error generating image:', error.message);
    
    // Check if this is a payment/quota issue
    if (error.message.includes('402') || error.message.includes('Payment Required')) {
      console.error('\n======= IMAGE GENERATION SERVICE PAYMENT ISSUE =======');
      console.error('The image generation service has exhausted its credits or requires payment.');
      console.error('Please check the Black Forest AI account status and billing information.');
      console.error('=========================================================\n');
    }
    
    return { success: false, error: error.message };
  }
}

// Example usage
async function main() {
  console.log("Image Generation Request");
  console.log("===============================");
  
  // Get command line arguments
  const args = process.argv.slice(2);
  let targetLocation = null;
  let targetAppraiserId = null;
  
  if (args.length >= 1) {
    targetLocation = args[0];
  }
  
  if (args.length >= 2) {
    targetAppraiserId = args[1];
  }
  
  // Read location files
  const locationFiles = fs.readdirSync(LOCATIONS_DIR)
    .filter(file => file.endsWith('.json') && !file.includes('copy'));
  
  if (locationFiles.length === 0) {
    console.error("No location files found");
    return;
  }
  
  // Filter to target location if specified
  let filesToProcess = locationFiles;
  if (targetLocation) {
    const matchingFile = `${targetLocation}.json`;
    if (locationFiles.includes(matchingFile)) {
      filesToProcess = [matchingFile];
      console.log(`Processing specific location: ${targetLocation}`);
    } else {
      console.error(`Location file not found: ${matchingFile}`);
      return;
    }
  } else {
    console.log(`No specific location provided. Will use sample location: ${locationFiles[0].replace('.json', '')}`);
    filesToProcess = [locationFiles[0]];
  }
  
  // Process each selected file
  for (const locationFile of filesToProcess) {
    const citySlug = locationFile.replace('.json', '');
    const locationData = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, locationFile)));
    
    if (!locationData.appraisers || locationData.appraisers.length === 0) {
      console.log(`No appraisers found in ${locationFile}`);
      continue;
    }
    
    // Filter to specific appraiser if ID is provided
    let appraisersToProcess = locationData.appraisers;
    if (targetAppraiserId) {
      const matchingAppraiser = locationData.appraisers.find(a => a.id === targetAppraiserId);
      if (matchingAppraiser) {
        appraisersToProcess = [matchingAppraiser];
        console.log(`Processing specific appraiser: ${matchingAppraiser.name} (ID: ${matchingAppraiser.id})`);
      } else {
        console.error(`Appraiser ID not found: ${targetAppraiserId}`);
        continue;
      }
    } else {
      console.log(`No specific appraiser ID provided. Will process the first appraiser.`);
      appraisersToProcess = [locationData.appraisers[0]];
    }
    
    // Process each selected appraiser
    for (const appraiser of appraisersToProcess) {
      console.log(`\nProcessing appraiser: ${appraiser.name} (ID: ${appraiser.id})`);
      console.log(`City: ${citySlug}`);
      
      // Generate a filename for this appraiser
      const filename = generateImageFilename(appraiser, citySlug);
      
      // Create a prompt based on the appraiser's specialties
      const specialties = Array.isArray(appraiser.specialties) 
        ? appraiser.specialties.join(', ') 
        : appraiser.specialties || 'fine art';
      
      const prompt = `Professional art appraiser specializing in ${specialties}. Business professional attire, neutral background, high quality portrait.`;
      const style = 'realistic';
      
      // Request image generation
      const result = await requestImageGeneration(prompt, style, filename, appraiser.id, citySlug);
      
      console.log("\nImage Generation Result:");
      console.log(result);
      
      // Update the appraiser data if successful
      if (result.success && result.imageUrl) {
        // Find and update the appraiser in the location data
        const appraiserToUpdate = locationData.appraisers.find(a => a.id === appraiser.id);
        if (appraiserToUpdate) {
          appraiserToUpdate.imageUrl = result.imageUrl;
          appraiserToUpdate.oldImageUrl = appraiserToUpdate.oldImageUrl || result.imageUrl;
          
          // Write the updated data back to the file
          fs.writeFileSync(
            path.join(LOCATIONS_DIR, locationFile),
            JSON.stringify(locationData, null, 2)
          );
          
          console.log(`Updated image URL for ${appraiser.id} in ${locationFile}`);
        }
      }
    }
  }
  
  console.log("\nNext steps:");
  console.log("1. Run `npm run rebuild-static` to rebuild the static files with the updated image URLs");
  console.log("2. Run `npm run build:with-image-validation` to build the site with the updated images");
}

main().catch(console.error); 