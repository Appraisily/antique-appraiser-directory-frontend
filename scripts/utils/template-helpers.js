/**
 * Template helper functions for static HTML generation
 * This module provides reusable HTML components and templates for the static site generation
 */

/**
 * Generates the common HTML head section with enhanced SEO metadata
 * @param {Object} options - Configuration options
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {string} options.canonicalUrl - Canonical URL
 * @param {string} options.imageUrl - Open Graph image URL
 * @param {string[]} options.keywords - SEO keywords
 * @param {string} options.cssPath - Path to CSS file
 * @param {string} options.ogType - Open Graph type
 * @param {string} options.ogLocale - Open Graph locale
 * @returns {string} HTML head section
 */
export function getEnhancedHeaderHTML({
  title,
  description,
  canonicalUrl,
  imageUrl = 'https://ik.imagekit.io/appraisily/appraisily-og-image.jpg',
  keywords = [],
  cssPath,
  ogType = 'website',
  ogLocale = 'en_US'
}) {
  const keywordsStr = keywords.length > 0 ? keywords.join(', ') : 'art appraiser, art appraisal, artwork valuation, art authentication';
  
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${keywordsStr}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonicalUrl}" />
    
    <!-- Performance optimization -->
    <link rel="preload" href="${cssPath}" as="style" />
    <link rel="stylesheet" href="${cssPath}" />
    <link rel="preconnect" href="https://ik.imagekit.io" crossorigin />
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
    <link rel="dns-prefetch" href="https://ik.imagekit.io" />
    <link rel="dns-prefetch" href="https://www.google-analytics.com" />
    
    <!-- Open Graph tags -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Appraisily" />
    <meta property="og:locale" content="${ogLocale}" />
    
    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="twitter:site" content="@appraisily" />
    
    <!-- Mobile optimization -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Appraisily" />
    <meta name="theme-color" content="#1a56db" />
    
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-PSLHDGM');</script>
    <!-- End Google Tag Manager -->
  </head>
  <body>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PSLHDGM"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->`;
}

/**
 * Generates the common footer HTML with enhanced structure and navigation
 * @param {string} jsPath - Path to JavaScript file
 * @returns {string} HTML footer section
 */
export function getEnhancedFooterHTML(jsPath) {
  // Define cities list for the footer with proper semantic structure
  const citiesListHTML = buildCitiesListHTML();
  
  const currentYear = new Date().getFullYear();
  
  return `<footer class="bg-gray-900 text-white py-12" itemscope itemtype="https://schema.org/WPFooter">
      <div class="container mx-auto px-6">
        <div class="mb-10">
          <h3 class="text-xl font-bold mb-4">Find Art Appraisers Near You</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-gray-400 text-sm">
            ${citiesListHTML}
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 border-t border-gray-800 pt-8">
          <div class="flex flex-col items-start">
            <img src="https://cdn.mcauto-images-production.sendgrid.net/304ac75ef1d5c007/8aeb2689-2b5b-402d-a6f3-6521621e123a/300x300.png" 
                 alt="Appraisily Logo" 
                 class="w-12 h-12 mb-3"
                 width="48"
                 height="48"
                 loading="lazy" />
            <h3 class="text-xl font-bold">Appraisily</h3>
            <p class="text-gray-400 text-sm mt-2">Professional online art and antique appraisals. Get accurate valuations from certified experts within 48 hours.</p>
            <a href="https://appraisily.com/start" class="mt-4 bg-primary hover:bg-primary/90 text-white py-2 px-4 rounded-md inline-block transition-colors">Start Appraisal</a>
          </div>
          
          <div>
            <h3 class="text-xl font-bold mb-4">Quick Links</h3>
            <ul class="space-y-2 text-sm">
              <li><a href="https://appraisily.com/directory" class="text-gray-400 hover:text-white transition">Directory</a></li>
              <li><a href="https://appraisily.com/" class="text-gray-400 hover:text-white transition">Home</a></li>
              <li><a href="https://appraisily.com/about" class="text-gray-400 hover:text-white transition">About Us</a></li>
              <li><a href="https://appraisily.com/contact" class="text-gray-400 hover:text-white transition">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h3 class="text-xl font-bold mb-4">Services</h3>
            <ul class="space-y-2 text-sm">
              <li><a href="https://appraisily.com/services" class="text-gray-400 hover:text-white transition">Services</a></li>
              <li><a href="https://appraisily.com/how-it-works" class="text-gray-400 hover:text-white transition">How It Works</a></li>
              <li><a href="https://appraisily.com/screener" class="text-gray-400 hover:text-white transition">Free AI Art Analysis</a></li>
              <li><a href="https://appraisily.com/terms" class="text-gray-400 hover:text-white transition">Terms of Service</a></li>
            </ul>
          </div>
          
          <div>
            <h3 class="text-xl font-bold mb-4">Contact Us</h3>
            <p class="text-gray-400 text-sm">Have questions? Need assistance?</p>
            <p class="text-gray-400 text-sm mt-2">Email: <a href="mailto:info@appraisily.com" class="text-primary hover:text-white transition">info@appraisily.com</a></p>
          </div>
        </div>
        
        <div class="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p class="text-gray-400 text-sm">&copy; ${currentYear} Appraisily. All rights reserved.</p>
          <div class="flex space-x-4 mt-4 md:mt-0 text-sm">
            <a href="https://appraisily.com/privacy" class="text-gray-400 hover:text-white transition">Privacy Policy</a>
            <a href="https://appraisily.com/terms" class="text-gray-400 hover:text-white transition">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
    <script type="module" src="${jsPath}" defer></script>
  </body>
</html>`;
}

