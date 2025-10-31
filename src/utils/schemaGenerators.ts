/* eslint-disable @typescript-eslint/no-explicit-any */
import { PARENT_SITE_URL, SITE_NAME, SITE_URL, buildSiteUrl } from '../config/site';

const buildProfileUrl = (path: string) => {
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
  } catch {
    // ignore malformed inputs and fall back to SITE_URL
  }
  return buildSiteUrl(path);
};

const sanitizeYearsInBusiness = (value?: string) => {
  if (!value) return undefined;
  const numericMatch = value.match(/\d{4}/);
  if (numericMatch) {
    return numericMatch[0];
  }
  if (/^\d+\+?\s+years?/i.test(value)) {
    return value;
  }
  return undefined;
};

export function generateAppraiserSchema(appraiser: any) {

  // Handle standardized or legacy data format
  const isStandardized = appraiser.expertise !== undefined;
  
  // Get proper address fields
  const address = isStandardized 
    ? appraiser.address 
    : {
        street: appraiser.address?.split(',')[0]?.trim() || "",
        city: appraiser.city || appraiser.address?.split(',')[0]?.trim() || "",
        state: appraiser.state || appraiser.address?.split(',')[1]?.trim() || "",
        zip: appraiser.postalCode || "",
        formatted: appraiser.address || ""
      };
  
  // Get business hours
  const businessHours = isStandardized 
    ? appraiser.business?.hours 
    : appraiser.businessHours;
  
  // Format hours if available
  const formattedHours = businessHours?.map((hours: any) => {
    // Handle different formats
    let opens = '', closes = '';
    if (typeof hours.hours === 'string' && hours.hours.includes(' - ')) {
      [opens, closes] = hours.hours.split(' - ');
    } else if (typeof hours.opens === 'string' && typeof hours.closes === 'string') {
      opens = hours.opens;
      closes = hours.closes;
    }
    
    return {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": hours.day,
      "opens": opens,
      "closes": closes
    };
  }) || [];

  // Generate price range indicator
  const priceRange = isStandardized 
    ? appraiser.business?.pricing || "$$$"
    : (appraiser.pricing || appraiser.priceRange || "$$$");

  // Get specialties
  const specialties = isStandardized 
    ? appraiser.expertise?.specialties || []
    : appraiser.specialties || [];
    
  // Get services
  const services = isStandardized 
    ? appraiser.expertise?.services || []
    : appraiser.services_offered || [];
    
  // Get certifications
  const certifications = isStandardized 
    ? appraiser.expertise?.certifications || []
    : appraiser.certifications || [];
  
  // Get contact info
  const contact = isStandardized 
    ? appraiser.contact 
    : {
        phone: appraiser.phone || "",
        email: appraiser.email || "",
        website: appraiser.website || ""
      };

  // Create safe schema with null checks for missing properties
  const profilePath = `appraiser/${appraiser.slug || appraiser.id}`;
  const profileUrl = buildProfileUrl(profilePath);

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": profileUrl,
    "name": appraiser.name,
    "alternateName": appraiser.slug || undefined,
    "image": {
      "@type": "ImageObject",
      "url": appraiser.imageUrl || appraiser.image || "https://ik.imagekit.io/appraisily/placeholder-image.jpg",
      "width": 800,
      "height": 600,
      "caption": `${appraiser.name} - Antique Appraiser`
    },
    "description": (isStandardized ? appraiser.content?.about : appraiser.about) ||
      `${appraiser.name} provides professional antique appraisal services specializing in valuation, authentication, and identification of antiques and collectibles.`,
    "foundingDate": sanitizeYearsInBusiness(isStandardized ? appraiser.business?.yearsInBusiness : appraiser.yearEstablished || appraiser.years_in_business),
    "address": {
      "@type": "PostalAddress",
      "streetAddress": address.street || "",
      "addressLocality": address.city || "",
      "addressRegion": address.state || "",
      "postalCode": address.zip || "",
      "addressCountry": "US"
    },
    "url": profileUrl,
    "telephone": contact.phone || "",
    "email": contact.email || "",
    "sameAs": [
      appraiser.socialLinks?.facebook || "",
      appraiser.socialLinks?.instagram || "",
      appraiser.socialLinks?.linkedin || "",
      appraiser.socialLinks?.twitter || "",
      contact.website || ""
    ].filter(url => url !== ""),
    "priceRange": priceRange,
    "paymentAccepted": appraiser.paymentMethods || "Cash, Credit Card",
    "openingHoursSpecification": formattedHours,
    "mainEntityOfPage": profileUrl,
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": "https://ik.imagekit.io/appraisily/appraisily-og-image.jpg"
      }
    }
  };

  // Add rating information
  const rating = isStandardized ? appraiser.business?.rating : appraiser.rating;
  const reviewCount = isStandardized ? appraiser.business?.reviewCount : appraiser.reviewCount;
  
  if (rating !== undefined) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": rating.toString(),
      "reviewCount": (reviewCount || 1).toString(),
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  // Add reviews
  const reviews = isStandardized ? appraiser.reviews : appraiser.reviews;
  
  if (Array.isArray(reviews) && reviews.length > 0) {
    schema.review = reviews.map((review: any) => ({
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating.toString(),
        "bestRating": "5",
        "worstRating": "1"
      },
      "author": {
        "@type": "Person",
        "name": review.author
      },
      "datePublished": review.date,
      "reviewBody": review.content
    }));
  }

  // Add services
  if (services.length > 0) {
    if (Array.isArray(services) && typeof services[0] === 'object' && services[0].name) {
      schema.makesOffer = services.map((service: any) => ({
        "@type": "Offer",
        "name": service.name,
        "description": service.description,
        "price": service.price?.replace(/[^0-9]/g, '') || "",
        "priceCurrency": "USD"
      }));
    } else {
      // Handle string array services
      schema.makesOffer = services.map((service: string) => ({
        "@type": "Offer",
        "name": service,
        "description": `Professional antique ${service} by ${appraiser.name}`,
        "priceCurrency": "USD"
      }));
    }
  }

  // Add certifications
  if (certifications.length > 0) {
    schema.hasCredential = certifications.map((certification: string) => ({
      "@type": "EducationalOccupationalCredential",
      "credentialCategory": "certification",
      "name": certification
    }));
  }

  // Add specialties
  if (specialties.length > 0) {
    // Clean up specialties - sometimes they contain long descriptions
    const cleanSpecialties = specialties.map((specialty: string) => {
      // If specialty is too long, truncate it
      if (specialty.length > 100) {
        const firstSentence = specialty.split('.')[0];
        return firstSentence.length < 100 ? firstSentence : specialty.substring(0, 100);
      }
      return specialty;
    });
    
    schema.knowsAbout = cleanSpecialties;
  }

  // Add area served information
  schema.areaServed = {
    "@type": "City",
    "name": address.city || "",
    "containedInPlace": {
      "@type": "State",
      "name": address.state || ""
    }
  };

  // Add services catalog
  schema.hasOfferCatalog = {
    "@type": "OfferCatalog",
    "name": "Antique Appraisal Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Antique Valuation",
        "description": `Professional antique valuation services by ${appraiser.name}`
        },
        "position": 1
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Antique Authentication",
          "description": `Expert antique authentication by ${appraiser.name}`
        },
        "position": 2
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Antique Identification",
          "description": `Professional antique identification services by ${appraiser.name}`
        },
        "position": 3
      }
    ]
  };

  // Add more structured data for search engines
  schema.additionalType = "https://schema.org/ProfessionalService";
  schema.isAccessibleForFree = false;
  schema.keywords = [
    "antique appraiser", 
    "antique valuation", 
    "antique authentication", 
    "antique identification",
    `antique appraiser in ${address.city}`,
    `antique appraiser near ${address.city}`,
    "antique value determination",
    "antique price guide",
    "antique expert"
  ].concat(specialties.slice(0, 5));

  return schema;
}

