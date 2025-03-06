/**
 * Advanced image validation and processing utilities
 * Handles validation, caching, and generation of appraiser images
 */

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

// Constants
const IMAGEKIT_URL_BASE = 'https://ik.imagekit.io/appraisily';
const DEFAULT_IMAGE = `${IMAGEKIT_URL_BASE}/appraisily-og-image.jpg`;
const IMAGE_CACHE_DIR = 'dist/data/image-cache';
const CACHE_EXPIRY_HOURS = 24; // Cache validity period in hours

// Get image generation service URL from environment or use default
const IMAGE_GENERATION_SERVICE_URL = process.env.IMAGE_GENERATION_SERVICE_URL || 
  'https://image-generation.appraisily.com/generate';

// In-memory cache for the current session
const memoryCache = new Map();

/**
 * Creates a cache key from an image URL
 * @param {string} url - Image URL
 * @returns {string} Cache key
 */
function createCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * Ensures the cache directory exists
 * @returns {Promise<void>}
 */
async function ensureCacheDirectory() {
  await fs.ensureDir(IMAGE_CACHE_DIR);
}

/**
 * Gets the path to the cache file for a URL
 * @param {string} url - Image URL
 * @returns {string} Path to cache file
 */
function getCacheFilePath(url) {
  const key = createCacheKey(url);
  return path.join(IMAGE_CACHE_DIR, `${key}.json`);
}

/**
 * Saves a validation result to the cache
 * @param {string} url - Image URL
 * @param {boolean} isValid - Validation result
 * @returns {Promise<void>}
 */
async function saveToCache(url, isValid) {
  await ensureCacheDirectory();
  const cacheFile = getCacheFilePath(url);
  await fs.writeJSON(cacheFile, {
    url,
    isValid,
    timestamp: Date.now()
  });
  
  // Update memory cache as well
  memoryCache.set(url, {
    isValid,
    timestamp: Date.now()
  });
}

/**
 * Checks if a cached result is still valid (not expired)
 * @param {Object} cachedData - Cached data
 * @returns {boolean} True if cache is still valid
 */
function isCacheValid(cachedData) {
  if (!cachedData || !cachedData.timestamp) return false;
  
  const now = Date.now();
  const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
  return (now - cachedData.timestamp) < expiryTime;
}

/**
 * Gets a cached validation result
 * @param {string} url - Image URL
 * @returns {Promise<Object|null>} Cached result or null
 */
async function getFromCache(url) {
  // Check memory cache first for faster access
  if (memoryCache.has(url)) {
    const memoryResult = memoryCache.get(url);
    if (isCacheValid(memoryResult)) {
      return memoryResult;
    }
  }
  
  // Check file cache if memory cache is missing or expired
  try {
    const cacheFile = getCacheFilePath(url);
    if (await fs.pathExists(cacheFile)) {
      const cachedData = await fs.readJSON(cacheFile);
      if (isCacheValid(cachedData)) {
        // Update memory cache with file cache data
        memoryCache.set(url, {
          isValid: cachedData.isValid,
          timestamp: cachedData.timestamp
        });
        return cachedData;
      }
    }
  } catch (error) {
    console.warn(`Error reading cache for ${url}:`, error.message);
  }
  
  return null;
}

/**
 * Validates if an image URL is accessible
 * @param {string} url - Image URL to validate
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<boolean>} True if image is valid
 */
export async function validateImageUrl(url, useCache = true) {
  if (!url) return false;
  
  // Check cache if enabled
  if (useCache) {
    const cachedResult = await getFromCache(url);
    if (cachedResult) {
      return cachedResult.isValid;
    }
  }
  
  try {
    // Make a HEAD request to check if the image exists
    const response = await axios.head(url, { 
      timeout: 5000,
      validateStatus: status => status === 200
    });
    
    const isValid = response.status === 200;
    
    // Save to cache if result is successful
    if (useCache) {
      await saveToCache(url, isValid);
    }
    
    return isValid;
  } catch (error) {
    // Save negative result to cache
    if (useCache) {
      await saveToCache(url, false);
    }
    
    return false;
  }
}

/**
 * Generate possible image URL patterns for an appraiser
 * @param {Object} appraiser - Appraiser data
 * @returns {string[]} Array of possible image URLs
 */
