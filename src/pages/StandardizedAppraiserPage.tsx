import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Star, Mail, Phone, Globe, Clock, ChevronRight, Shield } from 'lucide-react';
import { getStandardizedAppraiser, StandardizedAppraiser } from '../utils/standardizedData';
import { SEO } from '../components/SEO';
import {
  hasPlaceholderName,
  isPlaceholderAbout,
  isTemplatedExperience,
  isTemplatedNotes,
  isTemplatedPricing
} from '../utils/dataQuality';
import { SITE_URL, buildSiteUrl, getPrimaryCtaUrl } from '../config/site';
import { trackEvent } from '../utils/analytics';
import { DEFAULT_PLACEHOLDER_IMAGE } from '../config/assets';
import { normalizeAssetUrl } from '../utils/assetUrls';

export function StandardizedAppraiserPage() {
  const { appraiserId } = useParams<{ appraiserId: string }>();
  const [appraiser, setAppraiser] = useState<StandardizedAppraiser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const primaryCtaUrl = getPrimaryCtaUrl();
  const handleContactClick = (channel: 'phone' | 'email' | 'website', placement: string) => {
    trackEvent('appraiser_contact_click', {
      channel,
      placement,
      appraiser_slug: appraiser?.slug || appraiserId || '',
      appraiser_name: appraiser?.name
    });
  };

  const handleCtaClick = (placement: string) => {
    trackEvent('cta_click', {
      placement,
      destination: primaryCtaUrl,
      appraiser_slug: appraiser?.slug || appraiserId || ''
    });
  };
  
  // Fetch appraiser data when component mounts or appraiserId changes
  useEffect(() => {
    async function fetchData() {
      if (!appraiserId) {
        setError('Invalid appraiser ID');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const data = await getStandardizedAppraiser(appraiserId);
        if (data) {
          setAppraiser(data);
        } else {
          setError(`No data found for ${appraiserId}`);
        }
      } catch (err) {
        console.error('Error fetching appraiser data:', err);
        setError('Failed to load appraiser data');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [appraiserId]);

  useEffect(() => {
    if (!appraiser) {
      return;
    }

    trackEvent('view_item', {
      appraiser_slug: appraiser.slug,
      appraiser_name: appraiser.name,
      city: appraiser.address.city,
      state: appraiser.address.state,
      rating: appraiser.business.rating,
      review_count: appraiser.business.reviewCount,
      specialties: appraiser.expertise.specialties
    });
  }, [appraiser]);

  const generateBreadcrumbSchema = () => {
    if (!appraiser) return null;
    
    const citySlug = appraiser.address.city.toLowerCase().replace(/\s+/g, '-');
    
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": SITE_URL
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": `Antique Appraisers in ${appraiser.address.city}`,
          "item": buildSiteUrl(`/location/${citySlug}`)
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": appraiser.name,
          "item": buildSiteUrl(`/appraiser/${appraiser.slug}`)
        }
      ]
    };
  };

  const generateAppraiserSchema = () => {
    if (!appraiser) return null;
    
    return {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "name": appraiser.name,
      "image": appraiser.imageUrl,
      "description": appraiser.content.about,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": appraiser.address.street,
        "addressLocality": appraiser.address.city,
        "addressRegion": appraiser.address.state,
        "postalCode": appraiser.address.zip,
        "addressCountry": "US"
      },
      "url": buildSiteUrl(`/appraiser/${appraiser.slug}`),
      "telephone": appraiser.contact.phone,
      "email": appraiser.contact.email,
      "priceRange": appraiser.business.pricing,
      "openingHours": appraiser.business.hours.map(h => `${h.day} ${h.hours}`).join(', '),
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": appraiser.business.rating.toString(),
        "reviewCount": appraiser.business.reviewCount.toString(),
        "bestRating": "5",
        "worstRating": "1"
      },
      "review": appraiser.reviews.map(review => ({
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": review.author
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": review.rating.toString(),
          "bestRating": "5",
          "worstRating": "1"
        },
        "datePublished": review.date,
        "reviewBody": review.content
      }))
    };
  };

  const generateFAQSchema = () => {
    if (!appraiser) return null;
    
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": `What services does ${appraiser.name} offer?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": appraiser.expertise.services.join(', ')
          }
        },
        {
          "@type": "Question",
          "name": `What are ${appraiser.name}'s specialties?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": appraiser.expertise.specialties.join(', ')
          }
        },
        {
          "@type": "Question",
          "name": `How can I contact ${appraiser.name}?`,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": `You can contact ${appraiser.name} by phone at ${appraiser.contact.phone} or by email at ${appraiser.contact.email}.`
          }
        }
      ]
    };
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16">
        <h1 className="text-2xl font-bold mb-4">Loading Appraiser Details...</h1>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="h-64 bg-gray-200 rounded mb-4"></div>
            </div>
            <div className="md:col-span-2">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !appraiser) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16">
        <SEO 
          title="Appraiser Not Found | Antique Appraisers Directory"
          description="We couldn't find the requested antique appraiser. Browse our directory for other antique appraisers."
          path="/appraiser/not-found"
        />
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Antique Appraiser Not Found</h1>
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg mb-6">
            <p className="font-medium">We couldn't find the requested antique appraiser.</p>
            <p className="mt-2">Please check back or explore other appraisers in our directory.</p>
          </div>
          <a href={SITE_URL} className="text-blue-600 hover:underline font-medium">
            Browse all locations
          </a>
        </div>
      </div>
    );
  }

  const seoTitle = `${appraiser.name} - Antique Appraiser in ${appraiser.address.city} | Expert Antique Valuation Services`;
  const seoDescription = `Get professional antique appraisal services from ${appraiser.name} in ${appraiser.address.city}. Specializing in ${appraiser.expertise.specialties.join(', ')}. Certified expert with verified reviews.`;
  const citySlug = appraiser.address.city.toLowerCase().replace(/\s+/g, '-');
  const fallbackAbout = (() => {
    const parts = [
      `${appraiser.name} provides antique appraisal services in ${appraiser.address.city}, ${appraiser.address.state}.`
    ];
    if (appraiser.expertise.specialties.length > 0) {
      parts.push(`Specialties include ${appraiser.expertise.specialties.join(', ')}.`);
    }
    if (appraiser.expertise.services.length > 0) {
      parts.push(`Services include ${appraiser.expertise.services.join(', ')}.`);
    }
    if (appraiser.expertise.certifications.length > 0) {
      parts.push(`Certifications include ${appraiser.expertise.certifications.join(', ')}.`);
    }
    return parts.join(' ');
  })();
  const aboutContent =
    appraiser.content?.about && !isPlaceholderAbout(appraiser.content.about)
      ? appraiser.content.about
      : fallbackAbout;
  const pricingContent = isTemplatedPricing(appraiser.business?.pricing)
    ? 'Pricing depends on the item type, complexity, and scope. Contact the appraiser for a tailored quote.'
    : appraiser.business.pricing;
  const notesContent = isTemplatedNotes(appraiser.content?.notes, appraiser.address.city)
    ? null
    : appraiser.content.notes;

  const dataWarnings: string[] = [];
  if (isTemplatedPricing(appraiser.business?.pricing)) {
    dataWarnings.push('Pricing info is auto-generated and may need a manual update.');
  }
  if (isTemplatedExperience(appraiser.business?.yearsInBusiness)) {
    dataWarnings.push('Years-in-business is using our default template.');
  }
  if (hasPlaceholderName(appraiser.name) || isPlaceholderAbout(appraiser.content?.about)) {
    dataWarnings.push('Business name or description still contains placeholder copy.');
  }
  if (isTemplatedNotes(appraiser.content?.notes, appraiser.address.city)) {
    dataWarnings.push('Location notes are still using boilerplate text.');
  }
  const showDataWarning = dataWarnings.length > 0;
  const gtmAppraiserId = appraiser.slug || appraiser.id || appraiserId || '';
  const gtmAppraiserName = appraiser.name;

  return (
    <div className="container mx-auto px-4 py-8 mt-16">
      <SEO 
        title={seoTitle}
        description={seoDescription}
        schema={[
          generateAppraiserSchema(appraiser),
          generateBreadcrumbSchema(),
          generateFAQSchema(appraiser)
        ]}
        path={`/appraiser/${appraiser.slug}`}
      />
      
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          <li>
          <a href={SITE_URL} className="text-gray-500 hover:text-gray-700">Home</a>
          </li>
          <li className="flex items-center">
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <a 
              href={buildSiteUrl(`/location/${citySlug}`)}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              {appraiser.address.city}
            </a>
          </li>
          <li className="flex items-center">
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="ml-2 text-gray-900 font-medium">{appraiser.name}</span>
          </li>
        </ol>
      </nav>
      {showDataWarning && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-5 py-4 text-sm text-yellow-900">
          <p className="font-semibold mb-2">Heads up: this profile still needs verification.</p>
          <ul className="list-disc space-y-1 pl-5">
            {dataWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="rounded-lg overflow-hidden shadow-md mb-6">
            <img 
              src={normalizeAssetUrl(appraiser.imageUrl)} 
              alt={`${appraiser.name} - Antique Appraiser in ${appraiser.address.city}`}
              className="w-full h-auto"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = DEFAULT_PLACEHOLDER_IMAGE;
              }}
            />
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            
            <div className="space-y-3">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-gray-700">{appraiser.address.formatted}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-blue-600 mr-3" />
                <a
                  href={`tel:${appraiser.contact.phone}`}
                  className="text-gray-700 hover:text-blue-600"
                  data-gtm-event="directory_cta"
                  data-gtm-cta="call"
                  data-gtm-surface="profile_contact_info"
                  data-gtm-appraiser-id={gtmAppraiserId}
                  data-gtm-appraiser-name={gtmAppraiserName}
                  onClick={() => handleContactClick('phone', 'profile_contact_info')}
                >
                  {appraiser.contact.phone}
                </a>
              </div>
              
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-blue-600 mr-3" />
                <a
                  href={`mailto:${appraiser.contact.email}`}
                  className="text-gray-700 hover:text-blue-600"
                  data-gtm-event="directory_cta"
                  data-gtm-cta="email"
                  data-gtm-surface="profile_contact_info"
                  data-gtm-appraiser-id={gtmAppraiserId}
                  data-gtm-appraiser-name={gtmAppraiserName}
                  onClick={() => handleContactClick('email', 'profile_contact_info')}
                >
                  {appraiser.contact.email}
                </a>
              </div>
              
              {appraiser.contact.website && (
                <div className="flex items-center">
                  <Globe className="h-5 w-5 text-blue-600 mr-3" />
                  <a
                    href={appraiser.contact.website.startsWith('http') ? appraiser.contact.website : `https://${appraiser.contact.website}`}
                    className="text-gray-700 hover:text-blue-600"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-gtm-event="directory_cta"
                    data-gtm-cta="website"
                    data-gtm-surface="profile_contact_info"
                    data-gtm-appraiser-id={gtmAppraiserId}
                    data-gtm-appraiser-name={gtmAppraiserName}
                    onClick={() => handleContactClick('website', 'profile_contact_info')}
                  >
                    Visit Website
                  </a>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Hours</h3>
            <div className="space-y-2">
              {appraiser.business.hours.map((hour, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{hour.day}</span>
                  <span className="text-gray-900 font-medium">{hour.hours}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Certifications</h3>
            <div className="space-y-2">
              {appraiser.expertise.certifications.map((cert, index) => (
                <div key={index} className="flex items-center">
                  <Shield className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-gray-700">{cert}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100">
              <a
                href={primaryCtaUrl}
                className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-medium transition-all duration-300"
                data-gtm-event="directory_cta"
                data-gtm-cta="request_appraisal"
                data-gtm-surface="profile_sidebar_cta"
                data-gtm-appraiser-id={gtmAppraiserId}
                data-gtm-appraiser-name={gtmAppraiserName}
                onClick={() => handleCtaClick('profile_sidebar_cta')}
              >
                Request an Appraisal
              </a>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{appraiser.name}</h1>
              
              <div className="flex items-center">
                <div className="flex items-center bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="font-semibold">{appraiser.business.rating.toFixed(1)}</span>
                  <span className="text-sm text-gray-500 ml-1">
                    ({appraiser.business.reviewCount})
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600">
                <Clock className="h-4 w-4 inline-block mr-2 text-gray-400" />
                <span className="text-sm mr-3">
                  {appraiser.business.yearsInBusiness}
                </span>
                
                <MapPin className="h-4 w-4 inline-block mr-2 text-gray-400" />
                <span className="text-sm">
                  {appraiser.address.city}, {appraiser.address.state}
                </span>
              </p>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-700 mb-6 leading-relaxed">
              {aboutContent}
            </p>
            
            {notesContent && (
              <div className="bg-blue-50 text-blue-700 p-4 rounded-md mb-6">
                <p>{notesContent}</p>
              </div>
            )}
            
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Specialties</h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {appraiser.expertise.specialties.map((specialty, index) => (
                <span 
                  key={index}
                  className="bg-gray-100 text-gray-800 rounded-full px-3 py-1 text-sm"
                >
                  {specialty}
                </span>
              ))}
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Services</h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {appraiser.expertise.services.map((service, index) => (
                <span 
                  key={index}
                  className="border border-blue-200 text-blue-700 bg-blue-50 rounded-md px-3 py-1 text-sm"
                >
                  {service}
                </span>
              ))}
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Pricing</h2>
            <p className="text-gray-700 mb-6">
              {pricingContent}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reviews</h2>
            
            {appraiser.reviews.length > 0 ? (
              <div className="space-y-6">
                {appraiser.reviews.map((review, index) => (
                  <div key={index} className="border-b border-gray-100 pb-6 last:border-none last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">{review.author}</h3>
                      <div className="flex items-center">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`h-4 w-4 ${i < review.rating ? 'text-yellow-500' : 'text-gray-300'}`} 
                              fill={i < review.rating ? 'currentColor' : 'none'}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500 ml-2">{review.date}</span>
                      </div>
                    </div>
                    <p className="text-gray-700">{review.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No reviews yet.</p>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">Need Antique Appraisal Services?</h3>
              <p className="text-gray-600 mb-4">
                Contact {appraiser.name} directly or use our platform to request an appraisal.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a 
                  href={`tel:${appraiser.contact.phone}`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  data-gtm-event="directory_cta"
                  data-gtm-cta="call"
                  data-gtm-surface="profile_cta_section"
                  data-gtm-appraiser-id={gtmAppraiserId}
                  data-gtm-appraiser-name={gtmAppraiserName}
                  onClick={() => handleContactClick('phone', 'profile_cta_section')}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call Now
                </a>
                <a 
                  href={`mailto:${appraiser.contact.email}`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  data-gtm-event="directory_cta"
                  data-gtm-cta="email"
                  data-gtm-surface="profile_cta_section"
                  data-gtm-appraiser-id={gtmAppraiserId}
                  data-gtm-appraiser-name={gtmAppraiserName}
                  onClick={() => handleContactClick('email', 'profile_cta_section')}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </a>
                <a 
                  href={primaryCtaUrl}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  data-gtm-event="directory_cta"
                  data-gtm-cta="request_appraisal"
                  data-gtm-surface="profile_cta_section"
                  data-gtm-appraiser-id={gtmAppraiserId}
                  data-gtm-appraiser-name={gtmAppraiserName}
                  onClick={() => handleCtaClick('profile_cta_section')}
                >
                  Request Appraisal
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
