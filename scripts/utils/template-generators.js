/**
 * Template generators for the Art Appraiser Directory
 * Generates HTML for location pages, appraiser pages, and other content
 * Uses advanced utilities for image validation, SEO, and performance
 */

import path from 'path';
import fs from 'fs-extra';

// Import advanced utilities
import { 
  validateImageUrl, 
  getValidImageUrl, 
  batchProcessAppraiserImages,
  generateResponsiveImageHtml
} from './image-validation.js';

import {
  generateResourceHints,
  optimizeForCoreWebVitals,
  extractCriticalCss,
  generateLazyLoadingScript,
  optimizeHtml
} from './performance-utils.js';

import {
  generateLocationPageSchemas,
  generateAppraiserPageSchemas,
  generateSchemaMarkup
} from './schema-generator.js';

// Constants
const BASE_URL = 'https://antique-appraiser-directory.appraisily.com';
const DEFAULT_META_TITLE = 'Art Appraiser Directory | Find Qualified Art Appraisers';
const DEFAULT_META_DESCRIPTION = 'Find professional art appraisers for insurance, estate, donation, and fair market value appraisals. Get accurate valuations for your artwork.';

/**
 * Generates meta tags for SEO
 * @param {Object} seoData - SEO data including title, description, etc.
 * @returns {string} HTML meta tags
 */
