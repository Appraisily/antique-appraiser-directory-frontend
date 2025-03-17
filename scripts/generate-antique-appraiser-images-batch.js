#!/usr/bin/env node

/**
 * Generate Antique Appraiser Images (Batch Version)
 * 
 * This script generates professional profile images for all antique appraisers
 * in the standardized data, processing a specified batch size at a time.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fetch from 'node-fetch';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');
const TRACKING_FILE = path.join(ROOT_DIR, 'image-generation-progress.json');

// Image generation service URL
const IMAGE_SERVICE_URL = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';

// Default batch size
const DEFAULT_BATCH_SIZE = 5;

// Log with color and timestamp
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toISOString();
  let coloredMessage;

  switch (type) {
    case 'warning':
      coloredMessage = chalk.yellow(message);
      break;
    case 'error':
      coloredMessage = chalk.red(message);
      break;
    case 'success':
      coloredMessage = chalk.green(message);
      break;
    default:
      coloredMessage = chalk.blue(message);
  }

  console.log(`[${timestamp}] ${coloredMessage}`);
}

/**
 * State abbreviation to state name mapping
 */
const STATE_MAP = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

/**
 * Get or initialize the tracking data
 */
async function getTrackingData() {
  try {
    if (await fs.pathExists(TRACKING_FILE)) {
      return await fs.readJson(TRACKING_FILE);
    } else {
      const data = {
        totalAppraisers: 0,
        processedAppraisers: 0,
        cities: {},
        lastProcessed: null,
        startTime: new Date().toISOString(),
        completedAppraisers: []
      };
      await fs.writeJson(TRACKING_FILE, data, { spaces: 2 });
      return data;
    }
  } catch (error) {
    log(`Error reading tracking data: ${error.message}`, 'error');
    return {
      totalAppraisers: 0,
      processedAppraisers: 0,
      cities: {},
      lastProcessed: null,
      startTime: new Date().toISOString(),
      completedAppraisers: []
    };
  }
}

/**
 * Update the tracking data
 */
async function updateTrackingData(data) {
  try {
    data.lastProcessed = new Date().toISOString();
    await fs.writeJson(TRACKING_FILE, data, { spaces: 2 });
  } catch (error) {
    log(`Error updating tracking data: ${error.message}`, 'error');
  }
}

/**
 * Generate an image for a single appraiser
 */
