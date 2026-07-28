/**
 * Standardized Data Utilities
 *
 * Helpers for loading the standardized appraiser data that lives in
 * src/data/standardized_verified/*.json. Files are discovered via import.meta.glob so
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
  publication: {
    status: 'verified' | 'limited' | 'unknown';
    sourceUrl: string;
    sourceChecked: string;
    claimScope: string[];
    providerClaimed: boolean;
    credentialVerified: boolean;
  };
  serviceArea: {
    slug: string;
    city: string;
    region: string;
    country: string;
    url: string;
  } | null;
  seo: {
    title: string;
    description: string;
    canonical: string;
  };
}

export interface StandardizedLocation {
  appraisers: StandardizedAppraiser[];
}

interface PublicLocationAppraiser {
  name?: string;
  url?: string;
  slug?: string;
  image?: string;
  description?: string;
  publicRouteAvailable?: boolean;
}

interface PublicLocationFeed {
  location?: {
    slug?: string;
    city?: string;
    region?: string;
    listedAppraisers?: PublicLocationAppraiser[];
  };
}

interface PublicAppraiserEntry {
  slug?: string;
  url?: string;
  name?: string;
  description?: string;
  image?: string;
  telephone?: string;
  email?: string;
  website?: string;
  address?: {
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  };
  priceRange?: string;
  specialties?: string[];
  services?: string[];
  publication?: {
    status?: 'verified' | 'limited';
    sourceUrl?: string;
    sourceChecked?: string;
    claimScope?: string[];
    providerClaimed?: boolean;
    credentialVerified?: boolean;
  };
  serviceAreas?: Array<{
    slug?: string;
    city?: string;
    region?: string;
    country?: string;
    url?: string;
  }>;
  seo?: {
    title?: string;
    description?: string;
    canonical?: string;
  };
}

type RawStandardizedAppraiser = Partial<StandardizedAppraiser> & {
  phone?: string;
  email?: string;
  website?: string;
};

type RawStandardizedLocation = {
  appraisers?: RawStandardizedAppraiser[];
};

type LocationModule = () => Promise<{ default: StandardizedLocation }>;

const locationModules = import.meta.glob('../data/standardized_verified/*.json') as Record<string, LocationModule>;

const locationLoaders: Record<string, LocationModule> = Object.fromEntries(
  Object.entries(locationModules).map(([modulePath, loader]) => {
    const match = modulePath.match(/standardized_verified\/([^/]+)\.json$/);
    const slug = match ? match[1] : modulePath;
    return [slug, loader];
  })
);

const locationCache = new Map<string, Promise<StandardizedLocation>>();

// Lazy-built reverse index: appraiser id/slug → location slug
let appraiserIndex: Map<string, string> | null = null;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => stringValue(item))
    .filter(Boolean);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeHours(value: unknown): Array<{ day: string; hours: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const maybeHour = item as { day?: unknown; hours?: unknown };
      const day = stringValue(maybeHour.day);
      const hours = stringValue(maybeHour.hours);
      if (!day && !hours) return null;
      return { day, hours };
    })
    .filter((item): item is { day: string; hours: string } => Boolean(item));
}

function formatAddress(address: StandardizedAppraiser['address']): string {
  const street = stringValue(address.street);
  const city = stringValue(address.city);
  const state = stringValue(address.state);
  const zip = stringValue(address.zip);
  const country = stringValue((address as StandardizedAppraiser['address'] & { country?: string }).country);

  const locality = [city, state].filter(Boolean).join(', ');
  const trailing = [zip, country].filter(Boolean).join(' ');

  return [street, locality, trailing].filter(Boolean).join(', ');
}

function normalizeAppraiser(appraiser: RawStandardizedAppraiser): StandardizedAppraiser {
  const name = stringValue(appraiser.name) || 'Appraiser';
  const rawAddress = (appraiser.address && typeof appraiser.address === 'object' ? appraiser.address : {}) as Partial<StandardizedAppraiser['address']> & {
    country?: string;
  };
  const rawBusiness = (appraiser.business && typeof appraiser.business === 'object' ? appraiser.business : {}) as Partial<StandardizedAppraiser['business']>;
  const rawExpertise = (appraiser.expertise && typeof appraiser.expertise === 'object' ? appraiser.expertise : {}) as Partial<StandardizedAppraiser['expertise']>;
  const rawContent = (appraiser.content && typeof appraiser.content === 'object' ? appraiser.content : {}) as Partial<StandardizedAppraiser['content']>;
  const rawMetadata = (appraiser.metadata && typeof appraiser.metadata === 'object' ? appraiser.metadata : {}) as Partial<StandardizedAppraiser['metadata']>;
  const rawContact = (appraiser.contact && typeof appraiser.contact === 'object' ? appraiser.contact : {}) as Partial<StandardizedAppraiser['contact']>;

  const normalizedAddress: StandardizedAppraiser['address'] = {
    street: stringValue(rawAddress.street),
    city: stringValue(rawAddress.city),
    state: stringValue(rawAddress.state),
    zip: stringValue(rawAddress.zip),
    formatted: stringValue(rawAddress.formatted)
  };

  if (!normalizedAddress.formatted) {
    normalizedAddress.formatted = formatAddress(normalizedAddress);
  }

  return {
    id: stringValue(appraiser.id) || stringValue(appraiser.slug) || slugify(name),
    name,
    slug: stringValue(appraiser.slug) || stringValue(appraiser.id) || slugify(name),
    imageUrl: stringValue(appraiser.imageUrl),
    address: normalizedAddress,
    contact: {
      phone: stringValue(rawContact.phone) || stringValue(appraiser.phone),
      email: stringValue(rawContact.email) || stringValue(appraiser.email),
      website: stringValue(rawContact.website) || stringValue(appraiser.website)
    },
    business: {
      yearsInBusiness: stringValue(rawBusiness.yearsInBusiness),
      hours: normalizeHours(rawBusiness.hours),
      pricing: stringValue(rawBusiness.pricing),
      rating: numberValue(rawBusiness.rating, 0),
      reviewCount: numberValue(rawBusiness.reviewCount, 0)
    },
    expertise: {
      specialties: stringArray(rawExpertise.specialties),
      certifications: stringArray(rawExpertise.certifications),
      services: stringArray(rawExpertise.services)
    },
    content: {
      about: stringValue(rawContent.about),
      notes: stringValue(rawContent.notes)
    },
    reviews: Array.isArray(appraiser.reviews)
      ? appraiser.reviews
          .map(review => {
            if (!review || typeof review !== 'object') return null;
            const maybeReview = review as {
              author?: unknown;
              rating?: unknown;
              date?: unknown;
              content?: unknown;
            };
            return {
              author: stringValue(maybeReview.author),
              rating: numberValue(maybeReview.rating, 0),
              date: stringValue(maybeReview.date),
              content: stringValue(maybeReview.content)
            };
          })
          .filter((review): review is StandardizedAppraiser['reviews'][number] => Boolean(review))
      : [],
    metadata: {
      lastUpdated: stringValue(rawMetadata.lastUpdated),
      inService: rawMetadata.inService !== false
    },
    publication: {
      status: appraiser.publication?.status || 'unknown',
      sourceUrl: stringValue(appraiser.publication?.sourceUrl),
      sourceChecked: stringValue(appraiser.publication?.sourceChecked),
      claimScope: stringArray(appraiser.publication?.claimScope),
      providerClaimed: appraiser.publication?.providerClaimed === true,
      credentialVerified: appraiser.publication?.credentialVerified === true,
    },
    serviceArea: appraiser.serviceArea || null,
    seo: {
      title: stringValue(appraiser.seo?.title),
      description: stringValue(appraiser.seo?.description),
      canonical: stringValue(appraiser.seo?.canonical),
    },
  };
}

function normalizeLocation(location: RawStandardizedLocation | null | undefined): StandardizedLocation {
  return {
    appraisers: Array.isArray(location?.appraisers)
      ? location.appraisers.map(normalizeAppraiser)
      : []
  };
}

async function buildAppraiserIndex(): Promise<Map<string, string>> {
  if (appraiserIndex) return appraiserIndex;
  appraiserIndex = new Map();
  const slugs = Object.keys(locationLoaders);
  const locations = await Promise.all(
    slugs.map(async (slug) => {
      const loc = await getStandardizedLocation(slug);
      return { slug, loc };
    })
  );
  for (const { slug, loc } of locations) {
    if (!loc?.appraisers) continue;
    for (const appraiser of loc.appraisers) {
      if (appraiser.id) appraiserIndex.set(appraiser.id, slug);
      if (appraiser.slug) appraiserIndex.set(appraiser.slug, slug);
    }
  }
  return appraiserIndex;
}

// Export cities from cities.json
export const cities = citiesData.cities;

function normalizeCitySlug(citySlug: string): string {
  return citySlug.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
}

function getSlugFromProfileUrl(url?: string): string {
  const match = String(url || '').match(/\/appraiser\/([^/?#]+)/);
  return match?.[1] || '';
}

async function getPublishedLocationFeed(citySlug: string): Promise<PublicLocationFeed | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  const normalizedSlug = normalizeCitySlug(citySlug);

  try {
    const response = await fetch('/locations.json', { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const feed = await response.json() as { locations?: PublicLocationFeed['location'][] };
      const location = feed.locations?.find(item => item?.slug === normalizedSlug);
      if (location) return { location };
    }
  } catch {
    // Fall through to the route-local feed.
  }

  try {
    const response = await fetch(`/location/${normalizedSlug}/index.json`, { headers: { Accept: 'application/json' } });
    if (response.ok) return await response.json() as PublicLocationFeed;
  } catch {
    return null;
  }
  return null;
}

let publicAppraiserFeedPromise: Promise<PublicAppraiserEntry[] | null> | null = null;

async function getPublishedAppraiserFeed(): Promise<PublicAppraiserEntry[] | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  if (!publicAppraiserFeedPromise) {
    publicAppraiserFeedPromise = fetch('/appraisers.json', { headers: { Accept: 'application/json' } })
      .then(async response => {
        if (!response.ok) return null;
        const feed = await response.json() as { appraisers?: PublicAppraiserEntry[] };
        return Array.isArray(feed.appraisers) ? feed.appraisers : null;
      })
      .catch(() => null);
  }
  return publicAppraiserFeedPromise;
}

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
        loader().then(module => normalizeLocation(module.default))
      );
    }

    return locationCache.get(normalizedSlug)!;
  } catch (error) {
    console.error(`Error in getStandardizedLocation for ${citySlug}:`, error);
    return Promise.resolve(null);
  }
}

export async function getPublishedStandardizedLocation(citySlug: string): Promise<StandardizedLocation | null> {
  if (!citySlug) return null;
  const normalizedSlug = normalizeCitySlug(citySlug);
  const [publishedFeed, publicAppraisers] = await Promise.all([
    getPublishedLocationFeed(normalizedSlug),
    getPublishedAppraiserFeed(),
  ]);

  // Local source files contain fields that are not necessarily approved for
  // publication. A missing or partial public feed must fail closed instead of
  // falling back to those bundled records.
  if (!publishedFeed?.location || !publicAppraisers) {
    return { appraisers: [] };
  }
  const publicBySlug = new Map(publicAppraisers.map(entry => [entry.slug || getSlugFromProfileUrl(entry.url), entry]));
  const appraisers = (publishedFeed.location.listedAppraisers || [])
    .map(entry => {
      const slug = entry.slug || getSlugFromProfileUrl(entry.url);
      if (entry.publicRouteAvailable === false || !entry.url || !slug) return null;
      const publicEntry = publicBySlug.get(slug);
      return publicEntry ? publishedEntryToSafeAppraiser(publicEntry, normalizedSlug) : null;
    })
    .filter((appraiser): appraiser is StandardizedAppraiser => Boolean(appraiser));
  return { appraisers };
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
    // First attempt: use the reverse index to find the location slug directly
    const index = await buildAppraiserIndex();
    const locationSlug = index.get(appraiserId);
    if (locationSlug) {
      const location = await getStandardizedLocation(locationSlug);
      if (location?.appraisers) {
        const appraiser = location.appraisers.find(
          app => app.id === appraiserId || app.slug === appraiserId
        );
        if (appraiser) return appraiser;
      }
    }

    // Fallback: full scan (needed on first call before index is built)
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

export function publishedEntryToSafeAppraiser(
  entry: PublicAppraiserEntry,
  preferredServiceAreaSlug?: string
): StandardizedAppraiser | null {
  if (!entry.slug || !entry.name || !entry.url) return null;
  const address = entry.address || {};
  const serviceArea = entry.serviceAreas?.find(area => area.slug === preferredServiceAreaSlug)
    || entry.serviceAreas?.[0]
    || null;
  const city = address.city || serviceArea?.city || '';
  const region = address.region || serviceArea?.region || '';
  const formatted = [address.streetAddress, [city, region].filter(Boolean).join(', '), address.postalCode]
    .filter(Boolean)
    .join(', ');
  return {
    id: entry.slug,
    slug: entry.slug,
    name: entry.name,
    imageUrl: entry.image || '',
    address: {
      street: address.streetAddress || '',
      city,
      state: region,
      zip: address.postalCode || '',
      formatted,
    },
    contact: {
      phone: entry.telephone || '',
      email: entry.email || '',
      website: entry.website || '',
    },
    business: {
      yearsInBusiness: '',
      hours: [],
      pricing: entry.priceRange || '',
      rating: 0,
      reviewCount: 0,
    },
    expertise: {
      specialties: entry.specialties || [],
      certifications: [],
      services: entry.services || [],
    },
    content: {
      about: entry.description || `${entry.name} has a limited directory listing for ${formatted || 'this service area'}.`,
      notes: 'Directory details are limited to information present in the approved public profile.',
    },
    reviews: [],
    metadata: { lastUpdated: '', inService: true },
    publication: {
      status: entry.publication?.status || 'unknown',
      sourceUrl: entry.publication?.sourceUrl || '',
      sourceChecked: entry.publication?.sourceChecked || '',
      claimScope: entry.publication?.claimScope || [],
      providerClaimed: entry.publication?.providerClaimed === true,
      credentialVerified: entry.publication?.credentialVerified === true,
    },
    serviceArea: serviceArea
      ? {
          slug: serviceArea.slug || '',
          city: serviceArea.city || '',
          region: serviceArea.region || '',
          country: serviceArea.country || '',
          url: serviceArea.url || '',
        }
      : null,
    seo: {
      title: entry.seo?.title || '',
      description: entry.seo?.description || '',
      canonical: entry.seo?.canonical || entry.url,
    },
  };
}

export async function getPublishedStandardizedAppraiser(appraiserId: string): Promise<StandardizedAppraiser | null> {
  if (!appraiserId || typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  try {
    const appraisers = await getPublishedAppraiserFeed();
    const entry = appraisers?.find(item => item.slug === appraiserId || getSlugFromProfileUrl(item.url) === appraiserId);
    return entry ? publishedEntryToSafeAppraiser(entry) : null;
  } catch {
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
  getPublishedStandardizedLocation,
  getPublishedStandardizedAppraiser,
  getStandardizedAppraiser,
  getAllStandardizedAppraisers,
  cities
};