function generateMetaTags(seoData = {}) {
  const {
    title = DEFAULT_META_TITLE,
    description = DEFAULT_META_DESCRIPTION,
    canonicalUrl,
    imageUrl = 'https://ik.imagekit.io/appraisily/appraisily-og-image.jpg',
    keywords = 'art appraiser, art appraisal, artwork valuation, certified appraiser',
    type = 'website',
    twitterCard = 'summary_large_image',
    author = 'Appraisily',
    published = new Date().toISOString().split('T')[0],
    modified = new Date().toISOString().split('T')[0]
  } = seoData;

  return `
    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}">
    <meta name="description" content="${description}">
    <meta name="keywords" content="${keywords}">
    <meta name="author" content="${author}">
    ${canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}">` : ''}
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${type}">
    <meta property="og:url" content="${canonicalUrl || BASE_URL}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="${twitterCard}">
    <meta property="twitter:url" content="${canonicalUrl || BASE_URL}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${imageUrl}">
    
    <!-- Article specific meta (if article type) -->
    ${type === 'article' ? `
      <meta property="article:published_time" content="${published}">
      <meta property="article:modified_time" content="${modified}">
      <meta property="article:author" content="${author}">
    ` : ''}
  `;
}

/**
 * Generates an appraiser card HTML with validated image
 * @param {Object} appraiser - Appraiser data
 * @param {Object} options - Additional options for the card
 * @returns {string} HTML for the appraiser card
 */
async function generateAppraiserCardHtml(appraiser, options = {}) {
  if (!appraiser || !appraiser.name) return '';
  
  const {
    showLocation = true,
    linkToProfile = true,
    cardClass = 'appraiser-card'
  } = options;
  
  // Format the appraiser's location
  const location = [
    appraiser.city || '',
    appraiser.state || ''
  ].filter(Boolean).join(', ');
  
  // Get a valid image URL using our enhanced utility
  const imageUrl = appraiser.imageUrl || await getValidImageUrl(appraiser);
  
  // Generate responsive image HTML using the utility function
  const imageHtml = generateResponsiveImageHtml({
    src: imageUrl,
    alt: `${appraiser.name} - Art Appraiser${location ? ` in ${location}` : ''}`,
    className: 'card-img',
    width: 400,
    height: 300
  });
  
  // Generate appraiser profile URL
  const slug = appraiser.slug || appraiser.id || appraiser.name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
  
  const profileUrl = `${BASE_URL}/appraiser/${slug}`;
  
  // Generate the card HTML
  return `
    <div class="${cardClass}">
      <div class="card-image">
        ${linkToProfile ? `<a href="${profileUrl}">` : ''}
          ${imageHtml}
        ${linkToProfile ? '</a>' : ''}
      </div>
      <div class="card-content">
        <h3 class="card-title">
          ${linkToProfile ? `<a href="${profileUrl}">` : ''}
            ${appraiser.name}
          ${linkToProfile ? '</a>' : ''}
        </h3>
        ${showLocation && location ? `<p class="card-location">${location}</p>` : ''}
        ${appraiser.specialties && appraiser.specialties.length > 0 ?
          `<p class="card-specialties">Specialties: ${appraiser.specialties.join(', ')}</p>` : ''
        }
        ${appraiser.rating ?
          `<div class="card-rating">
            <span class="stars">★★★★★</span>
            <span class="rating-value">${appraiser.rating}</span>
            ${appraiser.reviewCount ? `<span class="review-count">(${appraiser.reviewCount} reviews)</span>` : ''}
          </div>` : ''
        }
        ${linkToProfile ? `<a href="${profileUrl}" class="view-profile-btn">View Profile</a>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generates the complete HTML for a location page
 * @param {Object} options - Page generation options
 * @returns {string} Complete HTML for the location page
 */
export async function generateLocationPageHTML({
  cityName,
  stateName,
  appraisers = [],
  seoData = {}
}) {
  if (!cityName) {
    console.error('City name is required for location page generation');
    return '';
  }
  
  // Convert city name to a URL-friendly format
  const citySlug = cityName.toLowerCase().replace(/\s+/g, '-');
  
  // Format the location for display
  const locationDisplay = stateName ? `${cityName}, ${stateName}` : cityName;
  
  // Create default SEO data if not provided
  const defaultSeoData = {
    title: `Art Appraisers in ${locationDisplay} | Find Local Art Valuation Experts`,
    description: `Find qualified art appraisers in ${locationDisplay}. Get professional art valuations for insurance, estate planning, donations, and sales from local experts.`,
    canonicalUrl: `${BASE_URL}/location/${citySlug}`,
    keywords: `art appraiser ${cityName}, art appraisal ${cityName}, artwork valuation ${cityName}, certified appraiser ${cityName}`,
    imageUrl: 'https://ik.imagekit.io/appraisily/locations/art-appraisers-location.jpg'
  };
  
  // Merge default SEO data with provided SEO data
  const mergedSeoData = { ...defaultSeoData, ...seoData };
  
  // Filter appraisers for this location
  const locationAppraisers = appraisers.filter(appraiser => {
    const appraiserCity = appraiser.city || '';
    const appraiserLocation = appraiser.location || '';
    
    return (
      appraiserCity.toLowerCase() === cityName.toLowerCase() ||
      appraiserLocation.toLowerCase().includes(cityName.toLowerCase())
    );
  });
  
  console.log(`Found ${locationAppraisers.length} appraisers for ${locationDisplay}`);
  
  // Generate appraiser cards HTML
  const appraiserCardsHtml = await Promise.all(
    locationAppraisers.map(appraiser => 
      generateAppraiserCardHtml(appraiser, { showLocation: false })
    )
  );
  
  // Create location data for schema generation
  const locationData = {
    city: cityName,
    state: stateName,
    description: `Find professional art appraisers in ${locationDisplay} for accurate valuations and appraisals.`
  };
  
  // Generate all required schemas for the location page
  const schemas = generateLocationPageSchemas(locationData, locationAppraisers);
  const schemaMarkup = generateSchemaMarkup(schemas);
  
  // Generate resource hints for performance
  const resourceHints = generateResourceHints({
    preconnectUrls: [
      'https://ik.imagekit.io',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com'
    ],
    preloadAssets: [
      { url: '/css/styles.css', as: 'style' },
      { url: '/js/main.js', as: 'script' }
    ]
  });
  
  // Generate the complete HTML
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${resourceHints}
      ${generateMetaTags(mergedSeoData)}
      <link rel="stylesheet" href="/css/styles.css">
      ${schemaMarkup}
    </head>
    <body>
      <header>
        <div class="container">
          <a href="/" class="logo">Art Appraiser Directory</a>
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/directory">Directory</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
        </div>
      </header>
      
      <main>
        <section class="hero">
          <div class="container">
            <h1>Art Appraisers in ${locationDisplay}</h1>
            <p>Find qualified art appraisers and valuation experts in ${locationDisplay} for insurance, estate, donation, and fair market appraisals.</p>
          </div>
        </section>
        
        <section class="content">
          <div class="container">
            <div class="breadcrumbs">
              <a href="/">Home</a> &gt;
              <a href="/directory">Directory</a> &gt;
              <span>${locationDisplay}</span>
            </div>
            
            <div class="location-description">
              <h2>Finding Art Appraisers in ${locationDisplay}</h2>
              <p>Need a professional art appraiser in ${locationDisplay}? Our directory features qualified appraisers with expertise in various types of artwork and collectibles. Whether you need an appraisal for insurance purposes, estate planning, donations, or to determine fair market value, these local experts can help.</p>
            </div>
            
            <div class="appraiser-list">
              <h2>${locationAppraisers.length} Art Appraisers in ${locationDisplay}</h2>
              ${locationAppraisers.length > 0 
                ? `<div class="appraiser-grid">${appraiserCardsHtml.join('')}</div>`
                : `<p class="no-results">No appraisers found in ${locationDisplay}. Please check nearby locations or <a href="/contact">contact us</a> for assistance.</p>`
              }
            </div>
            
            <div class="location-info">
              <h2>Art Appraisal Services in ${locationDisplay}</h2>
              <p>Art appraisal is a crucial service for artwork owners and collectors. Professional appraisers in ${locationDisplay} provide accurate valuations based on years of expertise and knowledge of the art market.</p>
              
              <h3>Common Types of Art Appraisals</h3>
              <ul>
                <li><strong>Insurance Appraisals:</strong> Determine replacement value for insurance coverage</li>
                <li><strong>Estate Appraisals:</strong> Establish fair market value for estate tax purposes</li>
                <li><strong>Donation Appraisals:</strong> Provide valuations for charitable contribution tax deductions</li>
                <li><strong>Fair Market Value Appraisals:</strong> Determine the current market value for potential sales</li>
                <li><strong>Damage Appraisals:</strong> Assess value loss due to damage or deterioration</li>
              </ul>
              
              <h3>Frequently Asked Questions</h3>
              <div class="faq">
                <div class="faq-item">
                  <h4>How much does art appraisal cost in ${cityName}?</h4>
                  <p>Art appraisal costs in ${cityName} typically range from $125 to $350 per hour, depending on the appraiser's expertise and the complexity of the artwork. Many appraisers also offer flat rates for certain types of appraisals.</p>
                </div>
                <div class="faq-item">
                  <h4>How do I find a reliable art appraiser in ${cityName}?</h4>
                  <p>To find a reliable art appraiser in ${cityName}, look for appraisers with certifications from recognized organizations such as the International Society of Appraisers (ISA), American Society of Appraisers (ASA), or Appraisers Association of America (AAA). Check reviews, ask for references, and verify their area of specialization.</p>
                </div>
                <div class="faq-item">
                  <h4>What information do I need to provide for an art appraisal in ${cityName}?</h4>
                  <p>For an art appraisal in ${cityName}, you'll typically need to provide clear photographs of the artwork, dimensions, medium, information about the artist, provenance (history of ownership), documentation or certificates of authenticity, and the purpose of the appraisal.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer>
        <div class="container">
          <div class="footer-content">
            <div class="footer-section">
              <h3>Art Appraiser Directory</h3>
              <p>Connecting art owners with qualified appraisers nationwide.</p>
            </div>
            <div class="footer-section">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/directory">Directory</a></li>
                <li><a href="/about">About</a></li>
                <li><a href="/contact">Contact</a></li>
              </ul>
            </div>
            <div class="footer-section">
              <h3>Contact Us</h3>
              <p>Email: info@appraisily.com</p>
              <p>Phone: (800) 555-1234</p>
            </div>
          </div>
          <div class="footer-bottom">
            <p>&copy; ${new Date().getFullYear()} Appraisily. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      <script src="/js/main.js" defer></script>
      ${generateLazyLoadingScript()}
    </body>
    </html>
  `;
  
  // Optimize HTML for Core Web Vitals
  html = optimizeForCoreWebVitals(html, {
    lazyLoading: { rootMargin: '200px 0px' }
  });
  
  // Remove extra whitespace for smaller file size
  return optimizeHtml(html, { preserveLineBreaks: true });
}

