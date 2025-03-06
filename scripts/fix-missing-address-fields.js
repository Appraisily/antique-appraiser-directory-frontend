import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

async function fixMissingAddressFields() {
  console.log('🔍 Checking for missing address fields in all appraisers...');
  let totalAppraisers = 0;
  let totalFixed = 0;
  
  // Read all location files
  const locationFiles = fs.readdirSync(LOCATIONS_DIR)
    .filter(file => file.endsWith('.json'));
  
  for (const file of locationFiles) {
    const locationPath = path.join(LOCATIONS_DIR, file);
    const locationData = JSON.parse(fs.readFileSync(locationPath, 'utf8'));
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
      
      // Check if address field is missing
      if (!appraiser.address) {
        // Create an address from city and state
        if (appraiser.city && appraiser.state) {
          appraiser.address = `${appraiser.city}, ${appraiser.state}`;
          console.log(`✅ Added address for: ${appraiser.name} (${cityName})`);
          totalFixed++;
          updated = true;
        } else {
          // Use the location city name as fallback
          const cityProper = cityName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          appraiser.address = `${cityProper}, Unknown`;
          console.log(`⚠️ Added fallback address for: ${appraiser.name} (${cityName})`);
          totalFixed++;
          updated = true;
        }
      }
    }
    
    // Save changes if any
    if (updated) {
      fs.writeFileSync(locationPath, JSON.stringify(locationData, null, 2), 'utf8');
      console.log(`💾 Saved updates for ${cityName}`);
    }
  }
  
  console.log('\n📊 SUMMARY:');
  console.log(`📋 Total appraisers: ${totalAppraisers}`);
  console.log(`🛠️ Total appraisers fixed: ${totalFixed}`);
}

// Execute the script
fixMissingAddressFields()
  .then(() => console.log('✅ Process completed successfully!'))
  .catch(error => {
    console.error('❌ Error executing script:', error);
    process.exit(1);
  }); 