/**
 * Builds HTML for the list of cities in the footer
 * @returns {string} HTML for city links
 */
function buildCitiesListHTML() {
  const cities = [
    { name: 'New York', state: 'New York' },
    { name: 'Los Angeles', state: 'California' },
    { name: 'Chicago', state: 'Illinois' },
    { name: 'Houston', state: 'Texas' },
    { name: 'Phoenix', state: 'Arizona' },
    { name: 'Philadelphia', state: 'Pennsylvania' },
    { name: 'San Antonio', state: 'Texas' },
    { name: 'San Diego', state: 'California' },
    { name: 'Dallas', state: 'Texas' },
    { name: 'San Jose', state: 'California' },
    { name: 'Austin', state: 'Texas' },
    { name: 'Jacksonville', state: 'Florida' },
    { name: 'Fort Worth', state: 'Texas' },
    { name: 'Columbus', state: 'Ohio' },
    { name: 'San Francisco', state: 'California' },
    { name: 'Charlotte', state: 'North Carolina' },
    { name: 'Indianapolis', state: 'Indiana' },
    { name: 'Seattle', state: 'Washington' },
    { name: 'Denver', state: 'Colorado' },
    { name: 'Washington', state: 'District of Columbia' },
    { name: 'Boston', state: 'Massachusetts' },
    { name: 'Nashville', state: 'Tennessee' },
    { name: 'Portland', state: 'Oregon' },
    { name: 'Las Vegas', state: 'Nevada' },
    { name: 'Atlanta', state: 'Georgia' },
    { name: 'Miami', state: 'Florida' },
    { name: 'Minneapolis', state: 'Minnesota' },
    { name: 'New Orleans', state: 'Louisiana' },
    { name: 'Cleveland', state: 'Ohio' },
    { name: 'St. Louis', state: 'Missouri' },
    { name: 'Pittsburgh', state: 'Pennsylvania' },
    { name: 'Cincinnati', state: 'Ohio' },
    { name: 'Kansas City', state: 'Missouri' },
    { name: 'Sacramento', state: 'California' },
    { name: 'Salt Lake City', state: 'Utah' },
    { name: 'Providence', state: 'Rhode Island' },
    { name: 'Richmond', state: 'Virginia' },
    { name: 'Buffalo', state: 'New York' },
    { name: 'Raleigh', state: 'North Carolina' },
    { name: 'Hartford', state: 'Connecticut' },
    { name: 'Charleston', state: 'South Carolina' },
    { name: 'Savannah', state: 'Georgia' },
    { name: 'Santa Fe', state: 'New Mexico' },
    { name: 'Palm Beach', state: 'Florida' },
    { name: 'Aspen', state: 'Colorado' },
  ];
  
  return cities.map(city => {
    const slug = city.name.toLowerCase().replace(/\s+/g, '-');
    const displayName = `${city.name}, ${city.state}`;
    return `<a href="/location/${slug}" class="hover:text-white transition" title="Art Appraisers in ${displayName}">${displayName}</a>`;
  }).join('\n      ');
}

