// This file is auto-generated. Do not edit directly.
import citiesData from '../data/cities.json';

// Import all location data files
import aspenData from '../data/locations/aspen.json';
import atlantaData from '../data/locations/atlanta.json';
import austinData from '../data/locations/austin.json';
import bostonData from '../data/locations/boston.json';
import buffaloData from '../data/locations/buffalo.json';
import charlestonData from '../data/locations/charleston.json';
import charlotteData from '../data/locations/charlotte.json';
import chicagocopyData from '../data/locations/chicago copy.json';
import chicagoData from '../data/locations/chicago.json';
import cincinnatiData from '../data/locations/cincinnati.json';
import clevelandData from '../data/locations/cleveland.json';
import columbusData from '../data/locations/columbus.json';
import dallasData from '../data/locations/dallas.json';
import denverData from '../data/locations/denver.json';
import fortworthData from '../data/locations/fort-worth.json';
import hartfordData from '../data/locations/hartford.json';
import houstonData from '../data/locations/houston.json';
import indianapolisData from '../data/locations/indianapolis.json';
import jacksonvilleData from '../data/locations/jacksonville.json';
import kansascityData from '../data/locations/kansas-city.json';
import lasvegasData from '../data/locations/las-vegas.json';
import losangelesData from '../data/locations/los-angeles.json';
import miamiData from '../data/locations/miami.json';
import minneapolisData from '../data/locations/minneapolis.json';
import nashvilleData from '../data/locations/nashville.json';
import neworleansData from '../data/locations/new-orleans.json';
import newyorkcopyData from '../data/locations/new-york copy.json';
import newyorkData from '../data/locations/new-york.json';
import palmbeachData from '../data/locations/palm-beach.json';
import philadelphiaData from '../data/locations/philadelphia.json';
import phoenixcopyData from '../data/locations/phoenix copy.json';
import phoenixData from '../data/locations/phoenix.json';
import pittsburghData from '../data/locations/pittsburgh.json';
import portlandData from '../data/locations/portland.json';
import providenceData from '../data/locations/providence.json';
import raleighData from '../data/locations/raleigh.json';
import richmondData from '../data/locations/richmond.json';
import sacramentoData from '../data/locations/sacramento.json';
import saltlakecityData from '../data/locations/salt-lake-city.json';
import sanantonioData from '../data/locations/san-antonio.json';
import sandiegoData from '../data/locations/san-diego.json';
import sanfranciscoData from '../data/locations/san-francisco.json';
import sanjoseData from '../data/locations/san-jose.json';
import santafeData from '../data/locations/santa-fe.json';
import savannahData from '../data/locations/savannah.json';
import seattleData from '../data/locations/seattle.json';
import stlouisData from '../data/locations/st-louis.json';
import washingtondcData from '../data/locations/washington-dc.json';
import washingtonData from '../data/locations/washington.json';

// Export array of all locations
export const locations = [
  aspenData,
  atlantaData,
  austinData,
  bostonData,
  buffaloData,
  charlestonData,
  charlotteData,
  chicagocopyData,
  chicagoData,
  cincinnatiData,
  clevelandData,
  columbusData,
  dallasData,
  denverData,
  fortworthData,
  hartfordData,
  houstonData,
  indianapolisData,
  jacksonvilleData,
  kansascityData,
  lasvegasData,
  losangelesData,
  miamiData,
  minneapolisData,
  nashvilleData,
  neworleansData,
  newyorkcopyData,
  newyorkData,
  palmbeachData,
  philadelphiaData,
  phoenixcopyData,
  phoenixData,
  pittsburghData,
  portlandData,
  providenceData,
  raleighData,
  richmondData,
  sacramentoData,
  saltlakecityData,
  sanantonioData,
  sandiegoData,
  sanfranciscoData,
  sanjoseData,
  santafeData,
  savannahData,
  seattleData,
  stlouisData,
  washingtondcData,
  washingtonData,
];

// Export cities from cities.json
export const cities = citiesData.cities;

/**
 * Get location data by city slug
 * @param {string} citySlug - The slug of the city to find
 * @returns {object|null} - The location data or null if not found
 */
export function getLocation(citySlug: string) {
  // Guard clause to handle undefined or null citySlug
  if (!citySlug) {
    console.error('getLocation called with undefined or null citySlug');
    return null;
  }

  try {
    const normalizedSlug = citySlug.toLowerCase().replace(/\s+/g, '-');
    console.log('getLocation - normalizedSlug:', normalizedSlug);
    
    // First try to find location by seo.schema.areaServed.name
    const locationBySeo = locations.find(location => 
      location.seo?.schema?.areaServed?.name?.toLowerCase().replace(/\s+/g, '-') === normalizedSlug
    );
    if (locationBySeo) return locationBySeo;

    // Then try by city property
    const locationByCity = locations.find(location => 
      location.city?.toLowerCase().replace(/\s+/g, '-') === normalizedSlug
    );
    if (locationByCity) return locationByCity;

    // Finally try by first appraiser's city
    const locationByAppraiser = locations.find(location => 
      location.appraisers?.[0]?.city?.toLowerCase().replace(/\s+/g, '-') === normalizedSlug
    );

    const result = locationBySeo || locationByCity || locationByAppraiser || null;
    if (!result) {
      console.error(`No location data found for slug: ${normalizedSlug}`);
    }
    return result;
  } catch (error) {
    console.error(`Error in getLocation for slug "${citySlug}":`, error);
    return null;
  }
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
