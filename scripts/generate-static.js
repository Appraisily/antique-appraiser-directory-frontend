import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateLocationPageHTML, generateAppraiserPageHTML, validateAndUpdateAppraiserImages, saveValidatedAppraiserData } from './utils/template-generators.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

// Default placeholder image for missing images
const DEFAULT_PLACEHOLDER_IMAGE = 'https://ik.imagekit.io/appraisily/placeholder-art-image.jpg';

// Update the error handling script - MOVED UP to avoid reference issues
const imageErrorHandlingScript = `
    <!-- Image error handling script -->
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          // Only add error handler if not already present
          if (!img.hasAttribute('data-has-error-handler')) {
            img.setAttribute('data-has-error-handler', 'true');
            img.onerror = function() {
              console.log('Replacing broken image:', this.src);
              this.onerror = null;
              // Use placehold.co instead of ImageKit for better reliability
              this.src = 'https://placehold.co/300x300/e0e0e0/333333?text=Image+Unavailable';
              // Add a class for styling broken images
              this.classList.add('fallback-image');
            };
            // Force reload to trigger onerror for already broken images
            if (img.complete) {
              if (!img.naturalWidth) {
                img.src = img.src;
              }
            }
          }
        });
      });
    </script>`;

// ImageKit base URL for appraiser images
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/appraisily/appraiser-images';

// Ensure dist directory exists
fs.ensureDirSync(DIST_DIR);

// Get and copy assets
const assetsDir = path.join(DIST_DIR, 'assets');
const assetFiles = fs.readdirSync(assetsDir);
const cssFile = assetFiles.find(file => file.endsWith('.css'));
const jsFile = assetFiles.find(file => file.endsWith('.js'));

// Construct the ABSOLUTE asset paths
// This is important - let's use absolute URLs to avoid path issues
const cssPath = `/assets/${cssFile}`;
const jsPath = `/assets/${jsFile}`;

console.log(`CSS file path: ${cssPath}`);
console.log(`JS file path: ${jsPath}`);

// Function to generate standardized image URL that matches the image generator pattern
function generateImageUrl(appraiser) {
  // First check if the appraiser already has a proper imageUrl that includes the timestamp/ID pattern
  if (appraiser.imageUrl && appraiser.imageUrl.includes('_') && (appraiser.imageUrl.includes('?updatedAt=') || appraiser.imageUrl.includes('_V'))) {
    return appraiser.imageUrl;
  }
  
  // If appraiser has image URL but doesn't match the pattern, use it as fallback
  if (appraiser.image || appraiser.imageUrl) {
    return appraiser.image || appraiser.imageUrl;
  }
  
  // Otherwise return the default placeholder
  return DEFAULT_PLACEHOLDER_IMAGE;
}

// Read all location JSON files
const locationFiles = fs.readdirSync(LOCATIONS_DIR)
  .filter(file => file.endsWith('.json') && !file.includes('copy') && !file.includes('lifecycle') && !file.includes('cors') && !file.includes('hugo'));

// Generate HTML for each location
locationFiles.forEach(file => {
  const locationData = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, file)));
  const citySlug = file.replace('.json', '');
  const cityName = citySlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Create location directory
  const locationDir = path.join(DIST_DIR, 'location', citySlug);
  fs.ensureDirSync(locationDir);

  // Generate HTML
  const html = generateLocationHTML(locationData, cityName, citySlug, cssPath, jsPath);
  fs.writeFileSync(path.join(locationDir, 'index.html'), html);

  // Generate HTML for each appraiser
  locationData.appraisers?.forEach(appraiser => {
    if (appraiser.id) {
      const appraiserDir = path.join(DIST_DIR, 'appraiser', appraiser.id);
      fs.ensureDirSync(appraiserDir);

      const appraiserHtml = generateAppraiserHTML(appraiser, cityName, cssPath, jsPath);
      fs.writeFileSync(path.join(appraiserDir, 'index.html'), appraiserHtml);
    }
  });
});

// Common footer HTML - replace the old script with the new one
function getFooterHTML(jsPath) {
  return `
    <script type="module" crossorigin src="${jsPath}"></script>
    ${imageErrorHandlingScript}
  </body>
</html>`;
}

