/**
 * Schema.org structured data generator for art appraiser directory
 * Creates rich structured data for better SEO and search engine understanding
 */

/**
 * Create a schema script tag from a schema object
 * @param {Object} schema - Schema.org structured data object
 * @returns {string} HTML script tag with structured data
 */
export function createSchemaScript(schema) {
  if (!schema) return '';
  return `<script type="application/ld+json">${JSON.stringify(schema, null, 0)}</script>`;
}

/**
 * Creates WebSite schema for the main site
 * @param {Object} options - Website options
 * @returns {Object} Website schema
 */
export function generateWebsiteSchema(options = {}) {
  const {
    name = 'Art Appraiser Directory',
    url = 'https://antique-appraiser-directory.appraisily.com',
    description = 'Find qualified antique appraisers for insurance, estate, donation, and fair market value appraisals.',
    searchUrl = 'https://antique-appraiser-directory.appraisily.com/search'
  } = options;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': name,
    'url': url,
    'description': description,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${searchUrl}?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * Generates breadcrumb schema for a page
 * @param {Object} options - Breadcrumb options 
 * @returns {Object} Breadcrumb schema
 */
export function generateBreadcrumbSchema(options = {}) {
  const {
    items = [],
    baseUrl = 'https://appraisily.com'
  } = options;
  
  if (!items || items.length === 0) return null;
  
  const itemListElement = items.map((item, index) => ({
    '@type': 'ListItem',
    'position': index + 1,
    'name': item.name,
    'item': item.url || `${baseUrl}${item.path || '/'}`
  }));
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': itemListElement
  };
}

/**
 * Generates local business schema for an appraiser
 * @param {Object} appraiser - Appraiser data 
 * @returns {Object} Local business schema
 */
export function generateAppraiserSchema(appraiser) {
  if (!appraiser || !appraiser.name) return null;
  
  // Base URL for all appraiser pages
  const baseUrl = 'https://antique-appraiser-directory.appraisily.com';
  
  // Generate slug if not provided
  const slug = appraiser.slug || appraiser.id || appraiser.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  
  // Rating data
  const hasRating = appraiser.rating && appraiser.reviewCount;
  
  // Basic schema structure
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${baseUrl}/appraiser/${slug}#business`,
    'name': appraiser.businessName || appraiser.name,
    'url': `${baseUrl}/appraiser/${slug}`,
    'image': appraiser.imageUrl || appraiser.image || '',
    'description': appraiser.description || `${appraiser.name} is a professional art appraiser specializing in ${appraiser.specialties?.join(', ') || 'fine art appraisals'}.`,
    'priceRange': appraiser.priceRange || '$$-$$$',
    'telephone': appraiser.phone || '',
    'email': appraiser.email || '',
    'sameAs': []
  };
  
  // Add business website if available
  if (appraiser.website) {
    schema.sameAs.push(appraiser.website);
  }
  
  // Add social profiles if available
  if (appraiser.socialProfiles) {
    schema.sameAs.push(...appraiser.socialProfiles.filter(Boolean));
  }
  
  // Remove empty sameAs array
  if (schema.sameAs.length === 0) {
    delete schema.sameAs;
  }
  
  // Add address information if available
  if (appraiser.city || appraiser.state) {
    schema.address = {
      '@type': 'PostalAddress',
      'addressLocality': appraiser.city || '',
      'addressRegion': appraiser.state || '',
      'addressCountry': 'US'
    };
    
    // Add specific address details if available
    if (appraiser.streetAddress) {
      schema.address.streetAddress = appraiser.streetAddress;
    }
    
    if (appraiser.postalCode) {
      schema.address.postalCode = appraiser.postalCode;
    }
  }
  
  // Add geo coordinates if available
  if (appraiser.latitude && appraiser.longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      'latitude': appraiser.latitude,
      'longitude': appraiser.longitude
    };
  }
  
  // Add hours of operation if available
  if (appraiser.hours) {
    schema.openingHoursSpecification = Array.isArray(appraiser.hours) 
      ? appraiser.hours.map(hour => ({
          '@type': 'OpeningHoursSpecification',
          ...hour
        }))
      : [{
          '@type': 'OpeningHoursSpecification',
          'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          'opens': '09:00',
          'closes': '17:00'
        }];
  }
  
  // Add ratings if available
  if (hasRating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': appraiser.rating,
      'reviewCount': appraiser.reviewCount,
      'bestRating': 5,
      'worstRating': 1
    };
  }
  
  // Add services offered
  const services = appraiser.specialties || ['Art Appraisal', 'Fine Art Valuation', 'Art Authentication'];
  
  schema.hasOfferCatalog = {
    '@type': 'OfferCatalog',
    'name': 'Art Appraisal Services',
    'itemListElement': services.map(service => ({
      '@type': 'Offer',
      'itemOffered': {
        '@type': 'Service',
        'name': service
      }
    }))
  };
  
  // Add main service
  schema.mainEntityOfPage = {
    '@type': 'WebPage',
    '@id': `${baseUrl}/appraiser/${slug}`
  };
  
  // Add person schema if this is an individual (rather than a company)
  if (!appraiser.businessName) {
    schema.founder = {
      '@type': 'Person',
      'name': appraiser.name,
      'jobTitle': 'Art Appraiser'
    };
  }
  
  return schema;
}

