import React from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Star, Mail, Phone, Globe, Clock, Award, Shield } from 'lucide-react';
import { getAppraiser } from '../utils/staticData';
import { SEO } from '../components/SEO';
import { generateAppraiserSchema, generateFAQSchema } from '../utils/schemaGenerators';

type Appraiser = {
  id: string;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  address: string;
  phone: string;
  email: string;
  website: string;
  specialties: string[];
  certifications: string[];
  businessHours: {
    day: string;
    hours: string;
  }[];
  about: string;
  services: {
    name: string;
    description: string;
    price: string;
  }[];
  reviews: {
    id: string;
    author: string;
    rating: number;
    date: string;
    content: string;
  }[];
  city?: string;
};

export function AppraiserPage() {
  const { appraiserId } = useParams<{ appraiserId: string }>();
  const appraiser = appraiserId ? getAppraiser(appraiserId) : null;

  const generateBreadcrumbSchema = (appraiser: any) => {
    const cityFromAddress = appraiser.address ? appraiser.address.split(',')[0].trim() : appraiser.city || 'Unknown';
    const citySlug = (appraiser.city || cityFromAddress).toLowerCase().replace(/\s+/g, '-');

    return {
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
          "name": `Art Appraisers in ${cityFromAddress}`,
          "item": `https://appraisily.com/location/${citySlug}`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": appraiser.name,
          "item": `https://art-appraiser-directory.appraisily.com/appraiser/${appraiserId}`
        }
      ]
    };
  };

  if (!appraiser) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-muted-foreground">Appraiser not found</p>
        </div>
      </div>
    );
  }

  // Type that matches expected structure with optional properties
  interface SafeAppraiser {
    name: string;
    id: string;
    rating: number;
    reviewCount: number;
    address: string;
    city?: string;
    state?: string;
    phone: string;
    email: string;
    website: string;
    specialties: string[];
    certifications: string[];
    about: string;
    services: Array<{
      name: string;
      description: string;
      price: string;
    }>;
    businessHours: Array<{
      day: string;
      hours: string;
    }>;
    reviews: Array<{
      id: string;
      author: string;
      rating: number;
      date: string;
      content: string;
    }>;
    image: string;
    imageUrl?: string;
    [key: string]: any; // Allow any other properties
  }

  // Use type assertion to create a fully-populated SafeAppraiser
  const safeAppraiser: SafeAppraiser = {
    ...appraiser,
    // Ensure id is always defined
    id: (appraiser as any).id || appraiserId || '',
    // Extract city from address if not defined
    city: (appraiser as any).city || (appraiser.address ? appraiser.address.split(',')[0].trim() : 'Unknown'),
    state: (appraiser as any).state || (appraiser.address?.split(',')[1]?.trim() || 'Unknown'),
    // Provide fallbacks for mandatory display fields
    rating: (appraiser as any).rating || 0,
    reviewCount: (appraiser as any).reviewCount || 0,
    about: (appraiser as any).about || `${appraiser.name} is a professional art appraiser specializing in art valuation services.`,
    email: (appraiser as any).email || '',
    phone: appraiser.phone || '',
    website: appraiser.website || '#',
    specialties: Array.isArray(appraiser.specialties) ? appraiser.specialties : [],
    certifications: Array.isArray(appraiser.certifications) ? appraiser.certifications : [],
    // Convert services_offered to services format if services doesn't exist
    services: Array.isArray((appraiser as any).services) 
      ? (appraiser as any).services 
      : (Array.isArray(appraiser.services_offered) 
          ? appraiser.services_offered.map((service: string) => ({
              name: service,
              description: `Professional ${service} services`,
              price: (appraiser as any).pricing || "Contact for pricing"
            }))
          : []),
    businessHours: Array.isArray((appraiser as any).businessHours) 
      ? (appraiser as any).businessHours 
      : [
          { day: "Monday-Friday", hours: "9:00 AM - 5:00 PM" },
          { day: "Saturday-Sunday", hours: "By appointment" }
        ],
    reviews: Array.isArray((appraiser as any).reviews) 
      ? (appraiser as any).reviews 
      : [],
    // Use imageUrl as fallback for image
    image: (appraiser as any).image || appraiser.imageUrl || 'https://placehold.co/600x400?text=No+Image'
  };

  return (
    <>
      <SEO
        title={`${safeAppraiser.name} - Art Appraiser in ${safeAppraiser.address ? safeAppraiser.address.split(',')[0].trim() : safeAppraiser.city || 'Your Area'} | Expert Art Valuation Services | Appraisily`}
        description={`Get professional art appraisal services from ${safeAppraiser.name} near ${safeAppraiser.address ? safeAppraiser.address.split(',')[0].trim() : safeAppraiser.city || 'you'}. Specializing in ${safeAppraiser.specialties.join(', ')}. Certified expert with ${safeAppraiser.reviewCount} verified reviews.`}
        keywords={[
          `${safeAppraiser.name.toLowerCase()} art appraiser`,
          `${safeAppraiser.address ? `art appraisal ${safeAppraiser.address.split(',')[0].toLowerCase()}` : `art appraisal ${safeAppraiser.city?.toLowerCase() || ''}`}`,
          `art appraiser near me`,
          `local art appraiser ${safeAppraiser.address ? safeAppraiser.address.split(',')[0].toLowerCase() : safeAppraiser.city?.toLowerCase() || ''}`,
          `best art appraiser ${safeAppraiser.address ? safeAppraiser.address.split(',')[0].toLowerCase() : safeAppraiser.city?.toLowerCase() || ''}`,
          ...safeAppraiser.specialties.map(s => s.toLowerCase()),
          'art valuation',
          'art authentication',
          'certified art appraiser'
        ]}
        schema={[
          generateAppraiserSchema(safeAppraiser),
          generateBreadcrumbSchema(safeAppraiser),
          generateFAQSchema(safeAppraiser)
        ]}
        canonicalUrl={`https://art-appraiser-directory.appraisily.com/appraiser/${appraiserId}`}
      />

      <div className="flex-1">
        <div className="relative h-[300px] md:h-[400px]">
          <img
            src={safeAppraiser.image}
            alt={safeAppraiser.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        <div className="container mx-auto px-6 -mt-16 relative z-10">
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{safeAppraiser.name}</h1>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-400" />
                    <span className="font-semibold">{safeAppraiser.rating}/5</span>
                    <span className="text-muted-foreground">({safeAppraiser.reviewCount} reviews)</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{safeAppraiser.address}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`mailto:${safeAppraiser.email}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Contact
                </a>
                <a
                  href={`tel:${safeAppraiser.phone}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Call Now
                </a>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mt-8">
              <div className="md:col-span-2 space-y-8">
                <section>
                  <h2 className="text-2xl font-semibold mb-4">About</h2>
                  <p className="text-muted-foreground">{safeAppraiser.about}</p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">Services</h2>
                  <div className="space-y-4">
                    {safeAppraiser.services.map((service) => (
                      <div key={service.name} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold">{service.name}</h3>
                          <span className="text-primary font-medium">{service.price}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold mb-4">Reviews</h2>
                  <div className="space-y-4">
                    {safeAppraiser.reviews.map((review) => (
                      <div key={review.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{review.author}</span>
                          <span className="text-sm text-muted-foreground">{review.date}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? 'text-yellow-400' : 'text-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-muted-foreground">{review.content}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Contact Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Website:</strong>{' '}
                      <a href={safeAppraiser.website} className="text-primary hover:underline">
                        {safeAppraiser.website.replace(/^https?:\/\//, '')}
                      </a>
                    </p>
                    <p>
                      <strong>Email:</strong>{' '}
                      <a href={`mailto:${safeAppraiser.email}`} className="text-primary hover:underline">
                        {safeAppraiser.email}
                      </a>
                    </p>
                    <p>
                      <strong>Phone:</strong>{' '}
                      <a href={`tel:${safeAppraiser.phone}`} className="text-primary hover:underline">
                        {safeAppraiser.phone}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Business Hours
                  </h3>
                  <div className="space-y-2 text-sm">
                    {safeAppraiser.businessHours.map((hours) => (
                      <div key={hours.day} className="flex justify-between">
                        <span>{hours.day}</span>
                        <span className="text-muted-foreground">{hours.hours}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Specialties
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {safeAppraiser.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Certifications
                  </h3>
                  <div className="space-y-2 text-sm">
                    {safeAppraiser.certifications.map((certification) => (
                      <div key={certification} className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-primary" />
                        <span>{certification}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}