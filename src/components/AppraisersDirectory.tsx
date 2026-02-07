import React, { useState, useEffect } from 'react';
import { MapPin, Star, Clock } from 'lucide-react';
import { buildSiteUrl } from '../config/site';
import { normalizeAssetUrl } from '../utils/assetUrls';

// Import standardized data utilities
import { getAllStandardizedAppraisers, StandardizedAppraiser } from '../utils/standardizedData';

// Type definitions
type Appraiser = StandardizedAppraiser;

export function AppraisersDirectory() {
  const [allAppraisers, setAllAppraisers] = useState<Appraiser[]>([]);
  const [filteredAppraisers, setFilteredAppraisers] = useState<Appraiser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [loading, setLoading] = useState(true);

  // Load all appraisers from standardized data
  useEffect(() => {
    const loadAppraisers = async () => {
      try {
        setLoading(true);
        const appraisers = await getAllStandardizedAppraisers();
        setAllAppraisers(appraisers);
        setFilteredAppraisers(appraisers);
      } catch (error) {
        console.error('Error loading appraisers:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAppraisers();
  }, []);

  // Filter appraisers based on search and filters
  useEffect(() => {
    let results = allAppraisers;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(
        appraiser => 
          appraiser.name.toLowerCase().includes(term) || 
          appraiser.address.city.toLowerCase().includes(term) ||
          (appraiser.expertise.specialties && appraiser.expertise.specialties.some(specialty => 
            specialty.toLowerCase().includes(term)
          ))
      );
    }
    
    if (selectedState) {
      results = results.filter(appraiser => appraiser.address.state === selectedState);
    }
    
    if (selectedSpecialty) {
      results = results.filter(
        appraiser => appraiser.expertise.specialties && appraiser.expertise.specialties.some(
          specialty => specialty.toLowerCase().includes(selectedSpecialty.toLowerCase())
        )
      );
    }
    
    setFilteredAppraisers(results);
  }, [searchTerm, selectedState, selectedSpecialty, allAppraisers]);

  // Get unique states for filter dropdown
  const states = [...new Set(allAppraisers.map(appraiser => appraiser.address.state))].filter(Boolean).sort();
  
  // Get unique specialties for filter dropdown
  const specialties = [...new Set(
    allAppraisers.flatMap(appraiser => appraiser.expertise.specialties || [])
  )].filter(Boolean).sort();

  const handleCardNavigation = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    appraiser: Appraiser
  ) => {
    const target = event.target as HTMLElement | null;
    if (target && typeof target.closest === 'function') {
      const interactive = target.closest('a[href], button, input, select, textarea, summary, [role="button"], [role="link"]');
      if (interactive && interactive !== event.currentTarget) return;
    }

    if ('key' in event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    }

    window.location.href = buildSiteUrl(`/appraiser/${appraiser.slug}`);
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-blue-50 py-12">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center mb-6">
            <a href={buildSiteUrl('/')} className="flex items-center text-foreground hover:text-primary transition-colors">
              <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-primary to-blue-600 text-transparent bg-clip-text">Appraisily</span>
            </a>
            <a href={buildSiteUrl('/')} className="text-primary hover:underline">← Back to Main Site</a>
          </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-6 text-center">
            Antique Appraiser Directory
          </h1>
          <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
            Browse our comprehensive list of antique appraisers from across the country. 
            Find experts specializing in various antique categories to help with your appraisal needs.
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
        
        {loading ? (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-gray-600 mb-2">Loading antique appraisers...</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAppraisers.map(appraiser => (
              <div 
                key={appraiser.id} 
                className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer focus-within:ring-2 focus-within:ring-primary/40"
                role="link"
                tabIndex={0}
                onClick={(event) => handleCardNavigation(event, appraiser)}
                onKeyDown={(event) => handleCardNavigation(event, appraiser)}
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={normalizeAssetUrl(appraiser.imageUrl)} 
                    alt={`${appraiser.name} - Antique Appraiser`}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold mb-2 hover:text-primary transition-colors">
                    {appraiser.name}
                  </h3>
                  <div className="flex items-center text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> 
                    {appraiser.address.city}, {appraiser.address.state}
                  </div>
                  
                  {appraiser.business?.yearsInBusiness && (
                    <div className="flex items-center text-sm text-muted-foreground mb-3">
                      <Clock className="w-4 h-4 mr-1" /> 
                      {appraiser.business.yearsInBusiness} experience
                    </div>
                  )}
                  
                  {appraiser.business?.rating && (
                    <div className="flex items-center text-sm text-muted-foreground mb-3">
                      <Star className="w-4 h-4 mr-1 text-yellow-500" /> 
                      {appraiser.business.rating} ({appraiser.business.reviewCount} reviews)
                    </div>
                  )}
                  
                  {appraiser.content?.notes && (
                    <p className="text-muted-foreground text-sm mb-4">{appraiser.content.notes}</p>
                  )}
                  
                  {/* Specialties */}
                  {appraiser.expertise?.specialties && appraiser.expertise.specialties.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium mb-2">Specialties:</h4>
                      <div className="flex flex-wrap gap-2">
                        {appraiser.expertise.specialties.slice(0, 3).map((specialty, index) => (
                          <span key={index} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                            {specialty.length > 30 ? specialty.substring(0, 30) + '...' : specialty}
                          </span>
                        ))}
                        {appraiser.expertise.specialties.length > 3 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                            +{appraiser.expertise.specialties.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Certifications */}
                  {appraiser.expertise?.certifications && appraiser.expertise.certifications.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium mb-2">Certifications:</h4>
                      <div className="flex flex-wrap gap-2">
                        {appraiser.expertise.certifications.map((cert, index) => (
                          <span key={index} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full flex items-center">
                            <Badge className="w-3 h-3 mr-1" /> {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Contact Info */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {appraiser.contact?.phone && (
                      <div className="text-sm mb-1">
                        <strong className="text-gray-700">Phone:</strong> {appraiser.contact.phone}
                      </div>
                    )}
                    {appraiser.contact?.website && (
                      <div className="text-sm mb-1">
                        <strong className="text-gray-700">Website:</strong>{' '}
                        <a 
                          href={appraiser.contact.website.startsWith('http') ? appraiser.contact.website : `https://${appraiser.contact.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          data-gtm-event="directory_cta"
                          data-gtm-cta="website"
                          data-gtm-surface="directory_card"
                          data-gtm-appraiser-id={appraiser.id || appraiser.slug || appraiser.name}
                          data-gtm-appraiser-name={appraiser.name}
                        >
                          Visit Website
                        </a>
                      </div>
                    )}
                    <div className="mt-3">
                      <Link 
                        to={`/appraiser/${appraiser.id}`}
                        className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                      >
                        View Details
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && filteredAppraisers.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-gray-600 mb-2">No appraisers found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or filters</p>
          </div>
        )}
      </main>
    </div>
  );
} 