/**
 * Generates FAQPage schema from a list of questions and answers
 * @param {Array} faqs - List of FAQ objects with question and answer properties
 * @returns {Object} FAQPage schema
 */
export function generateFaqSchema(faqs) {
  if (!faqs || !Array.isArray(faqs) || faqs.length === 0) return null;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer
      }
    }))
  };
}

/**
 * Generates a city/location schema
 * @param {Object} locationData - Location data
 * @returns {Object} Location schema
 */
export function generateLocationSchema(locationData) {
  if (!locationData || !locationData.city) return null;
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'City',
    'name': locationData.city,
    'description': locationData.description || `Find professional art appraisers in ${locationData.city}, ${locationData.state || 'USA'}.`
  };
  
  // Add address information
  if (locationData.state) {
    schema.address = {
      '@type': 'PostalAddress',
      'addressLocality': locationData.city,
      'addressRegion': locationData.state,
      'addressCountry': 'US'
    };
  }
  
  // Add geo coordinates if available
  if (locationData.latitude && locationData.longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      'latitude': locationData.latitude,
      'longitude': locationData.longitude
    };
  }
  
  return schema;
}

/**
 * Generates local business listing schema for a location page
 * @param {Object} options - Local business list options
 * @returns {Object} Local business list schema
 */
export function generateLocalBusinessListSchema(options) {
  const {
    businesses = [],
    cityName = '',
    baseUrl = 'https://antique-appraiser-directory.appraisily.com'
  } = options;
  
  if (!businesses || businesses.length === 0) return null;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'itemListElement': businesses.map((business, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'ProfessionalService',
        'name': business.name,
        'image': business.imageUrl || business.image || '',
        'telephone': business.phone || '',
        'url': `${baseUrl}/appraiser/${business.slug || business.id}`,
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': business.city || cityName,
          'addressRegion': business.state || '',
          'addressCountry': 'US'
        },
        'priceRange': business.priceRange || '$$-$$$',
        'description': business.description || `Professional art appraiser serving ${cityName} and surrounding areas.`
      }
    }))
  };
}

/**
 * Generates Review schema for an appraiser
 * @param {Object} review - Review data
 * @param {Object} appraiser - Appraiser data
 * @returns {Object} Review schema
 */
export function generateReviewSchema(review, appraiser) {
  if (!review || !appraiser) return null;
  
  const baseUrl = 'https://art-appraiser.appraisily.com';
  const slug = appraiser.slug || appraiser.id || '';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    'reviewRating': {
      '@type': 'Rating',
      'ratingValue': review.rating,
      'bestRating': 5,
      'worstRating': 1
    },
    'author': {
      '@type': 'Person',
      'name': review.author || 'Anonymous'
    },
    'datePublished': review.date || new Date().toISOString().split('T')[0],
    'reviewBody': review.text || '',
    'itemReviewed': {
      '@type': 'ProfessionalService',
      'name': appraiser.name,
      'url': `${baseUrl}/appraiser/${slug}`,
      'image': appraiser.imageUrl || appraiser.image || ''
    }
  };
}

