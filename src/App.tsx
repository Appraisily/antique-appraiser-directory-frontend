import React from 'react';
import { MapPin, Star, Search, ArrowRight } from 'lucide-react';
import { CitySearch, type CitySearchHandle } from './components/CitySearch';
import { SEO } from './components/SEO';
import { cities } from './data/cities.json';
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL, buildSiteUrl, getPrimaryCtaUrl } from './config/site';
import { trackEvent } from './utils/analytics';
import { normalizeAssetUrl } from './utils/assetUrls';
import heroIllustrationPrimary from '../images/hero-antique-parlor.png';
import heroIllustrationSecondary from '../images/hero-antique-gallery.png';
import patternScrollwork from '../images/pattern-antique-scrollwork.png';
import iconFurniture from '../images/icon-antique-furniture.png';
import iconFineArt from '../images/icon-antique-fine-art.png';
import iconJewelry from '../images/icon-antique-jewelry.png';

type DirectoryCity = (typeof cities)[number];

type FeaturedCitySpotlight = {
  slug: string;
  query: string;
  blurb: string;
};

const FEATURED_CITY_SPOTLIGHTS: readonly FeaturedCitySpotlight[] = [
  {
    slug: 'des-moines',
    query: 'Des Moines art appraisals',
    blurb: 'Good fit for donation, estate, and insurance appraisal searches in Iowa.'
  },
  {
    slug: 'chicago',
    query: 'Chicago antique appraisers',
    blurb: 'Strong page to compare metro-area antique and art appraisal providers.'
  },
  {
    slug: 'milwaukee',
    query: 'Antique appraisal Milwaukee',
    blurb: 'Targets local appraisal intent for estate items, collections, and insurance work.'
  },
  {
    slug: 'columbus',
    query: 'Columbus art appraiser',
    blurb: 'Useful for donation, estate, and personal-property valuation comparisons.'
  },
  {
    slug: 'seattle',
    query: 'Seattle art appraisal services',
    blurb: 'Covers Seattle-area antique and art valuation intent with local and online options.'
  }
] as const;

