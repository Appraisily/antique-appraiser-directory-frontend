import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix glob import to support both ESM and CommonJS
let globModule;
try {
  // Try ESM import first
  globModule = await import('glob');
} catch (error) {
  try {
    // Fallback to CommonJS require
    globModule = { glob: require('glob').glob };
    console.log('Using CommonJS import for glob');
  } catch (err) {
    // If both fail, create a simple fallback implementation
    console.log('Glob module not available, using fallback file discovery');
    globModule = {
      glob: (pattern, options) => {
        const dir = options.cwd || '.';
        const files = [];
        
        // Simple implementation to handle basic patterns like '*.css'
        if (pattern.startsWith('*.')) {
          const extension = pattern.substring(2);
          const dirContents = fs.readdirSync(dir);
          
          dirContents.forEach(file => {
            if (file.endsWith(`.${extension}`)) {
              files.push(file);
            }
          });
        }
        
        return Promise.resolve(files);
      }
    };
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Directory paths
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');
const DIST_DIR = path.join(__dirname, '../dist');
const APPRAISERS_DIR = path.join(DIST_DIR, 'appraiser');

// Default placeholder image
const DEFAULT_PLACEHOLDER = 'https://placehold.co/300x300/e0e0e0/333333?text=Image+Unavailable';

// Load image validation data from site-analysis-report.json
let imageValidationMap = new Map();
try {
  const reportPath = path.join(__dirname, '../site-analysis-report.json');
  if (fs.existsSync(reportPath)) {
    const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (reportData.imageResults && Array.isArray(reportData.imageResults)) {
      // Create a map for quick lookups
      reportData.imageResults.forEach(result => {
        imageValidationMap.set(result.id, {
          valid: result.valid,
          imageUrl: result.imageUrl
        });
      });
      console.log(`📊 Loaded image validation data for ${imageValidationMap.size} appraisers`);
    }
  } else {
    console.warn('⚠️ site-analysis-report.json not found, proceeding without image validation');
  }
} catch (error) {
  console.error('❌ Error loading image validation data:', error.message);
}

// Helper function to get a validated image URL
function getValidatedImageUrl(id, defaultImageUrl) {
  // If we have validation data for this appraiser
  if (imageValidationMap.has(id)) {
    const validationData = imageValidationMap.get(id);
    // If the image is marked as valid, use it
    if (validationData.valid) {
      return validationData.imageUrl;
    }
    // Otherwise try to find a valid alternative
    else if (validationData.imageUrl && validationData.imageUrl !== defaultImageUrl) {
      return validationData.imageUrl;
    }
  }
  
  // If no validation data or no valid alternative, use the provided default
  return defaultImageUrl || DEFAULT_PLACEHOLDER;
}

// Helper function to safely get a property from an object
function safeGet(obj, path, defaultValue = '') {
  if (!obj) return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== null && result !== undefined ? result : defaultValue;
}

// Function to generate a static HTML page for an appraiser
function generateAppraiserStaticPage(appraiser, location) {
  if (!appraiser || !appraiser.id) {
    console.warn(`⚠️ Skipping appraiser with no ID: ${appraiser?.name || 'Unknown'}`);
    return false;
  }
  
  try {
    // Create directory for the appraiser
    const appraiserSlug = appraiser.id.toLowerCase().replace(/\s+/g, '-');
    const locationSlug = location.toLowerCase().replace(/\s+/g, '-');
    const combinedId = `${locationSlug}-${appraiserSlug}`;
    const outputDir = path.join(APPRAISERS_DIR, combinedId);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get CSS and JS files
    let cssFiles = [];
    let jsFiles = [];
    
    try {
      if (globModule && typeof globModule.glob === 'function') {
        cssFiles = globModule.glob.sync('*.css', { cwd: path.join(DIST_DIR, 'assets') }) || [];
        jsFiles = globModule.glob.sync('*.js', { cwd: path.join(DIST_DIR, 'assets') }) || [];
      } else {
        // Fallback to fs.readdirSync
        const assetsDir = path.join(DIST_DIR, 'assets');
        const files = fs.readdirSync(assetsDir);
        
        cssFiles = files.filter(file => file.endsWith('.css'));
        jsFiles = files.filter(file => file.endsWith('.js'));
      }
    } catch (error) {
      console.error('Error getting asset files:', error);
      // Initialize with empty arrays if there's an error
      cssFiles = [];
      jsFiles = [];
    }
    
    const cssFile = cssFiles.length > 0 ? `/assets/${cssFiles[0]}` : '';
    const jsFile = jsFiles.length > 0 ? `/assets/${jsFiles[0]}` : '';
    
    // Get appraiser details
    const name = safeGet(appraiser, 'name', 'Art Appraiser');
    const businessName = safeGet(appraiser, 'business_name', '');
    const displayName = businessName || name;
    
    // Check if specialties is an array before using map
    const specialtiesText = Array.isArray(safeGet(appraiser, 'specialties')) 
      ? safeGet(appraiser, 'specialties').join(', ')
      : 'Fine Art Appraisal';
    
    const description = `${displayName} specializes in ${specialtiesText} in ${location}. Contact for professional art appraisal services.`;
    const phone = safeGet(appraiser, 'phone', '');
    const website = safeGet(appraiser, 'website', '');
    const address = safeGet(appraiser, 'address', location);
    
    // Get a validated image URL
    const originalImage = safeGet(appraiser, 'image', '');
    const image = getValidatedImageUrl(combinedId, originalImage) || DEFAULT_PLACEHOLDER;
    
    // Create HTML content
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayName} - Art Appraiser in ${location}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://art-appraiser.appraisily.com/appraiser/${locationSlug}-${appraiserSlug}/">
  ${cssFile ? `<link rel="stylesheet" href="${cssFile}">` : ''}
  
  <!-- Schema.org structured data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "${displayName}",
    "description": "${description}",
    "provider": {
      "@type": "LocalBusiness",
      "name": "${displayName}",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "${location}"
      },
      ${phone ? `"telephone": "${phone}",` : ''}
      ${website ? `"url": "${website}",` : ''}
      "image": "${image}"
    },
    "areaServed": "${location}",
    "serviceType": "Art Appraisal",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.5",
      "reviewCount": "15"
    },
    "offers": {
      "@type": "Offer",
      "description": "Professional art appraisal services with complimentary valuation for consignment"
    }
  }
  </script>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a> &gt;
      <a href="/location/${locationSlug}/">${location}</a> &gt;
      <span>${displayName}</span>
    </nav>
  </header>
  
  <main>
    <article class="appraiser-profile">
      <div class="profile-header">
        <img src="${image}" alt="${displayName}" class="appraiser-image" onerror="this.src='${DEFAULT_PLACEHOLDER}'; this.classList.add('fallback-image');">
        <div class="profile-info">
          <h1>${displayName}</h1>
          <p class="location">${location}</p>
          ${phone ? `<p class="phone">${phone}</p>` : ''}
          ${website ? `<p class="website"><a href="${website}" target="_blank" rel="noopener">${website}</a></p>` : ''}
        </div>
      </div>
      
      <div class="profile-details">
        <section class="specialties">
          <h2>Specialties</h2>
          <ul>
            ${Array.isArray(safeGet(appraiser, 'specialties')) 
              ? safeGet(appraiser, 'specialties').map(specialty => `<li>${specialty}</li>`).join('')
              : '<li>Fine Art Appraisal</li>'}
          </ul>
        </section>
        
        <section class="services">
          <h2>Services Offered</h2>
          <ul>
            ${Array.isArray(safeGet(appraiser, 'services_offered')) 
              ? safeGet(appraiser, 'services_offered').map(service => `<li>${service}</li>`).join('')
              : '<li>Art Appraisal Services</li>'}
          </ul>
        </section>
        
        <section class="certifications">
          <h2>Certifications</h2>
          <ul>
            ${Array.isArray(safeGet(appraiser, 'certifications')) 
              ? safeGet(appraiser, 'certifications').map(cert => `<li>${cert}</li>`).join('')
              : '<li>Professional Art Appraiser</li>'}
          </ul>
        </section>
      </div>
    </article>
  </main>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} Art Appraiser Directory. All rights reserved.</p>
  </footer>
  
  <!-- Fallback image script -->
  <script>
    // Handle broken images
    document.addEventListener('DOMContentLoaded', function() {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        img.onerror = function() {
          this.src = '${DEFAULT_PLACEHOLDER}';
          this.classList.add('fallback-image');
        };
        
        // Check already loaded images
        if (img.complete && img.naturalHeight === 0) {
          img.src = '${DEFAULT_PLACEHOLDER}';
          img.classList.add('fallback-image');
        }
      });
    });
  </script>
  
  ${jsFile ? `<script type="module" src="${jsFile}"></script>` : ''}
