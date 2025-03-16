import fs from 'fs-extra';
import path from 'path';
import { URL } from 'url';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const DEFAULT_PLACEHOLDER_IMAGE = 'https://ik.imagekit.io/appraisily/placeholder-art-image.jpg';
const IMAGE_TIMEOUT = 8000; // 8 seconds

// Colors for generating personalized placeholders
const BACKGROUND_COLORS = ['4A90E2', 'B8E986', 'F5A623', 'D0021B', '7ED321', '9013FE', '50E3C2', 'F8E71C', 'B8E986', 'BD10E0'];
const TEXT_COLORS = ['FFFFFF', '000000', '333333', 'FFFFFF', '000000', 'FFFFFF', '000000', '000000', '000000', 'FFFFFF'];

// Check if an image URL is accessible
async function checkImageUrl(url) {
  if (!url || url.includes('placeholder') || !url.startsWith('http')) {
    return { valid: false, reason: 'Invalid URL format' };
  }
  
  try {
    // Parse the URL to handle malformed URLs
    const parsedUrl = new URL(url);
    
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
      return { valid: false, reason: `HTTP status: ${response.status}` };
    }
    
    // Check content type to ensure it's an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return { valid: false, reason: `Not an image: ${contentType}` };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error.message };
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
  
  const colorIndex = (appraiser.name.length + city.length) % BACKGROUND_COLORS.length;
  const backgroundColor = BACKGROUND_COLORS[colorIndex];
  const textColor = TEXT_COLORS[colorIndex];
  
  return `https://via.placeholder.com/300x300/${backgroundColor}/${textColor}?text=${initials}`;
}

// Update the appraiser's image URL in the static HTML files
async function updateAppraiserHtmlFiles(appraiser, oldImageUrl, newImageUrl) {
  const distDir = path.join(__dirname, '../dist');
  
  // Skip if appraiser has no ID
  if (!appraiser.id) {
    console.log(`⚠️ Skipping HTML update for ${appraiser.name} - no ID found`);
    return false;
  }
  
  const appraiserPagePath = path.join(distDir, 'appraiser', appraiser.id, 'index.html');
  
  if (fs.existsSync(appraiserPagePath)) {
    try {
      let htmlContent = fs.readFileSync(appraiserPagePath, 'utf8');
      
      // Replace the old image URL with the new one
      const updatedHtml = htmlContent.replace(new RegExp(oldImageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newImageUrl);
      
      // Write the updated HTML back to the file
      fs.writeFileSync(appraiserPagePath, updatedHtml, 'utf8');
      console.log(`📄 Updated HTML file for: ${appraiser.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating HTML file for ${appraiser.name}: ${error.message}`);
      return false;
    }
  }
  
  return false;
}

// Process all location data files
async function validateAllImages() {
  console.log('🔍 Starting comprehensive image validation...');
  let totalAppraisers = 0;
  let totalImages = 0;
  let totalFixed = 0;
  let details = [];
  
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
      
      totalImages++;
      const oldImageUrl = appraiser.imageUrl || appraiser.image || '';
      
      // Check if the current image URL is valid
      const imageCheck = await checkImageUrl(oldImageUrl);
      
      if (!imageCheck.valid) {
        // Generate a personalized placeholder
        const newPlaceholder = generatePlaceholderImage(appraiser, cityName);
        const oldUrl = oldImageUrl;
        
        // Update the appraiser data
        appraiser.imageUrl = newPlaceholder;
        
        // Add details to the report
        details.push({
          name: appraiser.name,
          city: cityName,
          oldUrl: oldUrl,
          newUrl: newPlaceholder,
          reason: imageCheck.reason
        });
        
        console.log(`✅ Fixed image for: ${appraiser.name} (${cityName}) - ${imageCheck.reason}`);
        totalFixed++;
        updated = true;
        
        // Try to update the HTML file if it exists
        await updateAppraiserHtmlFiles(appraiser, oldUrl, newPlaceholder);
      }
    }
    
    // Save changes if any
    if (updated) {
      fs.writeFileSync(locationPath, JSON.stringify(locationData, null, 2), 'utf8');
      console.log(`💾 Saved updates for ${cityName}`);
    }
  }
  
  // Write detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalAppraisers,
      totalImages,
      totalFixed
    },
    details
  };
  
  fs.writeFileSync(path.join(__dirname, '../image-validation-report.json'), JSON.stringify(report, null, 2), 'utf8');
  
  console.log('\n📊 SUMMARY:');
  console.log(`📋 Total appraisers: ${totalAppraisers}`);
  console.log(`🖼️ Total images processed: ${totalImages}`);
  console.log(`🛠️ Total images fixed: ${totalFixed}`);
  console.log(`📝 Detailed report saved to image-validation-report.json`);
}

// Update build HTML to handle broken images
async function injectImageErrorHandling() {
  console.log('\n🔧 Adding image error handling to generated HTML files...');
  
  const distDir = path.join(__dirname, '../dist');
  
  // Process appraiser pages
  const appraiserDir = path.join(distDir, 'appraiser');
  if (!fs.existsSync(appraiserDir)) {
    console.log('❌ Appraiser directory not found');
    return;
  }
  
  const cities = fs.readdirSync(appraiserDir);
  let updatedCount = 0;
  
  for (const city of cities) {
    const cityDir = path.join(appraiserDir, city);
    if (fs.statSync(cityDir).isDirectory()) {
      const indexFile = path.join(cityDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        let html = fs.readFileSync(indexFile, 'utf8');
        
        // Check if error handling is already present
        if (!html.includes('img.onerror')) {
          // Insert error handling script before closing </body> tag
          const errorHandlingScript = `
  <!-- Image error handling script -->
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        img.onerror = function() {
          console.log('Replacing broken image:', this.src);
          this.onerror = null;
          this.src = 'https://ik.imagekit.io/appraisily/placeholder-art-image.jpg';
        };
      });
    });
  </script>
</body>`;
          
          html = html.replace('</body>', errorHandlingScript);
          fs.writeFileSync(indexFile, html, 'utf8');
          updatedCount++;
        }
      }
    }
  }
  
  console.log(`✅ Added image error handling to ${updatedCount} HTML files`);
}

// Run both validation and error handling
async function main() {
  console.log('🚀 Starting comprehensive image validation and fixing process...');
  await validateAllImages();
  await injectImageErrorHandling();
  console.log('✅ Process completed successfully!');
}

// Execute the script
main().catch(error => {
  console.error('❌ Error executing script:', error);
  process.exit(1);
}); 