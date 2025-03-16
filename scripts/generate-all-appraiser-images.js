#!/usr/bin/env node

/**
 * Generate Images for ALL Antique Appraisers
 * 
 * This script generates professional profile images for all antique appraisers
 * in the standardized data, processing them in batches.
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

// Default batch size (adjust as needed based on API rate limits)
const DEFAULT_BATCH_SIZE = 10;

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
        specialties: appraiser.expertise?.specialties || [],
        city: cityName,
        state: stateName
      },
      customPrompt: `Make a photorealistic image of an antique appraiser located in ${cityName}, ${stateName}`
    };
    
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
    .filter(file => file.endsWith('.json') && !file.includes('README') && !file.includes('copy'))
    .map(file => path.join(STANDARDIZED_DIR, file));
  
  log(`Found ${cityFiles.length} city files to process.`);
  
  // Process each city file
  for (const cityFile of cityFiles) {
    const cityName = path.basename(cityFile, '.json');
    try {
      // Read the city data
      const cityData = await fs.readJson(cityFile);
      
      // If no appraisers in this city, skip
      if (!cityData.appraisers || cityData.appraisers.length === 0) {
        log(`No appraisers found in ${cityName}, skipping.`, 'warning');
        continue;
      }
      
      log(`Processing ${cityData.appraisers.length} appraisers in ${cityName}...`);
      
      // Add each appraiser to the list
      cityData.appraisers.forEach(appraiser => {
        appraisers.push({
          id: appraiser.id,
          name: appraiser.name,
          city: cityName,
          cityFile,
          state: appraiser.address?.state || '',
          existing: appraiser.imageUrl,
          expertise: {
            specialties: appraiser.expertise?.specialties || []
          }
        });
      });
    } catch (error) {
      log(`Error reading city file ${cityFile}: ${error.message}`, 'error');
    }
  }
  
  return appraisers;
}

/**
 * Generate images for all appraisers in batches
 */
async function generateAllImages(batchSize = DEFAULT_BATCH_SIZE) {
  try {
    // Get the tracking data
    const trackingData = await getTrackingData();
    
    // Get all appraisers
    const allAppraisers = await getAllAppraisers();
    
    // Update the tracking data with the total count
    trackingData.totalAppraisers = allAppraisers.length;
    await updateTrackingData(trackingData);
    
    // Filter out any appraisers that have already been processed
    const toProcess = allAppraisers.filter(appraiser => 
      !trackingData.completedAppraisers.includes(appraiser.id)
    );
    
    log(`Found ${allAppraisers.length} total appraisers.`);
    log(`${toProcess.length} appraisers left to process.`);
    
    // If no appraisers to process, we're done
    if (toProcess.length === 0) {
      log('All appraisers already have images. Nothing to do.', 'success');
      return;
    }
    
    // Process in batches
    let processedCount = 0;
    const totalBatches = Math.ceil(toProcess.length / batchSize);
    
    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      // Select the batch to process
      const startIndex = batchNum * batchSize;
      const endIndex = Math.min(startIndex + batchSize, toProcess.length);
      const batch = toProcess.slice(startIndex, endIndex);
      
      log(`Processing batch ${batchNum + 1}/${totalBatches} with ${batch.length} appraisers...`);
      
      const results = [];
      
      // Process each appraiser in the batch
      for (const appraiser of batch) {
        // Check if appraiser already has a valid image URL
        if (appraiser.existing && 
            !appraiser.existing.includes('placeholder') && 
            !appraiser.existing.includes('undefined')) {
          log(`Appraiser ${appraiser.name} already has an image: ${appraiser.existing}`, 'info');
          trackingData.completedAppraisers.push(appraiser.id);
          continue;
        }
        
        // Generate the image
        const imageUrl = await generateImageForAppraiser(
          appraiser,
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
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Print batch summary
      processedCount += results.length;
      log(`Batch ${batchNum + 1}/${totalBatches} completed.`, 'success');
      log(`Generated ${results.length} images in this batch.`, 'success');
      log(`Total progress: ${trackingData.processedAppraisers}/${trackingData.totalAppraisers} appraisers processed.`, 'success');
      
      // List the generated images
      if (results.length > 0) {
        log('Successfully generated the following images:', 'success');
        results.forEach((result, index) => {
          log(`${index + 1}. ${result.name} (${result.city}): ${result.imageUrl}`, 'success');
        });
      }
      
      // Add a longer delay between batches to avoid overwhelming the API
      if (batchNum < totalBatches - 1) {
        log(`Waiting for 5 seconds before processing the next batch...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Print final summary
    log(`Image generation complete.`, 'success');
    log(`Successfully generated images for ${processedCount} appraisers.`, 'success');
    log(`Total processed: ${trackingData.processedAppraisers}/${trackingData.totalAppraisers}`, 'success');
  } catch (error) {
    log(`Error generating images: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Main function
async function main() {
  // Get the batch size from the command line arguments
  const batchSize = process.argv[2] ? parseInt(process.argv[2], 10) : DEFAULT_BATCH_SIZE;
  
  log(`Starting image generation for all appraisers with batch size ${batchSize}...`);
  
  // Generate images for all appraisers
  await generateAllImages(batchSize);
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error.message}`, 'error');
  process.exit(1);
});