export function generateLocationSchema(locationData: any, cityName: string, slug: string) {
  // Add safety check for locationData
  if (!locationData) {
    console.error('Cannot generate location schema: locationData is undefined');
    return {};
  }
  
  // Determine if we're using standardized data format
  const isStandardized = locationData.appraisers && 
    locationData.appraisers[0] && 
    locationData.appraisers[0].expertise !== undefined;
  
  // Extract location information
  let safeCity, safeSlug, stateCode;
  
  if (isStandardized) {
    // Get city from the first appraiser's address
    safeCity = locationData.appraisers[0]?.address?.city || 'unknown-location';
    stateCode = locationData.appraisers[0]?.address?.state || 'USA';
    safeSlug = safeCity.toLowerCase().replace(/\s+/g, '-');
  } else {
    safeCity = locationData.city || 'unknown-location';
    safeSlug = (locationData.slug || safeCity.toLowerCase().replace(/\s+/g, '-'));
    stateCode = locationData.state || 'USA';
  }

  const resolvedCity = cityName || safeCity;
  const resolvedSlug = slug || safeSlug;
  
  // Build provider data from appraisers
  const providers = Array.isArray(locationData.appraisers) 
    ? locationData.appraisers.map((appraiser: any) => {
        if (isStandardized) {
          return {
            "@type": "LocalBusiness",
            "name": appraiser?.name || 'Antique Appraiser',
            "image": appraiser?.imageUrl || '',
            "address": {
              "@type": "PostalAddress",
              "addressLocality": appraiser?.address?.city || resolvedCity,
              "addressRegion": appraiser?.address?.state || stateCode,
              "addressCountry": "US"
            },
            "priceRange": appraiser?.business?.pricing || "$$-$$$",
            "telephone": appraiser?.contact?.phone || "",
            "url": buildProfileUrl(`appraiser/${appraiser?.id || 'unknown'}`),
            "sameAs": appraiser?.contact?.website || ""
          };
        } else {
          return {
            "@type": "LocalBusiness",
            "name": appraiser?.name || 'Antique Appraiser',
            "image": appraiser?.image || appraiser?.imageUrl || '',
            "address": {
              "@type": "PostalAddress",
              "addressLocality": resolvedCity,
              "addressRegion": stateCode,
              "addressCountry": "US"
            },
            "priceRange": appraiser?.pricing || "$$-$$$",
            "telephone": appraiser?.phone || "",
            "url": buildProfileUrl(`appraiser/${appraiser?.id || 'unknown'}`),
            "sameAs": appraiser?.website || ""
          };
        }
      }) 
    : [];
  
  // Create the schema object
  const pagePath = `location/${resolvedSlug}`;
  const pageUrl = buildProfileUrl(pagePath);

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": pageUrl,
    "name": `Antique Appraisers in ${resolvedCity}`,
    "description": `Find top-rated antique appraisers near you in ${resolvedCity}, ${stateCode}. Professional antique valuation services for insurance, estate planning, donations, and more.`,
    "serviceType": "Antique Appraisal",
    "areaServed": {
      "@type": "City",
      "name": resolvedCity,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": resolvedCity,
        "addressRegion": stateCode,
        "addressCountry": "US"
      },
      "containedInPlace": {
        "@type": "State",
        "name": stateCode
      }
    },
    "provider": providers,
    "offers": {
      "@type": "Offer",
      "description": `Professional antique appraisal services in ${resolvedCity}`,
      "areaServed": {
        "@type": "City",
        "name": resolvedCity,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": safeCity,
          "addressRegion": stateCode,
          "addressCountry": "US"
        }
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": pageUrl
    },
    "keywords": [
      `antique appraisers in ${resolvedCity}`,
      `antique appraisers near ${resolvedCity}`,
      `${resolvedCity} antique appraisers`,
      `antique valuation ${resolvedCity}`,
      `antique authentication ${resolvedCity}`,
      `antique identification ${resolvedCity}`,
      `find antique appraisers ${resolvedCity}`,
      `antique evaluation ${resolvedCity}`,
      `best antique appraisers ${resolvedCity}`
    ]
  };
}

