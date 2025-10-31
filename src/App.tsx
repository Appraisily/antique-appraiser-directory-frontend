import React from 'react';
import { MapPin, Star, Search, ArrowRight } from 'lucide-react';
import { CitySearch } from './components/CitySearch';
import { SEO } from './components/SEO';
import { cities } from './data/cities.json';
import { CTA_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL, buildSiteUrl } from './config/site';
import { trackEvent } from './utils/analytics';
import heroIllustrationPrimary from '../images/hero-antique-parlor.png';
import heroIllustrationSecondary from '../images/hero-antique-gallery.png';
import patternScrollwork from '../images/pattern-antique-scrollwork.png';
import iconFurniture from '../images/icon-antique-furniture.png';
import iconFineArt from '../images/icon-antique-fine-art.png';
import iconJewelry from '../images/icon-antique-jewelry.png';

type DirectoryCity = (typeof cities)[number];

function App() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const totalCities = cities.length;
  const totalStates = new Set(cities.map(city => city.state)).size;

  const statsHighlights = [
    { value: `${totalCities}+`, label: 'Cities covered nationwide' },
    { value: `${totalStates}`, label: 'States with certified experts' },
    { value: '48 hrs', label: 'Average appraisal turnaround' }
  ];
  const handleCtaClick = (placement: string) => {
    trackEvent('cta_click', {
      placement,
      destination: CTA_URL
    });
  };

  const handleCityDirectoryClick = (city: DirectoryCity, placement: string) => {
    trackEvent('city_directory_click', {
      placement,
      city_slug: city.slug,
      city_name: city.name,
      state: city.state
    });
  };

  const handleFeaturedAppraiserClick = (slug: string, name: string, placement: string) => {
    trackEvent('featured_appraiser_click', {
      placement,
      appraiser_slug: slug,
      appraiser_name: name
    });
  };

  const specialtyHighlights = [
    {
      title: 'Furniture & Décor',
      description: 'Victorian, Art Deco, mid-century and bespoke furnishings evaluated by specialists.',
      image: iconFurniture,
      alt: 'Antique furniture icon'
    },
    {
      title: 'Fine Art & Paintings',
      description: 'Museum-quality canvases, sculptures and works on paper reviewed for provenance.',
      image: iconFineArt,
      alt: 'Antique fine art icon'
    },
    {
      title: 'Jewelry & Timepieces',
      description: 'Estate jewelry, gemstones and horology assessed with gemological expertise.',
      image: iconJewelry,
      alt: 'Antique jewelry icon'
    }
  ];

  // Group cities by region for better organization
  const regions = {
    'Northeast': cities.filter(city => 
      ['New York', 'Massachusetts', 'Rhode Island', 'Connecticut', 'Pennsylvania', 'New Jersey'].includes(city.state)
    ),
    'Southeast': cities.filter(city => 
      ['Florida', 'Georgia', 'North Carolina', 'South Carolina', 'Tennessee', 'Virginia'].includes(city.state)
    ),
    'Midwest': cities.filter(city => 
      ['Illinois', 'Ohio', 'Michigan', 'Minnesota', 'Missouri', 'Indiana', 'Wisconsin'].includes(city.state)
    ),
    'Southwest': cities.filter(city => 
      ['Texas', 'Arizona', 'New Mexico', 'Oklahoma'].includes(city.state)
    ),
    'West Coast': cities.filter(city => 
      ['California', 'Washington', 'Oregon', 'Nevada'].includes(city.state)
    ),
    'Mountain': cities.filter(city => 
      ['Colorado', 'Utah', 'Montana', 'Idaho', 'Wyoming'].includes(city.state)
    )
  };

  // Generate the home page schema
  const generateHomePageSchema = () => {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      "url": SITE_URL,
      "name": SITE_NAME,
      "description": SITE_DESCRIPTION,
      "publisher": {
        "@type": "Organization",
        "name": SITE_NAME,
        "url": SITE_URL,
        "logo": {
          "@type": "ImageObject",
          "url": "https://ik.imagekit.io/appraisily/appraisily-og-image.jpg"
        }
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
  };

  // Generate Professional Service schema for art appraisal services
  const generateServiceSchema = () => {
    return {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "@id": `${SITE_URL}#professional-service`,
      "name": SITE_NAME,
      "description": SITE_DESCRIPTION,
      "url": SITE_URL,
      "serviceType": "Art Appraisal",
      "audience": {
        "@type": "Audience",
        "audienceType": "Art Collectors, Insurance Companies, Estates, Donors"
      },
      "serviceArea": {
        "@type": "Country",
        "name": "United States"
      },
      "provider": {
        "@type": "Organization",
        "name": SITE_NAME,
        "url": SITE_URL
      }
    };
  };

  const generateOrganizationSchema = () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    "name": SITE_NAME,
    "url": SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": "https://ik.imagekit.io/appraisily/appraisily-og-image.jpg"
    },
    "sameAs": [
      "https://twitter.com/appraisily",
      "https://www.linkedin.com/company/appraisily"
    ],
    "description": SITE_DESCRIPTION,
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "support@appraisily.com",
        "url": SITE_URL
      }
    ]
  });

  const generateCityItemList = () => {
    const topCities = cities.slice(0, 12);
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Featured Antique Appraiser Cities",
      "itemListElement": topCities.map((city, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": `${city.name}, ${city.state}`,
        "url": buildSiteUrl(`/location/${city.slug}`)
      }))
    };
  };

  return (
    <>
      <SEO
        title={`${SITE_NAME} | Find Antique Appraisers Near You`}
        description={SITE_DESCRIPTION}
        schema={[
          generateHomePageSchema(),
          generateServiceSchema(),
          generateOrganizationSchema(),
          generateCityItemList()
        ]}
        path="/"
      />
      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/10 to-blue-50" />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${patternScrollwork})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />

          <div className="relative container mx-auto px-6 py-20 md:py-24">
            <div className="grid items-center gap-12 md:grid-cols-2">
              <div className="order-2 space-y-6 text-center md:order-1 md:text-left">
                <span className="inline-flex items-center justify-center rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-primary shadow-sm">
                  Trusted antique valuation network
                </span>
                <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
                  Find <span className="text-primary">certified antique appraisers</span> near you
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl md:max-w-xl mx-auto md:mx-0">
                  Connect with vetted specialists for heirloom furniture, fine art, jewelry, and historically significant collections.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto md:mx-0 bg-white/90 p-2 rounded-lg shadow-lg backdrop-blur-lg"
                >
                  <CitySearch />
                  <button
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary-foreground hover:bg-primary/90 h-12 px-8 py-2 bg-primary md:w-auto w-full shadow-md hover:shadow-lg transform hover:-translate-y-1 duration-300"
                    type="submit"
                  >
                    <Search className="w-4 h-4" />
                    Find Appraisers
                  </button>
                </form>

                <div className="grid gap-6 pt-8 sm:grid-cols-3">
                  {statsHighlights.map(stat => (
                    <div key={stat.label} className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-md">
                      <p className="text-2xl font-bold text-primary">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-1 md:order-2">
                <div className="relative mx-auto max-w-sm md:max-w-md">
                  <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-2xl backdrop-blur-md">
                    <img
                      src={heroIllustrationPrimary}
                      alt="Antique appraisal consultation illustration"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="hidden lg:block">
                    <div className="absolute -bottom-12 -left-12 w-40 overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-xl backdrop-blur-md">
                      <img
                        src={heroIllustrationSecondary}
                        alt="Gallery of antique heirlooms on display"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto text-center mb-12 space-y-4">
              <span className="uppercase tracking-[0.3em] text-xs text-primary/80">What we appraise</span>
              <h2 className="text-3xl font-bold">Specialty categories handled with care</h2>
              <p className="text-muted-foreground">
                Every submission is matched with a certified specialist who understands the historical context and market value of your antiques.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {specialtyHighlights.map(item => (
                <div
                  key={item.title}
                  className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/70 p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                >
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-0" />
                  <div className="relative mb-6 flex items-center justify-center">
                    <img
                      src={item.image}
                      alt={item.alt}
                      loading="lazy"
                      className="h-16 w-16 object-contain drop-shadow-lg"
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cities Directory Section */}
        <div className="bg-gray-50 py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold mb-4 text-center">Antique Appraiser Directory by City</h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              Find certified antique appraisers in your city. Our directory covers major metropolitan areas across the United States.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.entries(regions).map(([region, regionCities]) => (
                <div key={region} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-300">
                  <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">{region}</h3>
                  <ul className="grid grid-cols-1 gap-2">
                    {regionCities.map(city => (
                      <li key={city.slug}>
                        <a 
                          href={buildSiteUrl(`/location/${city.slug}`)}
                          className="flex items-center text-gray-700 hover:text-blue-600 py-1 transition-colors"
                          data-gtm-event="city_directory_click"
                          data-gtm-city={city.slug}
                          data-gtm-state={city.state}
                          data-gtm-placement={`home_${region.toLowerCase().replace(/\s+/g, '-')}`}
                          onClick={() => handleCityDirectoryClick(city, `home_${region.toLowerCase().replace(/\s+/g, '-')}`)}
                        >
                          <MapPin className="w-4 h-4 mr-2 text-blue-500" />
                          <span>{city.name}, {city.state}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            <div className="mt-10 text-center">
              <p className="text-gray-600 mb-4">Don't see your city? We may still have art appraisers available in your area.</p>
              <a
                href={CTA_URL}
                className="inline-flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 py-3 px-6 rounded-lg shadow-md font-medium transition-all duration-300"
                data-gtm-event="cta_click"
                data-gtm-placement="home_directory"
                onClick={() => handleCtaClick('home_directory')}
              >
                Request an Appraisal <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        
        {/* Featured Appraisers Section */}
        <main className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-10 text-center">Featured Antique Appraisers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Appraiser Card 1 - Sotheby's New York */}
            <a
              href={buildSiteUrl('/appraiser/sothebys-new-york')}
              className="group"
              data-gtm-event="featured_appraiser_click"
              data-gtm-appraiser="sothebys-new-york"
              data-gtm-placement="home_featured"
              onClick={() => handleFeaturedAppraiserClick('sothebys-new-york', "Sotheby's New York", 'home_featured')}
            >
              <div className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden group-hover:shadow-xl transition-all duration-300 cursor-pointer transform group-hover:-translate-y-2">
                <div className="relative">
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '65%' }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <img
                        src="https://ik.imagekit.io/appraisily/appraiser-images/appraiser_sothebys-new-york-7070_1742166258599_OtNJ5gopN.jpg"
                        alt="Sotheby's New York"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-md shadow-md text-sm font-medium text-primary flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" /> 4.7
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Sotheby's New York</h3>
                  <div className="flex items-center text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> New York, NY
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">Prestigious auction house offering comprehensive valuations of fine art and luxury items since 1744.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Fine Art</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Luxury Items</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Valuations</span>
                  </div>
                </div>
              </div>
            </a>
            
            {/* Appraiser Card 2 - Heritage Auctions */}
            <a
              href={buildSiteUrl('/appraiser/heritage-auctions')}
              className="group"
              data-gtm-event="featured_appraiser_click"
              data-gtm-appraiser="heritage-auctions"
              data-gtm-placement="home_featured"
              onClick={() => handleFeaturedAppraiserClick('heritage-auctions', 'Heritage Auctions', 'home_featured')}
            >
              <div className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden group-hover:shadow-xl transition-all duration-300 cursor-pointer transform group-hover:-translate-y-2">
                <div className="relative">
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '65%' }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <img
                        src="https://ik.imagekit.io/appraisily/appraiser-images/appraiser_heritage-auctions-9336_1742166295247_Te5aZW192.jpg"
                        alt="Heritage Auctions"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-md shadow-md text-sm font-medium text-primary flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" /> 4.6
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Heritage Auctions</h3>
                  <div className="flex items-center text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> New York, NY
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">Leading collectibles auctioneer specializing in fine art and rare collectibles since 1976.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Collectibles</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Fine Art</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Auctions</span>
                  </div>
                </div>
              </div>
            </a>
            
            {/* Appraiser Card 3 - Clars Auction Gallery */}
            <a
              href={buildSiteUrl('/appraiser/clars-auction-gallery')}
              className="group"
              data-gtm-event="featured_appraiser_click"
              data-gtm-appraiser="clars-auction-gallery"
              data-gtm-placement="home_featured"
              onClick={() => handleFeaturedAppraiserClick('clars-auction-gallery', 'Clars Auction Gallery', 'home_featured')}
            >
              <div className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden group-hover:shadow-xl transition-all duration-300 cursor-pointer transform group-hover:-translate-y-2">
                <div className="relative">
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '65%' }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <img
                        src="https://ik.imagekit.io/appraisily/appraiser-images/appraiser_oakland-clars-auction-gallery_1742202839449_GkygjFg5F.jpg"
                        alt="Clars Auction Gallery"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-md shadow-md text-sm font-medium text-primary flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" /> 5.0
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Clars Auction Gallery</h3>
                  <div className="flex items-center text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> Oakland, CA
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">Specialists in antique furniture, Asian art, mid-century design, and fine jewelry since 1972.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Antique Furniture</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Asian Art</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Jewelry</span>
                  </div>
                </div>
              </div>
            </a>
          </div>
          
          <div className="mt-12 text-center">
            <a 
              href={buildSiteUrl('/location/new-york')} 
              className="inline-flex items-center justify-center rounded-lg border border-primary bg-white px-6 py-3 text-sm font-medium text-primary shadow-sm transition-all hover:bg-primary hover:text-white mr-4"
            >
              Browse All Appraisers
            </a>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