export function generatePossibleImageUrls(appraiser) {
  if (!appraiser || !appraiser.name) return [];
  
  const urls = [];
  
  // If there's already an imageUrl, add it first
  if (appraiser.imageUrl) {
    urls.push(appraiser.imageUrl);
  }
  
  // If there's an image property, add it too
  if (appraiser.image && appraiser.image !== appraiser.imageUrl) {
    urls.push(appraiser.image);
  }
  
  // Generate a slug from the name if not provided
  const slug = appraiser.slug || appraiser.name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
  
  // Generate standard naming pattern URLs
  urls.push(`${IMAGEKIT_URL_BASE}/appraiser-images/appraiser_${slug}.jpg`);
  urls.push(`${IMAGEKIT_URL_BASE}/appraiser-images/${slug}.jpg`);
  
  // Add variations with business name if available
  if (appraiser.businessName) {
    const businessSlug = appraiser.businessName.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    
    urls.push(`${IMAGEKIT_URL_BASE}/appraiser-images/appraiser_${businessSlug}.jpg`);
    urls.push(`${IMAGEKIT_URL_BASE}/appraiser-images/${businessSlug}.jpg`);
  }
  
  // Add location-based variations
  if (appraiser.city) {
    const citySlug = appraiser.city.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    
    urls.push(`${IMAGEKIT_URL_BASE}/appraiser-images/appraiser_${slug}_${citySlug}.jpg`);
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

/**
 * Generates an image for an appraiser using the image generation service
 * @param {Object} appraiser - Appraiser data
 * @returns {Promise<string|null>} Generated image URL or null
 */
export async function generateAppraiserImage(appraiser) {
  if (!appraiser || !appraiser.name) {
    console.error('Invalid appraiser data provided for image generation');
    return null;
  }
  
  try {
    // Prepare payload for image generation service
    const payload = {
      name: appraiser.name,
      type: 'appraiser',
      location: appraiser.city || appraiser.location || '',
      description: `Professional art appraiser${appraiser.specialties ? ` specializing in ${appraiser.specialties.join(', ')}` : ''}`,
      businessName: appraiser.businessName || '',
      timestamp: Date.now()
    };
    
    // Call image generation service
    const response = await axios.post(IMAGE_GENERATION_SERVICE_URL, payload, { 
      timeout: 20000 // Longer timeout for image generation
    });
    
    if (response.data && response.data.imageUrl) {
      console.log(`✓ Generated new image for ${appraiser.name}: ${response.data.imageUrl}`);
      return response.data.imageUrl;
    }
    
    console.error(`Failed to generate image for ${appraiser.name}: No image URL in response`);
    return null;
  } catch (error) {
    console.error(`Error generating image for ${appraiser.name}:`, error.message);
    return null;
  }
}

/**
 * Gets a valid image URL for an appraiser, trying multiple fallback strategies
 * @param {Object} appraiser - Appraiser data
 * @returns {Promise<string>} Valid image URL
 */
export async function getValidImageUrl(appraiser) {
  if (!appraiser) return DEFAULT_IMAGE;
  
  // Step 1: Try possible existing URLs
  const possibleUrls = generatePossibleImageUrls(appraiser);
  
  for (const url of possibleUrls) {
    if (await validateImageUrl(url)) {
      return url;
    }
  }
  
  // Step 2: Try generating a new image
  const generatedImageUrl = await generateAppraiserImage(appraiser);
  if (generatedImageUrl && await validateImageUrl(generatedImageUrl, false)) {
    return generatedImageUrl;
  }
  
  // Step 3: Try category-specific placeholder
  const specialtyPlaceholder = getSpecialtyPlaceholder(appraiser.specialties);
  if (specialtyPlaceholder && await validateImageUrl(specialtyPlaceholder)) {
    return specialtyPlaceholder;
  }
  
  // Final fallback: Return default image
  console.log(`Using default image for ${appraiser.name || 'unknown appraiser'}`);
  return DEFAULT_IMAGE;
}

/**
 * Gets a placeholder image based on appraiser's specialty
 * @param {string[]} specialties - Appraiser specialties
 * @returns {string|null} Specialty-specific placeholder URL
 */
function getSpecialtyPlaceholder(specialties) {
  if (!specialties || !Array.isArray(specialties) || specialties.length === 0) {
    return null;
  }
  
  // Map of specialty keywords to placeholder images
  const specialtyMap = {
    'painting': `${IMAGEKIT_URL_BASE}/placeholders/painting-appraiser.jpg`,
    'sculpture': `${IMAGEKIT_URL_BASE}/placeholders/sculpture-appraiser.jpg`,
    'antique': `${IMAGEKIT_URL_BASE}/placeholders/antiques-appraiser.jpg`,
    'modern': `${IMAGEKIT_URL_BASE}/placeholders/modern-art-appraiser.jpg`,
    'contemporary': `${IMAGEKIT_URL_BASE}/placeholders/contemporary-art-appraiser.jpg`,
    'oriental': `${IMAGEKIT_URL_BASE}/placeholders/asian-art-appraiser.jpg`,
    'asian': `${IMAGEKIT_URL_BASE}/placeholders/asian-art-appraiser.jpg`,
    'furniture': `${IMAGEKIT_URL_BASE}/placeholders/furniture-appraiser.jpg`,
    'jewelry': `${IMAGEKIT_URL_BASE}/placeholders/jewelry-appraiser.jpg`,
    'print': `${IMAGEKIT_URL_BASE}/placeholders/prints-appraiser.jpg`,
    'photograph': `${IMAGEKIT_URL_BASE}/placeholders/photography-appraiser.jpg`
  };
  
  // Check if any specialty matches our map
  for (const specialty of specialties) {
    const lowercaseSpecialty = specialty.toLowerCase();
    
    for (const [keyword, url] of Object.entries(specialtyMap)) {
      if (lowercaseSpecialty.includes(keyword)) {
        return url;
      }
    }
  }
  
  return null;
}

/**
 * Process a batch of appraisers to validate and update their images
 * @param {Array} appraisers - Array of appraiser objects
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Array>} Updated appraisers with valid image URLs
 */
export async function batchProcessAppraiserImages(appraisers, progressCallback = null) {
  if (!appraisers || !Array.isArray(appraisers)) {
    console.error('Invalid appraisers array provided');
    return [];
  }
  
  // Ensure cache directory exists
  await ensureCacheDirectory();
  
  const total = appraisers.length;
  const updatedAppraisers = [];
  
  for (let i = 0; i < total; i++) {
    const appraiser = appraisers[i];
    try {
      // Get valid image URL for this appraiser
      const validImageUrl = await getValidImageUrl(appraiser);
      
      // Update appraiser object with valid image URL
      updatedAppraisers.push({
        ...appraiser,
        imageUrl: validImageUrl
      });
      
      // Report progress if callback provided
      if (progressCallback && typeof progressCallback === 'function') {
        progressCallback({
          current: i + 1,
          total,
          appraiser: appraiser.name,
          success: true
        });
      }
    } catch (error) {
      console.error(`Error processing images for ${appraiser?.name || 'unknown appraiser'}:`, error.message);
      
      // Still include appraiser with original image data
      updatedAppraisers.push(appraiser);
      
      // Report error if callback provided
      if (progressCallback && typeof progressCallback === 'function') {
        progressCallback({
          current: i + 1,
          total,
          appraiser: appraiser?.name,
          success: false,
          error: error.message
        });
      }
    }
  }
  
  return updatedAppraisers;
}

/**
 * Clears the image validation cache
 * @returns {Promise<void>}
 */
export async function clearImageCache() {
  // Clear memory cache
  memoryCache.clear();
  
  // Clear file cache if it exists
  try {
    if (await fs.pathExists(IMAGE_CACHE_DIR)) {
      await fs.emptyDir(IMAGE_CACHE_DIR);
      console.log('Image validation cache cleared');
    }
  } catch (error) {
    console.error('Error clearing image cache:', error.message);
  }
}

/**
 * Generates a responsive image HTML markup with proper attributes
 * @param {Object} options - Image options
 * @returns {string} HTML image markup
 */
export function generateResponsiveImageHtml(options) {
  const {
    src,
    alt,
    className = '',
    width = 400,
    height = 300,
    loading = 'lazy',
    sizes = '(max-width: 768px) 100vw, 800px'
  } = options;
  
  if (!src) return '';
  
  // For ImageKit URLs, add parameters for responsive images
  if (src.includes('ik.imagekit.io')) {
    // Remove any existing transform parameters
    const baseUrl = src.split('?')[0];
    
    // Create srcset with multiple sizes
    const srcset = `
      ${baseUrl}?tr=w-400,h-300,q-80 400w,
      ${baseUrl}?tr=w-800,h-600,q-80 800w,
      ${baseUrl}?tr=w-1200,h-900,q-80 1200w
    `.trim();
    
    return `
      <img 
        src="${baseUrl}?tr=w-${width},h-${height},q-80" 
        srcset="${srcset}"
        sizes="${sizes}"
        alt="${alt}" 
        class="${className}" 
        loading="${loading}" 
        width="${width}" 
        height="${height}"
        decoding="async"
      />
    `.trim();
  }
  
  // For non-ImageKit URLs, use standard img tag
  return `
    <img 
      src="${src}" 
      alt="${alt}" 
      class="${className}" 
      loading="${loading}" 
      width="${width}" 
      height="${height}"
      decoding="async"
    />
  `.trim();
} 