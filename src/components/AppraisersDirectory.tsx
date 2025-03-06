import React, { useState, useEffect } from 'react';
import { MapPin, Star, Clock, Award, Badge } from 'lucide-react';
import { Link } from 'react-router-dom';

// Import all location data
import aspenData from '../data/locations/aspen.json';
import atlantaData from '../data/locations/atlanta.json';
import austinData from '../data/locations/austin.json';
import bostonData from '../data/locations/boston.json';
import buffaloData from '../data/locations/buffalo.json';
import charlestonData from '../data/locations/charleston.json';
import charlotteData from '../data/locations/charlotte.json';
import chicagoData from '../data/locations/chicago.json';
import cincinnatiData from '../data/locations/cincinnati.json';
import clevelandData from '../data/locations/cleveland.json';
import columbusData from '../data/locations/columbus.json';
import dallasData from '../data/locations/dallas.json';
import denverData from '../data/locations/denver.json';
import fortWorthData from '../data/locations/fort-worth.json';
import hartfordData from '../data/locations/hartford.json';
import houstonData from '../data/locations/houston.json';
import indianapolisData from '../data/locations/indianapolis.json';
import jacksonvilleData from '../data/locations/jacksonville.json';
import kansasCityData from '../data/locations/kansas-city.json';
import lasVegasData from '../data/locations/las-vegas.json';
import miamiData from '../data/locations/miami.json';
import minneapolisData from '../data/locations/minneapolis.json';
import nashvilleData from '../data/locations/nashville.json';
import newOrleansData from '../data/locations/new-orleans.json';
import newYorkData from '../data/locations/new-york.json';
import palmBeachData from '../data/locations/palm-beach.json';
import philadelphiaData from '../data/locations/philadelphia.json';
import phoenixData from '../data/locations/phoenix.json';
import pittsburghData from '../data/locations/pittsburgh.json';
import portlandData from '../data/locations/portland.json';
import providenceData from '../data/locations/providence.json';
import raleighData from '../data/locations/raleigh.json';
import richmondData from '../data/locations/richmond.json';
import sacramentoData from '../data/locations/sacramento.json';
import saltLakeCityData from '../data/locations/salt-lake-city.json';
import sanAntonioData from '../data/locations/san-antonio.json';
import sanDiegoData from '../data/locations/san-diego.json';
import sanFranciscoData from '../data/locations/san-francisco.json';
import sanJoseData from '../data/locations/san-jose.json';
import santaFeData from '../data/locations/santa-fe.json';
import savannahData from '../data/locations/savannah.json';
import seattleData from '../data/locations/seattle.json';
import stLouisData from '../data/locations/st-louis.json';
import washingtonData from '../data/locations/washington.json';

// Combine all appraiser data
const allLocations = {
  aspen: aspenData,
  atlanta: atlantaData,
  austin: austinData,
  boston: bostonData,
  buffalo: buffaloData,
  charleston: charlestonData,
  charlotte: charlotteData,
  chicago: chicagoData,
  cincinnati: cincinnatiData,
  cleveland: clevelandData,
  columbus: columbusData,
  dallas: dallasData,
  denver: denverData,
  'fort-worth': fortWorthData,
  hartford: hartfordData,
  houston: houstonData,
  indianapolis: indianapolisData,
  jacksonville: jacksonvilleData,
  'kansas-city': kansasCityData,
  'las-vegas': lasVegasData,
  miami: miamiData,
  minneapolis: minneapolisData,
  nashville: nashvilleData,
  'new-orleans': newOrleansData,
  'new-york': newYorkData,
  'palm-beach': palmBeachData,
  philadelphia: philadelphiaData,
  phoenix: phoenixData,
  pittsburgh: pittsburghData,
  portland: portlandData,
  providence: providenceData,
  raleigh: raleighData,
  richmond: richmondData,
  sacramento: sacramentoData,
  'salt-lake-city': saltLakeCityData,
  'san-antonio': sanAntonioData,
  'san-diego': sanDiegoData,
  'san-francisco': sanFranciscoData,
  'san-jose': sanJoseData,
  'santa-fe': santaFeData,
  savannah: savannahData,
  seattle: seattleData,
  'st-louis': stLouisData,
  washington: washingtonData,
};

// Type definitions
interface Appraiser {
  id?: string;
  name: string;
  specialties: string[];
  pricing: string;
  services_offered: string[];
  certifications: string[];
  years_in_business: string;
  city: string;
  state: string;
  phone: string;
  website: string;
  notes: string;
}

interface LocationData {
  appraisers: Appraiser[];
}

