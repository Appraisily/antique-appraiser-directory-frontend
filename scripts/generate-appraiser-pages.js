/**
 * Generate static HTML pages for each appraiser
 * Uses standardized data from src/data/standardized/*.json
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';
import axios from 'axios';

// Get the current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const APPRAISER_DIR = path.join(DIST_DIR, 'appraiser');
const STANDARDIZED_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');
const TEMPLATE_FILE = path.join(DIST_DIR, 'index.html');
const GOOGLE_TAG_MANAGER_ID =
  process.env.VITE_GTM_ID ||
  process.env.GTM_CONTAINER_ID ||
  'GTM-PSLHDGM';

const ASSETS_BASE_URL = 'https://assets.appraisily.com/assets/directory';
const PLACEHOLDER_IMAGE = `${ASSETS_BASE_URL}/placeholder.jpg`;

function normalizeImageUrl(input = '') {
  const url = String(input || '').trim();
  if (!url) return PLACEHOLDER_IMAGE;
  if (url.startsWith(ASSETS_BASE_URL)) return url;
  if (url.startsWith('https://ik.imagekit.io/appraisily/')) {
    return `${ASSETS_BASE_URL}/${url.slice('https://ik.imagekit.io/appraisily/'.length)}`;
  }
  if (url.startsWith('https://placehold.co')) return PLACEHOLDER_IMAGE;
  return url;
}

const FALLBACK_IMAGES = [
  PLACEHOLDER_IMAGE,
  `${ASSETS_BASE_URL}/WebPage/logo_new.png`,
];

// Log with color and timestamp
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toISOString();
  let coloredMessage;

  switch (type) {
    case 'warning':
      coloredMessage = chalk.yellow(message);
      break;
    case 'error':
      coloredMessage = chalk.red(message);
      break;
    case 'success':
      coloredMessage = chalk.green(message);
      break;
    default:
      coloredMessage = chalk.blue(message);
  }

  console.log(`[${timestamp}] ${coloredMessage}`);
}

/**
 * Check if an image URL is accessible
 * @param {string} url - The image URL to check
 * @returns {Promise<boolean>} - Whether the image is accessible
 */
async function isImageAccessible(url) {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Get a random fallback image URL
 * @returns {string} - A random fallback image URL
 */
function getRandomFallbackImage() {
  const randomIndex = Math.floor(Math.random() * FALLBACK_IMAGES.length);
  return FALLBACK_IMAGES[randomIndex];
}

/**
 * Load all standardized appraiser data
 * @returns {Array} - Array of all appraisers
 */
function loadAllAppraisers() {
  const appraisers = [];
  
  // Read all JSON files in the standardized directory
  const files = fs.readdirSync(STANDARDIZED_DIR);
  
  for (const file of files) {
    if (file.endsWith('.json') && file !== 'README.md') {
      const filePath = path.join(STANDARDIZED_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.appraisers && Array.isArray(data.appraisers)) {
          // Add location to each appraiser
          const location = file.replace('.json', '');
          const appraisersWithLocation = data.appraisers.map(appraiser => ({
            ...appraiser,
            location
          }));
          appraisers.push(...appraisersWithLocation);
        }
      } catch (error) {
        log(`Error loading ${file}: ${error.message}`, 'error');
      }
    }
  }
  
  return appraisers;
}

