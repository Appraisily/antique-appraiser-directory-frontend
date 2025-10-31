/**
 * Standardized Data Utilities
 *
 * Helpers for loading the standardized appraiser data that lives in
 * src/data/standardized/*.json. Files are discovered via import.meta.glob so
 * that routes only load the JSON they need.
 */

import citiesData from '../data/cities.json';

// Define types for standardized data
export interface StandardizedAppraiser {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    formatted: string;
  };
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  business: {
    yearsInBusiness: string;
    hours: Array<{
      day: string;
      hours: string;
    }>;
    pricing: string;
    rating: number;
    reviewCount: number;
  };
  expertise: {
    specialties: string[];
    certifications: string[];
    services: string[];
  };
  content: {
    about: string;
    notes: string;
  };
  reviews: Array<{
    author: string;
    rating: number;
    date: string;
    content: string;
  }>;
  metadata: {
    lastUpdated: string;
    inService: boolean;
  };
}

export interface StandardizedLocation {
  appraisers: StandardizedAppraiser[];
}

type LocationModule = () => Promise<{ default: StandardizedLocation }>;

const locationModules = import.meta.glob('../data/standardized/*.json') as Record<string, LocationModule>;

const locationLoaders: Record<string, LocationModule> = Object.fromEntries(
  Object.entries(locationModules).map(([modulePath, loader]) => {
    const match = modulePath.match(/standardized\/([^/]+)\.json$/);
    const slug = match ? match[1] : modulePath;
    return [slug, loader];
  })
);

const locationCache = new Map<string, Promise<StandardizedLocation>>();

// Export cities from cities.json
export const cities = citiesData.cities;

/**
 * Get standardized location data by city slug
 * @param {string} citySlug - The slug of the city to find
 * @returns {Promise<StandardizedLocation|null>} - The location data or null if not found
 */
export function getStandardizedLocation(citySlug: string): Promise<StandardizedLocation | null> {
  if (!citySlug) {
    console.error('getStandardizedLocation called with undefined or null citySlug');
    return Promise.resolve(null);
  }

  try {
    // Normalize the slug - replace spaces with dashes, remove periods, ensure lowercase
    const normalizedSlug = citySlug.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');

    const loader = locationLoaders[normalizedSlug];
    if (!loader) {
      console.error(`No standardized data found for slug: ${normalizedSlug}`);
      return Promise.resolve(null);
    }

    if (!locationCache.has(normalizedSlug)) {
      locationCache.set(
        normalizedSlug,
        loader().then(module => module.default)
      );
    }

    return locationCache.get(normalizedSlug)!;
  } catch (error) {
    console.error(`Error in getStandardizedLocation for ${citySlug}:`, error);
    return Promise.resolve(null);
  }
}

/**
 * Get appraiser data by ID
 * @param {string} appraiserId - The ID of the appraiser to find
 * @returns {StandardizedAppraiser|null} - The appraiser data or null if not found
 */
export async function getStandardizedAppraiser(appraiserId: string): Promise<StandardizedAppraiser | null> {
  if (!appraiserId) {
    console.error('getStandardizedAppraiser called with undefined or null appraiserId');
    return null;
  }

  try {
    const allLocations = await Promise.all(
      Object.keys(locationLoaders).map(slug => getStandardizedLocation(slug))
    );

    for (const location of allLocations) {
      if (!location?.appraisers) continue;

      const appraiser = location.appraisers.find(app =>
        app.id === appraiserId || app.slug === appraiserId
      );

      if (appraiser) return appraiser;
    }

    console.error(`No appraiser found with ID: ${appraiserId}`);
    return null;
  } catch (error) {
    console.error(`Error in getStandardizedAppraiser for ${appraiserId}:`, error);
    return null;
  }
}

/**
 * Get all appraisers across all locations
 * @returns {Promise<StandardizedAppraiser[]>} - Array of all appraisers
 */
export async function getAllStandardizedAppraisers(): Promise<StandardizedAppraiser[]> {
  try {
    const allLocations = await Promise.all(
      Object.keys(locationLoaders).map(slug => getStandardizedLocation(slug))
    );

    const allAppraisers: StandardizedAppraiser[] = [];

    allLocations.forEach(location => {
      if (location?.appraisers?.length) {
        allAppraisers.push(...location.appraisers);
      }
    });

    return allAppraisers;
  } catch (error) {
    console.error('Error in getAllStandardizedAppraisers:', error);
    return [];
  }
}

export default {
  getStandardizedLocation,
  getStandardizedAppraiser,
  getAllStandardizedAppraisers,
  cities
};
