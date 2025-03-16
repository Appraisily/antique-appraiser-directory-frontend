import React, { useState, useEffect } from 'react';

/**
 * Art Appraiser Directory - Simplified Direct Integration
 * 
 * This component provides the directory functionality but as a direct 
 * import into the main site rather than a separate application.
 * 
 * Benefits:
 * - Single build process
 * - No hydration issues
 * - No merge-builds complexity
 * - Shared dependencies with main site
 * - Direct access to main site context, theme, etc.
 */

// Main Directory component that can be mounted anywhere in the main site
const DirectoryApp = ({ baseUrl = '/directory' }) => {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [currentPage, setCurrentPage] = useState('home');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAppraiser, setCurrentAppraiser] = useState(null);
  
  // Determine what to show based on the URL
  useEffect(() => {
    const path = window.location.pathname;
    
    // Parse the URL to determine what view to show
    if (path.startsWith(`${baseUrl}/location/`)) {
      const locationSlug = path.split('/').pop();
      setCurrentPage('location');
      fetchLocation(locationSlug);
    } 
    else if (path.startsWith(`${baseUrl}/appraiser/`)) {
      const appraiserSlug = path.split('/').pop();
      setCurrentPage('appraiser');
      fetchAppraiser(appraiserSlug);
    } 
    else if (path === baseUrl || path === `${baseUrl}/`) {
      setCurrentPage('home');
      fetchLocations();
    }
    
    setLoading(false);
  }, [baseUrl]);
  
  // Data fetching functions - these would use the same data source as the main site
  const fetchLocations = async () => {
    try {
      // This could be a direct import from a shared data module
      // or an API call that's shared with the main site
      const response = await fetch('/data/locations.json');
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };
  
  const fetchLocation = async (slug) => {
    try {
      const response = await fetch(`/data/location/${slug}.json`);
      const data = await response.json();
      setCurrentLocation(data);
    } catch (error) {
      console.error(`Error fetching location ${slug}:`, error);
    }
  };
  
  const fetchAppraiser = async (slug) => {
    try {
      const response = await fetch(`/data/appraiser/${slug}.json`);
      const data = await response.json();
      setCurrentAppraiser(data);
    } catch (error) {
      console.error(`Error fetching appraiser ${slug}:`, error);
    }
  };
  
  // Render the appropriate view based on currentPage
  const renderContent = () => {
    if (loading) {
      return <div className="directory-loading">Loading...</div>;
    }
    
    switch (currentPage) {
      case 'home':
        return <HomeView locations={locations} baseUrl={baseUrl} />;
      case 'location':
        return <LocationView location={currentLocation} baseUrl={baseUrl} />;
      case 'appraiser':
        return <AppraiserView appraiser={currentAppraiser} baseUrl={baseUrl} />;
      default:
        return <div>Page not found</div>;
    }
  };
  
  return (
    <div className="directory-container">
      {renderContent()}
    </div>
  );
};

// Sub-components for the different views
const HomeView = ({ locations, baseUrl }) => (
  <div className="directory-home">
    <h1>Find Art Appraisers Near You</h1>
    <p>Browse our directory of professional art appraisers across the United States.</p>
    
    <div className="locations-grid">
      {locations.map(location => (
        <div key={location.slug} className="location-card">
          <h2>
            <a href={`${baseUrl}/location/${location.slug}`}>
              {location.name}
            </a>
          </h2>
          <p>{location.appraiserCount} Art Appraisers Available</p>
        </div>
      ))}
    </div>
  </div>
);

const LocationView = ({ location, baseUrl }) => {
  if (!location) return <div>Loading location...</div>;
  
  return (
    <div className="location-page">
      <h1>Art Appraisers in {location.name}</h1>
      <p>{location.description}</p>
      
      <div className="appraisers-list">
        {location.appraisers.map(appraiser => (
          <div key={appraiser.slug} className="appraiser-card">
            <div className="appraiser-image">
              <img 
                src={appraiser.imageUrl || '/images/placeholder-appraiser.jpg'} 
                alt={appraiser.name}
                loading="lazy"
              />
            </div>
            <div className="appraiser-details">
              <h2>
                <a href={`${baseUrl}/appraiser/${appraiser.slug}`}>
                  {appraiser.name}
                </a>
              </h2>
              <p className="specialties">{appraiser.specialties}</p>
              <p className="description">{appraiser.shortDescription}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AppraiserView = ({ appraiser, baseUrl }) => {
  if (!appraiser) return <div>Loading appraiser...</div>;
  
  return (
    <div className="appraiser-page">
      <div className="appraiser-header">
        <div className="appraiser-image">
          <img 
            src={appraiser.imageUrl || '/images/placeholder-appraiser.jpg'} 
            alt={appraiser.name}
          />
        </div>
        <div className="appraiser-intro">
          <h1>{appraiser.name}</h1>
          <p className="location">
            <a href={`${baseUrl}/location/${appraiser.location.slug}`}>
              {appraiser.location.name}
            </a>
          </p>
          <p className="specialties">{appraiser.specialties}</p>
        </div>
      </div>
      
      <div className="appraiser-content">
        <div className="appraiser-description">
          <h2>About {appraiser.name}</h2>
          <div dangerouslySetInnerHTML={{ __html: appraiser.description }} />
        </div>
        
        <div className="appraiser-services">
          <h2>Services Offered</h2>
          <ul>
            {appraiser.services.map((service, index) => (
              <li key={index}>{service}</li>
            ))}
          </ul>
        </div>
        
        <div className="appraiser-contact">
          <h2>Contact Information</h2>
          <p>Phone: {appraiser.phone}</p>
          <p>Email: {appraiser.email}</p>
          <p>Website: <a href={appraiser.website} target="_blank" rel="noopener noreferrer">{appraiser.website}</a></p>
        </div>
      </div>
    </div>
  );
};

export default DirectoryApp; 