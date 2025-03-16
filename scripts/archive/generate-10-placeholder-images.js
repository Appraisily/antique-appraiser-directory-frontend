import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const DEFAULT_PLACEHOLDER_URL = 'https://ik.imagekit.io/appraisily/placeholder-art-image.jpg';

// ImageKit transformation parameters to create unique placeholder images
const TEXT_COLORS = ['000000', 'ffffff', '3498db', '2ecc71', 'e74c3c', 'f39c12', '9b59b6', '1abc9c'];
const BG_COLORS = ['f2f2f2', '333333', 'e8f4f8', 'eafaf1', 'fdedec', 'fef9e7', 'f5eef8', 'e8f8f5'];

// Check if an image URL is accessible
async function checkImageUrl(url) {
  if (!url || url.includes('placeholder') || !url.startsWith('http')) {
    return false;
  }
  
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    return response.ok;
  } catch (error) {
    console.log(`❌ Error checking image URL: ${url} - ${error.message}`);
    return false;
  }
}

// Generate a personalized placeholder image URL with initials
function generatePlaceholderImage(appraiser, city) {
  const initials = appraiser.name
    .split(' ')
    .map(part => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  
  const colorIndex = Math.floor(Math.random() * TEXT_COLORS.length);
  const textColor = TEXT_COLORS[colorIndex];
  const bgColor = BG_COLORS[colorIndex];
  
  // Create a personalized placeholder using ImageKit transformations
  return `https://ik.imagekit.io/appraisily/placeholder-art-image.jpg?tr=bg-${bgColor},l-text,i-${initials},fs-80,fc-${textColor},lpad-30`;
}

// Process all locations and fix appraiser images
async function generatePlaceholderImages() {
  console.log('Starting placeholder image generation...');
  let totalAppraisers = 0;
  let totalImages = 0;
  let totalFixed = 0;
  
  // Read all location files
  const locationFiles = fs.readdirSync(LOCATIONS_DIR)
    .filter(file => file.endsWith('.json'));
  
  for (const file of locationFiles) {
    const locationPath = path.join(LOCATIONS_DIR, file);
    const locationData = JSON.parse(fs.readFileSync(locationPath, 'utf8'));
    const cityName = file.replace('.json', '');
    let updated = false;
    
    console.log(`\nProcessing ${cityName}...`);
    
    if (!locationData.appraisers || locationData.appraisers.length === 0) {
      console.log(`No appraisers found in ${file}`);
      continue;
    }
    
    totalAppraisers += locationData.appraisers.length;
    
    // Check each appraiser
    for (const appraiser of locationData.appraisers) {
      if (!appraiser.name) continue;
      
      totalImages++;
      
      const imageUrl = appraiser.imageUrl || appraiser.image;
      
      // Check if the current image URL is valid
      const isValid = await checkImageUrl(imageUrl);
      
      if (!isValid) {
        // Generate a personalized placeholder
        const newPlaceholder = generatePlaceholderImage(appraiser, cityName);
        appraiser.imageUrl = newPlaceholder;
        
        console.log(`✅ Generated placeholder for: ${appraiser.name} (${cityName})`);
        totalFixed++;
        updated = true;
      }
    }
    
    // Save changes if any
    if (updated) {
      fs.writeFileSync(locationPath, JSON.stringify(locationData, null, 2), 'utf8');
      console.log(`Saved updates for ${cityName}`);
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total appraisers: ${totalAppraisers}`);
  console.log(`Total images: ${totalImages}`);
  console.log(`Total placeholders generated: ${totalFixed}`);
  console.log(`Done!`);
}

// Run the script
generatePlaceholderImages();