function renderGtmAttributes(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const attrName = `data-gtm-${key.replace(/[A-Z]/g, '-$&').toLowerCase()}`;
      const attrValue = String(value).replace(/"/g, '&quot;');
      return ` ${attrName}="${attrValue}"`;
    })
    .join('');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLegacyRedirectHtml(appraiser, canonicalUrl, legacySlug) {
  const dataLayerPayload = {
    event: 'legacy_redirect_page_view',
    canonicalSlug: appraiser.slug,
    legacyId: appraiser.id ?? null,
    canonicalUrl,
    pagePath: `/appraiser/${legacySlug ?? appraiser.id ?? appraiser.slug}`,
  };

  const gtmHeadSnippet = GOOGLE_TAG_MANAGER_ID
    ? `
    <script>
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(${JSON.stringify(dataLayerPayload)});
    </script>
    <script>
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${GOOGLE_TAG_MANAGER_ID}');
    </script>`
    : '';

  const gtmBodySnippet = GOOGLE_TAG_MANAGER_ID
    ? `
    <noscript>
      <iframe src="https://www.googletagmanager.com/ns.html?id=${GOOGLE_TAG_MANAGER_ID}"
      height="0" width="0" style="display:none;visibility:hidden"></iframe>
    </noscript>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appraiser.name)} | Antique Appraiser Directory</title>
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    ${gtmHeadSnippet}
    <meta http-equiv="refresh" content="1;url=${escapeHtml(canonicalUrl)}" />
    <script>
      setTimeout(() => {
        window.location.replace('${canonicalUrl}');
      }, 250);
    </script>
  </head>
  <body>
    ${gtmBodySnippet}
    <p>If you are not redirected automatically, follow this <a href="${escapeHtml(canonicalUrl)}">link to ${escapeHtml(appraiser.name)}</a>.</p>
  </body>
</html>`;
}

/**
 * Generate HTML for an appraiser page
 * @param {Object} appraiser - The appraiser data
 * @returns {string} - The HTML content
 */
