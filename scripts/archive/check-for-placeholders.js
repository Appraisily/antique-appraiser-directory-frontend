import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const PLACEHOLDER_IMAGE_URL = 'https://placehold.co/600x400?text=Art+Appraiser+Image';

async function checkForPlaceholders() {
  try {
    console.log('Checking for placeholder images across all locations...');
    
    // Read all JSON files from the locations directory
    const files = await fs.readdir(LOCATIONS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} location files.`);
    
    let locationsWithPlaceholders = [];
    let totalAppraisers = 0;
    let totalWithPlaceholder = 0;
    
    // Process each location file
    for (const file of jsonFiles) {
      const locationFile = path.join(LOCATIONS_DIR, file);
      const locationName = file.replace('.json', '');
      
      // Read and parse the JSON file
      const locationData = await fs.readJson(locationFile);
      const appraisers = locationData.appraisers || [];
      
      totalAppraisers += appraisers.length;
      
      // Find appraisers with placeholder images
      const appraisersWithPlaceholder = appraisers.filter(appraiser => {
        return (
          appraiser.imageUrl === PLACEHOLDER_IMAGE_URL ||
          appraiser.imageUrl?.includes('placeholder') ||
          !appraiser.imageUrl
        );
      });
      
      const count = appraisersWithPlaceholder.length;
      totalWithPlaceholder += count;
      
      if (count > 0) {
        locationsWithPlaceholders.push({
          location: locationName,
          count,
          total: appraisers.length,
          percentage: Math.round((count / appraisers.length) * 100)
        });
      }
    }
    
    // Sort locations by placeholder count (descending)
    locationsWithPlaceholders.sort((a, b) => b.count - a.count);
    
    // Print summary
    console.log('\n==== Placeholder Images Summary ====');
    console.log(`Total appraisers across all locations: ${totalAppraisers}`);
    console.log(`Total appraisers with placeholder images: ${totalWithPlaceholder} (${Math.round((totalWithPlaceholder / totalAppraisers) * 100)}%)`);
    console.log(`Locations with placeholders: ${locationsWithPlaceholders.length}`);
    
    console.log('\nLocations with placeholder images:');
    locationsWithPlaceholders.forEach(loc => {
      console.log(`- ${loc.location}: ${loc.count}/${loc.total} (${loc.percentage}%)`);
    });
    
  } catch (error) {
    console.error('Error checking for placeholders:', error.message);
  }
}

// Run the check
checkForPlaceholders(); 