function generateLocationHTML(locationData, cityName, citySlug, cssPath, jsPath) {
  const title = `Art Appraisers in ${cityName} | Expert Art Valuation Services | Appraisily`;
  const description = `Find certified art appraisers in ${cityName}. Get expert art valuations, authentication services, and professional advice for your art collection.`;
  const canonicalUrl = `https://art-appraiser.appraisily.com/location/${citySlug}`;
  const locationImage = locationData.imageUrl || 'https://ik.imagekit.io/appraisily/location-images/default-city.jpg';
  
  // Create schema data
  const locationSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `Art Appraisal Services in ${cityName}`,
    "description": `Find top-rated art appraisers in ${cityName}, ${locationData.state}. Professional art valuation services for insurance, estate planning, donations, and more.`,
    "serviceType": "Art Appraisal",
    "areaServed": {
      "@type": "City",
      "name": cityName,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": cityName,
        "addressRegion": locationData.state,
        "addressCountry": "US"
      }
    },
    "provider": locationData.appraisers?.map(appraiser => ({
      "@type": "ProfessionalService",
      "name": appraiser.name,
      "image": appraiser.image || appraiser.imageUrl,
      "url": `https://art-appraiser.appraisily.com/appraiser/${appraiser.id}`
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
        "item": "https://art-appraiser.appraisily.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": `Art Appraisers in ${cityName}`,
        "item": canonicalUrl
      }
    ]
  };
  
  // FAQ schema specific to locations
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `How do I find an art appraiser in ${cityName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can find qualified art appraisers in ${cityName} through our directory. We list certified professionals who specialize in various types of art and collectibles.`
        }
      },
      {
        "@type": "Question",
        "name": `What services do art appraisers in ${cityName} offer?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Art appraisers in ${cityName} offer various services including valuations for insurance purposes, estate planning, donations, sales, and purchases. Many also provide authentication services and consultations.`
        }
      },
      {
        "@type": "Question",
        "name": `How much does an art appraisal cost in ${cityName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Art appraisal costs in ${cityName} vary depending on the complexity of the item, the purpose of the appraisal, and the appraiser's experience. Many appraisers charge either a flat fee per item or an hourly rate.`
        }
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="art appraiser, ${cityName} art appraisal, artwork valuation, art authentication, art insurance appraisal, fine art appraisal" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="index, follow" />
    
    <!-- Performance optimization -->
    <link rel="preload" href="${cssPath}" as="style" />
    <link rel="stylesheet" href="${cssPath}" />
    <link rel="preload" href="${jsPath}" as="script" />
    
    <!-- Open Graph tags -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${locationImage}" />
    
    <!-- Twitter Card data -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${locationImage}" />
    
    <!-- Schema.org markup -->
    <script type="application/ld+json">
      ${JSON.stringify(locationSchema)}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify(breadcrumbSchema)}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify(faqSchema)}
    </script>
    
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
    <!-- End Google Tag Manager (noscript) -->
    
    <div id="root">
      <!-- SSR content will be injected here during build -->
      <div data-location-city="${cityName}" data-location-slug="${citySlug}">
        <h1>Art Appraisers in ${cityName}</h1>
        <p>Find certified art appraisers in ${cityName}. Get expert art valuations, authentication services, and professional advice for your art collection.</p>
        
        <section>
          <h2>Top Art Appraisers in ${cityName}</h2>
          ${locationData.appraisers?.map(appraiser => `
            <div class="appraiser-card" data-appraiser-id="${appraiser.id}">
              <h3>${appraiser.name}</h3>
              <p>${appraiser.specialties?.join(', ')}</p>
              <a href="/appraiser/${appraiser.id}">View Details</a>
            </div>
          `).join('') || ''}
        </section>
      </div>
    </div>

    <script type="module" src="${jsPath}"></script>
    ${imageErrorHandlingScript}
  </body>
