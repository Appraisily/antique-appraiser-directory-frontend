#!/usr/bin/env node

/**
 * Fix-All-Pages.js
 * 
 * This script fixes all the static HTML files for the site:
 * 1. Fixes React hydration issues
 * 2. Injects fallback image handler
 * 3. Rebuilds with correct paths
 * 4. Generates static HTML files for all location pages
 * 5. Updates "Art Appraiser" to "Antique Appraiser" throughout
 * 6. Generates appraiser pages
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import chalk from 'chalk';
import { getGtmBodySnippet, getGtmHeadSnippet } from './utils/gtm.js';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CITIES_PATH = path.join(ROOT_DIR, 'src', 'data', 'cities.json');
const STANDARDIZED_DATA_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');

// US state abbreviation to full name mapping for geo.region
const STATE_ABBR_TO_FULL = {
  'AL': 'US-AL', 'AK': 'US-AK', 'AZ': 'US-AZ', 'AR': 'US-AR', 'CA': 'US-CA',
  'CO': 'US-CO', 'CT': 'US-CT', 'DE': 'US-DE', 'FL': 'US-FL', 'GA': 'US-GA',
  'HI': 'US-HI', 'ID': 'US-ID', 'IL': 'US-IL', 'IN': 'US-IN', 'IA': 'US-IA',
  'KS': 'US-KS', 'KY': 'US-KY', 'LA': 'US-LA', 'ME': 'US-ME', 'MD': 'US-MD',
  'MA': 'US-MA', 'MI': 'US-MI', 'MN': 'US-MN', 'MS': 'US-MS', 'MO': 'US-MO',
  'MT': 'US-MT', 'NE': 'US-NE', 'NV': 'US-NV', 'NH': 'US-NH', 'NJ': 'US-NJ',
  'NM': 'US-NM', 'NY': 'US-NY', 'NC': 'US-NC', 'ND': 'US-ND', 'OH': 'US-OH',
  'OK': 'US-OK', 'OR': 'US-OR', 'PA': 'US-PA', 'RI': 'US-RI', 'SC': 'US-SC',
  'SD': 'US-SD', 'TN': 'US-TN', 'TX': 'US-TX', 'UT': 'US-UT', 'VT': 'US-VT',
  'VA': 'US-VA', 'WA': 'US-WA', 'WV': 'US-WV', 'WI': 'US-WI', 'WY': 'US-WY',
  'DC': 'US-DC', 'ON': 'CA-ON', 'AB': 'CA-AB', 'BC': 'CA-BC', 'QC': 'CA-QC'
};

/**
 * Load standardized location data for a city slug
 */
function loadLocationData(citySlug) {
  const locationPath = path.join(STANDARDIZED_DATA_DIR, `${citySlug}.json`);
  if (fs.existsSync(locationPath)) {
    return JSON.parse(fs.readFileSync(locationPath, 'utf-8'));
  }
  return null;
}

/**
 * Generate JSON-LD schema for a location page
 */