export function AppraisersDirectory() {
  const [allAppraisers, setAllAppraisers] = useState<Appraiser[]>([]);
  const [filteredAppraisers, setFilteredAppraisers] = useState<Appraiser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');

  // Extract all appraisers from all locations
  useEffect(() => {
    const appraisers: Appraiser[] = [];
    
    Object.entries(allLocations).forEach(([locationKey, locationData]) => {
      const typedLocationData = locationData as unknown as LocationData;
      
      // Process each appraiser and add the locationKey for reference
      typedLocationData.appraisers.forEach(appraiser => {
        // Generate an ID if one doesn't exist
        if (!appraiser.id) {
          appraiser.id = appraiser.name.toLowerCase().replace(/\s+/g, '-');
        }
        
        appraisers.push(appraiser);
      });
    });
    
    setAllAppraisers(appraisers);
    setFilteredAppraisers(appraisers);
  }, []);

  // Filter appraisers based on search and filters
  useEffect(() => {
    let results = allAppraisers;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(
        appraiser => 
          appraiser.name.toLowerCase().includes(term) || 
          appraiser.city.toLowerCase().includes(term) ||
          appraiser.specialties.some(specialty => specialty.toLowerCase().includes(term))
      );
    }
    
    if (selectedState) {
      results = results.filter(appraiser => appraiser.state === selectedState);
    }
    
    if (selectedSpecialty) {
      results = results.filter(
        appraiser => appraiser.specialties.some(
          specialty => specialty.toLowerCase().includes(selectedSpecialty.toLowerCase())
        )
      );
    }
    
    setFilteredAppraisers(results);
  }, [searchTerm, selectedState, selectedSpecialty, allAppraisers]);

  // Get unique states for filter dropdown
  const states = [...new Set(allAppraisers.map(appraiser => appraiser.state))].filter(Boolean).sort();
  
  // Get unique specialties for filter dropdown
  const specialties = [...new Set(
    allAppraisers.flatMap(appraiser => appraiser.specialties)
  )].filter(Boolean).sort();

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-blue-50 py-12">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center mb-6">
            <a href="/" className="flex items-center text-foreground hover:text-primary transition-colors">
              <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-primary to-blue-600 text-transparent bg-clip-text">Appraisily</span>
            </a>
            <a href="/" className="text-primary hover:underline">← Back to Main Site</a>
          </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-6 text-center">
            Art Appraiser Directory
          </h1>
          <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
            Browse our comprehensive list of art appraisers from across the country. 
            Find experts specializing in various art forms to help with your appraisal needs.
          </p>
          
          {/* Search and Filters */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Appraisers
                </label>
                <input
                  type="text"
                  id="search"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Search by name, city, or specialty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by State
                </label>
                <select
                  id="state"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                >
                  <option value="">All States</option>
                  {states.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Specialty
                </label>
                <select
                  id="specialty"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                >
                  <option value="">All Specialties</option>
                  {specialties.map(specialty => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Appraisers Grid */}
      <main className="container mx-auto px-6 py-12">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {filteredAppraisers.length} Appraiser{filteredAppraisers.length !== 1 ? 's' : ''} Found
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredAppraisers.map(appraiser => (
            <div 
              key={appraiser.id} 
              className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="p-5">
                <h3 className="text-xl font-semibold mb-2 hover:text-primary transition-colors">
                  {appraiser.name}
                </h3>
                <div className="flex items-center text-muted-foreground mb-3">
                  <MapPin className="w-4 h-4 mr-1" /> 
                  {appraiser.city}, {appraiser.state}
                </div>
                
                {appraiser.years_in_business && (
                  <div className="flex items-center text-sm text-muted-foreground mb-3">
                    <Clock className="w-4 h-4 mr-1" /> 
                    {appraiser.years_in_business} experience
                  </div>
                )}
                
                {appraiser.notes && (
                  <p className="text-muted-foreground text-sm mb-4">{appraiser.notes}</p>
                )}
                
                {/* Specialties */}
                {appraiser.specialties && appraiser.specialties.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-2">Specialties:</h4>
                    <div className="flex flex-wrap gap-2">
                      {appraiser.specialties.slice(0, 5).map((specialty, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                          {specialty}
                        </span>
                      ))}
                      {appraiser.specialties.length > 5 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          +{appraiser.specialties.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Certifications */}
                {appraiser.certifications && appraiser.certifications.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-2">Certifications:</h4>
                    <div className="flex flex-wrap gap-2">
                      {appraiser.certifications.map((cert, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full flex items-center">
                          <Badge className="w-3 h-3 mr-1" /> {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Contact Info */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {appraiser.phone && (
                    <div className="text-sm mb-1">
                      <strong className="text-gray-700">Phone:</strong> {appraiser.phone}
                    </div>
                  )}
                  {appraiser.website && (
                    <div className="text-sm mb-1">
                      <strong className="text-gray-700">Website:</strong>{' '}
                      <a 
                        href={appraiser.website.startsWith('http') ? appraiser.website : `https://${appraiser.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {filteredAppraisers.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-gray-600 mb-2">No appraisers found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or filters</p>
          </div>
        )}
      </main>
    </div>
  );
} 