/**
 * Creates an enhanced responsive image markup with proper attributes for SEO and performance
 * @param {Object} options - Image options
 * @param {string} options.src - Image source URL
 * @param {string} options.alt - Image alt text
 * @param {string} options.className - CSS class
 * @param {number} options.width - Image width
 * @param {number} options.height - Image height
 * @returns {string} HTML image markup
 */
export function createEnhancedImageMarkup({
  src, 
  alt, 
  className = '', 
  width = 800, 
  height = 600
}) {
  if (!src) return '';
  
  // For ImageKit URLs, we can add URL parameters for different sizes
  if (src.includes('ik.imagekit.io')) {
    // Base URL without any existing transforms
    const baseUrl = src.split('?')[0];
    
    // Create srcset with multiple sizes for responsive images
    const srcset = `
      ${baseUrl}?tr=w-400,h-300 400w,
      ${baseUrl}?tr=w-800,h-600 800w,
      ${baseUrl}?tr=w-1200,h-900 1200w
    `.trim();
    
    return `
      <img 
        src="${baseUrl}?tr=w-800,h-600" 
        srcset="${srcset}"
        sizes="(max-width: 768px) 100vw, 800px"
        alt="${alt}" 
        class="${className}" 
        loading="lazy" 
        width="${width}" 
        height="${height}"
        decoding="async"
      />
    `.trim();
  } else {
    // For non-ImageKit URLs, just use the original with lazy loading
    return `
      <img 
        src="${src}" 
        alt="${alt}" 
        class="${className}" 
        loading="lazy" 
        width="${width}" 
        height="${height}"
        decoding="async"
      />
    `.trim();
  }
}

/**
 * Generates breadcrumb navigation HTML
 * @param {Array} items - Breadcrumb items with name and url properties
 * @returns {string} HTML breadcrumb markup
 */
export function generateBreadcrumbsHTML(items) {
  if (!items || items.length === 0) return '';
  
  const itemsHtml = items.map((item, index) => {
    const isLast = index === items.length - 1;
    if (isLast) {
      return `<li class="breadcrumb-item active" aria-current="page">${item.name}</li>`;
    }
    return `<li class="breadcrumb-item"><a href="${item.url}">${item.name}</a></li>`;
  }).join('');
  
  return `
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        ${itemsHtml}
      </ol>
    </nav>
  `;
}

/**
 * Generates structured review HTML with schema markup attributes
 * @param {Object} review - Review data
 * @returns {string} HTML review markup
 */
export function generateReviewHTML(review) {
  if (!review) return '';
  
  const stars = '★'.repeat(Math.round(review.rating)) + '☆'.repeat(5 - Math.round(review.rating));
  
  return `
    <div class="review" itemprop="review" itemscope itemtype="https://schema.org/Review">
      <div class="review-header">
        <span class="review-author" itemprop="author">${review.author}</span>
        <span class="review-date" itemprop="datePublished">${review.date}</span>
      </div>
      <div class="review-rating" itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">
        <meta itemprop="worstRating" content="1">
        <span class="stars">${stars}</span>
        <meta itemprop="ratingValue" content="${review.rating}">
        <meta itemprop="bestRating" content="5">
      </div>
      <div class="review-content" itemprop="reviewBody">
        ${review.content}
      </div>
    </div>
  `;
}

/**
 * Generates meta tags for a specific city for local SEO
 * @param {Object} city - City data
 * @returns {string} HTML meta tags for local SEO
 */
export function generateLocalSEOMetaTags(city) {
  if (!city || !city.name) return '';
  
  return `
    <meta name="geo.placename" content="${city.name}" />
    <meta name="geo.region" content="US-${city.stateCode || ''}" />
    ${city.latitude && city.longitude ? `<meta name="geo.position" content="${city.latitude};${city.longitude}" />` : ''}
    ${city.latitude && city.longitude ? `<meta name="ICBM" content="${city.latitude}, ${city.longitude}" />` : ''}
    <meta name="location" content="${city.name}, ${city.state || ''}" />
  `;
}

/**
 * Creates a schema.org script tag from an object
 * @param {Object} schemaObj - Schema.org data structure
 * @returns {string} HTML script tag with JSON-LD
 */
export function createSchemaScriptTag(schemaObj) {
  if (!schemaObj) return '';
  
  return `<script type="application/ld+json">
    ${JSON.stringify(schemaObj)}
  </script>`;
} 