function generateLocationSchemaJson(locationData, cityName, stateCode, citySlug) {
  if (!locationData || !locationData.appraisers || locationData.appraisers.length === 0) {
    return null;
  }

  const appraisers = locationData.appraisers;
  const providers = appraisers.map((a, index) => ({
    "@type": "LocalBusiness",
    "name": a.name || 'Antique Appraiser',
    "image": a.imageUrl || 'https://assets.appraisily.com/assets/directory/placeholder.jpg',
    "address": {
      "@type": "PostalAddress",
      "addressLocality": a.address?.city || cityName,
      "addressRegion": a.address?.state || stateCode,
      "addressCountry": "US"
    },
    "priceRange": a.business?.pricing || "$$-$$$",
    "telephone": a.contact?.phone || "",
    "url": `https://antique-appraiser-directory.appraisily.com/appraiser/${a.slug}/`,
    "aggregateRating": a.business?.rating ? {
      "@type": "AggregateRating",
      "ratingValue": a.business.rating.toString(),
      "reviewCount": (a.business.reviewCount || 1).toString(),
      "bestRating": "5",
      "worstRating": "1"
    } : undefined
  })).filter(p => p);

  // Calculate aggregate rating across all appraisers
  const ratedAppraisers = appraisers.filter(a => a.business?.rating > 0);
  let aggregateRating = undefined;
  if (ratedAppraisers.length > 0) {
    const totalRating = ratedAppraisers.reduce((sum, a) => sum + (a.business?.rating || 0), 0);
    const totalReviews = ratedAppraisers.reduce((sum, a) => sum + (a.business?.reviewCount || 0), 0);
    const avgRating = totalRating / ratedAppraisers.length;
    aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": avgRating.toFixed(1),
      "reviewCount": totalReviews.toString(),
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `https://antique-appraiser-directory.appraisily.com/location/${citySlug}/`,
    "name": `Antique Appraisers in ${cityName}, ${stateCode}`,
    "description": `Compare ${appraisers.length} antique appraisers in ${cityName}, ${stateCode} for estate, insurance, donation, and personal-property valuations. Review local experts and online options.`,
    "numberOfItems": appraisers.length,
    "itemListElement": providers.map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": p
    })),
    ...(aggregateRating ? { aggregateRating } : {}),
    "areaServed": {
      "@type": "City",
      "name": cityName,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": cityName,
        "addressRegion": stateCode,
        "addressCountry": "US"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://antique-appraiser-directory.appraisily.com/location/${citySlug}/`
    },
    "keywords": [
      `antique appraisers in ${cityName}`,
      `antique appraisers near ${cityName}`,
      `antique appraisers near me ${cityName}`,
      `${cityName} antique appraisers`,
      `antique valuation ${cityName}`,
      `antique authentication ${cityName}`,
      `antique appraiser near me`
    ]
  };

  return schema;
}

/**
 * Generate FAQ schema for a location page
 */
function generateLocationFaqSchemaJson(cityName) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Where can I find antique appraisers near me in ${cityName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `This directory lists antique appraisers serving ${cityName}. You can contact local providers directly or use Appraisily for a fast online antique appraisal alternative.`
        }
      },
      {
        "@type": "Question",
        "name": `How much does an antique appraisal cost in ${cityName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Antique appraisal costs in ${cityName} vary by provider and item complexity. Browse the appraisers above to compare pricing, or start an online appraisal with Appraisily for transparent upfront pricing.`
        }
      },
      {
        "@type": "Question",
        "name": `What should I look for in an antique appraiser near ${cityName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Look for certified appraisers with expertise in your specific item type (furniture, jewelry, artwork, etc.), transparent pricing, and experience with your appraisal purpose (insurance, estate, donation, or resale).`
        }
      },
      {
        "@type": "Question",
        "name": "How does an online antique appraisal work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Submit clear photos, measurements, and any provenance. Our experts review the item and deliver a written valuation report online."
        }
      }
    ]
  };
}

/**
 * Generate BreadcrumbList schema for a location page
 */
function generateBreadcrumbSchemaJson(cityName, citySlug) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://antique-appraiser-directory.appraisily.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": `Antique Appraisers in ${cityName}`,
        "item": `https://antique-appraiser-directory.appraisily.com/location/${citySlug}/`
      }
    ]
  };
}

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
 * Run a script as a subprocess and return its output
 */
function runScript(command, args = []) {
  return new Promise((resolve, reject) => {
    const cmdString = `${command} ${args.join(' ')}`;
    log(`Running command: ${cmdString}`, 'info');
    
    exec(cmdString, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
      if (error) {
        log(`Error running script: ${error.message}`, 'error');
        log(stderr, 'error');
        reject(error);
        return;
      }
      
      resolve(stdout);
    });
  });
}

/**
 * Get all HTML files in the dist directory
 */
