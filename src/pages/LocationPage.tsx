import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { getLocation } from '../utils/staticData';
import { SEO } from '../components/SEO';
import { generateLocationSchema } from '../utils/schemaGenerators';

export type Appraiser = {
  id: string;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  address: string;
  specialties: string[];
};

export function LocationPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  console.log('LocationPage - citySlug:', citySlug);
  
  // Make sure we have a valid citySlug before proceeding
  const validCitySlug = typeof citySlug === 'string' ? citySlug : '';
  const locationData = validCitySlug ? getLocation(validCitySlug) : null;
  console.log('LocationPage - locationData:', locationData);

  // Log any missing data to help with debugging
  useEffect(() => {
    if (!locationData && validCitySlug) {
      console.error(`Could not find location data for slug: ${validCitySlug}`);
    }
  }, [locationData, validCitySlug]);

  // Safely transform city slug to display name with null/undefined handling
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
        "item": `https://appraisily.com/location/${validCitySlug || ''}`
      }
    ]
  });

  if (!locationData) {
    return (
      <>
        <SEO
          title={`Art Appraisers | Expert Art Valuation Services`}
          description={`Find certified art appraisers for expert art valuations, authentication services, and professional advice for your art collection.`}
          keywords={['art appraisers', 'art valuation', 'art authentication']}
          schema={[generateBreadcrumbSchema()]}
          canonicalUrl={`https://appraisily.com/location/${validCitySlug || ''}`}
        />
        <div className="container mx-auto px-6 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Location Not Found</h1>
            <p className="text-muted-foreground">We couldn't find information for the requested location.</p>
          </div>
        </div>
      </>
    );
  }

  // Safely get keywords with null checks
  const getKeywords = () => {
    // Use optional chaining and provide default empty arrays/values
    const baseKeywords = locationData?.seo?.keywords || [];
    const locationState = locationData?.state || 'usa';
    
    // Ensure cityName and locationState are treated as strings before using toLowerCase
    return [
      ...baseKeywords,
      `art appraisers ${cityName?.toLowerCase() || ''}`,
      `art appraisers near me`,
      `art appraisers in ${cityName?.toLowerCase() || ''}`,
      `art valuation ${cityName?.toLowerCase() || ''}`,
      `art appraisal near ${cityName?.toLowerCase() || ''}`,
      `fine art appraiser ${cityName?.toLowerCase() || ''}`,
      `art authentication ${locationState?.toLowerCase() || ''}`,
      `local art appraiser ${cityName?.toLowerCase() || ''}`,
      `${cityName?.toLowerCase() || ''} art appraiser`,
      `best art appraiser ${cityName?.toLowerCase() || ''}`,
      `fine art appraisal ${cityName?.toLowerCase() || ''}`
    ].filter(Boolean); // Remove any empty strings
  };

  return (
    <>
      <SEO
        title={(locationData?.seo?.title) || `Art Appraisers in ${cityName} | Expert Art Valuation Services`}
        description={(locationData?.seo?.description) || `Find top-rated art appraisers near you in ${cityName}. Professional art valuation, authentication services, and expert appraisals for insurance, estate planning, and donations.`}
        keywords={getKeywords()}
        schema={[generateLocationSchema(locationData), generateBreadcrumbSchema()]}
        canonicalUrl={`https://appraisily.com/location/${validCitySlug || ''}`}
        ogImage={locationData?.seo?.ogImage || "https://ik.imagekit.io/appraisily/appraisily-og-image.jpg"}
        ogType="website"
        preload={[
          {
            as: "image",
            href: locationData?.seo?.ogImage || "https://ik.imagekit.io/appraisily/appraisily-og-image.jpg",
            crossorigin: true
          }
        ]}
      />

      <div className="flex-1">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 py-12">
          <div className="container mx-auto px-6">
            <h1 key="page-title" className="text-4xl font-bold text-foreground mb-4">
              Art Appraisers in {cityName}
            </h1>
            <p key="page-description" className="text-lg text-muted-foreground max-w-2xl">
              Connect with certified art appraisers in {cityName}. Get expert valuations,
              authentication services, and professional advice for your art collection.
            </p>
          </div>
        </div>

        <main className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {locationData.appraisers && locationData.appraisers.map((appraiser, index) => (
                <a key={`appraiser-${appraiser?.id || appraiser?.name || index}-${index}`} href={`https://art-appraiser-directory.appraisily.com/appraiser/${appraiser?.id || ''}`}>
                  <div className="rounded-lg border bg-white text-foreground shadow-sm group overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="relative">
                      <div style={{ position: 'relative', width: '100%', paddingBottom: '75%' }}>
                        <div style={{ position: 'absolute', inset: 0 }}>
                          <img
                            src={appraiser?.image || appraiser?.imageUrl || '/placeholder-image.jpg'}
                            alt={appraiser?.name || 'Art Appraiser'}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400" />
                          <span className="text-white font-semibold">{appraiser?.rating || 0}/5</span>
                          <span className="text-white/80 text-sm">({appraiser?.reviewCount || 0} reviews)</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h2 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors">
                        {appraiser?.name || 'Unnamed Appraiser'}
                      </h2>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">{appraiser?.address || 'Address not available'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {Array.isArray(appraiser?.specialties) && appraiser.specialties.map((specialty, index) => (
                          <span
                            key={`${appraiser?.id || appraiser?.name || index}-${specialty}-${index}`}
                            className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
          </div>
        </main>
      </div>
    </>
  );
}