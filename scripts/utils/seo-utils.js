/**
 * SEO utilities for enhancing search engine visibility
 * This module provides functions for optimizing content for search engines
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Generate SEO-optimized title for a page
 * @param {Object} options - Title options
 * @param {string} options.name - Primary name/topic
 * @param {string} options.location - Location name, if applicable
 * @param {string} options.suffix - Brand suffix
 * @param {boolean} options.includeKeywords - Whether to include keywords
 * @returns {string} SEO-optimized title
 */
export function generateSeoTitle({ 
  name, 
  location = '', 
  suffix = 'Appraisily', 
  includeKeywords = true 
}) {
  // Build the title with proper keyword placement
  let title = name;
  
  // Add location if provided
  if (location) {
    title = `${title} in ${location}`;
  }
  
  // Add relevant keywords based on context
  if (includeKeywords) {
    if (title.toLowerCase().includes('appraiser')) {
      title = `${title} | Expert Antique Valuation Services`;
    } else if (title.toLowerCase().includes('antique appraisers')) {
      title = `${title} | Find Certified Professionals`;
    } else {
      title = `${title} | Fine Antique Appraisal Services`;
    }
  }
  
  // Add brand if not already included and ensure title length is optimal
  if (!title.includes(suffix) && title.length + suffix.length + 3 <= 60) {
    title = `${title} | ${suffix}`;
  }
  
  // Ensure title is not too long (Google typically displays 50-60 characters)
  if (title.length > 60) {
    return title.substring(0, 57) + '...';
  }
  
  return title;
}

/**
 * Generate SEO-optimized meta description
 * @param {Object} options - Description options
 * @param {string} options.name - Primary name
 * @param {string} options.location - Location name
 * @param {string} options.specialties - Specialties, if applicable
 * @param {string} options.baseDescription - Base description text
 * @returns {string} SEO-optimized description
 */
export function generateSeoDescription({
  name,
  location = '',
  specialties = '',
  baseDescription = ''
}) {
  let description = baseDescription;
  
  // If no base description, generate one
  if (!description) {
    if (location) {
      description = `Find certified antique appraisers in ${location}. Get expert antique valuations, authentication services, and professional advice for your antique collection.`;
    } else if (name && name.includes('Appraiser')) {
      description = `Get professional antique appraisal services from ${name}.`;
      if (specialties) {
        description += ` Specializing in ${specialties}.`;
      }
      description += ` Certified expert providing accurate valuations for insurance, estate planning, donations, and sales.`;
    } else {
      description = `Professional antique appraisal services for insurance, estate planning, donations, and sales. Get accurate valuations from certified experts.`;
    }
  }
  
  // Ensure description is not too long (Google typically displays 155-160 characters)
  if (description.length > 155) {
    return description.substring(0, 152) + '...';
  }
  
  return description;
}

/**
 * Generate keyword list for a page
 * @param {Object} options - Keyword options
 * @param {string} options.type - Page type (appraiser, location, etc.)
 * @param {string} options.name - Primary name
 * @param {string} options.location - Location name
 * @param {string[]} options.specialties - Specialties array
 * @returns {string[]} Array of relevant keywords
 */
export function generateKeywords({
  type = 'general',
  name = '',
  location = '',
  specialties = []
}) {
  const baseKeywords = [
    'antique appraisal', 
    'antique appraiser', 
    'antique valuation', 
    'fine antique appraisal', 
    'antique authentication', 
    'antique valuation services'
  ];
  
  let contextualKeywords = [];
  
  // Add type-specific keywords
  if (type === 'appraiser') {
    contextualKeywords = [
      'certified antique appraiser',
      'professional antique appraiser',
      'antique appraisal expert',
      'antique valuation specialist',
      'antique authentication services',
      'collectibles appraisal',
      'furniture appraisal'
    ];
  } else if (type === 'location') {
    contextualKeywords = [
      `antique appraiser ${location}`,
      `${location} antique appraisal`,
      `fine antique appraisal ${location}`,
      `antique valuation services ${location}`,
      `certified antique appraiser ${location}`,
      `find antique appraiser ${location}`,
      `local antique appraisers`
    ];
  }
  
  // Add specialty-specific keywords
  if (specialties && specialties.length > 0) {
    const specialtyKeywords = specialties.map(specialty => 
      [`${specialty.toLowerCase()} appraisal`, `${specialty.toLowerCase()} valuation`]
    ).flat();
    contextualKeywords = [...contextualKeywords, ...specialtyKeywords];
  }
  
  // Combine and ensure uniqueness
  const allKeywords = [...baseKeywords, ...contextualKeywords];
  const uniqueKeywords = [...new Set(allKeywords)];
  
  // Limit to 10-15 most relevant keywords
  return uniqueKeywords.slice(0, 15);
}

