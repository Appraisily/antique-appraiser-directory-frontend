#!/usr/bin/env node

/**
 * Generate Antique Appraiser Images
 * 
 * This script generates professional profile images for antique appraisers
 * using the image generation service and updates the standardized JSON files.
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

// Image generation service URL
const IMAGE_SERVICE_URL = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';

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
 * Generate an image for a single appraiser
 */
async function generateImageForAppraiser(appraiser, cityName, stateName) {
  try {
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
  } catch (error) {
    log(`Error updating appraiser image: ${error.message}`, 'error');
  }
}

/**
 * Generate images for a specific number of appraisers
 */
async function generateImages(count = 3) {
  try {
    // Get list of all city files
    const cityFiles = (await fs.readdir(STANDARDIZED_DIR))
      .filter(file => file.endsWith('.json') && !file.includes('README'))
      .map(file => path.join(STANDARDIZED_DIR, file));
    
    log(`Found ${cityFiles.length} city files.`);
    
    // Randomly select 3 different cities
    const selectedCities = [];
    while (selectedCities.length < Math.min(count, cityFiles.length)) {
      const randomIndex = Math.floor(Math.random() * cityFiles.length);
      const cityFile = cityFiles[randomIndex];
      
      if (!selectedCities.includes(cityFile)) {
        selectedCities.push(cityFile);
      }
    }
    
    let processedCount = 0;
    
    // Process each selected city
    for (const cityFile of selectedCities) {
      // If we've reached the desired count, stop
      if (processedCount >= count) {
        break;
      }
      
      const cityName = path.basename(cityFile, '.json');
      log(`Processing ${cityName}...`);
      
      // Read the city data
      const cityData = await fs.readJson(cityFile);
      
      // Find the state name
      let stateName = '';
      if (cityData.appraisers.length > 0 && cityData.appraisers[0].address) {
        stateName = cityData.appraisers[0].address.state;
      }
      
      // If no appraisers in this city, skip
      if (!cityData.appraisers || cityData.appraisers.length === 0) {
        log(`No appraisers found in ${cityName}, skipping.`, 'warning');
        continue;
      }
      
      // Choose a random appraiser from this city
      const randomIndex = Math.floor(Math.random() * cityData.appraisers.length);
      const appraiser = cityData.appraisers[randomIndex];
      
      // Generate an image for this appraiser
      const imageUrl = await generateImageForAppraiser(appraiser, cityName, stateName);
      
      // If image generation was successful, update the JSON file
      if (imageUrl) {
        await updateAppraiserImage(cityFile, appraiser.id, imageUrl);
        processedCount++;
      }
    }
    
    log(`Successfully generated images for ${processedCount} appraisers.`, 'success');
  } catch (error) {
    log(`Error generating images: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the script
const count = process.argv[2] ? parseInt(process.argv[2], 10) : 3;
generateImages(count);