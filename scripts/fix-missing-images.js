import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

// Default placeholder image for missing images
const DEFAULT_PLACEHOLDER_IMAGE = 'https://ik.imagekit.io/appraisily/placeholder-art-image.jpg';
// ImageKit base URL for appraiser images
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/appraisily/appraiser-images';

// Counters for reporting
let totalAppraisers = 0;
let updatedImages = 0;

// Read all location JSON files
const locationFiles = fs.readdirSync(LOCATIONS_DIR)
  .filter(file => file.endsWith('.json') && !file.includes('copy') && !file.includes('lifecycle') && !file.includes('cors') && !file.includes('hugo'));

console.log(`Found ${locationFiles.length} location files to process`);

// Process each location file
locationFiles.forEach(file => {
  const locationFilePath = path.join(LOCATIONS_DIR, file);
  const locationData = JSON.parse(fs.readFileSync(locationFilePath, 'utf8'));
  const citySlug = file.replace('.json', '');
  let locationUpdated = false;

  // Skip if no appraisers
  if (!locationData.appraisers || !Array.isArray(locationData.appraisers)) {
    console.log(`No appraisers found in ${file}`);
    return;
  }

  // Process each appraiser
  locationData.appraisers.forEach(appraiser => {
    totalAppraisers++;
    
    // Ensure appraiser has an id
    if (!appraiser.id) {
      // Generate id based on name and city if missing
      const namePart = appraiser.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      appraiser.id = `${citySlug}-${namePart}`;
      locationUpdated = true;
    }
    
    // Check if imageUrl matches the expected pattern
    const hasProperImageUrl = appraiser.imageUrl && 
      (appraiser.imageUrl.includes('_') && 
      (appraiser.imageUrl.includes('?updatedAt=') || appraiser.imageUrl.includes('_V')));
    
    if (!hasProperImageUrl) {
      // Generate a timestamp for uniqueness
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 10);
      
      // Create a filename matching the image generator pattern
      const newImageFilename = `appraiser_${appraiser.id}_${timestamp}_V${randomId}.jpg`;
      const newImageUrl = `${IMAGEKIT_BASE_URL}/${newImageFilename}`;
      
      // If no imageUrl or imageUrl is using old pattern, update it
      if (!appraiser.imageUrl || 
          (appraiser.imageUrl && !hasProperImageUrl)) {
        // Keep old image URL as a backup
        if (appraiser.imageUrl) {
          appraiser.oldImageUrl = appraiser.imageUrl;
        }
        if (appraiser.image) {
          appraiser.oldImage = appraiser.image;
          // Delete the old image property - standardize on imageUrl
          delete appraiser.image;
        }
        
        // Update with new URL
        appraiser.imageUrl = newImageUrl;
        updatedImages++;
        locationUpdated = true;
      }
    } else if (appraiser.image && !appraiser.imageUrl) {
      // If has image but no imageUrl, move to imageUrl
      appraiser.imageUrl = appraiser.image;
      appraiser.oldImage = appraiser.image;
      delete appraiser.image;
      locationUpdated = true;
    }
  });

  // Save the file if any changes were made
  if (locationUpdated) {
    fs.writeFileSync(locationFilePath, JSON.stringify(locationData, null, 2));
    console.log(`Updated ${file}`);
  }
});

console.log(`
Processing complete:
- Total appraisers processed: ${totalAppraisers}
- Total image URLs updated: ${updatedImages}
`);

console.log(`
Next steps:
1. Run 'npm run rebuild-static' to rebuild the static files with the updated image URLs
2. Commit and push the changes
3. Rebuild and deploy the site
`); 