function generateAppraiserHtml(appraiser) {
  // Generate schema.org JSON-LD
  const appraiserSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": appraiser.name,
    "image": normalizeImageUrl(appraiser.imageUrl),
    "description": appraiser.content.about,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": appraiser.address.street,
      "addressLocality": appraiser.address.city,
      "addressRegion": appraiser.address.state,
      "postalCode": appraiser.address.zip,
      "addressCountry": "US"
    },
    "url": `/appraiser/${appraiser.slug}`,
    "telephone": appraiser.contact.phone,
    "email": appraiser.contact.email,
    "priceRange": appraiser.business.pricing,
    "openingHours": appraiser.business.hours.map(h => `${h.day} ${h.hours}`).join(', '),
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": appraiser.business.rating.toString(),
      "reviewCount": appraiser.business.reviewCount.toString(),
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": appraiser.reviews.map(review => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.author
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating.toString(),
        "bestRating": "5",
        "worstRating": "1"
      },
      "datePublished": review.date,
      "reviewBody": review.content
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": `Art Appraisers in ${appraiser.address.city}`,
        "item": `/location/${appraiser.address.city.toLowerCase().replace(/\s+/g, '-')}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": appraiser.name,
        "item": `/appraiser/${appraiser.slug}`
      }
    ]
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `What services does ${appraiser.name} offer?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": appraiser.expertise.services.join(', ')
        }
      },
      {
        "@type": "Question",
        "name": `What are ${appraiser.name}'s specialties?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": appraiser.expertise.specialties.join(', ')
        }
      },
      {
        "@type": "Question",
        "name": `How can I contact ${appraiser.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can contact ${appraiser.name} by phone at ${appraiser.contact.phone} or by email at ${appraiser.contact.email}.`
        }
      }
    ]
  };

  // Generate review HTML
  const reviewsHtml = appraiser.reviews.map(review => `
    <div class="border-b border-gray-100 pb-6 last:border-none last:pb-0">
      <div class="flex justify-between items-start mb-2">
        <h3 class="font-semibold text-gray-900">${review.author}</h3>
        <div class="flex items-center">
          <div class="flex">
            ${Array(5).fill(0).map((_, i) => `
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                class="h-4 w-4 ${i < review.rating ? 'text-yellow-500' : 'text-gray-300'}" 
                fill="${i < review.rating ? 'currentColor' : 'none'}" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
              </svg>
            `).join('')}
          </div>
          <span class="text-sm text-gray-500 ml-2">${review.date}</span>
        </div>
      </div>
      <p class="text-gray-700">${review.content}</p>
    </div>
  `).join('');

  // Generate specialties HTML
  const specialtiesHtml = appraiser.expertise.specialties.map(specialty => `
    <span class="bg-gray-100 text-gray-800 rounded-full px-3 py-1 text-sm">${specialty}</span>
  `).join('');

  // Generate services HTML
  const servicesHtml = appraiser.expertise.services.map(service => `
    <span class="border border-blue-200 text-blue-700 bg-blue-50 rounded-md px-3 py-1 text-sm">${service}</span>
  `).join('');

  // Generate certifications HTML
  const certificationsHtml = appraiser.expertise.certifications.map(cert => `
    <div class="flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      <span class="text-gray-700">${cert}</span>
    </div>
  `).join('');

  // Generate business hours HTML
  const hoursHtml = appraiser.business.hours.map(hour => `
    <div class="flex justify-between">
      <span class="text-gray-600">${hour.day}</span>
      <span class="text-gray-900 font-medium">${hour.hours}</span>
    </div>
  `).join('');

  // Main appraiser page content
  const mainContent = `
    <div id="root">
      <div class="container mx-auto px-4 py-8 mt-16">
        <nav class="flex mb-6" aria-label="Breadcrumb">
          <ol class="flex items-center space-x-2">
            <li>
              <a href="/" class="text-gray-500 hover:text-gray-700">Home</a>
            </li>
            <li class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <a 
                href="/location/${appraiser.address.city.toLowerCase().replace(/\s+/g, '-')}"
                class="ml-2 text-gray-500 hover:text-gray-700"
              >
                ${appraiser.address.city}
              </a>
            </li>
            <li class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span class="ml-2 text-gray-900 font-medium">${appraiser.name}</span>
            </li>
          </ol>
        </nav>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="md:col-span-1">
            <div class="rounded-lg overflow-hidden shadow-md mb-6">
              <img 
                src="${normalizeImageUrl(appraiser.imageUrl)}" 
                alt="${appraiser.name} - Art Appraiser in ${appraiser.address.city}"
                class="w-full h-auto object-cover"
                onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE}';"
              />
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-5 mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              
              <div class="space-y-3">
                <div class="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-3 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <div>
                    <p class="text-gray-700">${appraiser.address.formatted}</p>
                  </div>
                </div>
                
                <div class="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  <a href="tel:${appraiser.contact.phone}" class="text-gray-700 hover:text-blue-600"${renderGtmAttributes({
                    event: 'directory_cta',
                    cta: 'call',
                    surface: 'contact_card',
                    appraiserId: appraiser.slug,
                    appraiserName: appraiser.name
                  })}>
                    ${appraiser.contact.phone}
                  </a>
                </div>

                <div class="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <a href="mailto:${appraiser.contact.email}" class="text-gray-700 hover:text-blue-600"${renderGtmAttributes({
                    event: 'directory_cta',
                    cta: 'email',
                    surface: 'contact_card',
                    appraiserId: appraiser.slug,
                    appraiserName: appraiser.name
                  })}>
                    ${appraiser.contact.email}
                  </a>
                </div>

                ${appraiser.contact.website ? `
                <div class="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  <a 
                    href="${appraiser.contact.website.startsWith('http') ? appraiser.contact.website : `https://${appraiser.contact.website}`}" 
                    class="text-gray-700 hover:text-blue-600"
                    target="_blank"
                    rel="noopener noreferrer"
                    ${renderGtmAttributes({
                      event: 'directory_cta',
                      cta: 'website',
                      surface: 'contact_card',
                      appraiserId: appraiser.slug,
                      appraiserName: appraiser.name
                    })}
                  >
                    Visit Website
                  </a>
                </div>
                ` : ''}
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-5 mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Business Hours</h3>
              <div class="space-y-2">
                ${hoursHtml}
              </div>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-5">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Certifications</h3>
              <div class="space-y-2">
                ${certificationsHtml}
              </div>
              
              <div class="mt-6 pt-4 border-t border-gray-100">
                <a
                  href="https://appraisily.com/start"
                  class="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-medium transition-all duration-300"
                  ${renderGtmAttributes({
                    event: 'directory_cta',
                    cta: 'request_appraisal',
                    surface: 'contact_sidebar',
                    appraiserId: appraiser.slug,
                    appraiserName: appraiser.name
                  })}
                >
                  Request an Appraisal
                </a>
              </div>
            </div>
          </div>
          
          <div class="md:col-span-2">
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
              <div class="flex items-center justify-between mb-4">
                <h1 class="text-3xl font-bold text-gray-900">${appraiser.name}</h1>
                
                <div class="flex items-center">
                  <div class="flex items-center bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-yellow-500 mr-1" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                    <span class="font-semibold">${appraiser.business.rating.toFixed(1)}</span>
                    <span class="text-sm text-gray-500 ml-1">
                      (${appraiser.business.reviewCount})
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="mb-6">
                <p class="text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span class="text-sm mr-3">
                    ${appraiser.business.yearsInBusiness}
                  </span>
                  
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span class="text-sm">
                    ${appraiser.address.city}, ${appraiser.address.state}
                  </span>
                </p>
              </div>
              
              <h2 class="text-xl font-semibold text-gray-900 mb-3">About</h2>
              <p class="text-gray-700 mb-6 leading-relaxed">
                ${appraiser.content.about}
              </p>
              
              ${appraiser.content.notes ? `
              <div class="bg-blue-50 text-blue-700 p-4 rounded-md mb-6">
                <p>${appraiser.content.notes}</p>
              </div>
              ` : ''}
              
              <h2 class="text-xl font-semibold text-gray-900 mb-3">Specialties</h2>
              <div class="flex flex-wrap gap-2 mb-6">
                ${specialtiesHtml}
              </div>
              
              <h2 class="text-xl font-semibold text-gray-900 mb-3">Services</h2>
              <div class="flex flex-wrap gap-2 mb-6">
                ${servicesHtml}
              </div>
              
              <h2 class="text-xl font-semibold text-gray-900 mb-3">Pricing</h2>
              <p class="text-gray-700 mb-6">
                ${appraiser.business.pricing}
              </p>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-xl font-semibold text-gray-900 mb-4">Reviews</h2>
              
              ${appraiser.reviews.length > 0 ? `
              <div class="space-y-6">
                ${reviewsHtml}
              </div>
              ` : `
              <p class="text-gray-500 italic">No reviews yet.</p>
              `}
              
              <div class="mt-8 pt-6 border-t border-gray-100">
                <h3 class="font-medium text-gray-900 mb-3">Need Art Appraisal Services?</h3>
                <p class="text-gray-600 mb-4">
                  Contact ${appraiser.name} directly or use our platform to request an appraisal.
                </p>
                <div class="flex flex-col sm:flex-row gap-3">
                  <a 
                    href="tel:${appraiser.contact.phone}"
                    class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    ${renderGtmAttributes({
                      event: 'directory_cta',
                      cta: 'call',
                      surface: 'cta_block',
                      appraiserId: appraiser.slug,
                      appraiserName: appraiser.name
                    })}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    Call Now
                  </a>
                  <a 
                    href="mailto:${appraiser.contact.email}"
                    class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    ${renderGtmAttributes({
                      event: 'directory_cta',
                      cta: 'email',
                      surface: 'cta_block',
                      appraiserId: appraiser.slug,
                      appraiserName: appraiser.name
                    })}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    Send Email
                  </a>
                  <a 
                    href="https://appraisily.com/start"
                    class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    ${renderGtmAttributes({
                      event: 'directory_cta',
                      cta: 'request_appraisal',
                      surface: 'cta_block',
                      appraiserId: appraiser.slug,
                      appraiserName: appraiser.name
                    })}
                  >
                    Request Appraisal
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const seoTitle = `${appraiser.name} - Art Appraiser in ${appraiser.address.city} | Expert Art Valuation Services`;
  const seoDescription = `Get professional art appraisal services from ${appraiser.name} in ${appraiser.address.city}. Specializing in ${appraiser.expertise.specialties.join(', ')}. Certified expert with verified reviews.`;
  const canonicalUrl = `https://antique-appraiser-directory.appraisily.com/appraiser/${appraiser.slug}/`;

  return {
    title: seoTitle,
    description: seoDescription,
    schema: [appraiserSchema, breadcrumbSchema, faqSchema],
    content: mainContent,
    canonicalUrl
  };
}