export function generateFAQSchema(appraiser: any) {
  // Determine if we're using standardized data format
  const isStandardized = appraiser.expertise !== undefined;
  
  // Extract services based on data format
  let services = '';
  if (isStandardized) {
    services = Array.isArray(appraiser.expertise?.services) ? appraiser.expertise.services.join(', ') : '';
  } else {
    services = Array.isArray(appraiser.services) 
      ? appraiser.services.map((s: any) => s.name).join(', ') 
      : (Array.isArray(appraiser.services_offered) ? appraiser.services_offered.join(', ') : '');
  }
  
  // Extract specialties
  const specialties = isStandardized 
    ? (Array.isArray(appraiser.expertise?.specialties) ? appraiser.expertise.specialties.join(', ') : '')
    : (Array.isArray(appraiser.specialties) ? appraiser.specialties.join(', ') : '');
    
  // Extract certifications
  const certifications = isStandardized
    ? (Array.isArray(appraiser.expertise?.certifications) ? appraiser.expertise.certifications.join(', ') : '')
    : (Array.isArray(appraiser.certifications) ? appraiser.certifications.join(', ') : '');
  
  // Extract contact information
  const phone = isStandardized ? appraiser.contact?.phone : appraiser.phone;
  const email = isStandardized ? appraiser.contact?.email : appraiser.email;
  
  // Extract location information
  const city = isStandardized 
    ? appraiser.address?.city
    : (appraiser.address?.split(',')[0]?.trim() || appraiser.city || '');
    
  const state = isStandardized
    ? appraiser.address?.state
    : (appraiser.address?.split(',')[1]?.trim() || appraiser.state || '');
  
  // Extract rating information
  const rating = isStandardized ? appraiser.business?.rating : appraiser.rating;
  const reviewCount = isStandardized ? appraiser.business?.reviewCount : appraiser.reviewCount;
  
  // Extract pricing information
  const pricing = isStandardized ? appraiser.business?.pricing : appraiser.pricing;
  
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `What antique appraisal services does ${appraiser.name} offer?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": services || `${appraiser.name} offers professional antique appraisal services including valuations for insurance, estate planning, donations, and sales of antique items.`
        }
      },
      {
        "@type": "Question",
        "name": `What types of antiques does ${appraiser.name} specialize in?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": specialties || `${appraiser.name} specializes in appraising various types of antiques, vintage items, and collectibles.`
        }
      },
      {
        "@type": "Question",
        "name": `What credentials and certifications does ${appraiser.name} have for antique appraisal?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": certifications || `${appraiser.name} holds professional certifications and qualifications in antique appraisal.`
        }
      },
      {
        "@type": "Question",
        "name": `How can I contact ${appraiser.name} for an antique appraisal?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can contact ${appraiser.name} by phone at ${phone || '[contact number on website]'} or by email at ${email || '[email on website]'} to schedule your antique appraisal.`
        }
      },
      {
        "@type": "Question",
        "name": `Where is ${appraiser.name} located for antique appraisals?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${appraiser.name} is located in ${city || 'your area'} and provides antique appraisal services to clients in ${city} and surrounding regions.`
        }
      },
      {
        "@type": "Question",
        "name": `How much does an antique appraisal cost with ${appraiser.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": pricing 
            ? `${appraiser.name} offers antique appraisal services with the following pricing: ${pricing}.`
            : `${appraiser.name} offers antique appraisal services at competitive rates. Contact directly for a quote based on your specific needs and the items to be appraised.`
        }
      },
      {
        "@type": "Question",
        "name": `How long does an antique appraisal take with ${appraiser.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `The time required for an antique appraisal with ${appraiser.name} depends on the complexity, age, and quantity of items being appraised. Simple items may be appraised quickly, while rare or complex antiques may require more research. Please contact directly for an estimated timeline for your specific appraisal needs.`
        }
      },
      {
        "@type": "Question",
        "name": `Is ${appraiser.name} the best antique appraiser in ${city}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": rating 
            ? `${appraiser.name} is highly rated with ${rating} stars and ${reviewCount || 'numerous'} reviews, making them one of the most respected antique appraisers in ${city}${state ? ', ' + state : ''}. Their expertise in ${specialties || 'various antique categories'} has earned them a strong reputation in the local community.`
            : `${appraiser.name} is a respected antique appraiser in ${city}${state ? ', ' + state : ''} with expertise in ${specialties || 'various antique categories'}, which has earned them a strong reputation in the local community.`
        }
      },
      {
        "@type": "Question",
        "name": `Can I find an antique appraiser near me in ${city}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Yes, ${appraiser.name} provides antique appraisal services to clients in ${city} and surrounding areas. They offer ${services || 'comprehensive antique appraisal services'} for residents looking for professional antique valuation near them.`
        }
      },
      {
        "@type": "Question",
        "name": `What types of antique items can ${appraiser.name} appraise?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${appraiser.name} specializes in appraising ${specialties || 'a wide range of antiques and collectibles including furniture, jewelry, artwork, porcelain, silver, clocks, rugs, and decorative arts'}. Their expertise allows them to provide accurate valuations for various types of antique and vintage items.`
        }
      },
      {
        "@type": "Question",
        "name": `Do I need an appointment for an antique appraisal with ${appraiser.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Yes, it's recommended to schedule an appointment with ${appraiser.name} for antique appraisals to ensure they can devote appropriate time to examining and researching your items. You can contact them at ${phone || 'the number listed on their website'} to schedule a consultation.`
        }
      },
      {
        "@type": "Question",
        "name": `What information should I prepare before an antique appraisal with ${appraiser.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Before your antique appraisal with ${appraiser.name}, it's helpful to gather any documentation about your items, such as receipts, certificates of authenticity, provenance information, family history, or previous appraisals. Clear photographs of markings, signatures, or damage can also be useful for the appraisal process.`
        }
      }
    ]
  };
}

