import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
// Use a reliable public placeholder image
const DEFAULT_PLACEHOLDER_URL = 'https://placehold.co/300x300/e0e0e0/333333?text=Image+Unavailable';
const IMAGE_TIMEOUT = 8000; // 8 seconds timeout for image checks

// Check if an image URL is invalid due to known patterns
function isKnownBadPlaceholder(url) {
  return url && (
    url.includes('via.placeholder.com') || 
    url.includes('placeholder.com') ||
    url.includes('ik.imagekit.io/appraisily/placeholder-art-image.jpg')
  );
}

// Actively check if an image URL is accessible
async function isImageAccessible(url) {
  if (!url || !url.startsWith('http')) {
    return false;
  }
  
  try {
    // Add a timeout promise to handle cases where fetch might hang
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), IMAGE_TIMEOUT);
    });
    
    // Race the fetch against the timeout
    const response = await Promise.race([
      fetch(url, { 
        method: 'HEAD', 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }),
      timeoutPromise
    ]);
    
    if (!response.ok) {
      console.log(`❌ Image check failed for ${url}: HTTP status ${response.status}`);
      return false;
    }
    
    // Check content type to ensure it's an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.log(`❌ Not an image: ${url} (${contentType})`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Error checking image ${url}: ${error.message}`);
    return false;
  }
}

// Process all locations and fix appraiser images
async function fixPlaceholderImages() {
  console.log('🔍 Starting placeholder image fix...');
  let totalAppraisers = 0;
  let totalImages = 0;
  let totalFixed = 0;
  let totalChecked = 0;
  
  // Read all location files
  const locationFiles = fs.readdirSync(LOCATIONS_DIR)
    .filter(file => file.endsWith('.json'));
  
  for (const file of locationFiles) {
    const locationPath = path.join(LOCATIONS_DIR, file);
    const locationData = await fs.readJson(locationPath);
    const cityName = file.replace('.json', '');
    let updated = false;
    
    console.log(`\n📍 Processing ${cityName}...`);
    
    if (!locationData.appraisers || locationData.appraisers.length === 0) {
      console.log(`ℹ️ No appraisers found in ${file}`);
      continue;
    }
    
    totalAppraisers += locationData.appraisers.length;
    
    // Check each appraiser
    for (const appraiser of locationData.appraisers) {
      if (!appraiser.name) continue;
      
      totalImages++;
      
      const imageUrl = appraiser.imageUrl || appraiser.image;
      
      // Check if the current image URL is a known bad pattern
      if (isKnownBadPlaceholder(imageUrl)) {
        // Use the default placeholder
        appraiser.imageUrl = DEFAULT_PLACEHOLDER_URL;
        appraiser.image = DEFAULT_PLACEHOLDER_URL;
        
        console.log(`✅ Fixed known bad placeholder for: ${appraiser.name} (${cityName})`);
        totalFixed++;
        updated = true;
        continue;
      }
      
      // For ImageKit URLs, verify they are actually accessible
      if (imageUrl && imageUrl.includes('ik.imagekit.io')) {
        totalChecked++;
        const isAccessible = await isImageAccessible(imageUrl);
        
        if (!isAccessible) {
          // Replace with default placeholder if not accessible
          appraiser.imageUrl = DEFAULT_PLACEHOLDER_URL;
          appraiser.image = DEFAULT_PLACEHOLDER_URL;
          
          console.log(`✅ Fixed inaccessible ImageKit image for: ${appraiser.name} (${cityName})`);
          totalFixed++;
          updated = true;
        }
      }
    }
    
    // Save changes if any
    if (updated) {
      await fs.writeJson(locationPath, locationData, { spaces: 2 });
      console.log(`💾 Saved updates for ${cityName}`);
    }
  }
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`📋 Total appraisers: ${totalAppraisers}`);
  console.log(`🖼️ Total images checked: ${totalImages}`);
  console.log(`🔍 ImageKit URLs actively verified: ${totalChecked}`);
  console.log(`✨ Total placeholders fixed: ${totalFixed}`);
  console.log(`✅ Process completed successfully!`);
}

// Run the script
fixPlaceholderImages(); 