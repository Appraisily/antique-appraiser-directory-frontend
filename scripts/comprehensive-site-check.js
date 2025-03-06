import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const DIST_DIR = path.join(__dirname, '../dist');
const TIMEOUT_MS = 5000;

// Check if an image URL is valid (can be accessed)
const checkImageUrl = async (url) => {
  try {
    // If it's a local placeholder or not a full URL, skip external validation
    if (!url || url.startsWith('/images/') || !url.startsWith('http')) {
      return { valid: true, status: 'local', message: 'Local image' };
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Store the status for reporting
      const statusCode = response.status;
      const valid = statusCode >= 200 && statusCode < 300;
      
      return { 
        valid, 
        status: statusCode, 
        message: valid ? 'OK' : `HTTP Error ${statusCode}`
      };
    } catch (fetchError) {
      return { 
        valid: false, 
        status: 'error', 
        message: fetchError.message 
      };
    }
  } catch (error) {
    return { 
      valid: false, 
      status: 'error', 
      message: `General error: ${error.message}` 
    };
  }
};

// Check if a location page exists in the built site
const checkLocationPage = async (locationName) => {
  const pagePath = path.join(DIST_DIR, 'location', locationName, 'index.html');
  try {
    const exists = await fs.pathExists(pagePath);
    return {
      exists,
      path: pagePath
    };
  } catch (error) {
    return {
      exists: false,
      path: pagePath,
      error: error.message
    };
  }
};

// Check for missing important fields in appraiser data
const checkAppraiserData = (appraiser) => {
  const missingFields = [];
  
  // Check for empty or missing fields
  if (!appraiser.rating && appraiser.rating !== 0) missingFields.push('rating');
  if (!appraiser.phone) missingFields.push('phone');
  if (!appraiser.website) missingFields.push('website');
  if (!appraiser.specialties || appraiser.specialties.length === 0) missingFields.push('specialties');
  if (!appraiser.services_offered || appraiser.services_offered.length === 0) missingFields.push('services_offered');
  if (!appraiser.certifications || appraiser.certifications.length === 0) missingFields.push('certifications');
  if (!appraiser.years_in_business) missingFields.push('years_in_business');
  if (!appraiser.pricing) missingFields.push('pricing');
  
  return {
    id: appraiser.id,
    name: appraiser.name,
    missingFields: missingFields,
    hasMissingData: missingFields.length > 0
  };
};

// Main function to analyze all locations
const analyzeAllLocations = async () => {
  try {
    // Results storage
    const results = {
      imageResults: [],
      missingDataResults: [],
      locationPageResults: [],
      summary: {
        totalAppraisers: 0,
        totalImages: 0,
        brokenImages: 0,
        appraisersWithMissingData: 0,
        missingLocationPages: 0
      }
    };
    
    // Read all location files
    const files = await fs.readdir(LOCATIONS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const locationName = file.replace('.json', '');
      const locationPath = path.join(LOCATIONS_DIR, file);
      
      console.log(`\nProcessing ${locationName}...`);
      
      // Check if location page exists
      const locationPageCheck = await checkLocationPage(locationName);
      results.locationPageResults.push({
        location: locationName,
        ...locationPageCheck
      });
      
      if (!locationPageCheck.exists) {
        results.summary.missingLocationPages++;
        console.log(`❌ Location page for ${locationName} does not exist at ${locationPageCheck.path}`);
      }
      
      // Read and process location data
      const locationData = await fs.readJson(locationPath);
      
      if (!locationData.appraisers || !Array.isArray(locationData.appraisers)) {
        console.log(`No appraisers found in ${file}.`);
        continue;
      }
      
      results.summary.totalAppraisers += locationData.appraisers.length;
      
      // Check each appraiser
      for (const appraiser of locationData.appraisers) {
        // Check image
        if (appraiser.imageUrl) {
          results.summary.totalImages++;
          const imageCheck = await checkImageUrl(appraiser.imageUrl);
          
          if (!imageCheck.valid && imageCheck.status !== 'local') {
            results.summary.brokenImages++;
            console.log(`🔴 Broken image for ${appraiser.name} (${locationName}): ${appraiser.imageUrl} - ${imageCheck.message}`);
          }
          
          results.imageResults.push({
            location: locationName,
            appraiser: appraiser.name,
            id: appraiser.id,
            imageUrl: appraiser.imageUrl,
            ...imageCheck
          });
        }
        
        // Check for missing data
        const dataCheck = checkAppraiserData(appraiser);
        if (dataCheck.hasMissingData) {
          results.summary.appraisersWithMissingData++;
          console.log(`⚠️ Missing data for ${appraiser.name} (${locationName}): ${dataCheck.missingFields.join(', ')}`);
          
          results.missingDataResults.push({
            location: locationName,
            appraiser: appraiser.name,
            ...dataCheck
          });
        }
      }
    }
    
    // Save results to file
    const resultsPath = path.join(__dirname, '../site-analysis-report.json');
    await fs.writeJson(resultsPath, results, { spaces: 2 });
    console.log(`\nAnalysis complete! Results saved to ${resultsPath}`);
    
    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total Appraisers: ${results.summary.totalAppraisers}`);
    console.log(`Total Images: ${results.summary.totalImages}`);
    console.log(`Broken Images: ${results.summary.brokenImages}`);
    console.log(`Appraisers With Missing Data: ${results.summary.appraisersWithMissingData}`);
    console.log(`Missing Location Pages: ${results.summary.missingLocationPages}`);
    
    return results;
  } catch (error) {
    console.error('Error analyzing locations:', error);
    return null;
  }
};

// Run the analysis
analyzeAllLocations().then(() => {
  console.log('Done!');
}).catch(error => {
  console.error('Script failed:', error);
}); 