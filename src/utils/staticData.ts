// This file is auto-generated. Do not edit directly.
import citiesData from '../data/cities.json';

// Import all location data files
import aspenData from '../data/standardized/aspen.json';
import atlantaData from '../data/standardized/atlanta.json';
import austinData from '../data/standardized/austin.json';
import bostonData from '../data/standardized/boston.json';
import buffaloData from '../data/standardized/buffalo.json';
import charlestonData from '../data/standardized/charleston.json';
import charlotteData from '../data/standardized/charlotte.json';
import chicagocopyData from '../data/standardized/chicago copy.json';
import chicagoData from '../data/standardized/chicago.json';
import cincinnatiData from '../data/standardized/cincinnati.json';
import clevelandData from '../data/standardized/cleveland.json';
import columbusData from '../data/standardized/columbus.json';
import dallasData from '../data/standardized/dallas.json';
import denverData from '../data/standardized/denver.json';
import fortworthData from '../data/standardized/fort-worth.json';
import hartfordData from '../data/standardized/hartford.json';
import houstonData from '../data/standardized/houston.json';
import indianapolisData from '../data/standardized/indianapolis.json';
import jacksonvilleData from '../data/standardized/jacksonville.json';
import kansascityData from '../data/standardized/kansas-city.json';
import lasvegasData from '../data/standardized/las-vegas.json';
import losangelesData from '../data/standardized/los-angeles.json';
import miamiData from '../data/standardized/miami.json';
import minneapolisData from '../data/standardized/minneapolis.json';
import nashvilleData from '../data/standardized/nashville.json';
import neworleansData from '../data/standardized/new-orleans.json';
import newyorkcopyData from '../data/standardized/new-york copy.json';
import newyorkData from '../data/standardized/new-york.json';
import palmbeachData from '../data/standardized/palm-beach.json';
import philadelphiaData from '../data/standardized/philadelphia.json';
import phoenixcopyData from '../data/standardized/phoenix copy.json';
import phoenixData from '../data/standardized/phoenix.json';
import pittsburghData from '../data/standardized/pittsburgh.json';
import portlandData from '../data/standardized/portland.json';
import providenceData from '../data/standardized/providence.json';
import raleighData from '../data/standardized/raleigh.json';
import richmondData from '../data/standardized/richmond.json';
import sacramentoData from '../data/standardized/sacramento.json';
import saltlakecityData from '../data/standardized/salt-lake-city.json';
import sanantonioData from '../data/standardized/san-antonio.json';
import sandiegoData from '../data/standardized/san-diego.json';
import sanfranciscoData from '../data/standardized/san-francisco.json';
import sanjoseData from '../data/standardized/san-jose.json';
import santafeData from '../data/standardized/santa-fe.json';
import savannahData from '../data/standardized/savannah.json';
import seattleData from '../data/standardized/seattle.json';
import stlouisData from '../data/standardized/st-louis.json';
import washingtondcData from '../data/standardized/washington-dc.json';
import washingtonData from '../data/standardized/washington.json';

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
