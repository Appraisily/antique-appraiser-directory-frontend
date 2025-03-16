/**
 * Shared Data Service
 * 
 * A central place for data fetching logic that can be used 
 * across the entire site, including the directory section.
 * 
 * Benefits:
 * - Single source of truth for data
 * - Consistent data loading patterns
 * - Shared caching
 * - Simplified maintenance
 */

// Cache for previously fetched data
const cache = {
  locations: null,
  locationDetails: {},
  appraiserDetails: {},
};

/**
 * Get all locations
 */
export const getLocations = async () => {
  if (cache.locations) {
    return cache.locations;
  }
  
  try {
    const response = await fetch('/data/locations.json');
    const data = await response.json();
    cache.locations = data;
    return data;
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
};

/**
 * Get details for a specific location
 */
export const getLocationDetails = async (locationSlug) => {
  if (cache.locationDetails[locationSlug]) {
    return cache.locationDetails[locationSlug];
  }
  
  try {
    const response = await fetch(`/data/location/${locationSlug}.json`);
    const data = await response.json();
    cache.locationDetails[locationSlug] = data;
    return data;
  } catch (error) {
    console.error(`Error fetching location ${locationSlug}:`, error);
    return null;
  }
};

/**
 * Get details for a specific appraiser
 */
export const getAppraiserDetails = async (appraiserSlug) => {
  if (cache.appraiserDetails[appraiserSlug]) {
    return cache.appraiserDetails[appraiserSlug];
  }
  
  try {
    const response = await fetch(`/data/appraiser/${appraiserSlug}.json`);
    const data = await response.json();
    cache.appraiserDetails[appraiserSlug] = data;
    return data;
  } catch (error) {
    console.error(`Error fetching appraiser ${appraiserSlug}:`, error);
    return null;
  }
};

/**
 * Get featured appraisers for the home page
 */
export const getFeaturedAppraisers = async (limit = 3) => {
  try {
    const locations = await getLocations();
    let featured = [];
    
    // Collect one top appraiser from each of the most popular locations
    for (const location of locations.slice(0, limit)) {
      const locationDetails = await getLocationDetails(location.slug);
      if (locationDetails && locationDetails.appraisers && locationDetails.appraisers.length > 0) {
        featured.push({
          ...locationDetails.appraisers[0],
          location: {
            name: locationDetails.name,
            slug: locationDetails.slug
          }
        });
      }
    }
    
    return featured;
  } catch (error) {
    console.error('Error fetching featured appraisers:', error);
    return [];
  }
};

/**
 * Search for appraisers across all locations
 */
export const searchAppraisers = async (query) => {
  if (!query) return [];
  
  const normalizedQuery = query.toLowerCase();
  const results = [];
  
  try {
    // Get all locations
    const locations = await getLocations();
    
    // For each location, check if there are matching appraisers
    for (const location of locations) {
      const locationDetails = await getLocationDetails(location.slug);
      
      if (locationDetails && locationDetails.appraisers) {
        // Find matching appraisers in this location
        const matchingAppraisers = locationDetails.appraisers.filter(appraiser => {
          return (
            appraiser.name.toLowerCase().includes(normalizedQuery) || 
            appraiser.specialties.toLowerCase().includes(normalizedQuery) ||
            (appraiser.description && appraiser.description.toLowerCase().includes(normalizedQuery))
          );
        });
        
        // Add location info to each matching appraiser
        matchingAppraisers.forEach(appraiser => {
          results.push({
            ...appraiser,
            location: {
              name: locationDetails.name,
              slug: locationDetails.slug
            }
          });
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error searching appraisers:', error);
    return [];
  }
};

/**
 * Get appraisers by specialty
 */
export const getAppraisersBySpecialty = async (specialty) => {
  if (!specialty) return [];
  
  const normalizedSpecialty = specialty.toLowerCase();
  const results = [];
  
  try {
    // Get all locations
    const locations = await getLocations();
    
    // For each location, find appraisers with matching specialty
    for (const location of locations) {
      const locationDetails = await getLocationDetails(location.slug);
      
      if (locationDetails && locationDetails.appraisers) {
        // Find appraisers with matching specialty
        const matchingAppraisers = locationDetails.appraisers.filter(appraiser => {
          return appraiser.specialties.toLowerCase().includes(normalizedSpecialty);
        });
        
        // Add location info to each matching appraiser
        matchingAppraisers.forEach(appraiser => {
          results.push({
            ...appraiser,
            location: {
              name: locationDetails.name,
              slug: locationDetails.slug
            }
          });
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error getting appraisers by specialty ${specialty}:`, error);
    return [];
  }
}; 