/**
 * Generates the complete HTML for an appraiser page
 * @param {Object} appraiser - Appraiser data
 * @returns {string} Complete HTML for the appraiser page
 */
export async function generateAppraiserPageHTML(appraiser) {
  if (!appraiser || !appraiser.name) {
    console.error('Valid appraiser data is required for page generation');
    return '';
  }
  
  // Create slug for URLs
  const slug = appraiser.slug || appraiser.id || appraiser.name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
  
  // Location formatting
  const location = [
    appraiser.city || '',
    appraiser.state || ''
  ].filter(Boolean).join(', ');
  
  // Get a valid image URL
  const imageUrl = appraiser.imageUrl || await getValidImageUrl(appraiser);
  
  // Generate responsive image HTML
  const imageHtml = generateResponsiveImageHtml({
    src: imageUrl,
    alt: `${appraiser.name} - Art Appraiser${location ? ` in ${location}` : ''}`,
    className: 'appraiser-image',
    width: 600,
    height: 450
  });
  
  // Create SEO data
  const seoData = {
    title: `${appraiser.name} | Art Appraiser${location ? ` in ${location}` : ''}`,
    description: appraiser.description || 
      `${appraiser.name} is a professional art appraiser${location ? ` serving ${location}` : ''}. Specializing in ${appraiser.specialties?.join(', ') || 'fine art appraisals'}.`,
    canonicalUrl: `${BASE_URL}/appraiser/${slug}`,
    imageUrl: imageUrl,
    type: 'profile'
  };
  
  // Generate all required schemas for the appraiser page
  const schemas = generateAppraiserPageSchemas(appraiser);
  const schemaMarkup = generateSchemaMarkup(schemas);
  
  // Create services list HTML if available
  let servicesHtml = '';
  if (appraiser.services && Array.isArray(appraiser.services) && appraiser.services.length > 0) {
    servicesHtml = `
      <div class="appraiser-services">
        <h2>Services Offered</h2>
        <ul class="services-list">
          ${appraiser.services.map(service => `
            <li class="service-item">
              <h3>${service.name}</h3>
              ${service.description ? `<p>${service.description}</p>` : ''}
              ${service.price ? `<p class="service-price">Starting at $${service.price}</p>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  } else if (appraiser.specialties && Array.isArray(appraiser.specialties) && appraiser.specialties.length > 0) {
    // Create default services based on specialties if no specific services are defined
    servicesHtml = `
      <div class="appraiser-services">
        <h2>Services Offered</h2>
        <ul class="services-list">
          <li class="service-item">
            <h3>Art Appraisal Services</h3>
            <p>Professional appraisal services for ${appraiser.specialties.join(', ')} and other fine art.</p>
          </li>
          <li class="service-item">
            <h3>Insurance Appraisals</h3>
            <p>Determine replacement value for insurance coverage.</p>
          </li>
          <li class="service-item">
            <h3>Estate Appraisals</h3>
            <p>Establish fair market value for estate tax purposes.</p>
          </li>
          <li class="service-item">
            <h3>Donation Appraisals</h3>
            <p>Provide valuations for charitable contribution tax deductions.</p>
          </li>
        </ul>
      </div>
    `;
  }
  
  // Create reviews HTML if available
  let reviewsHtml = '';
  if (appraiser.reviews && Array.isArray(appraiser.reviews) && appraiser.reviews.length > 0) {
    reviewsHtml = `
      <div class="appraiser-reviews">
        <h2>Client Reviews</h2>
        <div class="reviews-list">
          ${appraiser.reviews.map(review => `
            <div class="review-item">
              <div class="review-header">
                <span class="reviewer-name">${review.author || 'Client'}</span>
                <span class="review-rating">★★★★★</span>
                <span class="review-rating-value">${review.rating}</span>
                ${review.date ? `<span class="review-date">${review.date}</span>` : ''}
              </div>
              <div class="review-content">
                <p>${review.text}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Generate the complete HTML
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${generateMetaTags(seoData)}
      <link rel="stylesheet" href="/css/styles.css">
      ${schemaMarkup}
    </head>
    <body>
      <header>
        <div class="container">
          <a href="/" class="logo">Art Appraiser Directory</a>
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/directory">Directory</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
        </div>
      </header>
      
      <main>
        <div class="container">
          <div class="breadcrumbs">
            <a href="/">Home</a> &gt;
            <a href="/directory">Directory</a> &gt;
            ${appraiser.city ? `<a href="/location/${appraiser.city.toLowerCase().replace(/\s+/g, '-')}">Art Appraisers in ${appraiser.city}</a> &gt;` : ''}
            <span>${appraiser.name}</span>
          </div>
          
          <div class="appraiser-profile">
            <div class="appraiser-header">
              <div class="appraiser-image-container">
                ${imageHtml}
              </div>
              <div class="appraiser-info">
                <h1>${appraiser.name}</h1>
                ${appraiser.businessName ? `<p class="business-name">${appraiser.businessName}</p>` : ''}
                ${location ? `<p class="location">${location}</p>` : ''}
                ${appraiser.phone ? `<p class="phone"><a href="tel:${appraiser.phone.replace(/[^0-9]/g, '')}">${appraiser.phone}</a></p>` : ''}
                ${appraiser.email ? `<p class="email"><a href="mailto:${appraiser.email}">${appraiser.email}</a></p>` : ''}
                ${appraiser.website ? `<p class="website"><a href="${appraiser.website}" target="_blank" rel="noopener">Visit Website</a></p>` : ''}
                
                ${appraiser.specialties && appraiser.specialties.length > 0 ?
                  `<div class="specialties">
                    <h3>Specialties</h3>
                    <p>${appraiser.specialties.join(', ')}</p>
                  </div>` : ''
                }
                
                ${appraiser.certifications && appraiser.certifications.length > 0 ?
                  `<div class="certifications">
                    <h3>Certifications</h3>
                    <p>${appraiser.certifications.join(', ')}</p>
                  </div>` : ''
                }
              </div>
            </div>
            
            <div class="appraiser-content">
              <div class="appraiser-description">
                <h2>About ${appraiser.name}</h2>
                ${appraiser.description ? 
                  `<div class="description-content">${appraiser.description}</div>` :
                  `<div class="description-content">
                    <p>${appraiser.name} is a professional art appraiser${location ? ` based in ${location}` : ''} specializing in ${appraiser.specialties?.join(', ') || 'fine art appraisals'}.</p>
                    <p>With extensive knowledge and expertise in the art market, ${appraiser.name.split(' ')[0]} provides accurate valuations for insurance, estate planning, donations, and fair market value determinations.</p>
                  </div>`
                }
              </div>
              
              ${servicesHtml}
              
              ${reviewsHtml}
              
              <div class="appraiser-faq">
                <h2>Frequently Asked Questions</h2>
                <div class="faq">
                  <div class="faq-item">
                    <h3>What services does ${appraiser.name} offer?</h3>
                    <p>${appraiser.services?.map(s => s.name).join(', ') || 
                      `${appraiser.name} offers professional art appraisal services including valuations for insurance, estate planning, donations, and sales.`}</p>
                  </div>
                  <div class="faq-item">
                    <h3>What are ${appraiser.name}'s specialties?</h3>
                    <p>${appraiser.specialties?.join(', ') || 
                      `${appraiser.name} specializes in appraising various types of artwork and collectibles.`}</p>
                  </div>
                  <div class="faq-item">
                    <h3>How can I contact ${appraiser.name}?</h3>
                    <p>You can contact ${appraiser.name} by ${appraiser.phone ? `phone at ${appraiser.phone}` : 'using the contact information on their profile page'}${appraiser.email ? ` or by email at ${appraiser.email}` : ''}.</p>
                  </div>
                </div>
              </div>
              
              <div class="contact-cta">
                <h2>Request an Appraisal</h2>
                <p>Need an art appraisal? Contact ${appraiser.name} today to schedule a consultation.</p>
                ${appraiser.phone ? 
                  `<a href="tel:${appraiser.phone.replace(/[^0-9]/g, '')}" class="cta-button">Call ${appraiser.phone}</a>` : 
                  appraiser.email ? 
                  `<a href="mailto:${appraiser.email}" class="cta-button">Email ${appraiser.name}</a>` :
                  `<a href="/contact" class="cta-button">Contact Us</a>`
                }
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer>
        <div class="container">
          <div class="footer-content">
            <div class="footer-section">
              <h3>Art Appraiser Directory</h3>
              <p>Connecting art owners with qualified appraisers nationwide.</p>
            </div>
            <div class="footer-section">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/directory">Directory</a></li>
                <li><a href="/about">About</a></li>
                <li><a href="/contact">Contact</a></li>
              </ul>
            </div>
            <div class="footer-section">
              <h3>Contact Us</h3>
              <p>Email: info@appraisily.com</p>
              <p>Phone: (800) 555-1234</p>
            </div>
          </div>
          <div class="footer-bottom">
            <p>&copy; ${new Date().getFullYear()} Appraisily. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      <script src="/js/main.js" defer></script>
      ${generateLazyLoadingScript()}
    </body>
    </html>
  `;
  
  // Optimize HTML for Core Web Vitals
  html = optimizeForCoreWebVitals(html, {
    lazyLoading: { rootMargin: '200px 0px' }
  });
  
  // Remove extra whitespace for smaller file size
  return optimizeHtml(html, { preserveLineBreaks: true });
}

/**
 * Validates and updates appraiser images in an array of appraiser data
 * @param {Array} appraisersData - Array of appraiser objects
 * @returns {Promise<Array>} Updated appraisers with valid image URLs
 */
export async function validateAndUpdateAppraiserImages(appraisersData) {
  if (!appraisersData || !Array.isArray(appraisersData)) {
    console.error('Invalid appraisers data provided');
    return [];
  }
  
  console.log(`Starting validation of ${appraisersData.length} appraiser images...`);
  
  // Use the batch processing utility from image-validation.js
  const validatedAppraisers = await batchProcessAppraiserImages(appraisersData, 
    (progress) => {
      // Log progress every 10 appraisers
      if (progress.current % 10 === 0 || progress.current === progress.total) {
        console.log(`Processed ${progress.current}/${progress.total} appraiser images`);
      }
      
      // Log errors
      if (!progress.success) {
        console.error(`Error processing image for ${progress.appraiser}: ${progress.error}`);
      }
    }
  );
  
  console.log(`Completed validation of ${validatedAppraisers.length} appraiser images`);
  return validatedAppraisers;
}

/**
 * Saves validated appraiser data to a JSON file
 * @param {Array} validatedAppraisers - Array of validated appraiser objects
 * @param {string} outputPath - Path to save the JSON file
 * @returns {Promise<void>}
 */
export async function saveValidatedAppraiserData(validatedAppraisers, outputPath) {
  if (!validatedAppraisers || !Array.isArray(validatedAppraisers)) {
    console.error('Invalid appraiser data provided for saving');
    return;
  }
  
  try {
    // Ensure the directory exists
    await fs.ensureDir(path.dirname(outputPath));
    
    // Save the data to a JSON file
    await fs.writeJSON(outputPath, validatedAppraisers, { spaces: 2 });
    
    console.log(`Saved validated appraiser data to ${outputPath}`);
  } catch (error) {
    console.error(`Error saving validated appraiser data: ${error.message}`);
    throw error;
  }
}

/**
 * Loads previously validated appraiser data from a JSON file
 * @param {string} inputPath - Path to the JSON file
 * @returns {Promise<Array>} Validated appraiser data
 */
export async function loadValidatedAppraiserData(inputPath) {
  try {
    if (await fs.pathExists(inputPath)) {
      const data = await fs.readJSON(inputPath);
      console.log(`Loaded ${data.length} validated appraisers from ${inputPath}`);
      return data;
    }
    
    console.log(`No validated appraiser data found at ${inputPath}`);
    return null;
  } catch (error) {
    console.error(`Error loading validated appraiser data: ${error.message}`);
    return null;
  }
} 