/**
 * Generates Service schema for appraisal services
 * @param {Object} service - Service data
 * @param {Object} provider - Service provider (appraiser)
 * @returns {Object} Service schema
 */
export function generateServiceSchema(service, provider) {
  if (!service || !service.name) return null;
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': service.name,
    'description': service.description || `Professional ${service.name.toLowerCase()} services.`
  };
  
  // Add service provider if available
  if (provider) {
    schema.provider = {
      '@type': 'ProfessionalService',
      'name': provider.name
    };
    
    // Add provider URL if available
    if (provider.slug || provider.id) {
      const baseUrl = 'https://antique-appraiser-directory.appraisily.com';
      const slug = provider.slug || provider.id;
      schema.provider.url = `${baseUrl}/appraiser/${slug}`;
    }
  }
  
  // Add price if available
  if (service.price) {
    schema.offers = {
      '@type': 'Offer',
      'price': service.price,
      'priceCurrency': 'USD'
    };
  }
  
  // Add area served if available
  if (provider && (provider.city || provider.state)) {
    schema.areaServed = {
      '@type': 'GeoCircle',
      'geoMidpoint': {
        '@type': 'GeoCoordinates',
        'latitude': provider.latitude || 0,
        'longitude': provider.longitude || 0
      },
      'geoRadius': '50000'
    };
  }
  
  return schema;
}

/**
 * Generates Article schema for blog posts
 * @param {Object} article - Article data
 * @returns {Object} Article schema
 */
export function generateArticleSchema(article) {
  if (!article || !article.title) return null;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': article.title,
    'description': article.description || '',
    'image': article.image || '',
    'datePublished': article.datePublished || new Date().toISOString(),
    'dateModified': article.dateModified || article.datePublished || new Date().toISOString(),
    'author': {
      '@type': 'Person',
      'name': article.author || 'Appraisily Editorial Team'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Appraisily',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://cdn.mcauto-images-production.sendgrid.net/304ac75ef1d5c007/8aeb2689-2b5b-402d-a6f3-6521621e123a/300x300.png'
      }
    },
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': article.url || ''
    }
  };
}

/**
 * Generates all required schemas for a location page
 * @param {Object} locationData - Location data
 * @param {Array} appraisers - List of appraisers in the location
 * @returns {Object} Combined schema containing all necessary structured data
 */
export function generateLocationPageSchemas(locationData, appraisers = []) {
  if (!locationData || !locationData.city) return [];
  
  const schemas = [];
  const cityName = locationData.city;
  const stateName = locationData.state || '';
  
  // Add location schema
  const locationSchema = generateLocationSchema(locationData);
  if (locationSchema) schemas.push(locationSchema);
  
  // Add local business list schema
  const businessListSchema = generateLocalBusinessListSchema({
    businesses: appraisers,
    cityName
  });
  if (businessListSchema) schemas.push(businessListSchema);
  
  // Add breadcrumb schema
  const breadcrumbSchema = generateBreadcrumbSchema({
    items: [
      { name: 'Home', path: '/' },
      { name: 'Directory', path: '/directory' },
      { name: `Art Appraisers in ${cityName}`, path: `/location/${cityName.toLowerCase().replace(/\s+/g, '-')}` }
    ]
  });
  if (breadcrumbSchema) schemas.push(breadcrumbSchema);
  
  // Generate service schema for the location
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': `Art Appraisal Services in ${cityName}, ${stateName}`,
    'description': `Professional art appraisal services in ${cityName}, ${stateName}. Get accurate valuations for insurance, estate planning, donations, and sales.`,
    'areaServed': {
      '@type': 'City',
      'name': cityName,
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': cityName,
        'addressRegion': stateName,
        'addressCountry': 'US'
      }
    },
    'provider': appraisers.map(appraiser => ({
      '@type': 'ProfessionalService',
      'name': appraiser.name,
      'url': `https://antique-appraiser-directory.appraisily.com/appraiser/${appraiser.slug || appraiser.id}`
    }))
  };
  schemas.push(serviceSchema);
  
  // Add FAQ schema
  const faqSchema = generateFaqSchema([
    {
      question: `How much does art appraisal cost in ${cityName}?`,
      answer: `Art appraisal costs in ${cityName} typically range from $125 to $350 per hour, depending on the appraiser's expertise and the complexity of the artwork. Many appraisers also offer flat rates for certain types of appraisals.`
    },
    {
      question: `How do I find a reliable art appraiser in ${cityName}?`,
      answer: `To find a reliable art appraiser in ${cityName}, look for appraisers with certifications from recognized organizations such as the International Society of Appraisers (ISA), American Society of Appraisers (ASA), or Appraisers Association of America (AAA). Check reviews, ask for references, and verify their area of specialization.`
    },
    {
      question: `What information do I need to provide for an art appraisal in ${cityName}?`,
      answer: `For an art appraisal in ${cityName}, you'll typically need to provide clear photographs of the artwork, dimensions, medium, information about the artist, provenance (history of ownership), documentation or certificates of authenticity, and the purpose of the appraisal.`
    }
  ]);
  if (faqSchema) schemas.push(faqSchema);
  
  return schemas;
}

