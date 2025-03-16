import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all city JSON files
const locationsDir = path.join(__dirname, '../src/data/locations');
const cityFiles = fs.readdirSync(locationsDir)
  .filter(file => file.endsWith('.json') && 
    !['cors.json', 'lifecycle.json', 'hugo_lifecycle.json'].includes(file))
  .map(file => file.replace('.json', ''));

// Generate the static data file content
let staticDataContent = `// This file is auto-generated. Do not edit directly.
import citiesData from '../data/cities.json';

// Import all location data files
`;

// Generate import statements
cityFiles.forEach(file => {
  const variableName = file.replace(/-/g, '').replace(/ /g, '').replace(/\./g, '') + 'Data';
  staticDataContent += `import ${variableName} from '../data/locations/${file}.json';\n`;
});

// Generate the locations array
staticDataContent += `\n// Export array of all locations\nexport const locations = [\n`;
cityFiles.forEach(file => {
  const variableName = file.replace(/-/g, '').replace(/ /g, '').replace(/\./g, '') + 'Data';
  staticDataContent += `  ${variableName},\n`;
});
staticDataContent += `];\n\n`;

// Add the rest of the file
staticDataContent += `// Export cities from cities.json
export const cities = citiesData.cities;

/**
 * Get location data by city slug
 * @param {string} citySlug - The slug of the city to find
 * @returns {object|null} - The location data or null if not found
 */
export function getLocation(citySlug: string) {
  const normalizedSlug = citySlug.toLowerCase().replace(/\\s+/g, '-');
  console.log('getLocation - normalizedSlug:', normalizedSlug);
  
  // First try to find location by seo.schema.areaServed.name
  const locationBySeo = locations.find(location => 
    location.seo?.schema?.areaServed?.name?.toLowerCase().replace(/\\s+/g, '-') === normalizedSlug
  );
  if (locationBySeo) return locationBySeo;

  // Then try by city property
  const locationByCity = locations.find(location => 
    location.city?.toLowerCase().replace(/\\s+/g, '-') === normalizedSlug
  );
  if (locationByCity) return locationByCity;

  // Finally try by first appraiser's city
  const locationByAppraiser = locations.find(location => 
    location.appraisers?.[0]?.city?.toLowerCase().replace(/\\s+/g, '-') === normalizedSlug
  );

  return locationBySeo || locationByCity || locationByAppraiser || null;
}

/**
 * Get appraiser data by ID
 * @param {string} appraiserId - The ID of the appraiser to find
 * @returns {object|null} - The appraiser data or null if not found
 */
export function getAppraiser(appraiserId: string) {
  for (const location of locations) {
    const appraiser = location.appraisers.find(a => a.id === appraiserId);
    if (appraiser) {
      return appraiser;
    }
  }
  return null;
}
`;

// Write the updated file
const staticDataFilePath = path.join(__dirname, '../src/utils/staticData.ts');
fs.writeFileSync(staticDataFilePath, staticDataContent);

console.log(`Updated staticData.ts with imports for ${cityFiles.length} city files.`); 