async function getAllHtmlFiles(dir = DIST_DIR) {
  const files = await fs.readdir(dir);
  let htmlFiles = [];
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      const nestedFiles = await getAllHtmlFiles(filePath);
      htmlFiles = [...htmlFiles, ...nestedFiles];
    } else if (file.endsWith('.html')) {
      htmlFiles.push(filePath);
    }
  }
  
  return htmlFiles;
}

/**
 * Fix React hydration in all HTML files - Optimized version
 * This processes files in batches to prevent excessive subprocess spawning
 */
async function fixAllHydrationIssues() {
  log('Fixing React hydration issues in all HTML files...', 'info');
  
  try {
    const htmlFiles = await getAllHtmlFiles();
    log(`Found ${htmlFiles.length} HTML files to process.`, 'info');
    
    // Instead of processing each file individually, run the script once
    // for specific important files, then let it handle everything else
    
    // Process the main index.html first
    const mainIndex = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(mainIndex)) {
      log('Processing main index.html...', 'info');
      await runScript('node', [path.join(__dirname, 'fix-react-hydration.js'), 'index.html']);
    }
    
    // Process the Cleveland location page 
    const clevelandPage = path.join(DIST_DIR, 'location', 'cleveland', 'index.html');
    if (fs.existsSync(clevelandPage)) {
      log('Processing Cleveland location page...', 'info');
      await runScript('node', [path.join(__dirname, 'fix-react-hydration.js'), 'location/cleveland/index.html']);
    }
    
    // Now run the script without a specific file, which will make it process all files
    log('Processing all remaining HTML files...', 'info');
    const output = await runScript('node', [path.join(__dirname, 'fix-react-hydration.js')]);
    
    log('Completed hydration fixes', 'success');
    return htmlFiles.length;
  } catch (error) {
    log(`Error fixing hydration issues: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Create HTML files for all location pages
 */
async function generateLocationPages() {
  log('Generating static HTML files for all location pages...', 'info');
  
  try {
    // Check if cities data exists
    if (!fs.existsSync(CITIES_PATH)) {
      log('⚠️ Cities data file not found!', 'warning');
      return 0;
    }

    // Read cities data
    const citiesData = JSON.parse(fs.readFileSync(CITIES_PATH, 'utf-8'));
    const cities = citiesData.cities || [];

    if (cities.length === 0) {
      log('⚠️ No cities found in the data file!', 'warning');
      return 0;
    }

    log(`📊 Found ${cities.length} cities to process`, 'info');
    let generatedCount = 0;

    // Create location directories and HTML files
    for (const city of cities) {
      const locationDir = path.join(DIST_DIR, 'location', city.slug);
      
      // Create directory if it doesn't exist
      fs.ensureDirSync(locationDir);
      
      // Read the index.html content to use as template
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (!fs.existsSync(indexPath)) {
        log(`⚠️ Index file not found at ${indexPath}!`, 'warning');
        continue;
      }
      
      const indexHtml = fs.readFileSync(indexPath, 'utf-8');
      
      // Load location data for structured data
      const locationData = loadLocationData(city.slug);
      const appraiserCount = locationData?.appraisers?.length || 0;
      
      // Create optimized city-specific meta tags with "near me" intent
      const expertLabel = appraiserCount === 1 ? 'Local Expert' : 'Local Experts';
      const title = appraiserCount > 0
        ? `${city.name} Antique Appraisers | Compare ${appraiserCount} ${expertLabel}`
        : `${city.name} Antique Appraisers | Local & Online Options`;
      const description = appraiserCount > 0
        ? `Compare ${appraiserCount} antique appraisers in ${city.name}, ${city.state} for estate, insurance, donation, and personal-property valuations. Review local experts and online options.`
        : `Find antique appraisers in ${city.name}, ${city.state} for estate, insurance, donation, and personal-property needs. Compare local providers and online appraisal options.`;
      const canonicalUrl = `https://antique-appraiser-directory.appraisily.com/location/${city.slug}/`;
      
      // Update HTML with city-specific meta tags
      const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
      const canonicalRegex = /<link rel="canonical" href=".*?"\s*\/?>/;

      let cityHtml = indexHtml
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${description}"`);

      if (canonicalRegex.test(cityHtml)) {
        cityHtml = cityHtml.replace(canonicalRegex, canonicalTag);
      } else {
        cityHtml = cityHtml.replace('</head>', `    ${canonicalTag}\n  </head>`);
      }

      // Add geo meta tags for local SEO
      const geoRegion = STATE_ABBR_TO_FULL[city.state] || `US-${city.state}`;
      const geoMetaTags = `<meta name="geo.placename" content="${city.name}, ${city.state}" />
    <meta name="geo.region" content="${geoRegion}" />`;
      
      if (typeof city.latitude === 'number' && typeof city.longitude === 'number') {
        const geoPosition = `${city.latitude};${city.longitude}`;
        cityHtml = cityHtml.replace('</head>', `    <meta name="ICBM" content="${geoPosition}" />
    ${geoMetaTags}
  </head>`);
      } else {
        cityHtml = cityHtml.replace('</head>', `    ${geoMetaTags}
  </head>`);
      }

      // Inject JSON-LD structured data
      const schemas = [];
      const locationSchema = generateLocationSchemaJson(locationData, city.name, city.state, city.slug);
      if (locationSchema) schemas.push(locationSchema);
      schemas.push(generateBreadcrumbSchemaJson(city.name, city.slug));
      schemas.push(generateLocationFaqSchemaJson(`${city.name}, ${city.state}`));
      
      if (schemas.length > 0) {
        const schemaJson = JSON.stringify(schemas);
        const schemaTag = `<script type="application/ld+json" data-appraisily-schema="schemas">${schemaJson}</script>`;
        cityHtml = cityHtml.replace('</head>', `    ${schemaTag}
  </head>`);
      }

      const hasGtmHead = cityHtml.includes('https://www.googletagmanager.com/gtm.js');
      if (!hasGtmHead) {
        const headSnippet = getGtmHeadSnippet().trim().split('\n').map(line => `    ${line}`).join('\n');
        cityHtml = cityHtml.replace('</head>', `${headSnippet}\n  </head>`);
      }

      const hasGtmNoscript = cityHtml.includes('https://www.googletagmanager.com/ns.html');
      if (!hasGtmNoscript) {
        const bodySnippet = getGtmBodySnippet().trim().split('\n').map(line => `    ${line}`).join('\n');
        cityHtml = cityHtml.replace('<body>', `<body>\n${bodySnippet}`);
      }
      
      // Write the HTML file
      const locationHtmlPath = path.join(locationDir, 'index.html');
      fs.writeFileSync(locationHtmlPath, cityHtml);
      
      log(`✅ Generated page for ${city.name}, ${city.state} (${appraiserCount} appraisers)`, 'success');
      generatedCount++;
    }

    log(`🎉 Successfully generated ${generatedCount} location pages with structured data!`, 'success');
    return generatedCount;
  } catch (error) {
    log(`❌ Error generating location pages: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
/**
 * Fix all "Art Appraiser" references to "Antique Appraiser"
 */
async function fixArtToAntiqueReferences() {
  log('Fixing "Art Appraiser" references to "Antique Appraiser"...', 'info');
  
  try {
    // Get all HTML files in the dist directory
    const htmlFiles = await getAllHtmlFiles();
    log(`Found ${htmlFiles.length} HTML files to check for art appraiser references`, 'info');
    
    let modifiedCount = 0;
    
    // Process each HTML file
    for (const htmlFile of htmlFiles) {
      let html = fs.readFileSync(htmlFile, 'utf8');
      const originalHtml = html;
      
      // Replace various patterns
      html = html.replace(/Art Appraisers/g, 'Antique Appraisers');
      html = html.replace(/Art Appraiser/g, 'Antique Appraiser');
      html = html.replace(/art appraisers/g, 'antique appraisers');
      html = html.replace(/art appraiser/g, 'antique appraiser');
      html = html.replace(/art valuation/g, 'antique valuation');
      html = html.replace(/art appraisal/g, 'antique appraisal');
      html = html.replace(/art authentication/g, 'antique authentication');
      html = html.replace(/art collection/g, 'antique collection');
      html = html.replace(/https:\/\/art-appraiser-directory\.appraisily\.com/g, 'https://antique-appraiser-directory.appraisily.com');
      html = html.replace(/https:\/\/art-appraiser\.appraisily\.com/g, 'https://antique-appraiser-directory.appraisily.com');
      
      // Write back if modified
      if (html !== originalHtml) {
        fs.writeFileSync(htmlFile, html);
        modifiedCount++;
        log(`Updated references in ${path.relative(DIST_DIR, htmlFile)}`, 'success');
      }
    }
    
    log(`Fixed Art Appraiser references in ${modifiedCount} files`, 'success');
    return modifiedCount;
  } catch (error) {
    log(`Error fixing Art Appraiser references: ${error.message}`, 'error');
    return 0;
  }
}

/**
 * Generate appraiser pages
 */
async function generateAppraiserPages() {
  log('Generating appraiser pages...', 'info');
  
  try {
    const output = await runScript('node', [path.join(__dirname, 'generate-appraiser-pages.js')]);
    log(output, 'info');
    log('Appraiser pages generated successfully', 'success');
    return true;
  } catch (error) {
    log(`Error generating appraiser pages: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Fix netlify.toml to use the correct domain
 */
async function fixNetlifyConfig() {
  log('Updating netlify.toml configuration...', 'info');
  
  try {
    const netlifyPath = path.join(ROOT_DIR, 'netlify.toml');
    if (!fs.existsSync(netlifyPath)) {
      log('netlify.toml not found!', 'warning');
      return false;
    }
    
    let content = fs.readFileSync(netlifyPath, 'utf8');
    const originalContent = content;
    
    // Replace domain references
    content = content.replace(/art-appraiser\.appraisily\.com/g, 'antique-appraiser-directory.appraisily.com');
    content = content.replace(/art-appraiser-directory\.appraisily\.com/g, 'antique-appraiser-directory.appraisily.com');
    
    // Write the file back if changed
    if (content !== originalContent) {
      fs.writeFileSync(netlifyPath, content);
      log('Updated netlify.toml configuration', 'success');
      return true;
    } else {
      log('No changes needed in netlify.toml', 'info');
      return true;
    }
  } catch (error) {
    log(`Error updating netlify.toml: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  try {
    log('Starting comprehensive page fix process...', 'info');
    
    // Step 1: Rebuild the static files if needed
    const shouldRebuild = process.argv.includes('--rebuild');
    if (shouldRebuild) {
      log('Rebuilding static files...', 'info');
      const rebuildOutput = await runScript('npm run rebuild-static');
      log(rebuildOutput, 'info');
    }
    
    // Step 2: Fix React hydration issues in all HTML files
    await fixAllHydrationIssues();
    
    // Step 3: Inject fallback image handler
    const fallbackOutput = await runScript('node', [path.join(__dirname, 'inject-fallback-image-handler.js')]);
    log(fallbackOutput, 'info');
    
    // Step 4: Generate static HTML files for all location pages
    await generateLocationPages();
    
    // Step 5: Fix Art Appraiser to Antique Appraiser references
    await fixArtToAntiqueReferences();
    
    // Step 6: Fix netlify.toml configuration
    await fixNetlifyConfig();
    
    // Step 7: Generate appraiser pages
    await generateAppraiserPages();
    
    log('\nAll pages fixed successfully!', 'success');
    log('Next steps:', 'info');
    log('1. Run `npm run serve:static` to test the site locally', 'info');
    log('2. Commit and push the changes', 'info');
    log('3. Promote the build through the Appraisily VPS pipeline (image build + compose redeploy)', 'info');
  } catch (error) {
    log(`Error fixing pages: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();
