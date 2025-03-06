import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

// ImageKit base URL for appraiser images
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/appraisily/appraiser-images';

// Default placeholder image for missing images
const DEFAULT_PLACEHOLDER_IMAGE = 'https://ik.imagekit.io/appraisily/placeholder-art-image.jpg';

// Stats for the report
const stats = {
  totalAppraisers: 0,
  totalImagesChecked: 0,
  workingImages: 0,
  brokenImages: 0,
  placeholderImages: 0,
  fixedImages: 0,
  failedToFix: 0,
};

// Allow overriding the fix flag via command line
const SHOULD_FIX = process.argv.includes('--fix');

/**
 * Check if an image URL is accessible
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} - Whether the image is accessible
 */
async function isImageAccessible(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Check if an appraiser has a valid image
 * @param {Object} appraiser - The appraiser object
 * @returns {Promise<Object>} - The status of the appraiser's image
 */
async function checkAppraiserImage(appraiser) {
  stats.totalAppraisers++;
  
  // Determine the image URL to use
  let imageUrl = appraiser.imageUrl || appraiser.image;

  // Skip if no image URL is provided
  if (!imageUrl) {
    return { 
      appraiser, 
      status: 'missing', 
      message: 'No image URL provided' 
    };
  }

  stats.totalImagesChecked++;

  // Check if it's already the placeholder image
  if (imageUrl === DEFAULT_PLACEHOLDER_IMAGE) {
    stats.placeholderImages++;
    return { 
      appraiser, 
      status: 'placeholder', 
      message: 'Using placeholder image' 
    };
  }

  // Check if the image is accessible
  const isWorking = await isImageAccessible(imageUrl);

  if (isWorking) {
    stats.workingImages++;
    return { 
      appraiser, 
      status: 'ok', 
      message: 'Image is accessible' 
    };
  } else {
    stats.brokenImages++;
    return { 
      appraiser, 
      status: 'broken', 
      message: 'Image is not accessible' 
    };
  }
}

/**
 * Process all locations and check appraiser images
 */
async function processAllLocations() {
  console.log('Starting image check for all appraisers...');
  
  try {
    // Get all location files
    const locationFiles = fs.readdirSync(LOCATIONS_DIR)
      .filter(file => file.endsWith('.json') && !file.includes('copy') && !file.includes('lifecycle') && !file.includes('cors') && !file.includes('hugo'));

    console.log(`Found ${locationFiles.length} location files`);

    // Track all appraisers with issues
    const appraisersWithIssues = [];

    // Process each location file
    for (const [index, file] of locationFiles.entries()) {
      const locationPath = path.join(LOCATIONS_DIR, file);
      const locationData = JSON.parse(fs.readFileSync(locationPath, 'utf8'));
      const cityName = file.replace('.json', '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Skip if no appraisers
      if (!locationData.appraisers || locationData.appraisers.length === 0) {
        console.log(`Location ${cityName} has no appraisers.`);
        continue;
      }

      console.log(`[${index + 1}/${locationFiles.length}] Processing ${cityName} (${locationData.appraisers.length} appraisers)`);

      // Check each appraiser's image
      for (const appraiser of locationData.appraisers) {
        const result = await checkAppraiserImage(appraiser);

        // If there's an issue with the image, add to the list
        if (result.status !== 'ok') {
          appraisersWithIssues.push({
            ...result,
            location: cityName,
            fileName: file
          });
        }
      }
    }

    // Display results
    console.log('\n----- Image Check Results -----');
    console.log(`Total Appraisers: ${stats.totalAppraisers}`);
    console.log(`Total Images Checked: ${stats.totalImagesChecked}`);
    console.log(`Working Images: ${stats.workingImages}`);
    console.log(`Broken Images: ${stats.brokenImages}`);
    console.log(`Placeholder Images: ${stats.placeholderImages}`);
    
    // Display details of issues
    if (appraisersWithIssues.length > 0) {
      console.log('\n----- Appraisers With Image Issues -----');
      appraisersWithIssues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.appraiser.name} (${issue.location})`);
        console.log(`   ID: ${issue.appraiser.id}`);
        console.log(`   Status: ${issue.status}`);
        console.log(`   Message: ${issue.message}`);
        console.log(`   Image URL: ${issue.appraiser.imageUrl || issue.appraiser.image || 'N/A'}`);
      });

      // Suggest fixing the issues
      if (appraisersWithIssues.length > 0 && !SHOULD_FIX) {
        console.log('\nTo automatically fix these issues, run:');
        console.log('npm run generate-all-images');
        console.log('\nOr check each image individually by running:');
        console.log('npm run check-images');
      }
    } else {
      console.log('\n✅ All appraiser images are working correctly!');
    }

  } catch (error) {
    console.error('Error processing locations:', error);
  }
}

// Run the main function
processAllLocations().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
}); 