</html>`;
}

function generateAppraiserHTML(appraiser, cityName, cssPath, jsPath) {
  // Format appraiser name and business name for SEO-friendly title
  const displayName = appraiser.businessName 
    ? `${appraiser.name} (${appraiser.businessName})` 
    : appraiser.name;
  
  const title = `${displayName} - Art Appraiser | Expert Art Valuation Services`;
  const specialties = appraiser.specialties?.join(', ') || '';
  const description = `Get professional art appraisal services from ${displayName}. Specializing in ${specialties}. Certified expert with ${appraiser.reviewCount || 'verified'} reviews.`;
  const canonicalUrl = `https://art-appraiser.appraisily.com/appraiser/${appraiser.id}`;
  const imageUrl = generateImageUrl(appraiser);
  
  // Create schema data for appraiser
  const appraiserSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": displayName,
    "image": imageUrl,
    "description": appraiser.about || description,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": appraiser.address?.split(',')[0]?.trim() || cityName,
      "addressRegion": appraiser.address?.split(',')[1]?.trim() || '',
      "addressCountry": "US"
    },
    "url": canonicalUrl,
    "telephone": appraiser.phone || '',
    "email": appraiser.email || '',
    "priceRange": "$$$",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": appraiser.rating?.toString() || "5",
      "reviewCount": appraiser.reviewCount?.toString() || "1",
      "bestRating": "5",
      "worstRating": "1"
    }
  };
  
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://art-appraiser.appraisily.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": `Art Appraisers in ${cityName}`,
        "item": `https://art-appraiser.appraisily.com/location/${cityName.toLowerCase().replace(/\s+/g, '-')}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": displayName,
        "item": canonicalUrl
      }
    ]
  };
  
  // FAQ schema specific to this appraiser
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `What services does ${displayName} offer?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": appraiser.services?.map(s => s.name).join(', ') || `${displayName} offers professional art appraisal services including valuations for insurance, estate planning, donations, and sales.`
        }
      },
      {
        "@type": "Question",
        "name": `What are ${displayName}'s specialties?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": specialties || `${displayName} specializes in appraising various types of artwork and collectibles.`
        }
      },
      {
        "@type": "Question",
        "name": `How can I contact ${displayName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can contact ${displayName} by phone at ${appraiser.phone || 'the number listed on their profile'} or by email at ${appraiser.email || 'the email address on their profile'}.`
        }
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/directory/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${specialties}, art appraiser, art valuation, ${cityName} art appraiser" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="index, follow" />
    
    <!-- Performance optimization -->
    <link rel="preload" href="${cssPath}" as="style" />
    <link rel="stylesheet" href="${cssPath}" />
    
    <!-- Open Graph tags -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:site_name" content="Appraisily" />
    
    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    
    <!-- Schema.org structured data -->
    <script type="application/ld+json">
      ${JSON.stringify(appraiserSchema)}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify(breadcrumbSchema)}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify(faqSchema)}
    </script>
    
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
    <!-- End Google Tag Manager (noscript) -->

    <div id="root">
      <!-- This content will be replaced by client-side React when JS loads -->
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/services">Services</a>
        </nav>
      </header>
      
      <main>
        <article itemscope itemtype="https://schema.org/ProfessionalService">
          <h1 itemprop="name">${displayName}</h1>
          
          <div class="appraiser-info">
            <div class="appraiser-image">
              <img src="${imageUrl}" alt="${displayName}" itemprop="image" width="300" height="300" loading="lazy" />
            </div>
            
            <div class="appraiser-details">
              <p itemprop="description">${appraiser.about || description}</p>
              
              <div itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
                <p><strong>Location:</strong> <span itemprop="addressLocality">${appraiser.address || cityName}</span></p>
              </div>
              
              ${appraiser.phone ? `<p><strong>Phone:</strong> <span itemprop="telephone">${appraiser.phone}</span></p>` : ''}
              ${appraiser.email ? `<p><strong>Email:</strong> <span itemprop="email">${appraiser.email}</span></p>` : ''}
              ${appraiser.website ? `<p><strong>Website:</strong> <a href="${appraiser.website}" itemprop="url" rel="noopener noreferrer">${appraiser.website}</a></p>` : ''}
            </div>
          </div>
          
          <section>
            <h2>Specialties</h2>
            <ul>
              ${appraiser.specialties?.map(specialty => `<li>${specialty}</li>`).join('') || '<li>Fine Art Appraisal</li>'}
            </ul>
          </section>
        </article>
      </main>
      
      <footer>
        <p>&copy; ${new Date().getFullYear()} Appraisily. All rights reserved.</p>
      </footer>
    </div>
    
    <!-- Load JS at the end for better performance -->
    <script src="${jsPath}" defer></script>
    ${imageErrorHandlingScript}
  </body>
</html>`;
}

// Add image validation at the beginning of the process
async function generateStaticHTML() {
  console.log('Starting static HTML generation...');
  try {
    // Create necessary directories
    // ... existing code ...
    
    // Get appraiser data
    const appraisersData = await getAppraisers();
    
    // Validate and update appraiser images
    console.log('Validating appraiser images...');
    const validatedAppraisers = await validateAndUpdateAppraiserImages(appraisersData);
    
    // Cache validated data for future use
    await saveValidatedAppraiserData(validatedAppraisers, path.join(DIST_DIR, 'data', 'validated-appraisers.json'));
    
    // Generate appraiser pages
    console.log('Generating appraiser pages...');
    for (const appraiser of validatedAppraisers) {
      // ... existing code ...
      const htmlContent = await generateAppraiserPageHTML(appraiser);
      // ... existing code ...
    }
    
    // Generate location pages
    console.log('Generating location pages...');
    const locations = getUniqueLocations(validatedAppraisers);
    for (const location of locations) {
      // ... existing code ...
      const appraisersInLocation = validatedAppraisers.filter(a => 
        (a.city && a.city.toLowerCase() === location.city.toLowerCase()) || 
        (a.location && a.location.toLowerCase().includes(location.city.toLowerCase()))
      );
      const htmlContent = await generateLocationPageHTML({
        cityName: location.city,
        stateName: location.state,
        appraisers: appraisersInLocation,
        seoData: {}
      });
      // ... existing code ...
    }
    
    // ... existing code ...
  } catch (error) {
    console.error('Error generating static HTML:', error);
  }
}