/**
 * Generate canonical URL for a page
 * @param {Object} options - URL options 
 * @param {string} options.baseUrl - Base site URL
 * @param {string} options.path - Page path
 * @param {string} options.id - Resource ID
 * @param {string} options.type - Resource type
 * @returns {string} Canonical URL
 */
export function generateCanonicalUrl({
  baseUrl = 'https://antique-appraiser.appraisily.com',
  path = '',
  id = '',
  type = ''
}) {
  if (path) {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }
  
  if (type && id) {
    return `${baseUrl}/${type}/${id}`;
  }
  
  return baseUrl;
}

/**
 * Process and optimize an HTML file for SEO
 * @param {string} filePath - Path to HTML file
 * @param {Object} options - Options for optimization
 * @returns {Promise<void>}
 */
export async function optimizeHtmlFile(filePath, options = {}) {
  try {
    // Read file content
    let content = await fs.readFile(filePath, 'utf-8');
    
    // Add heading structure if missing
    content = ensureHeadingStructure(content);
    
    // Enhance meta tags
    content = enhanceMetaTags(content, options);
    
    // Add schema references to content
    content = addSchemaMarkup(content, options);
    
    // Add semantic HTML improvements
    content = enhanceSemanticHtml(content);
    
    // Write optimized file
    await fs.writeFile(filePath, content, 'utf-8');
    
    return true;
  } catch (error) {
    console.error(`Error optimizing HTML file ${filePath}:`, error);
    return false;
  }
}

/**
 * Ensure proper heading structure in HTML content
 * @param {string} content - HTML content
 * @returns {string} Enhanced HTML content
 */
function ensureHeadingStructure(content) {
  // Check if content has an h1 tag
  if (!content.includes('<h1')) {
    // Find the main content area
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch && mainMatch[1]) {
      const mainContent = mainMatch[1];
      
      // Try to find a title-like element to convert to h1
      const titleMatch = mainContent.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (titleMatch) {
        const titleContent = titleMatch[1].trim();
        const h1Tag = `<h1 class="page-title">${titleContent}</h1>`;
        content = content.replace(titleMatch[0], h1Tag);
      }
    }
  }
  
  return content;
}

/**
 * Enhance meta tags in HTML content
 * @param {string} content - HTML content
 * @param {Object} options - Enhancement options
 * @returns {string} Enhanced HTML content
 */
function enhanceMetaTags(content, options) {
  // Implementation depends on the structure of your HTML
  return content;
}

/**
 * Add schema markup to HTML content
 * @param {string} content - HTML content
 * @param {Object} options - Schema options
 * @returns {string} Enhanced HTML content
 */
function addSchemaMarkup(content, options) {
  // Implementation depends on the structure of your HTML
  return content;
}

/**
 * Enhance semantic HTML elements
 * @param {string} content - HTML content
 * @returns {string} Enhanced HTML content
 */
function enhanceSemanticHtml(content) {
  // Add appropriate ARIA attributes for accessibility
  content = content.replace(/<nav([^>]*)>/gi, '<nav$1 aria-label="Main navigation">');
  content = content.replace(/<section([^>]*)>/gi, '<section$1 aria-labelledby="section-heading">');
  
  // Make sure images have alt text
  content = content.replace(/<img([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes('alt=')) {
      return match.replace('<img', '<img alt="Antique appraisal"');
    }
    return match;
  });
  
  // Add semantic content structure
  content = content.replace(/<div([^>]*)class="([^"]*)(appraiser-info|location-info)([^"]*)"([^>]*)>/gi, 
    '<article$1class="$2$3$4"$5 itemscope itemtype="https://schema.org/ProfessionalService">');
  content = content.replace(/<\/div>\s*(<\/div>\s*<\/div>\s*<\/div>)(\s*<!-- end appraiser-info -->)/gi, '</article>$1$2');
  
  return content;
}

/**
 * Generates image filename with SEO-friendly keywords
 * @param {string} baseName - Base name for the image
 * @param {string} type - Type of content (appraiser, location, etc.)
 * @param {string} location - Location name if applicable
 * @returns {string} SEO-friendly filename
 */
export function generateSeoImageFilename(baseName, type = '', location = '') {
  // Create a slug from the base name
  const slug = baseName.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
  
  // Build the filename with keywords
  let filename = slug;
  
  if (type) {
    filename = `${type}-${filename}`;
  }
  
  if (location) {
    const locationSlug = location.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
      
    filename = `${filename}-${locationSlug}`;
  }
  
  // Add antique-appraiser keyword for SEO
  if (!filename.includes('antique-appraiser')) {
    filename = `antique-appraiser-${filename}`;
  }
  
  return `${filename}.jpg`;
} 