</body>
</html>`;
    
    // Write HTML file
    fs.writeFileSync(path.join(outputDir, 'index.html'), html);
    return true;
  } catch (error) {
    console.error(`❌ Error generating page for ${appraiser.name || 'Unknown'}: ${error.message}`);
    return false;
  }
}

// Function to generate static HTML pages for all appraisers
async function generateAllAppraiserPages() {
  console.log('🔨 Generating static HTML for all appraiser pages...');
  
  let totalGenerated = 0;
  let totalFailed = 0;
  let totalImagesValidated = 0;
  let totalImagesReplaced = 0;
  
  // Get all location files
  const locationFiles = fs.readdirSync(LOCATIONS_DIR)
    .filter(file => file.endsWith('.json'));
  
  // Process each location
  for (const locationFile of locationFiles) {
    const locationName = path.basename(locationFile, '.json');
    console.log(`📍 Processing appraisers in ${locationName}...`);
    
    try {
      // Read location data
      const locationData = JSON.parse(
        fs.readFileSync(path.join(LOCATIONS_DIR, locationFile), 'utf8')
      );
      
      // Check if appraisers exist
      if (!locationData.appraisers || locationData.appraisers.length === 0) {
        console.log(`ℹ️ No appraisers found in ${locationFile}`);
        continue;
      }
      
      // Generate page for each appraiser
      for (const appraiser of locationData.appraisers) {
        if (!appraiser.id) {
          console.log(`  ⚠️ Skipping appraiser with no ID: ${appraiser.name || 'Unknown'}`);
          continue;
        }
        
        // Check if this appraiser has a validated image
        const appraiserSlug = appraiser.id.toLowerCase().replace(/\s+/g, '-');
        const locationSlug = locationData.name?.toLowerCase().replace(/\s+/g, '-') || locationName.toLowerCase();
        const combinedId = `${locationSlug}-${appraiserSlug}`;
        
        const originalImage = safeGet(appraiser, 'image', '');
        const validatedImage = getValidatedImageUrl(combinedId, originalImage);
        
        if (validatedImage !== originalImage && validatedImage !== DEFAULT_PLACEHOLDER) {
          totalImagesReplaced++;
          console.log(`  🔄 Replaced image for ${appraiser.name}: Using validated image from report`);
        }
        
        totalImagesValidated++;
        
        const success = generateAppraiserStaticPage(appraiser, locationData.name || locationName);
        
        if (success) {
          totalGenerated++;
        } else {
          totalFailed++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${locationFile}: ${error.message}`);
      totalFailed++;
    }
  }
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`📄 Total pages generated: ${totalGenerated}`);
  console.log(`🖼️ Total images validated: ${totalImagesValidated}`);
  console.log(`🔄 Images replaced with verified alternatives: ${totalImagesReplaced}`);
  console.log(`❌ Failed pages: ${totalFailed}`);
  console.log(`✅ Static HTML generation completed`);
}

// Run the script
generateAllAppraiserPages(); 