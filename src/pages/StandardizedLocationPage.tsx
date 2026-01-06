import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { getStandardizedLocation, StandardizedAppraiser, StandardizedLocation } from '../utils/standardizedData';
import { SEO } from '../components/SEO';
import { generateLocationSchema } from '../utils/schemaGenerators';
import { SITE_URL, buildSiteUrl, getPrimaryCtaUrl } from '../config/site';
import {
  hasPlaceholderName,
  isPlaceholderAbout,
  isTemplatedExperience,
  isTemplatedNotes,
  isTemplatedPricing
} from '../utils/dataQuality';
import { trackEvent } from '../utils/analytics';
import { cities as directoryCities } from '../data/cities.json';
import { DEFAULT_PLACEHOLDER_IMAGE } from '../config/assets';
import { normalizeAssetUrl } from '../utils/assetUrls';

export function StandardizedLocationPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [locationData, setLocationData] = useState<StandardizedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const primaryCtaUrl = getPrimaryCtaUrl();

  const validCitySlug = typeof citySlug === 'string' ? citySlug : '';
  const cityMeta = useMemo(
    () => directoryCities.find(city => city.slug === validCitySlug) ?? null,
    [validCitySlug]
  );

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

  useEffect(() => {
    if (!locationData || locationData.appraisers.length === 0) {
      return;
    }

    trackEvent('view_item_list', {
      page_type: 'location',
      city_slug: validCitySlug,
      city_name: cityMeta?.name,
      state: cityMeta?.state,
      items: locationData.appraisers.slice(0, 25).map(appraiser => ({
        item_id: appraiser.slug,
        item_name: appraiser.name,
        city: appraiser.address.city,
        state: appraiser.address.state,
        rating: appraiser.business.rating,
        review_count: appraiser.business.reviewCount
      }))
    });
  }, [cityMeta, locationData, validCitySlug]);

  const cityName = useMemo(() => {
    if (cityMeta) {
      return `${cityMeta.name}, ${cityMeta.state}`;
    }

    if (!validCitySlug) {
      return 'Location';
    }

    return validCitySlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [cityMeta, validCitySlug]);
  const topSpecialties = useMemo(() => {
    if (!locationData?.appraisers?.length) return [];
    const counts = new Map<string, number>();
    locationData.appraisers.forEach(appraiser => {
      appraiser.expertise.specialties.forEach(specialty => {
        counts.set(specialty, (counts.get(specialty) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([specialty]) => specialty);
  }, [locationData]);

  const generateBreadcrumbSchema = () => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `Antique Appraisers in ${cityName}`,
        item: buildSiteUrl(`/location/${validCitySlug}`)
      }
    ]
  });

  const seoTitle = `Antique Appraisers in ${cityName} + Online Appraisal | Appraisily`;
  const seoDescription = `Looking for in-person antique appraisers in ${cityName}? Compare trusted local professionals and get a fast online appraisal from Appraisily without the appointment.`;

  const generateLocationFaqSchema = () => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Do you offer in-person appraisals in ${cityName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Appraisily focuses on online appraisals. This directory lists local providers in ${cityName} so you can contact them directly, or use Appraisily for a fast online alternative.`
        }
      },
      {
        '@type': 'Question',
        name: 'How does an online appraisal work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Submit clear photos, measurements, and any provenance. Our experts review the item and deliver a written valuation report online.'
        }
      },
      {
        '@type': 'Question',
        name: 'How fast is the online appraisal turnaround?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Turnaround is typically faster than scheduling an in-person visit. Timing varies by item type and complexity.'
        }
      },
      {
        '@type': 'Question',
        name: 'What should I prepare before requesting an appraisal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Provide multiple photos (front, back, details, marks), dimensions, condition notes, and any history or purchase information.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I choose between local and online options?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Use the local directory for in-person options in ${cityName}, or request an online appraisal from Appraisily for speed and convenience.`
        }
      }
    ]
  });

  const flaggedAppraisers = (locationData?.appraisers ?? []).filter(appraiser =>
    isTemplatedPricing(appraiser.business?.pricing) ||
    isTemplatedExperience(appraiser.business?.yearsInBusiness) ||
    isTemplatedNotes(appraiser.content?.notes, appraiser.address.city) ||
    hasPlaceholderName(appraiser.name) ||
    isPlaceholderAbout(appraiser.content?.about)
  );
  const showLocationWarning = flaggedAppraisers.length > 0;

  const handleAppraiserCardClick = (appraiser: StandardizedAppraiser, placement: string) => {
    trackEvent('appraiser_card_click', {
      placement,
      appraiser_slug: appraiser.slug,
      appraiser_name: appraiser.name,
      city: appraiser.address.city,
      state: appraiser.address.state
    });
  };

  const handleLocationCtaClick = (placement: string) => {
    trackEvent('cta_click', {
      placement,
      destination: primaryCtaUrl,
      city_slug: validCitySlug
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-16">
        <h1 className="text-2xl font-bold mb-4">Loading {cityName} Antique Appraisers...</h1>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-40 bg-gray-200 rounded mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
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
          title={`Antique Appraisers in ${cityName} | Find Local Antique Appraisal Services`}
          description={`We're currently updating our list of antique appraisers in ${cityName}. Browse our directory for other locations or check back soon.`}
          schema={[generateBreadcrumbSchema()]}
          path={`/location/${validCitySlug}`}
        />
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Antique Appraisers in {cityName}</h1>
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg mb-6">
            <p className="font-medium">We're currently updating our database of antique appraisers in {cityName}.</p>
            <p className="mt-2">Please check back soon or explore other cities in our directory.</p>
          </div>
          <a href={SITE_URL} className="text-blue-600 hover:underline font-medium">
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
          generateLocationSchema(locationData, cityName, validCitySlug),
          generateBreadcrumbSchema(),
          generateLocationFaqSchema()
        ]}
        path={`/location/${validCitySlug}`}
      />

      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-lg mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-blue-700 mb-2">Searching for in-person appraisers?</p>
              <h1 className="text-3xl font-bold mb-3">Antique Appraisers in {cityName}</h1>
              <p className="text-gray-600">
                Compare local professionals in {cityName}, then choose the option that fits your timeline.
                If you want a faster path, Appraisily provides online appraisals without the appointment.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={primaryCtaUrl}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
                data-gtm-event="cta_click"
                data-gtm-placement="location_hero_primary"
                onClick={() => handleLocationCtaClick('location_hero_primary')}
              >
                Start an online appraisal
              </a>
              <a
                href="#local-appraisers"
                className="inline-flex items-center justify-center rounded-md border border-blue-200 px-5 py-3 text-blue-700 font-semibold hover:bg-blue-50 transition-colors"
                data-gtm-event="cta_click"
                data-gtm-placement="location_hero_secondary"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById('local-appraisers')?.scrollIntoView({ behavior: 'smooth' });
                  window.history.replaceState(
                    null,
                    '',
                    `${window.location.pathname}${window.location.search}#local-appraisers`
                  );
                }}
              >
                See local appraisers
              </a>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Fast turnaround</p>
              <p>Get expert insight online without waiting for an appointment.</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Trusted local options</p>
              <p>Browse verified appraisers serving {cityName} and nearby areas.</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Clear next steps</p>
              <p>Use the directory to compare, then choose local or online.</p>
            </div>
          </div>
        </div>

        {locationData?.appraisers?.length > 0 && (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold mb-2">Antique appraisal snapshot for {cityName}</h2>
            <p className="text-gray-600">
              We currently list {locationData.appraisers.length} antique appraisers in {cityName}.
              {topSpecialties.length > 0 && ` Most common specialties include ${topSpecialties.join(', ')}.`}
            </p>
          </div>
        )}

        {showLocationWarning && (
          <div className="mb-8 rounded-lg border border-yellow-300 bg-yellow-50 px-5 py-4 text-sm text-yellow-900">
            <p className="font-semibold mb-1">We&rsquo;re still polishing a few profiles in this city.</p>
            <p>
              {flaggedAppraisers.length} of {locationData.appraisers.length} listings still use templated copy for pricing or experience.
              We&rsquo;re working with our research team to swap in verified details. If you spot something off, let us know at{' '}
              <a className="underline" href="mailto:info@appraisily.com">
                info@appraisily.com
              </a>
              .
            </p>
          </div>
        )}

        <div className="mb-10 rounded-lg border border-blue-100 bg-blue-50/60 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold mb-2">Online vs. in-person appraisal in {cityName}</h2>
              <p className="text-gray-600">
                Many people searching for an in-person appraisal prefer the speed and convenience of online reviews.
                Use the comparison below to decide what fits your situation.
              </p>
            </div>
            <a
              href={primaryCtaUrl}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
              data-gtm-event="cta_click"
              data-gtm-placement="location_comparison"
              onClick={() => handleLocationCtaClick('location_comparison')}
            >
              Get an online appraisal
            </a>
          </div>
          <div className="mt-6 overflow-hidden rounded-lg border border-blue-100 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 text-sm">
              <div className="border-b md:border-b-0 md:border-r border-blue-100 p-4">
                <p className="font-semibold text-gray-900 mb-2">Local in-person</p>
                <ul className="space-y-2 text-gray-600">
                  <li>Schedule a visit and meet on site</li>
                  <li>Ideal for large collections or complex items</li>
                  <li>Timing depends on local availability</li>
                </ul>
              </div>
              <div className="p-4">
                <p className="font-semibold text-gray-900 mb-2">Appraisily online</p>
                <ul className="space-y-2 text-gray-600">
                  <li>No appointment required</li>
                  <li>Submit photos and details from anywhere</li>
                  <li>Faster turnaround for most items</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div id="local-appraisers" className="mb-6">
          <h2 className="text-2xl font-semibold">Local antique appraisers in {cityName}</h2>
          <p className="text-gray-600 mt-2">
            Use this list to contact in-person providers or compare them with Appraisily&rsquo;s online option.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locationData.appraisers.map(appraiser => (
            <div
              key={appraiser.id}
              className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <a
                href={buildSiteUrl(`/appraiser/${appraiser.slug}`)}
                className="block"
                data-gtm-event="appraiser_card_click"
                data-gtm-appraiser={appraiser.slug}
                data-gtm-placement="location_results"
                onClick={() => handleAppraiserCardClick(appraiser, 'location_results')}
              >
                <div className="h-48 bg-gray-200 overflow-hidden">
                  <img
                    src={normalizeAssetUrl(appraiser.imageUrl)}
                    alt={`${appraiser.name} - Antique Appraiser in ${appraiser.address.city}`}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = DEFAULT_PLACEHOLDER_IMAGE;
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

                  {appraiser.business.reviewCount > 0 && appraiser.business.rating > 0 ? (
                    <div className="flex items-center mb-3">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="ml-1 text-gray-700">{appraiser.business.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-sm text-gray-500 ml-2">
                        ({appraiser.business.reviewCount} reviews)
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mb-3">Reviews not available</div>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex flex-wrap gap-1">
                      {appraiser.expertise.specialties.slice(0, 3).map((specialty) => (
                        <span
                          key={specialty}
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
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
            <p className="text-gray-600">No antique appraisers found in {cityName} yet. Check back soon!</p>
          </div>
        )}

        <div className="mt-12 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Need an appraisal without the wait?</h2>
          <p className="text-gray-600 mb-4">
            Appraisily delivers expert online valuations backed by research and market data. Start online, then decide if you still
            need an in-person visit.
          </p>
          <a
            href={primaryCtaUrl}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            data-gtm-event="cta_click"
            data-gtm-placement="location_footer"
            onClick={() => handleLocationCtaClick('location_footer')}
          >
            Request an online appraisal
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>

        <div className="mt-10 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-semibold mb-4">FAQ for {cityName} appraisals</h2>
          <div className="space-y-4 text-gray-600">
            <div>
              <p className="font-semibold text-gray-900">Do you offer in-person appraisals in {cityName}?</p>
              <p>
                Appraisily focuses on online appraisals. Use the local directory to contact in-person providers, or get a fast
                online alternative with Appraisily.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">How does an online appraisal work?</p>
              <p>Share photos, measurements, and any provenance. Our experts review the item and deliver a written valuation.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">What should I prepare before requesting an appraisal?</p>
              <p>Multiple photos, condition notes, dimensions, and any labels, signatures, or purchase history help the most.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Can I still use a local appraiser?</p>
              <p>Yes. Start with the directory above if you want in-person services in {cityName}.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
