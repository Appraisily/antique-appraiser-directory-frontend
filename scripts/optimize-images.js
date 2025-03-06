import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const LOCATIONS_DIR = path.join(ROOT_DIR, 'src/data/locations');

/**
 * This script optimizes images to improve page load performance.
 * It:
 * 1. Adds responsive image markup using srcset for appraiser and location images
 * 2. Adds loading="lazy" attributes to images
 * 3. Ensures proper alt text for accessibility and SEO
 * 4. Adds width and height attributes to reduce layout shifts
 */

// Cache image dimensions to avoid repeated fetch requests
const imageDimensionsCache = new Map();

// Get image dimensions from a URL
async function getImageDimensions(imageUrl) {
  // Check cache first
  if (imageDimensionsCache.has(imageUrl)) {
    return imageDimensionsCache.get(imageUrl);
  }
  
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    // For ImageKit URLs, we can try to parse dimensions from URL or query parameters
    if (imageUrl.includes('ik.imagekit.io')) {
      // Try to extract dimensions from the URL or reasonable defaults
      const defaultDimensions = { width: 800, height: 600 };
      
      // Cache the result
      imageDimensionsCache.set(imageUrl, defaultDimensions);
      return defaultDimensions;
    } else {
      // For other images, use default dimensions
      const defaultDimensions = { width: 800, height: 600 };
      imageDimensionsCache.set(imageUrl, defaultDimensions);
      return defaultDimensions;
    }
  } catch (error) {
    console.error(`Error getting dimensions for ${imageUrl}:`, error);
    return { width: 800, height: 600 }; // Default dimensions
  }
}

// Create responsive image markup
function createResponsiveImageMarkup(imageUrl, alt, className = '') {
  // For ImageKit URLs, we can add URL parameters for different sizes
  if (imageUrl.includes('ik.imagekit.io')) {
    // Base URL without any existing transforms
    const baseUrl = imageUrl.split('?')[0];
    
    // Create srcset with multiple sizes
    const srcset = `
      ${baseUrl}?tr=w-400 400w,
      ${baseUrl}?tr=w-800 800w,
      ${baseUrl}?tr=w-1200 1200w
    `.trim();
    
    return `
      <img 
        src="${baseUrl}?tr=w-800" 
        srcset="${srcset}"
        sizes="(max-width: 768px) 100vw, 800px"
        alt="${alt}" 
        class="${className}" 
        loading="lazy" 
        width="800" 
        height="600"
      />
    `.trim();
  } else {
    // For non-ImageKit URLs, just use the original with lazy loading
    return `
      <img 
        src="${imageUrl}" 
        alt="${alt}" 
        class="${className}" 
        loading="lazy" 
        width="800" 
        height="600"
      />
    `.trim();
  }
}

// Process HTML files and update image tags
async function optimizeHtmlFiles() {
  console.log('Optimizing HTML files with responsive images...');
  
  // Get all HTML files
  const htmlFiles = [];
  
  // Function to recursively find all HTML files
  function findHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        findHtmlFiles(filePath);
      } else if (file === 'index.html') {
        htmlFiles.push(filePath);
      }
    }
  }
  
  // Find all HTML files in the dist directory
  findHtmlFiles(DIST_DIR);
  console.log(`Found ${htmlFiles.length} HTML files to optimize`);
  
  // Process each HTML file
  let optimizedCount = 0;
  
  for (const htmlFile of htmlFiles) {
    try {
      let content = fs.readFileSync(htmlFile, 'utf-8');
      
      // Simple regex to find image tags
      const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/g;
      let match;
      
      while ((match = imgRegex.exec(content)) !== null) {
        const fullImgTag = match[0];
        const imgSrc = match[1];
        
        // Skip if already has srcset or if it's an SVG
        if (fullImgTag.includes('srcset') || imgSrc.endsWith('.svg')) {
          continue;
        }
        
        // Extract alt text or create a reasonable one
        const altMatch = fullImgTag.match(/alt="([^"]+)"/);
        const alt = altMatch ? altMatch[1] : path.basename(imgSrc, path.extname(imgSrc));
        
        // Extract any existing class
        const classMatch = fullImgTag.match(/class="([^"]+)"/);
        const className = classMatch ? classMatch[1] : '';
        
        // Create responsive image markup
        const responsiveImgTag = createResponsiveImageMarkup(imgSrc, alt, className);
        
        // Replace the original tag with the responsive one
        content = content.replace(fullImgTag, responsiveImgTag);
      }
      
      // Write the updated content back to the file
      fs.writeFileSync(htmlFile, content, 'utf-8');
      optimizedCount++;
      
    } catch (error) {
      console.error(`Error optimizing ${htmlFile}:`, error);
    }
  }
  
  console.log(`✅ Optimized ${optimizedCount} HTML files with responsive images`);
}

// Main function
async function main() {
  console.log('🖼️ Starting image optimization process...');
  
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Dist directory does not exist! Run the build process first.');
    return;
  }
  
  // Optimize HTML files with responsive images
  await optimizeHtmlFiles();
  
  console.log('✅ Image optimization complete!');
}

// Run the main function
main().catch(error => {
  console.error('❌ Error during image optimization:', error);
  process.exit(1);
}); 