export function generateArticleSchema(pageTitle: string, pageDescription: string, url: string, imageUrl: string = '', author: string = '', publishDate: string = '', modifyDate: string = '') {
  // Use current date if no dates provided
  const currentDate = new Date().toISOString().split('T')[0];
  const publishedDate = publishDate || currentDate;
  const modifiedDate = modifyDate || currentDate;
  
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": pageTitle,
    "description": pageDescription,
    "image": imageUrl || "https://ik.imagekit.io/appraisily/placeholder-art-image.jpg",
    "author": {
      "@type": "Organization",
      "name": author || SITE_NAME,
      "url": PARENT_SITE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": "https://ik.imagekit.io/appraisily/appraisily-og-image.jpg",
        "width": 600,
        "height": 60
      }
    },
    "url": url,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "datePublished": publishedDate,
    "dateModified": modifiedDate,
    "inLanguage": "en-US",
    "isAccessibleForFree": true,
    "isFamilyFriendly": true,
    "keywords": ["art appraisal", "artwork valuation", "art authentication", "fine art", "art collecting"]
  };
}

export function generateBreadcrumbSchema(items: {name: string, url: string}[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}

export function generateWebPageSchema(title: string, description: string, url: string, lastModified: string = '') {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    "url": url,
    "name": title,
    "description": description,
    "inLanguage": "en-US",
    "isPartOf": {
      "@type": "WebSite",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "about": {
      "@type": "Thing",
      "name": "Art Appraisal Services"
    },
    "dateModified": lastModified || new Date().toISOString().split('T')[0],
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", "h2", ".summary", ".description"]
    },
    "hasPart": [
      {
        "@type": "WebPageElement",
        "isAccessibleForFree": "True",
        "cssSelector": ".main-content"
      }
    ]
  };
}

