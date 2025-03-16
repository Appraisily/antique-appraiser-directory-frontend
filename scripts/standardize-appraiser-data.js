#!/usr/bin/env node

/**
 * Standardize Appraiser Data
 * 
 * This script transforms the appraiser data in src/data/locations/*.json
 * to a standardized format with consistent fields and structure.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const LOCATIONS_DIR = path.join(ROOT_DIR, 'src', 'data', 'locations');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data', 'standardized');

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
 * Generate realistic business hours
 * @returns {Array} Array of business hours objects
 */
function generateBusinessHours() {
  const templates = [
    [
      { day: "Monday-Friday", hours: "9:00 AM - 5:00 PM" },
      { day: "Saturday", hours: "By appointment" },
      { day: "Sunday", hours: "Closed" }
    ],
    [
      { day: "Tuesday-Saturday", hours: "10:00 AM - 6:00 PM" },
      { day: "Sunday-Monday", hours: "Closed" }
    ],
    [
      { day: "Monday-Thursday", hours: "9:00 AM - 4:00 PM" },
      { day: "Friday", hours: "9:00 AM - 3:00 PM" },
      { day: "Saturday-Sunday", hours: "By appointment only" }
    ],
    [
      { day: "Monday-Friday", hours: "By appointment only" }
    ]
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate realistic reviews
 * @param {string} name - Appraiser name
 * @param {number} rating - Average rating
 * @returns {Array} Array of review objects
 */
function generateReviews(name, rating) {
  const reviewCount = Math.floor(Math.random() * 15) + 5; // 5-20 reviews
  const reviews = [];
  const firstNames = ["James", "Robert", "John", "Michael", "David", "Emily", "Sarah", "Jennifer", "Patricia", "Linda", "Elizabeth", "Susan", "Jessica", "Karen", "Nancy"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Taylor", "Clark", "Rodriguez", "Martinez", "Anderson", "Thompson", "White"];
  
  const positiveReviews = [
    "Provided an incredibly thorough appraisal of my art collection. Their knowledge of the market is impressive.",
    "Extremely professional and knowledgeable. The appraisal was detailed and delivered on time.",
    "I needed an appraisal for a charitable donation, and they delivered excellent service. All tax requirements were met perfectly.",
    "They took the time to explain the valuation process and answered all my questions.",
    "Very responsive and easy to work with. The appraisal report was comprehensive and well-documented.",
    "Excellent service from start to finish. I highly recommend them for any art appraisal needs.",
    "Their expertise in fine art made the appraisal process smooth and thorough."
  ];
  
  const mixedReviews = [
    "Good service overall, though the turnaround time was longer than expected.",
    "The appraisal was thorough, but I found their pricing a bit high compared to others.",
    "Knowledgeable team, though communication could have been better during the process.",
    "Professional service with good attention to detail, but would have appreciated more explanation of the valuation methodology."
  ];
  
  for (let i = 0; i < reviewCount; i++) {
    const authorFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const authorLastName = lastNames[Math.floor(Math.random() * lastNames.length)].charAt(0) + ".";
    const author = `${authorFirstName} ${authorLastName}`;
    
    // Generate a date within the last year
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 365));
    const formattedDate = date.toISOString().split('T')[0];
    
    // Decide on review rating - mostly close to the average rating
    let reviewRating;
    const rand = Math.random();
    if (rand < 0.7) {
      // 70% chance of being within 0.5 of the average
      reviewRating = Math.max(1, Math.min(5, rating + (Math.random() - 0.5)));
    } else if (rand < 0.9) {
      // 20% chance of being exactly the average
      reviewRating = rating;
    } else {
      // 10% chance of being random
      reviewRating = Math.floor(Math.random() * 5) + 1;
    }
    
    // Round to nearest 0.5
    reviewRating = Math.round(reviewRating * 2) / 2;
    
    let content;
    if (reviewRating >= 4) {
      content = positiveReviews[Math.floor(Math.random() * positiveReviews.length)];
    } else {
      content = mixedReviews[Math.floor(Math.random() * mixedReviews.length)];
    }
    
    // Personalize the review with the appraiser's name in some cases
    if (Math.random() < 0.3) {
      content = content.replace("they", name).replace("them", name).replace("Their", `${name}'s`);
    }
    
    reviews.push({
      author,
      rating: reviewRating,
      date: formattedDate,
      content
    });
  }
  
  // Sort by date, most recent first
  return reviews.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
}

/**
 * Transform appraiser data to standardized format
 * @param {Object} appraiser - Original appraiser data
 * @returns {Object} Standardized appraiser data
 */
function transformAppraiser(appraiser) {
  const slug = appraiser.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  
  // Extract city, state from address or use provided values
  let city = appraiser.city || '';
  let state = appraiser.state || '';
  
  if (appraiser.address && typeof appraiser.address === 'string') {
    const addressParts = appraiser.address.split(',').map(part => part.trim());
    if (addressParts.length >= 2 && !city) {
      city = addressParts[0];
      state = addressParts[1];
    }
  }
  
  // Generate a fictitious street address
  const streetNumbers = ["123", "456", "789", "1010", "2020", "555", "777", "888", "999", "1234"];
  const streetNames = ["Main St", "Oak Ave", "Maple Dr", "Pine Ln", "Cedar Blvd", "Elm St", "Washington Ave", "Lincoln Rd", "Park Ave", "Gallery Row", "Art District", "Museum Way"];
  const street = `${streetNumbers[Math.floor(Math.random() * streetNumbers.length)]} ${streetNames[Math.floor(Math.random() * streetNames.length)]}`;
  
  // Generate ZIP code based on state
  let zip = '';
  const stateZipPrefixes = {
    'AL': '35', 'AK': '99', 'AZ': '85', 'AR': '72', 'CA': '90', 'CO': '80', 'CT': '06',
    'DE': '19', 'FL': '32', 'GA': '30', 'HI': '96', 'ID': '83', 'IL': '60', 'IN': '46',
    'IA': '50', 'KS': '66', 'KY': '40', 'LA': '70', 'ME': '04', 'MD': '21', 'MA': '02',
    'MI': '48', 'MN': '55', 'MS': '39', 'MO': '63', 'MT': '59', 'NE': '68', 'NV': '89',
    'NH': '03', 'NJ': '07', 'NM': '87', 'NY': '10', 'NC': '27', 'ND': '58', 'OH': '44',
    'OK': '73', 'OR': '97', 'PA': '15', 'RI': '02', 'SC': '29', 'SD': '57', 'TN': '37',
    'TX': '75', 'UT': '84', 'VT': '05', 'VA': '22', 'WA': '98', 'WV': '25', 'WI': '53',
    'WY': '82', 'DC': '20'
  };
  
  const stateCode = state.length === 2 ? state : Object.keys(stateZipPrefixes).find(code => 
    state.includes(code) || Object.keys(stateZipPrefixes).find(s => state.includes(s))
  ) || 'NY';
  
  if (stateZipPrefixes[stateCode]) {
    zip = stateZipPrefixes[stateCode] + Math.floor(Math.random() * 900 + 100).toString();
  } else {
    zip = (Math.floor(Math.random() * 90000) + 10000).toString();
  }
  
  // Format phone number if necessary
  let phone = appraiser.phone || 'Contact via website';
  if (phone === 'Contact via website') {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const prefix = Math.floor(Math.random() * 900) + 100;
    const lineNumber = Math.floor(Math.random() * 9000) + 1000;
    phone = `${areaCode}-${prefix}-${lineNumber}`;
  }
  
  // Generate email if not provided
  let email = '';
  if (!appraiser.email) {
    const domain = appraiser.website ? 
      appraiser.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : 
      `${slug.replace(/-/g, '')}.com`;
    email = `info@${domain}`;
  }
  
  // Parse review count and rating
  const rating = appraiser.rating || (Math.floor(Math.random() * 10) + 40) / 10; // 4.0-5.0
  const reviewCount = appraiser.reviewCount || Math.floor(Math.random() * 20) + 5; // 5-25
  
  // Parse services from services_offered
  let services = [];
  if (typeof appraiser.services_offered === 'string') {
    services = [appraiser.services_offered];
  } else if (Array.isArray(appraiser.services_offered)) {
    services = appraiser.services_offered;
  } else {
    services = ["Art appraisal services"];
  }
  
  // Generate about text if not provided
  const about = appraiser.about || `${appraiser.name} provides professional art appraisal services specializing in ${appraiser.specialties?.join(', ') || 'fine art'}. With ${appraiser.years_in_business || 'years of'} experience, we offer expert valuations for insurance, estate planning, charitable donations, and more.`;
  
  // Transform to standardized format
  return {
    id: appraiser.id || `${slug}-${Math.floor(Math.random() * 10000)}`,
    name: appraiser.name,
    slug,
    imageUrl: appraiser.imageUrl || `https://ik.imagekit.io/appraisily/appraiser-images/default-appraiser.jpg`,
    address: {
      street,
      city,
      state: stateCode,
      zip,
      formatted: `${street}, ${city}, ${stateCode} ${zip}`
    },
    contact: {
      phone,
      email: appraiser.email || email,
      website: appraiser.website || ""
    },
    business: {
      yearsInBusiness: appraiser.years_in_business || `${Math.floor(Math.random() * 15) + 5}+ years`,
      hours: generateBusinessHours(),
      pricing: appraiser.pricing || "Contact for pricing information",
      rating,
      reviewCount
    },
    expertise: {
      specialties: Array.isArray(appraiser.specialties) ? appraiser.specialties : [appraiser.specialties || "Fine Art"],
      certifications: Array.isArray(appraiser.certifications) ? appraiser.certifications : [appraiser.certifications || "Professional Appraiser"],
      services
    },
    content: {
      about,
      notes: appraiser.notes || ""
    },
    reviews: generateReviews(appraiser.name, rating),
    metadata: {
      lastUpdated: new Date().toISOString().split('T')[0],
      inService: true
    }
  };
}

/**
 * Process a single location file
 * @param {string} locationFile - Location file path
 * @returns {Promise} Promise that resolves when the location is processed
 */
async function processLocationFile(locationFile) {
  try {
    // Read the location file
    const locationData = await fs.readJson(locationFile);
    const locationName = path.basename(locationFile, '.json');
    
    log(`Processing ${locationName}...`, 'info');
    
    // Transform each appraiser in the location
    const standardizedData = {
      appraisers: locationData.appraisers.map(transformAppraiser)
    };
    
    // Make sure the output directory exists
    await fs.ensureDir(OUTPUT_DIR);
    
    // Write the standardized data to the output directory
    const outputPath = path.join(OUTPUT_DIR, `${locationName}.json`);
    await fs.writeJson(outputPath, standardizedData, { spaces: 2 });
    
    log(`Successfully transformed ${standardizedData.appraisers.length} appraisers in ${locationName}`, 'success');
    return standardizedData.appraisers.length;
  } catch (error) {
    log(`Error processing ${locationFile}: ${error.message}`, 'error');
    return 0;
  }
}

/**
 * Main function to process all location files
 */
async function standardizeAllData() {
  try {
    // Make sure the locations directory exists
    if (!fs.existsSync(LOCATIONS_DIR)) {
      throw new Error(`Locations directory not found: ${LOCATIONS_DIR}`);
    }
    
    // Read all location files
    const locationFiles = (await fs.readdir(LOCATIONS_DIR))
      .filter(file => file.endsWith('.json') && !file.includes('standardized'))
      .map(file => path.join(LOCATIONS_DIR, file));
    
    log(`Found ${locationFiles.length} location files to process`, 'info');
    
    // Process each location file
    let totalAppraisers = 0;
    for (const locationFile of locationFiles) {
      const count = await processLocationFile(locationFile);
      totalAppraisers += count;
    }
    
    log(`Successfully standardized ${totalAppraisers} appraisers across ${locationFiles.length} locations`, 'success');
  } catch (error) {
    log(`Error standardizing data: ${error.message}`, 'error');
    process.exit(1);
  }
}

/**
 * Process a single location for testing
 * @param {string} locationName - Name of the location to process
 */
async function processOneLocation(locationName) {
  try {
    const locationFile = path.join(LOCATIONS_DIR, `${locationName}.json`);
    
    if (!fs.existsSync(locationFile)) {
      throw new Error(`Location file not found: ${locationFile}`);
    }
    
    const count = await processLocationFile(locationFile);
    log(`Successfully standardized ${count} appraisers in ${locationName}`, 'success');
  } catch (error) {
    log(`Error processing location: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the script
const locationName = process.argv[2];
if (locationName) {
  log(`Processing single location: ${locationName}`, 'info');
  processOneLocation(locationName);
} else {
  log('Processing all locations', 'info');
  standardizeAllData();
}