/**
 * Generate an HTML page with the template and appraiser content
 * @param {string} templateHtml - The HTML template
 * @param {Object} appraiserPage - The appraiser page data
 * @returns {string} - The complete HTML page
 */
function generatePageHtml(templateHtml, appraiserPage) {
  const dom = new JSDOM(templateHtml);
  const { document } = dom.window;
  
  // Update title and meta description
  document.title = appraiserPage.title;
  
  // Update meta description
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', appraiserPage.description);
  }
  
  // Add JSON-LD schema
  const head = document.querySelector('head');
  const schemaScript = document.createElement('script');
  schemaScript.setAttribute('type', 'application/ld+json');
  schemaScript.textContent = JSON.stringify(appraiserPage.schema);
  head.appendChild(schemaScript);

  // Ensure canonical tag points to the appraiser profile
  if (appraiserPage.canonicalUrl) {
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', appraiserPage.canonicalUrl);
  }
  
  // Update the content
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = appraiserPage.content;
  }
  
  return dom.serialize();
}

/**
 * Main function to generate appraiser pages
 */
async function main() {
  try {
    // Check if dist directory exists
    if (!fs.existsSync(DIST_DIR)) {
      log('Dist directory not found. Please run a build first.', 'error');
      process.exit(1);
    }

    // Ensure appraiser directory exists
    fs.ensureDirSync(APPRAISER_DIR);
    
    // Check if template file exists
    if (!fs.existsSync(TEMPLATE_FILE)) {
      log('Template file not found. Please run a build first.', 'error');
      process.exit(1);
    }
    
    // Read template file
    const templateHtml = fs.readFileSync(TEMPLATE_FILE, 'utf8');
    
    // Load all appraisers
    const appraisers = loadAllAppraisers();
    log(`Found ${appraisers.length} appraisers`, 'info');
    
    // Generate pages for each appraiser
    let processedCount = 0;
    let errorCount = 0;
    
    for (const appraiser of appraisers) {
      try {
        // Verify the image URL is accessible
        const imageUrl = normalizeImageUrl(appraiser.imageUrl);
        const isImageValid = await isImageAccessible(imageUrl);
        
        // If image is not valid, use a random fallback
        if (!isImageValid) {
          log(`Image for ${appraiser.name} is not accessible: ${imageUrl}`, 'warning');
          appraiser.imageUrl = getRandomFallbackImage();
        }
        
        // Create appraiser directory if it doesn't exist
        const appraiserDirPath = path.join(APPRAISER_DIR, appraiser.slug);
        fs.ensureDirSync(appraiserDirPath);
        
        // Generate HTML content
        const appraiserPage = generateAppraiserHtml(appraiser);
        const pageHtml = generatePageHtml(templateHtml, appraiserPage);
        
        // Write HTML file
        const htmlPath = path.join(appraiserDirPath, 'index.html');
        fs.writeFileSync(htmlPath, pageHtml);

        // Generate legacy alias if ID differs from slug for backwards compatibility
        if (appraiser.id) {
          const canonicalUrl = `https://antique-appraiser-directory.appraisily.com/appraiser/${appraiser.slug}/`;
          const legacySlugs = new Set([
            appraiser.id,
            appraiser.id.replace(/\s+/g, '-'),
            appraiser.id.replace(/\s+/g, '_'),
            appraiser.slug // ensure canonical included for de-dupe
          ]);

          legacySlugs.delete(appraiser.slug);

          legacySlugs.forEach(legacySlug => {
            const legacyHtml = buildLegacyRedirectHtml(appraiser, canonicalUrl, legacySlug);
            const legacyDirPath = path.join(APPRAISER_DIR, legacySlug);
            fs.ensureDirSync(legacyDirPath);
            const legacyHtmlPath = path.join(legacyDirPath, 'index.html');
            fs.writeFileSync(legacyHtmlPath, legacyHtml);
          });
        }
        
        log(`Generated page for ${appraiser.name} (${appraiser.slug})`, 'success');
        processedCount++;
      } catch (error) {
        log(`Error generating page for ${appraiser.name}: ${error.message}`, 'error');
        errorCount++;
      }
    }
    
    log(`Completed! Generated ${processedCount} appraiser pages (${errorCount} errors)`, 'success');
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the script
main();