export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": PARENT_SITE_URL,
    "name": SITE_NAME,
    "alternateName": "Art Appraisal Services",
    "url": PARENT_SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": "https://ik.imagekit.io/appraisily/appraisily-og-image.jpg",
      "width": 600,
      "height": 60
    },
    "sameAs": [
      "https://facebook.com/appraisily",
      "https://twitter.com/appraisily",
      "https://instagram.com/appraisily",
      "https://linkedin.com/company/appraisily"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-800-555-5555",
      "contactType": "customer service",
      "email": "info@appraisily.com",
      "availableLanguage": "English"
    },
    "areaServed": "US"
  };
}

export function generateHowToSchema(title: string = 'How to Get an Art Appraisal', description: string = 'Step-by-step guide to getting your artwork appraised by a professional.') {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": title,
    "description": description,
    "totalTime": "P3D",
    "tool": [
      {
        "@type": "HowToTool",
        "name": "Camera or smartphone"
      },
      {
        "@type": "HowToTool",
        "name": "Measuring tape"
      },
      {
        "@type": "HowToTool",
        "name": "Artwork documentation"
      }
    ],
    "step": [
      {
        "@type": "HowToStep",
        "name": "Document your artwork",
        "text": "Take clear, high-resolution photographs of your artwork from multiple angles, including any signatures, markings, or damage.",
        "image": "https://ik.imagekit.io/appraisily/how-to/document-artwork.jpg",
        "url": `${PARENT_SITE_URL}/how-to-document-artwork`
      },
      {
        "@type": "HowToStep",
        "name": "Gather documentation",
        "text": "Collect any existing documentation about your artwork, including receipts, certificates of authenticity, provenance documents, and restoration records.",
        "image": "https://ik.imagekit.io/appraisily/how-to/gather-documentation.jpg",
        "url": `${PARENT_SITE_URL}/artwork-documentation`
      },
      {
        "@type": "HowToStep",
        "name": "Find a qualified appraiser",
        "text": "Search our directory to find a certified art appraiser who specializes in your type of artwork.",
        "image": "https://ik.imagekit.io/appraisily/how-to/find-appraiser.jpg",
        "url": SITE_URL
      },
      {
        "@type": "HowToStep",
        "name": "Contact the appraiser",
        "text": "Reach out to the appraiser to discuss your needs, the purpose of the appraisal, and to schedule an appointment.",
        "image": "https://ik.imagekit.io/appraisily/how-to/contact-appraiser.jpg"
      },
      {
        "@type": "HowToStep",
        "name": "Get your appraisal",
        "text": "Meet with the appraiser (in-person or virtually) and receive your professional appraisal report with the valuation and detailed description of your artwork.",
        "image": "https://ik.imagekit.io/appraisily/how-to/receive-appraisal.jpg"
      }
    ]
  };
}
