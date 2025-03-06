import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read cities from cities.json
const citiesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/cities.json'), 'utf8'));
const cities = citiesData.cities;

// Get existing city files
const locationFiles = fs.readdirSync(path.join(__dirname, '../src/data/locations'))
  .filter(file => file.endsWith('.json') && 
    !file.includes('copy') && 
    !['cors.json', 'lifecycle.json', 'hugo_lifecycle.json'].includes(file))
  .map(file => file.replace('.json', ''));

// Create a template for new city files
const cityTemplate = {
  appraisers: [
    {
      id: "template-art-appraiser",
      name: "City Fine Art Appraisers",
      image: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&q=80",
      rating: 4.8,
      reviewCount: 125,
      address: "123 Main St",
      specialties: ["Fine Art", "Antique Paintings", "Sculptures"],
      phone: "(555) 123-4567",
      email: "info@cityartappraisers.com",
      website: "https://cityartappraisers.com",
      about: "Our team of certified appraisers brings decades of expertise to art valuation. We specialize in both traditional and contemporary art forms.",
      businessHours: [
        { day: "Monday", hours: "10:00 AM - 6:00 PM" },
        { day: "Tuesday", hours: "10:00 AM - 6:00 PM" },
        { day: "Wednesday", hours: "10:00 AM - 6:00 PM" },
        { day: "Thursday", hours: "10:00 AM - 6:00 PM" },
        { day: "Friday", hours: "10:00 AM - 5:00 PM" },
        { day: "Saturday", hours: "11:00 AM - 4:00 PM" },
        { day: "Sunday", hours: "Closed" }
      ],
      certifications: [
        "Appraisers Association of America (AAA)",
        "International Society of Appraisers (ISA)",
        "USPAP Certified"
      ],
      services: [
        {
          name: "Fine Art Appraisal",
          description: "Complete valuation service for paintings, sculptures, and other fine art pieces.",
          price: "$300-400"
        },
        {
          name: "Estate Appraisal",
          description: "Comprehensive art collection valuation for estate planning or tax purposes.",
          price: "From $1,200"
        },
        {
          name: "Insurance Appraisal",
          description: "Detailed documentation and valuation for insurance coverage.",
          price: "From $500"
        }
      ],
      reviews: [
        {
          id: "r1",
          author: "Michael R.",
          rating: 5,
          date: "March 18, 2024",
          content: "Incredible attention to detail and vast knowledge of the art market. Their appraisal helped me secure proper insurance for my collection."
        },
        {
          id: "r2",
          author: "Emily W.",
          rating: 4,
          date: "March 12, 2024",
          content: "Very professional service. They provided extensive documentation and market analysis for my estate planning needs."
        }
      ]
    }
  ]
};

// Count of missing and created files
let missingCount = 0;
let createdCount = 0;

// Create missing city files
cities.forEach(city => {
  const citySlug = city.slug;
  
  // Skip if file already exists
  if (locationFiles.includes(citySlug)) {
    return;
  }
  
  missingCount++;
  
  // Create city data based on template
  const cityData = {
    city: city.name,
    state: city.state,
    appraisers: cityTemplate.appraisers.map(appraiser => {
      // Customize some fields for this city
      return {
        ...appraiser,
        id: `${citySlug}-fine-art-appraiser`,
        name: `${city.name} Fine Art Appraisers`,
        address: `123 Main St, ${city.name}, ${city.state}`,
        email: `info@${citySlug}artappraisers.com`.replace(/-/g, ''),
        website: `https://${citySlug}artappraisers.com`.replace(/-/g, '')
      };
    }),
    // Add SEO information
    seo: {
      title: `Art Appraisers in ${city.name} | Expert Art Valuation Services`,
      description: `Find certified art appraisers in ${city.name}, ${city.state}. Get expert art valuations, authentication services, and professional advice for your art collection.`,
      keywords: [
        `art appraisers ${city.name.toLowerCase()}`,
        `art valuation ${city.name.toLowerCase()}`,
        `art authentication ${city.state.toLowerCase()}`,
        `fine art appraisal ${city.name.toLowerCase()}`
      ],
      schema: {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": `Art Appraisers in ${city.name}`,
        "description": `Find certified art appraisers in ${city.name}, ${city.state}. Get expert art valuations and authentication services.`,
        "areaServed": {
          "@type": "City",
          "name": city.name,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": city.name,
            "addressRegion": city.state
          }
        }
      }
    }
  };
  
  // Write city file
  const filePath = path.join(__dirname, '../src/data/locations', `${citySlug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(cityData, null, 2));
  createdCount++;
  
  console.log(`Created file for ${city.name}, ${city.state}`);
});

console.log(`\nSummary:`);
console.log(`Total cities in cities.json: ${cities.length}`);
console.log(`Existing city files: ${locationFiles.length}`);
console.log(`Missing city files: ${missingCount}`);
console.log(`Created city files: ${createdCount}`); 