async function generateImageForAppraiser(appraiser, cityName, stateName) {
  try {
    // Convert state code to full name if needed
    if (stateName.length === 2 && STATE_MAP[stateName]) {
      stateName = STATE_MAP[stateName];
    }
    
    log(`Generating image for ${appraiser.name} in ${cityName}, ${stateName}...`);
    
    const payload = {
      appraiser: {
        id: appraiser.id,
        name: appraiser.name,
        specialties: appraiser.expertise.specialties,
        city: cityName,
        state: stateName
      },
      customPrompt: `Make a photorealistic image of an antique appraiser located in ${cityName}, ${stateName}`
    };
    
    log(`Sending request to image service with payload...`);
    
    const response = await fetch(IMAGE_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate image: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Image generation failed: ${data.error || 'Unknown error'}`);
    }
    
    log(`Successfully generated image for ${appraiser.name}: ${data.data.imageUrl}`, 'success');
    
    return data.data.imageUrl;
  } catch (error) {
    log(`Error generating image for ${appraiser.id}: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Update the appraiser's image URL in the standardized JSON file
 */
async function updateAppraiserImage(cityFile, appraiserId, imageUrl) {
  try {
    // Read the standardized JSON file
    const data = await fs.readJson(cityFile);
    
    // Find the appraiser by ID
    const appraiserIndex = data.appraisers.findIndex(a => a.id === appraiserId);
    
    if (appraiserIndex === -1) {
      throw new Error(`Appraiser with ID ${appraiserId} not found in ${cityFile}`);
    }
    
    // Update the image URL
    data.appraisers[appraiserIndex].imageUrl = imageUrl;
    
    // Write the updated JSON back to the file
    await fs.writeJson(cityFile, data, { spaces: 2 });
    
    log(`Updated image URL for ${appraiserId} in ${cityFile}`, 'success');
    
    return {
      city: path.basename(cityFile, '.json'),
      appraiserId,
      name: data.appraisers[appraiserIndex].name,
      imageUrl
    };
  } catch (error) {
    log(`Error updating appraiser image: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Get all appraisers in the standardized data
 */
async function getAllAppraisers() {
  const appraisers = [];
  
  // Get list of all city files
  const cityFiles = (await fs.readdir(STANDARDIZED_DIR))
    .filter(file => file.endsWith('.json') && !file.includes('README'))
    .map(file => path.join(STANDARDIZED_DIR, file));
  
  // Process each city file
  for (const cityFile of cityFiles) {
    const cityName = path.basename(cityFile, '.json');
    try {
      // Read the city data
      const cityData = await fs.readJson(cityFile);
      
      // If no appraisers in this city, skip
      if (!cityData.appraisers || cityData.appraisers.length === 0) {
        continue;
      }
      
      // Add each appraiser to the list
      cityData.appraisers.forEach(appraiser => {
        appraisers.push({
          id: appraiser.id,
          name: appraiser.name,
          city: cityName,
          cityFile,
          state: appraiser.address?.state || '',
          existing: appraiser.imageUrl
        });
      });
    } catch (error) {
      log(`Error reading city file ${cityFile}: ${error.message}`, 'error');
    }
  }
  
  return appraisers;
}

/**
 * Check which appraisers need images
 */
async function checkAppraisersNeedingImages() {
  try {
    const allAppraisers = await getAllAppraisers();
    const forceRegenerateAll = process.argv.includes('--all');

    const needsImage = allAppraisers.filter(appraiser => {
      if (forceRegenerateAll) {
        return true; // Force regenerate all images
      }
      
      // If the image URL contains a placeholder path like "appraiser_chicago-" 
      // or is from our ImageKit folder, it's a generated image
      const hasPlaceholder = appraiser.existing && 
        (appraiser.existing.includes('appraiser_') || 
         appraiser.existing.includes('ik.imagekit.io/appraisily'));
      
      return !hasPlaceholder;
    });
    
    log(`Found ${allAppraisers.length} total appraisers.`);
    log(`${needsImage.length} appraisers need images.`);
    
    return {
      total: allAppraisers,
      needsImage
    };
  } catch (error) {
    log(`Error checking appraisers needing images: ${error.message}`, 'error');
    return { total: [], needsImage: [] };
  }
}

/**
 * Generate images for a batch of appraisers
 */
async function generateImagesForBatch(batchSize = DEFAULT_BATCH_SIZE) {
  try {
    // Get the tracking data
    const trackingData = await getTrackingData();
    
    // Check which appraisers need images
    const { total, needsImage } = await checkAppraisersNeedingImages();
    
    // Update the tracking data with the total count
    trackingData.totalAppraisers = total.length;
    await updateTrackingData(trackingData);
    
    // If no appraisers need images, we're done
    if (needsImage.length === 0) {
      log('All appraisers already have images. Nothing to do.', 'success');
      return [];
    }
    
    // Filter out any appraisers that have already been processed
    const toProcess = needsImage.filter(appraiser => 
      !trackingData.completedAppraisers.includes(appraiser.id)
    );
    
    // Select the batch to process
    const batch = toProcess.slice(0, batchSize);
    
    // If no appraisers to process in this batch, we're done
    if (batch.length === 0) {
      log('No more appraisers to process. All batches completed.', 'success');
      return [];
    }
    
    log(`Processing batch of ${batch.length} appraisers...`);
    
    const results = [];
    
    // Process each appraiser in the batch
    for (const appraiser of batch) {
      // Generate the image
      const imageUrl = await generateImageForAppraiser(
        { id: appraiser.id, name: appraiser.name, expertise: { specialties: [] } },
        appraiser.city,
        appraiser.state
      );
      
      // If image generation was successful, update the JSON file
      if (imageUrl) {
        const result = await updateAppraiserImage(appraiser.cityFile, appraiser.id, imageUrl);
        if (result) {
          results.push(result);
          
          // Update the tracking data
          trackingData.processedAppraisers++;
          trackingData.completedAppraisers.push(appraiser.id);
          await updateTrackingData(trackingData);
        }
      }
    }
    
    // Print summary
    log(`Successfully generated images for ${results.length} appraisers in this batch.`, 'success');
    log(`Total progress: ${trackingData.processedAppraisers}/${trackingData.totalAppraisers} appraisers processed.`, 'success');
    
    return results;
  } catch (error) {
    log(`Error generating images for batch: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Main function to run the batch generator
 */
async function main() {
  // Get the batch size from the command line arguments
  const batchSize = process.argv[2] ? parseInt(process.argv[2], 10) : DEFAULT_BATCH_SIZE;
  
  log(`Starting batch image generation with batch size ${batchSize}...`);
  
  // Generate images for the batch
  const results = await generateImagesForBatch(batchSize);
  
  // Print the results
  if (results.length > 0) {
    log('Successfully generated the following images:', 'success');
    results.forEach((result, index) => {
      log(`${index + 1}. ${result.name} (${result.city}): ${result.imageUrl}`, 'success');
    });
  }
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error.message}`, 'error');
  process.exit(1);
});