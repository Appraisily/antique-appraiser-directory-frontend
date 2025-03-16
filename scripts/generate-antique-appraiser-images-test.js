#!/usr/bin/env node

/**
 * Generate Antique Appraiser Images (Test Version)
 * 
 * This script generates professional profile images for antique appraisers
 * in three specific cities: New York, Chicago, and San Francisco.
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

// Specific cities to process
const CITIES_TO_PROCESS = ['new-york', 'chicago', 'san-francisco'];

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
    
    log(`Sending request to image service with payload: ${JSON.stringify(payload, null, 2)}`);
    
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
 * Generate images for appraisers in specific cities
 */
async function generateImages() {
  try {
    const results = [];
    
    // Process each city
    for (const cityName of CITIES_TO_PROCESS) {
      const cityFile = path.join(STANDARDIZED_DIR, `${cityName}.json`);
      
      // Check if the city file exists
      if (!await fs.pathExists(cityFile)) {
        log(`City file not found: ${cityFile}`, 'error');
        continue;
      }
      
      log(`Processing ${cityName}...`);
      
      // Read the city data
      const cityData = await fs.readJson(cityFile);
      
      // If no appraisers in this city, skip
      if (!cityData.appraisers || cityData.appraisers.length === 0) {
        log(`No appraisers found in ${cityName}, skipping.`, 'warning');
        continue;
      }
      
      // Find the state name
      let stateName = '';
      if (cityData.appraisers.length > 0 && cityData.appraisers[0].address) {
        stateName = cityData.appraisers[0].address.state;
        
        // Convert state code to full name if needed
        if (stateName.length === 2) {
          const stateMap = {
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
            'WI': 'Wisconsin', 'WY': 'Wyoming'
          };
          
          if (stateMap[stateName]) {
            stateName = stateMap[stateName];
          }
        }
      }
      
      // Choose first appraiser from this city
      const appraiser = cityData.appraisers[0];
      
      // Generate an image for this appraiser
      const imageUrl = await generateImageForAppraiser(appraiser, cityName, stateName);
      
      // If image generation was successful, update the JSON file
      if (imageUrl) {
        const result = await updateAppraiserImage(cityFile, appraiser.id, imageUrl);
        if (result) {
          results.push(result);
        }
      }
    }
    
    // Print summary
    log(`Successfully generated images for ${results.length} appraisers:`, 'success');
    results.forEach((result, index) => {
      log(`${index + 1}. ${result.name} (${result.city}): ${result.imageUrl}`, 'success');
    });
    
    return results;
  } catch (error) {
    log(`Error generating images: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the script
generateImages();