function App() {
  const citySearchRef = React.useRef<CitySearchHandle>(null);
  const [isSearchHighlighting, setIsSearchHighlighting] = React.useState(false);
  const searchHighlightTimeoutRef = React.useRef<number | null>(null);

  const scrollToCityDirectory = () => {
    if (typeof document === 'undefined') return false;

    const byId = document.getElementById('city-directory');
    if (byId) {
      byId.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    const byData = document.querySelector('[data-city-directory]');
    if (byData instanceof HTMLElement) {
      byData.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    const headingText = 'Antique Appraiser Directory by City';
    const h2 = Array.from(document.querySelectorAll('h2')).find((node) => (node.textContent || '').trim() === headingText);
    if (h2 instanceof HTMLElement) {
      const container = h2.closest('section, div');
      if (container instanceof HTMLElement) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      h2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    return false;
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const didNavigate = citySearchRef.current?.submitSearch();
    if (didNavigate) {
      return;
    }

    const query = citySearchRef.current?.getQuery().trim() ?? '';
    if (query) {
      trackEvent('location_search_submit_no_match', {
        source: 'hero_directory',
        query
      });

      // Fallback: try to find a matching city by slug or name
      const lowerQuery = query.toLowerCase();
      const match = cities.find(city =>
        city.slug.toLowerCase().includes(lowerQuery) ||
        city.name.toLowerCase().includes(lowerQuery) ||
        city.state.toLowerCase().includes(lowerQuery) ||
        `${city.name}, ${city.state}`.toLowerCase().includes(lowerQuery)
      );

      if (match) {
        trackEvent('location_search_fuzzy_match', {
          source: 'hero_directory',
          query,
          city_slug: match.slug
        });
        if (typeof window !== 'undefined') {
          window.location.href = buildSiteUrl(`/location/${match.slug}`);
        }
        return;
      }
    }

    if (scrollToCityDirectory()) return;

    if (typeof window !== 'undefined') {
      // Last resort: navigate to the closest matching city or home
      window.location.href = buildSiteUrl('/');
    }
  };

  const triggerSearchHighlight = () => {
    if (searchHighlightTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(searchHighlightTimeoutRef.current);
    }

    setIsSearchHighlighting(true);

    if (typeof window !== 'undefined') {
      searchHighlightTimeoutRef.current = window.setTimeout(() => {
        setIsSearchHighlighting(false);
      }, 1200);
    }
  };

  React.useEffect(() => {
    return () => {
      if (searchHighlightTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(searchHighlightTimeoutRef.current);
      }
    };
  }, []);
  const primaryCtaUrl = getPrimaryCtaUrl();

  const totalCities = cities.length;
  const totalStates = new Set(cities.map(city => city.state)).size;
  const featuredCitySpotlights = React.useMemo(() => {
    return FEATURED_CITY_SPOTLIGHTS.map((spotlight) => {
      const city = cities.find((candidate) => candidate.slug === spotlight.slug);
      if (!city) return null;
      return { ...spotlight, city };
    }).filter((spotlight): spotlight is FeaturedCitySpotlight & { city: DirectoryCity } => Boolean(spotlight));
  }, []);

  const statsHighlights = [
    { value: `${totalCities}+`, label: 'Cities covered nationwide' },
    { value: `${totalStates}`, label: 'States with certified experts' },
    { value: '48 hrs', label: 'Average appraisal turnaround' }
  ];

  const handleStatHighlightClick = (label: string) => {
    trackEvent('stat_highlight_click', {
      placement: 'home_hero_stats',
      label
    });
    scrollToCityDirectory();
  };
  const handleCtaClick = (placement: string) => {
    trackEvent('cta_click', {
      placement,
      destination: primaryCtaUrl
    });
  };

  const handleSpecialtyCardClick = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    specialty: string
  ) => {
    const target = (event.target as HTMLElement | null);
    if (target && typeof target.closest === 'function') {
      const interactive = target.closest('a[href], button, input, select, textarea, summary, [role="button"], [role="link"]');
      if (interactive && interactive !== event.currentTarget) return;
    }

    if ('key' in event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    }

    // Build CTA URL with specialty context so the start page can pre-select the category
    const ctaWithSpecialty = getPrimaryCtaUrl({ specialty_category: specialty });

    trackEvent('specialty_card_click', {
      placement: 'home_specialties',
      specialty,
      destination: ctaWithSpecialty
    });

    if (typeof window !== 'undefined') {
      window.location.href = ctaWithSpecialty;
    }
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

  const handleRegionCardFallbackClick = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
    city: DirectoryCity | undefined,
    placement: string
  ) => {
    if (!city) return;
    const target = (event.target as HTMLElement | null);
    if (target && typeof target.closest === 'function') {
      const interactive = target.closest('a[href], button, input, select, textarea, summary, [role="button"], [role="link"]');
      if (interactive && interactive !== event.currentTarget) return;
    }

    if ('key' in event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    }

    handleCityDirectoryClick(city, `${placement}_card`);
    if (typeof window !== 'undefined') {
      window.location.href = buildSiteUrl(`/location/${city.slug}`);
    }
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
          "url": DEFAULT_OG_IMAGE
        }
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
  };

  // Generate Professional Service schema for antique appraisal services
  const generateServiceSchema = () => {
    return {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "@id": `${SITE_URL}#professional-service`,
      "name": SITE_NAME,
      "description": SITE_DESCRIPTION,
      "url": SITE_URL,
      "serviceType": "Antique Appraisal",
      "audience": {
        "@type": "Audience",
        "audienceType": "Antique Collectors, Insurance Companies, Estates, Donors"
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
      "url": DEFAULT_OG_IMAGE
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
        "email": "info@appraisily.com",
        "url": SITE_URL
      }
    ]
  });

  const generateCityItemList = () => {
    const topCities = featuredCitySpotlights.length > 0
      ? featuredCitySpotlights.map(({ city }) => city)
      : cities.slice(0, 12);
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
        title="Antique Appraisers Near Me — Compare Local Experts by City"
        description="Search antique appraisers near me — compare local specialists for estate, insurance, donation, and personal-property valuations. Browse city pages or get an online appraisal in 24–48 hours."
        schema={[
          generateHomePageSchema(),
          generateServiceSchema(),
          generateOrganizationSchema(),
          generateCityItemList()
        ]}
        path="/"
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:text-blue-700"
      >
        Skip to main content
      </a>
      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/10 to-blue-50" />
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
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
                  Find <span className="text-primary">certified antique appraisers</span> and art valuation experts near you
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl md:max-w-xl mx-auto md:mx-0">
                  Browse city guides for donation, estate, insurance, and resale valuations, then compare local experts or start an online appraisal.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className={`flex flex-col md:flex-row gap-4 max-w-xl mx-auto md:mx-0 bg-white/90 p-2 rounded-lg shadow-lg backdrop-blur-lg transition-all duration-300 ${isSearchHighlighting ? 'ring-2 ring-primary/40 shadow-xl' : ''}`}
                >
                  <CitySearch ref={citySearchRef} />
                  <button
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary-foreground hover:bg-primary/90 h-12 px-8 py-2 bg-primary md:w-auto w-full shadow-md hover:shadow-lg transform hover:-translate-y-1 duration-300"
                    type="submit"
                    onClick={handleSubmit}
                  >
                    <Search className="w-4 h-4" />
                    Find Appraisers
                  </button>
                </form>

                <div className="grid gap-6 pt-8 sm:grid-cols-3">
                  {statsHighlights.map(stat => (
                    <button
                      key={stat.label}
                      type="button"
                      className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur-md text-left transition-colors hover:border-primary/30 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 relative z-0 cursor-pointer"
                      aria-label={`Browse antique appraisers: ${stat.label}`}
                      data-gtm-event="stat_highlight_click"
                      data-gtm-placement="home_hero_stats"
                      data-gtm-stat-label={stat.label}
                      onClick={() => handleStatHighlightClick(stat.label)}
                    >
                      <p className="text-2xl font-bold text-primary">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </button>
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
                  className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/70 p-8 shadow-sm transition-colors duration-300 cursor-pointer hover:border-primary/40 z-0"
                  role="link"
                  tabIndex={0}
                  onClick={(event) => handleSpecialtyCardClick(event, item.title)}
                  onKeyDown={(event) => handleSpecialtyCardClick(event, item.title)}
                  data-gtm-event="specialty_card_click"
                  data-gtm-placement="home_specialties"
                  data-gtm-specialty={item.title}
                >
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
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
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Start an appraisal</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cities Directory Section */}
        <div id="city-directory" data-city-directory className="bg-gray-50 py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold mb-4 text-center">Antique Appraiser Directory by City</h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              Find antique appraisers and art appraisal services in your city. Start with the highest-demand city guides below, then compare broader regional options across the United States.
            </p>

            {featuredCitySpotlights.length > 0 && (
              <div className="mb-10 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
                <div className="max-w-3xl">
                  <h3 className="text-2xl font-semibold text-gray-900">Most searched antique appraisal cities</h3>
                  <p className="mt-2 text-gray-600">
                    These city pages align with the strongest &quot;near me&quot; and city-level searches currently gaining traction, so they are the best starting point if you want local antique or art appraisal options fast.
                  </p>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {featuredCitySpotlights.map(({ city, query, blurb }) => (
                    <a
                      key={city.slug}
                      href={buildSiteUrl(`/location/${city.slug}`)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 relative z-0"
                      data-gtm-event="city_directory_click"
                      data-gtm-city={city.slug}
                      data-gtm-state={city.state}
                      data-gtm-placement="home_featured_cities"
                      onClick={() => handleCityDirectoryClick(city, 'home_featured_cities')}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                        <MapPin className="h-4 w-4" />
                        <span>{city.name}, {city.state}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-gray-900">{query}</p>
                      <p className="mt-2 text-sm text-gray-600">{blurb}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.entries(regions).map(([region, regionCities]) => {
                const placement = `home_${region.toLowerCase().replace(/\s+/g, '-')}`;
                const primaryCity = regionCities[0];
                return (
                  <div
                    key={region}
                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-300"
                  >
                    <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">{region}</h3>
                    <ul className="grid grid-cols-1 gap-2">
                      {regionCities.map(city => (
                        <li key={city.slug}>
                          <a
                            href={buildSiteUrl(`/location/${city.slug}`)}
                            className="flex w-full items-center text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md px-2 py-2 -mx-2 transition-colors cursor-pointer"
                            data-gtm-event="city_directory_click"
                            data-gtm-city={city.slug}
                            data-gtm-state={city.state}
                            data-gtm-placement={placement}
                            onClick={() => handleCityDirectoryClick(city, placement)}
                          >
                            <MapPin className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                            <span>{city.name}, {city.state}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    {primaryCity && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <a
                          href={buildSiteUrl(`/location/${primaryCity.slug}`)}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center transition-colors cursor-pointer"
                          data-gtm-event="region_view_all"
                          data-gtm-region={region.toLowerCase()}
                          data-gtm-placement={`${placement}_card`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCityDirectoryClick(primaryCity, placement);
                          }}
                        >
                          View {primaryCity.name} appraisers &rarr;
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-10 text-center">
              <p className="text-gray-600 mb-4">Don't see your city? We may still have antique appraisers available in your area.</p>
              <a
                  href={primaryCtaUrl}
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
        <main id="main-content" className="container mx-auto px-6 py-16">
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
                        src={normalizeAssetUrl('https://ik.imagekit.io/appraisily/appraiser-images/appraiser_sothebys-new-york-7070_1742166258599_OtNJ5gopN.jpg')}
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
                        src={normalizeAssetUrl('https://ik.imagekit.io/appraisily/appraiser-images/appraiser_heritage-auctions-9336_1742166295247_Te5aZW192.jpg')}
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
                        src={normalizeAssetUrl('https://ik.imagekit.io/appraisily/appraiser-images/appraiser_oakland-clars-auction-gallery_1742202839449_GkygjFg5F.jpg')}
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
            <button
              type="button"
              onClick={() => {
                trackEvent('browse_all_locations_click', {
                  placement: 'home_featured_appraisers'
                });
                scrollToCityDirectory();
              }}
              className="inline-flex items-center justify-center rounded-lg border border-primary bg-white px-6 py-3 text-sm font-medium text-primary shadow-sm transition-all hover:bg-primary hover:text-white mr-4 cursor-pointer"
            >
              Browse All Locations
            </button>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
