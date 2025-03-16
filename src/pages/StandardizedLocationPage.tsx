import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Star, Phone, Mail, Globe, Clock } from 'lucide-react';
import { getStandardizedLocation, StandardizedAppraiser, StandardizedLocation } from '../utils/standardizedData';
import { SEO } from '../components/SEO';
import { generateLocationSchema } from '../utils/schemaGenerators';

export function StandardizedLocationPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [locationData, setLocationData] = useState<StandardizedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Make sure we have a valid citySlug before proceeding
  const validCitySlug = typeof citySlug === 'string' ? citySlug : '';
  
  // Fetch location data when component mounts or citySlug changes
  useEffect(() => {
    async function fetchData() {
      if (!validCitySlug) {
        setError('Invalid city slug');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const data = await getStandardizedLocation(validCitySlug);
        if (data) {
          setLocationData(data);
        } else {
          setError(`No data found for ${validCitySlug}`);
        }
      } catch (err) {
        console.error('Error fetching location data:', err);
        setError('Failed to load location data');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [validCitySlug]);

  // Safely transform city slug to display name
  const cityName = validCitySlug
    ? validCitySlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Location';
    
  const generateBreadcrumbSchema = () => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://appraisily.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": `Art Appraisers in ${cityName}`,
        "item": `https://appraisily.com/location/${validCitySlug}`
      }
    ]
  });

  const seoTitle = `Top Art Appraisers in ${cityName} | Expert Art Valuation Services`;
  const seoDescription = `Find the best certified art appraisers in ${cityName}. Get expert art valuations, authentication services, and professional advice from trusted local professionals.`;
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16">
        <h1 className="text-2xl font-bold mb-4">Loading {cityName} Art Appraisers...</h1>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-40 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !locationData || !locationData.appraisers || locationData.appraisers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16">
        <SEO 
          title={`Art Appraisers in ${cityName} | Find Local Art Appraisal Services`}
          description={`We're currently updating our list of art appraisers in ${cityName}. Browse our directory for other locations or check back soon.`}
          canonicalUrl={`https://appraisily.com/location/${validCitySlug}`}
        />
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Art Appraisers in {cityName}</h1>
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg mb-6">
            <p className="font-medium">We're currently updating our database of art appraisers in {cityName}.</p>
            <p className="mt-2">Please check back soon or explore other cities in our directory.</p>
          </div>
          <a href="https://appraisily.com" className="text-blue-600 hover:underline font-medium">
            Browse all locations
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-16">
      <SEO 
        title={seoTitle}
        description={seoDescription}
        schema={[
          generateLocationSchema(cityName, validCitySlug),
          generateBreadcrumbSchema()
        ]}
        canonicalUrl={`https://appraisily.com/location/${validCitySlug}`}
      />
      
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-lg mb-8">
          <h1 className="text-3xl font-bold mb-3">Art Appraisers in {cityName}</h1>
          <p className="text-gray-600 max-w-3xl">
            Connect with certified art appraisers in {cityName} specializing in various types of artwork 
            and collectibles. Get professional valuations for insurance, estate planning, donations, and more.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locationData.appraisers.map((appraiser) => (
            <div key={appraiser.id} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <a 
                href={`https://art-appraiser-directory.appraisily.com/appraiser/${appraiser.slug}`} 
                className="block"
              >
                <div className="h-48 bg-gray-200 overflow-hidden">
                  <img 
                    src={appraiser.imageUrl} 
                    alt={`${appraiser.name} - Art Appraiser in ${appraiser.address.city}`}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://ik.imagekit.io/appraisily/placeholder-image.jpg';
                    }}
                  />
                </div>
                
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-2 text-gray-900 hover:text-blue-600 transition-colors">
                    {appraiser.name}
                  </h2>
                  
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <MapPin className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{appraiser.address.formatted}</span>
                  </div>
                  
                  <div className="flex items-center mb-3">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="ml-1 text-gray-700">{appraiser.business.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-sm text-gray-500 ml-2">
                      ({appraiser.business.reviewCount} reviews)
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex flex-wrap gap-1">
                      {appraiser.expertise.specialties.slice(0, 3).map((specialty, index) => (
                        <span 
                          key={index}
                          className="inline-block bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 text-xs mb-1"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <span className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center">
                      View Profile
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </a>
            </div>
          ))}
        </div>
        
        {locationData.appraisers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600">No art appraisers found in {cityName} yet. Check back soon!</p>
          </div>
        )}
        
        <div className="mt-12 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Looking for Art Appraisal Services in {cityName}?</h2>
          <p className="text-gray-600 mb-4">
            Professional art appraisers provide accurate valuations based on extensive research, market analysis, and expertise.
            Whether you need an appraisal for insurance, estate planning, donations, or sales, our directory connects you with
            certified professionals in {cityName}.
          </p>
          <a 
            href="https://appraisily.com/start" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Request an appraisal today
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}