/**
 * Generates all required schemas for an appraiser page
 * @param {Object} appraiser - Appraiser data
 * @returns {Object} Combined schema containing all necessary structured data
 */
export function generateAppraiserPageSchemas(appraiser) {
  if (!appraiser || !appraiser.name) return [];
  
  const schemas = [];
  
  // Add appraiser schema
  const appraiserSchema = generateAppraiserSchema(appraiser);
  if (appraiserSchema) schemas.push(appraiserSchema);
  
  // Add breadcrumb schema
  const breadcrumbSchema = generateBreadcrumbSchema({
    items: [
      { name: 'Home', path: '/' },
      { name: 'Directory', path: '/directory' },
      { name: `Art Appraisers in ${appraiser.city || ''}`, path: `/location/${(appraiser.city || '').toLowerCase().replace(/\s+/g, '-')}` },
      { name: appraiser.name, path: `/appraiser/${appraiser.slug || appraiser.id}` }
    ]
  });
  if (breadcrumbSchema) schemas.push(breadcrumbSchema);
  
  // Add reviews if available
  if (appraiser.reviews && Array.isArray(appraiser.reviews) && appraiser.reviews.length > 0) {
    appraiser.reviews.forEach(review => {
      const reviewSchema = generateReviewSchema(review, appraiser);
      if (reviewSchema) schemas.push(reviewSchema);
    });
  }
  
  // Add service schemas if available
  if (appraiser.services && Array.isArray(appraiser.services) && appraiser.services.length > 0) {
    appraiser.services.forEach(service => {
      const serviceSchema = generateServiceSchema(service, appraiser);
      if (serviceSchema) schemas.push(serviceSchema);
    });
  }
  
  // Add FAQ schema for the appraiser
  const faqSchema = generateFaqSchema([
    {
      question: `What services does ${appraiser.name} offer?`,
      answer: appraiser.services?.map(s => s.name).join(', ') || 
        `${appraiser.name} offers professional art appraisal services including valuations for insurance, estate planning, donations, and sales.`
    },
    {
      question: `What are ${appraiser.name}'s specialties?`,
      answer: appraiser.specialties?.join(', ') || 
        `${appraiser.name} specializes in appraising various types of artwork and collectibles.`
    },
    {
      question: `How can I contact ${appraiser.name}?`,
      answer: `You can contact ${appraiser.name} by ${appraiser.phone ? `phone at ${appraiser.phone}` : 'using the contact information on their profile page'}${appraiser.email ? ` or by email at ${appraiser.email}` : ''}.`
    }
  ]);
  if (faqSchema) schemas.push(faqSchema);
  
  return schemas;
}

/**
 * Generates complete schema.org markup for a page
 * @param {Array} schemas - Array of schema objects
 * @returns {string} HTML string with all schema script tags
 */
export function generateSchemaMarkup(schemas) {
  if (!schemas || !Array.isArray(schemas) || schemas.length === 0) return '';
  
  return schemas.map(schema => createSchemaScript(schema)).join('\n');
} 