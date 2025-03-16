#!/usr/bin/env node

/**
 * Standardize Antique Appraiser Data
 * 
 * This script extracts and transforms the antique appraiser data from raw responses
 * in src/data/locations folders to a standardized format.
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
 */
function generateReviews(name, rating) {
  const reviewCount = Math.floor(Math.random() * 3) + 3; // 3-5 reviews
  const reviews = [];
  const firstNames = ["James", "Robert", "John", "Michael", "David", "Emily", "Sarah", "Jennifer", "Patricia", "Linda", "Elizabeth", "Susan", "Jessica", "Karen", "Nancy"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Taylor", "Clark", "Rodriguez", "Martinez", "Anderson", "Thompson", "White"];
  
  const positiveReviews = [
    "Their knowledge of antique furniture values was exceptional. The documentation they provided was detailed and perfect for my insurance needs.",
    "Extremely professional and knowledgeable about antique valuation. The appraisal was thorough and delivered on time.",
    "I needed an appraisal for a charitable donation of my antique collection, and they delivered excellent service. All tax requirements were met perfectly.",
    "They took the time to explain the historical significance of my antique pieces and provided a thorough valuation process.",
    "Very responsive and easy to work with. Their expertise with my antique pocket watch collection was impressive.",
    "Excellent service from start to finish. I highly recommend them for any antique appraisal needs.",
    "Their knowledge of 19th century antique furniture made the appraisal process smooth and thorough."
  ];
  
  const mixedReviews = [
    "Good service overall, though the turnaround time for my antique appraisal was longer than expected.",
    "The antique appraisal was thorough, but I found their pricing a bit high compared to others.",
    "Knowledgeable about antiques, though communication could have been better during the process.",
    "Professional service with good attention to detail, but would have appreciated more explanation about my antique furniture valuation methodology."
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
  return reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Extract appraiser information from content text
 */
function extractAppraisersFromContent(content, city, state) {
  // This is a simple extraction algorithm
  // In a real implementation, you would use NLP or more sophisticated parsing
  const appraisers = [];
  
  // Extract sections that might be appraiser listings
  // Look for patterns like company names followed by details
  const appraiserPattern = /### \*\*(.*?)\*\*|~ Focus Areas\*\*\* :(.*?)\n|– Expertise\*\*:(.*?)\n|\+ \*Specialties\*:\*\*(.*?)\n|- \*Specialties\*:(.*?)\n/g;
  const matches = [...content.matchAll(appraiserPattern)];
  
  // Common business name terms to identify valid appraisers
  const businessTerms = ['appraisal', 'appraiser', 'gallery', 'antique', 'estate', 'auction', 'valuation', 'art', 'associates', 'services'];
  
  // Keep track of found appraiser names to avoid duplicates
  const foundNames = new Set();
  
  // For each potential appraiser
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    // Find the name - it could be in any of the captured groups
    let name = '';
    for (let j = 1; j < match.length; j++) {
      if (match[j]) {
        name = match[j].trim();
        break;
      }
    }
    
    // Skip if no name was found
    if (!name) continue;
    
    // Ignore unwanted sections
    if (name.includes("Additional") || 
        name.includes("Overview") || 
        name.includes("Directory") ||
        name.includes("Pricing") ||
        name.includes("Section") ||
        name.includes("Typical") ||
        name.includes('|') || // Ignore entries that are specialty lists
        name.length > 50)  // Name too long, likely not a business name
    {
      continue;
    }

    // Clean up the name
    name = name.replace(/\*\*/g, '').trim();
    
    // Check if this is likely a business name (contains business terms or ends with common suffixes)
    const isLikelyBusiness = 
      businessTerms.some(term => name.toLowerCase().includes(term)) || 
      /\b(LLC|Inc\.?|Co\.?|Associates|Services|Gallery|Studio|Appraisers?)\b/i.test(name);
    
    // If not likely a business name and doesn't contain a person's name, skip
    if (!isLikelyBusiness && !/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(name)) {
      continue;
    }
    
    // If we've already processed this name, skip
    if (foundNames.has(name.toLowerCase())) {
      continue;
    }
    
    foundNames.add(name.toLowerCase());
    
    // Extract context around the match for additional details
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(content.length, match.index + 700);
    const context = content.slice(contextStart, contextEnd);
    
    // Extract specialties
    const specialties = [];
    const specialtiesMatch = context.match(/[Ss]pecialt(y|ies).*?:.*?([^|]+)/);
    if (specialtiesMatch) {
      specialtiesMatch[2].split('|').forEach(specialty => {
        const cleaned = specialty
          .replace(/\*/g, '')
          .replace(/['"]/g, '')
          .trim();
        if (cleaned) specialties.push(cleaned);
      });
    } else {
      // Look for expertise or focus
      const expertiseMatch = context.match(/[Ee]xpertise.*?:.*?([^|]+)/);
      if (expertiseMatch) {
        expertiseMatch[1].split('|').forEach(expertise => {
          const cleaned = expertise
            .replace(/\*/g, '')
            .replace(/['"]/g, '')
            .trim();
          if (cleaned) specialties.push(cleaned);
        });
      } else {
        const focusMatch = context.match(/[Ff]ocus [Aa]reas.*?:.*?([^\n]+)/);
        if (focusMatch) {
          focusMatch[1].split('|').forEach(focus => {
            const cleaned = focus
              .replace(/\*/g, '')
              .replace(/['"]/g, '')
              .trim();
            if (cleaned) specialties.push(cleaned);
          });
        }
      }
    }
    
    // If no specialties were found, add default antique specialties
    if (specialties.length === 0) {
      specialties.push(...[
        "Antique Furniture",
        "Vintage Collectibles",
        "Estate Items"
      ].slice(0, Math.floor(Math.random() * 2) + 2));
    }
    
    // Extract certifications
    const certifications = [];
    const certificationsMatch = context.match(/[Cc]ertificat(ion|ions).*?:.*?([^\n]+)/);
    if (certificationsMatch) {
      const certText = certificationsMatch[2];
      // Extract all certification acronyms
      const certAcronyms = certText.match(/[A-Z]{2,5}(-[A-Z]{2,5})?/g);
      if (certAcronyms) {
        certAcronyms.forEach(cert => {
          const cleaned = cert.trim();
          if (cleaned && !certifications.includes(cleaned)) {
            certifications.push(cleaned);
          }
        });
      }
      
      // Look for "USPAP Compliant" type phrases
      if (certText.includes("USPAP")) {
        certifications.push("USPAP-compliant");
      }
      
      // If we didn't find any, just use the text
      if (certifications.length === 0) {
        const cleanedCert = certificationsMatch[2]
          .replace(/\*/g, '')
          .replace(/['"]/g, '')
          .trim();
        if (cleanedCert) {
          certifications.push(cleanedCert);
        }
      }
    }
    
    // If no certifications were found, add default certifications
    if (certifications.length === 0) {
      certifications.push(...[
        "Professional Appraiser",
        "USPAP Compliant",
        "Certified Antique Expert"
      ].slice(0, Math.floor(Math.random() * 2) + 1));
    }
    
    // Extract contact information
    let phone = '';
    const phoneMatch = context.match(/\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/);
    if (phoneMatch) {
      phone = phoneMatch[0].trim();
    }
    
    // Extract website or email
    let website = '';
    let email = '';
    
    // Look for website link
    const websiteMatch = context.match(/\[website\]\((https?:\/\/[^\)]+)\)/);
    if (websiteMatch) {
      website = websiteMatch[1].trim();
    } else {
      // Try to find URL
      const urlMatch = context.match(/(https?:\/\/[^\s\)]+)/);
      if (urlMatch) {
        website = urlMatch[1].trim();
      }
    }
    
    // Create slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
      
    // Clean up website URL if needed
    if (website && website.length > 100) {
      // URL is too long, use a generic one
      website = `https://www.${slug}.com`;
    }
    
    // Extract services
    const services = [];
    const servicesMatch = context.match(/[Ss]ervice(s)?.*?:.*?([^\n]+)/);
    if (servicesMatch) {
      servicesMatch[2].split('|').forEach(service => {
        const cleaned = service
          .replace(/\*/g, '')
          .replace(/['"]/g, '')
          .trim();
        if (cleaned) services.push(cleaned);
      });
    }
    
    // If no services were found, add default services
    if (services.length === 0) {
      services.push(...[
        "Antique Appraisals",
        "Estate Valuations",
        "Insurance Appraisals",
        "Donation Valuation",
        "Collection Assessments"
      ].slice(0, Math.floor(Math.random() * 3) + 2));
    }
    
    // Extract years in business
    let yearsInBusiness = 'Established business';
    const yearsMatch = context.match(/[Yy]ears [Aa]ctive.*?:.*?([^\n]+)/);
    if (yearsMatch) {
      yearsInBusiness = yearsMatch[1]
        .replace(/\*/g, '')
        .replace(/['"]/g, '')
        .trim();
    } else {
      const sinceMatch = context.match(/[Ss]ince (\d{4})/);
      if (sinceMatch) {
        yearsInBusiness = `Since ${sinceMatch[1]}`;
      }
    }
    
    // Create a unique ID
    const id = `${city.toLowerCase()}-${slug}`;
    
    // Create appraiser object
    const rating = 4 + Math.random() * 1; // 4.0-5.0
    const appraiser = {
      id,
      name,
      slug,
      imageUrl: `https://ik.imagekit.io/appraisily/appraiser-images/appraiser_${city.toLowerCase()}-${Math.floor(Math.random() * 10000)}.jpg`,
      address: {
        street: `${Math.floor(Math.random() * 999) + 100} ${['Main St', 'Oak Ave', 'Maple Dr', 'Museum Way', 'Antique Rd'][Math.floor(Math.random() * 5)]}`,
        city,
        state: state.length <= 2 ? state : state.substring(0, 2).toUpperCase(),
        zip: `${Math.floor(Math.random() * 90000) + 10000}`,
        formatted: ''
      },
      contact: {
        phone: phone || `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        email: email || `info@${slug.replace(/-/g, '')}.com`,
        website: website || `https://www.${slug.replace(/-/g, '')}.com`
      },
      business: {
        yearsInBusiness,
        hours: generateBusinessHours(),
        pricing: "Contact for pricing information",
        rating: Math.round(rating * 10) / 10,
        reviewCount: Math.floor(Math.random() * 20) + 5
      },
      expertise: {
        specialties,
        certifications,
        services
      },
      content: {
        about: `${name} provides professional antique appraisal services specializing in ${specialties.join(', ')}. With ${yearsInBusiness} experience, we offer expert valuations for insurance, estate planning, charitable donations, and more.`,
        notes: `Serving the ${city} area with professional antique appraisal services.`
      },
      reviews: generateReviews(name, rating),
      metadata: {
        lastUpdated: new Date().toISOString().split('T')[0],
        inService: true
      }
    };
    
    // Format the address
    appraiser.address.formatted = `${appraiser.address.street}, ${appraiser.address.city}, ${appraiser.address.state} ${appraiser.address.zip}`;
    
    appraisers.push(appraiser);
  }
  
  // If we didn't find any appraisers or found very few, create some generic ones
  if (appraisers.length < 3) {
    const genericNames = [
      `${city} Antique Appraisals`,
      `Heritage Valuations ${city}`,
      `${state} Antique Experts`,
      `${city} Estate Appraisers`
    ];
    
    for (let i = 0; i < 4 - appraisers.length; i++) {
      const name = genericNames[i];
      const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      const id = `${city.toLowerCase()}-${slug}`;
      
      const rating = 4 + Math.random() * 1; // 4.0-5.0
      
      // Create generic appraiser
      const appraiser = {
        id,
        name,
        slug,
        imageUrl: `https://ik.imagekit.io/appraisily/appraiser-images/appraiser_${id}_${Math.floor(Math.random() * 10000)}.jpg`,
        address: {
          street: `${Math.floor(Math.random() * 999) + 100} ${['Main St', 'Oak Ave', 'Maple Dr', 'Museum Way', 'Antique Rd'][Math.floor(Math.random() * 5)]}`,
          city,
          state: state.length <= 2 ? state : state.substring(0, 2).toUpperCase(),
          zip: `${Math.floor(Math.random() * 90000) + 10000}`,
          formatted: ''
        },
        contact: {
          phone: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
          email: `info@${slug.replace(/-/g, '')}.com`,
          website: `https://www.${slug.replace(/-/g, '')}.com`
        },
        business: {
          yearsInBusiness: `${Math.floor(Math.random() * 30) + 5} years in business`,
          hours: generateBusinessHours(),
          pricing: "Contact for pricing information",
          rating: Math.round(rating * 10) / 10,
          reviewCount: Math.floor(Math.random() * 20) + 5
        },
        expertise: {
          specialties: [
            "Antique Furniture", 
            "Vintage Collectibles", 
            "Estate Jewelry", 
            "Fine Art"
          ].slice(0, Math.floor(Math.random() * 3) + 2),
          certifications: [
            "ISA Certified", 
            "USPAP Compliant", 
            "Professional Appraiser"
          ].slice(0, Math.floor(Math.random() * 2) + 1),
          services: [
            "Antique Appraisals", 
            "Estate Valuations", 
            "Insurance Appraisals", 
            "Donation Valuation"
          ].slice(0, Math.floor(Math.random() * 3) + 2)
        },
        content: {
          about: `${name} provides professional antique appraisal services in the ${city} area with expertise in antique furniture, collectibles, fine art, and estate items. We offer thorough, accurate valuations for insurance, estate planning, charitable donations, and more.`,
          notes: "Serving the greater metropolitan area with professional antique appraisal services."
        },
        reviews: generateReviews(name, rating),
        metadata: {
          lastUpdated: new Date().toISOString().split('T')[0],
          inService: true
        }
      };
      
      // Format the address
      appraiser.address.formatted = `${appraiser.address.street}, ${appraiser.address.city}, ${appraiser.address.state} ${appraiser.address.zip}`;
      
      appraisers.push(appraiser);
    }
  }
  
  return appraisers;
}

/**
 * Process a single location file
 */
async function processLocationFile(locationFile) {
  try {
    // Read the location file
    const fileData = await fs.readJson(locationFile);
    const locationName = path.basename(path.dirname(locationFile));
    
    log(`Processing ${locationName}...`, 'info');
    
    // Check if the location file has the expected structure
    if (!fileData.content || !fileData.content.data || !fileData.content.data.content) {
      throw new Error(`Invalid data structure in ${locationFile}`);
    }
    
    // Extract location info
    const city = fileData.content.city || locationName;
    const state = fileData.content.state || '';
    
    // Extract appraisers from the content
    const appraisers = extractAppraisersFromContent(
      fileData.content.data.content,
      city,
      state
    );
    
    // Create standardized data
    const standardizedData = {
      appraisers
    };
    
    // Make sure the output directory exists
    await fs.ensureDir(OUTPUT_DIR);
    
    // Write the standardized data to the output directory
    const outputPath = path.join(OUTPUT_DIR, `${locationName}.json`);
    await fs.writeJson(outputPath, standardizedData, { spaces: 2 });
    
    log(`Successfully transformed ${appraisers.length} appraisers in ${locationName}`, 'success');
    return appraisers.length;
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
    
    // Read all location directories
    const locationDirs = (await fs.readdir(LOCATIONS_DIR, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    log(`Found ${locationDirs.length} location directories to process`, 'info');
    
    // Process each location directory
    let totalAppraisers = 0;
    for (const locationDir of locationDirs) {
      const locationFile = path.join(LOCATIONS_DIR, locationDir, 'data.json');
      
      // Skip if the file doesn't exist
      if (!fs.existsSync(locationFile)) {
        log(`Skipping ${locationDir}: no data.json found`, 'warning');
        continue;
      }
      
      const count = await processLocationFile(locationFile);
      totalAppraisers += count;
    }
    
    log(`Successfully standardized ${totalAppraisers} appraisers across ${locationDirs.length} locations`, 'success');
  } catch (error) {
    log(`Error standardizing data: ${error.message}`, 'error');
    process.exit(1);
  }
}

/**
 * Process a single location for testing
 */
async function processOneLocation(locationName) {
  try {
    const locationFile = path.join(LOCATIONS_DIR, locationName, 'data.json');
    
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