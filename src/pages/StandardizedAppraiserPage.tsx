import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Star, Mail, Phone, Globe, Clock, ChevronRight, Shield } from 'lucide-react';
import { getPublishedStandardizedAppraiser, StandardizedAppraiser } from '../utils/standardizedData';
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
import { normalizeAssetUrl } from '../utils/assetUrls';

const buildTelHref = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;
  return `tel:${hasPlus ? '+' : ''}${digits}`;
};

const buildMailtoHref = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `mailto:${trimmed}`;
};

const hideTinyPlaceholderImage = (target: HTMLImageElement) => {
  if (target.naturalWidth > 1 || target.naturalHeight > 1) {
    return;
  }

  const imageCard = target.closest('[data-appraiser-image-card]');
  if (imageCard instanceof HTMLElement) {
    imageCard.hidden = true;
  }
};

export function StandardizedAppraiserPage() {
  const { appraiserId } = useParams<{ appraiserId: string }>();
  const [appraiser, setAppraiser] = useState<StandardizedAppraiser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactFeedback, setContactFeedback] = useState<{ message: string; placement: string } | null>(null);
  const contactFeedbackTimeoutRef = useRef<number | null>(null);
  const primaryCtaUrl = getPrimaryCtaUrl();
  const showContactFeedback = (message: string, placement: string) => {
    setContactFeedback({ message, placement });
    if (contactFeedbackTimeoutRef.current && typeof window !== 'undefined') {
      window.clearTimeout(contactFeedbackTimeoutRef.current);
    }
    if (typeof window !== 'undefined') {
      contactFeedbackTimeoutRef.current = window.setTimeout(() => {
        setContactFeedback(null);
      }, 2500);
    }
  };
  const isLikelyDesktop = () => {
    if (typeof window === 'undefined') return false;
    if (!window.matchMedia) return false;
    return window.matchMedia('(pointer: fine)').matches;
  };

  const handleContactClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    channel: 'phone' | 'email' | 'website',
    placement: string
  ) => {
    trackEvent('appraiser_contact_click', {
      channel,
      placement,
      appraiser_slug: appraiser?.slug || appraiserId || '',
      appraiser_name: appraiser?.name
    });
    if (!appraiser) {
      return;
    }
    const fallbackMessage =
      channel === 'website'
        ? 'Opening website...'
        : channel === 'phone'
        ? 'Opening phone dialer...'
        : 'Opening email...';

    // On desktop: prevent tel:/mailto: navigation and copy to clipboard instead
    // On mobile: let the native tel:/mailto: handler work naturally (no clipboard race)
    if (channel === 'phone' || channel === 'email') {
      if (isLikelyDesktop()) {
        event.preventDefault();
        event.stopPropagation();
        const value = channel === 'phone' ? appraiser.contact.phone : appraiser.contact.email;
        if (value && navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(value)
            .then(() => {
              showContactFeedback(
                `${channel === 'phone' ? 'Phone number' : 'Email'} copied to clipboard.`,
                placement
              );
            })
            .catch(() => {
              showContactFeedback(fallbackMessage, placement);
            });
          return;
        }
        showContactFeedback(fallbackMessage, placement);
      }
      // On mobile: do nothing extra — let the browser handle tel:/mailto: natively
      return;
    }

    showContactFeedback(fallbackMessage, placement);
  };

  const handleCtaClick = (placement: string) => {
    trackEvent('cta_click', {
      placement,
      destination: primaryCtaUrl,
      appraiser_slug: appraiser?.slug || appraiserId || ''
    });
  };

  const handleReviewsJump = () => {
    trackEvent('reviews_jump_click', {
      placement: 'profile_rating',
      appraiser_slug: appraiser?.slug || appraiserId || '',
      appraiser_name: appraiser?.name
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
        const data = await getPublishedStandardizedAppraiser(appraiserId);
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

  useEffect(() => {
    return () => {
      if (contactFeedbackTimeoutRef.current && typeof window !== 'undefined') {
        window.clearTimeout(contactFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const phoneHref = appraiser ? buildTelHref(appraiser.contact.phone) : null;
  const emailHref = appraiser ? buildMailtoHref(appraiser.contact.email) : null;
  const hasContactEmail = Boolean(emailHref);
  const hasDirectContact = Boolean(
    phoneHref || emailHref || appraiser?.contact.website
  );
  const hasBusinessHours = appraiser ? appraiser.business.hours.length > 0 : false;
  const hasCertifications = appraiser ? appraiser.expertise.certifications.length > 0 : false;
  const hasPublishedLocation = Boolean(appraiser?.address.city || appraiser?.address.state);
  const hasPublishedAddress = Boolean(
    appraiser?.publication.claimScope.includes('primary_location') &&
    appraiser.address.formatted
  );
  const hasPublishedReviews = Boolean(
    appraiser &&
    appraiser.business.reviewCount > 0 &&
    appraiser.business.rating > 0
  );

  const generateBreadcrumbSchema = () => {
    if (!appraiser) return null;
    
    const citySlug = appraiser.serviceArea?.slug
      || appraiser.address.city.toLowerCase().replace(/\s+/g, '-');
    const middleCrumb = appraiser.address.city
      ? [{
          "@type": "ListItem",
          "position": 2,
          "name": `Antique Appraisers in ${appraiser.address.city}`,
          "item": buildSiteUrl(`/location/${citySlug}`)
        }]
      : [];

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
        ...middleCrumb,
        {
          "@type": "ListItem",
          "position": middleCrumb.length + 2,
          "name": appraiser.name,
          "item": buildSiteUrl(`/appraiser/${appraiser.slug}`)
        }
      ]
    };
  };

  const generateAppraiserSchema = () => {
    if (!appraiser) return null;

    const hasAggregateRating = hasPublishedReviews;
    const address = hasPublishedAddress
      ? {
          "@type": "PostalAddress",
          ...(appraiser.address.street ? { "streetAddress": appraiser.address.street } : {}),
          ...(appraiser.address.city ? { "addressLocality": appraiser.address.city } : {}),
          ...(appraiser.address.state ? { "addressRegion": appraiser.address.state } : {}),
          ...(appraiser.address.zip ? { "postalCode": appraiser.address.zip } : {}),
          ...(appraiser.serviceArea?.country ? { "addressCountry": appraiser.serviceArea.country } : {})
        }
      : undefined;

    return {
      "@context": "https://schema.org",
      "@type": appraiser.publication.status === 'verified' ? "ProfessionalService" : "Organization",
      "name": appraiser.name,
      ...(appraiser.imageUrl ? { "image": appraiser.imageUrl } : {}),
      "description": appraiser.content.about,
      "url": buildSiteUrl(`/appraiser/${appraiser.slug}`),
      ...(address ? { address } : {}),
      ...(appraiser.contact.website ? { sameAs: appraiser.contact.website } : {}),
      ...(appraiser.contact.phone ? { telephone: appraiser.contact.phone } : {}),
      ...(appraiser.contact.email ? { email: appraiser.contact.email } : {}),
      ...(appraiser.business.pricing ? { priceRange: appraiser.business.pricing } : {}),
      ...(hasBusinessHours
        ? { openingHours: appraiser.business.hours.map(h => `${h.day} ${h.hours}`).join(', ') }
        : {}),
      ...(hasAggregateRating
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              "ratingValue": appraiser.business.rating.toString(),
              "reviewCount": appraiser.business.reviewCount.toString(),
              "bestRating": "5",
              "worstRating": "1"
            },
            review: appraiser.reviews.map(review => ({
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
          }
        : {})
    };
  };

  const generateFAQSchema = () => {
    if (!appraiser) return null;
    const questions: Record<string, unknown>[] = [];
    if (appraiser.expertise.services.length > 0) {
      questions.push({
        "@type": "Question",
        "name": `What services does ${appraiser.name} offer?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": appraiser.expertise.services.join(', ')
        }
      });
    }
    if (appraiser.expertise.specialties.length > 0) {
      questions.push({
        "@type": "Question",
        "name": `What are ${appraiser.name}'s specialties?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": appraiser.expertise.specialties.join(', ')
        }
      });
    }
    const contactOptions = [
      appraiser.contact.phone ? `phone at ${appraiser.contact.phone}` : '',
      appraiser.contact.email ? `email at ${appraiser.contact.email}` : '',
      appraiser.contact.website ? 'the official website' : ''
    ].filter(Boolean);
    if (contactOptions.length > 0) {
      questions.push({
        "@type": "Question",
        "name": `How can I contact ${appraiser.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Contact ${appraiser.name} through ${contactOptions.join(' or ')}.`
        }
      });
    }
    if (questions.length === 0) return null;

    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": questions
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
          path={`/appraiser/${appraiserId || 'not-found'}`}
          noIndex
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
          <span className="mx-3 text-gray-400">|</span>
          <a
            href={`https://appraisily.com/contact?source=directory_listing&provider=${encodeURIComponent(appraiserId || 'unknown')}`}
            className="text-blue-600 hover:underline font-medium"
            data-provider-correction-link="true"
          >
            Report or correct this listing
          </a>
        </div>
      </div>
    );
  }

  const localityLabel = [appraiser.address.city, appraiser.address.state].filter(Boolean).join(', ');
  const seoTitle = appraiser.seo.title
    || `${appraiser.name}${localityLabel ? ` - Antique Appraiser in ${localityLabel}` : ' - Antique Appraiser Directory'}`;
  const seoDescription = appraiser.seo.description
    || `${appraiser.name} directory listing${localityLabel ? ` for ${localityLabel}` : ''}. Confirm current services and qualifications directly with the provider.`;
  const citySlug = appraiser.serviceArea?.slug
    || appraiser.address.city.toLowerCase().replace(/\s+/g, '-');
  const fallbackAbout = (() => {
    const parts = [
      `${appraiser.name} has a directory listing${localityLabel ? ` for ${localityLabel}` : ''}.`
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
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        ogImage={appraiser.imageUrl}
        schema={[
          generateAppraiserSchema(),
          generateBreadcrumbSchema(),
          generateFAQSchema()
        ].filter((schema): schema is Record<string, unknown> => Boolean(schema))}
        canonicalUrl={appraiser.seo.canonical || undefined}
        path={`/appraiser/${appraiser.slug}`}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:text-blue-700"
      >
        Skip to main content
      </a>
      <div className="container mx-auto px-4 py-8 mt-16">
        <div id="main-content">
          <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          <li>
          <a href={SITE_URL} className="text-gray-500 hover:text-gray-700">Home</a>
          </li>
          {appraiser.address.city && (
            <li className="flex items-center">
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <a
                href={buildSiteUrl(`/location/${citySlug}`)}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                {appraiser.address.city}
              </a>
            </li>
          )}
          <li className="flex items-center">
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="ml-2 text-gray-900 font-medium">{appraiser.name}</span>
          </li>
        </ol>
      </nav>
      <div
        className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-gray-700"
        data-provider-publication-status={appraiser.publication.status}
      >
        <p className="font-semibold text-gray-900">
          {appraiser.publication.status === 'verified'
            ? 'Source-reviewed directory listing'
            : 'Limited directory listing'}
        </p>
        <p className="mt-1">
          {appraiser.publication.status === 'verified'
            ? 'The facts shown here are limited to the approved public profile record.'
            : 'Confirm provider details on the official website before engagement.'}
        </p>
        {appraiser.publication.sourceChecked && (
          <p className="mt-2 text-xs text-gray-600">
            Source checked {appraiser.publication.sourceChecked}. A source check is not a credential verification or endorsement.
          </p>
        )}
        <a
          href={`https://appraisily.com/contact?source=directory_listing&provider=${encodeURIComponent(appraiser.slug)}`}
          className="mt-2 inline-flex font-medium text-blue-700 hover:underline"
          data-provider-correction-link="true"
        >
          Report or correct this listing
        </a>
      </div>
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
          <div className="rounded-lg overflow-hidden shadow-md mb-6 relative bg-primary/5" data-appraiser-image-card>
            <div className="flex aspect-[4/3] items-center justify-center" aria-hidden="true">
              <span className="font-serif text-7xl font-semibold text-primary/40 select-none">
                {appraiser.name.charAt(0)}
              </span>
            </div>
            {appraiser.imageUrl && !appraiser.imageUrl.includes('placeholder') && (
              <img
                src={normalizeAssetUrl(appraiser.imageUrl)}
                alt={`${appraiser.name}${appraiser.address.city ? ` - Antique Appraiser in ${appraiser.address.city}` : ''}`}
                className="absolute inset-0 h-full w-full object-cover"
                onLoad={(e) => {
                  hideTinyPlaceholderImage(e.currentTarget);
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
          
          {hasDirectContact && (
          <div className="bg-white rounded-lg shadow-md p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {phoneHref || emailHref ? 'Contact Information' : 'Official website'}
            </h3>
            
            <div className="space-y-3">
              {hasPublishedAddress && (
              <div className="flex items-start">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appraiser.address.formatted)}`}
                  className="flex w-full items-start text-gray-700 hover:text-blue-600"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                  <span>{appraiser.address.formatted}</span>
                </a>
              </div>
              )}

              {phoneHref && (
                <div className="flex items-center">
                  <a
                    href={phoneHref}
                    className="flex w-full items-center text-gray-700 hover:text-blue-600"
                    data-gtm-event="directory_cta"
                    data-gtm-cta="call"
                    data-gtm-surface="profile_contact_info"
                    data-gtm-appraiser-id={gtmAppraiserId}
                    data-gtm-appraiser-name={gtmAppraiserName}
                    onClick={(event) => handleContactClick(event, 'phone', 'profile_contact_info')}
                  >
                    <Phone className="h-5 w-5 text-blue-600 mr-3" />
                    <span>{appraiser.contact.phone}</span>
                  </a>
                </div>
              )}

              {hasContactEmail && (
                <div className="flex items-center">
                  <a
                    href={emailHref}
                    className="flex w-full items-center text-gray-700 hover:text-blue-600"
                    data-gtm-event="directory_cta"
                    data-gtm-cta="email"
                    data-gtm-surface="profile_contact_info"
                    data-gtm-appraiser-id={gtmAppraiserId}
                    data-gtm-appraiser-name={gtmAppraiserName}
                    onClick={(event) => handleContactClick(event, 'email', 'profile_contact_info')}
                  >
                    <Mail className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="break-all">{appraiser.contact.email}</span>
                  </a>
                </div>
              )}

              {appraiser.contact.website && (
                <div className="flex items-center">
                  <a
                    href={appraiser.contact.website.startsWith('http') ? appraiser.contact.website : `https://${appraiser.contact.website}`}
                    className="flex w-full items-center text-gray-700 hover:text-blue-600"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-gtm-event="directory_cta"
                    data-gtm-cta="website"
                    data-gtm-surface="profile_contact_info"
                    data-gtm-appraiser-id={gtmAppraiserId}
                    data-gtm-appraiser-name={gtmAppraiserName}
                    onClick={(event) => handleContactClick(event, 'website', 'profile_contact_info')}
                  >
                    <Globe className="h-5 w-5 text-blue-600 mr-3" />
                    <span>Visit Website</span>
                  </a>
                </div>
              )}
            </div>
            {contactFeedback?.placement === 'profile_contact_info' && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 font-medium animate-pulse" role="status" aria-live="polite">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {contactFeedback.message}
                </span>
              </div>
            )}
          </div>
          )}
          
          {hasBusinessHours && (
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
          )}
          
          <div className="bg-white rounded-lg shadow-md p-5">
            {hasCertifications && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Certifications</h3>
                <div className="space-y-2">
                  {appraiser.expertise.certifications.map((cert, index) => (
                    <div key={index} className="flex items-center">
                      <Shield className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-gray-700">{cert}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <div className={hasCertifications ? 'mt-6 pt-4 border-t border-gray-100' : ''}>
              <a
                href={primaryCtaUrl}
                className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-medium transition-all duration-300"
                data-gtm-event="directory_cta"
                data-gtm-cta="request_appraisal"
                data-gtm-surface="profile_sidebar_cta"
                data-clarity-action="profile_online_appraisal"
                data-gtm-appraiser-id={gtmAppraiserId}
                data-gtm-appraiser-name={gtmAppraiserName}
                onClick={() => handleCtaClick('profile_sidebar_cta')}
              >
                Get an online appraisal from Appraisily
              </a>
              <p className="mt-2 text-center text-xs text-gray-500">
                Opens Appraisily&rsquo;s secure online intake.
              </p>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{appraiser.name}</h1>
              
              <div className="flex items-center">
                {appraiser.business.reviewCount > 0 && appraiser.business.rating > 0 ? (
                  <a
                    href="#reviews"
                    className="flex items-center bg-blue-50 text-blue-700 rounded-full px-3 py-1 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                    onClick={handleReviewsJump}
                    aria-label="Jump to reviews"
                  >
                    <Star className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="font-semibold">{appraiser.business.rating.toFixed(1)}</span>
                    <span className="text-sm text-gray-500 ml-1">
                      ({appraiser.business.reviewCount})
                    </span>
                  </a>
                ) : null}
              </div>
            </div>
            
            {(appraiser.business.yearsInBusiness || hasPublishedLocation) && (
            <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
              {appraiser.business.yearsInBusiness && (
                <span className="inline-flex items-center">
                <Clock className="h-4 w-4 inline-block mr-2 text-gray-400" />
                {appraiser.business.yearsInBusiness}
                </span>
              )}
              {hasPublishedLocation && (
                <span className="inline-flex items-center">
                <MapPin className="h-4 w-4 inline-block mr-2 text-gray-400" />
                {localityLabel}
                </span>
              )}
            </div>
            )}
            
            <h2 className="text-xl font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-700 mb-6 leading-relaxed">
              {aboutContent}
            </p>
            
            {notesContent && (
              <div className="bg-blue-50 text-gray-700 p-4 rounded-md mb-6">
                <p>{notesContent}</p>
              </div>
            )}
            
            {appraiser.expertise.specialties.length > 0 && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Specialties</h2>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  {appraiser.expertise.specialties.join(', ')}
                </p>
              </>
            )}

            {appraiser.expertise.services.length > 0 && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Services</h2>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  {appraiser.expertise.services.join(', ')}
                </p>
              </>
            )}
            
            {pricingContent && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Pricing</h2>
                <p className="text-gray-700 mb-6">
                  {pricingContent}
                </p>
              </>
            )}
          </div>
          
          {hasPublishedReviews && appraiser.reviews.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6" id="reviews">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Reviews</h2>
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
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Need Antique Appraisal Services?</h3>
              <p className="text-gray-600 mb-4">
                {hasDirectContact
                  ? `Use the provider contact options below, or choose Appraisily for an online appraisal.`
                  : `No direct contact details are currently available for ${appraiser.name}. You can return to the city directory or choose Appraisily for an online appraisal.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {phoneHref && (
                  <a 
                    href={phoneHref}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    data-gtm-event="directory_cta"
                    data-gtm-cta="call"
                    data-gtm-surface="profile_cta_section"
                    data-gtm-appraiser-id={gtmAppraiserId}
                    data-gtm-appraiser-name={gtmAppraiserName}
                    onClick={(event) => handleContactClick(event, 'phone', 'profile_cta_section')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Now
                  </a>
                )}
                {emailHref && (
                  <a 
                    href={emailHref}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    data-gtm-event="directory_cta"
                    data-gtm-cta="email"
                    data-gtm-surface="profile_cta_section"
                    data-gtm-appraiser-id={gtmAppraiserId}
                    data-gtm-appraiser-name={gtmAppraiserName}
                    onClick={(event) => handleContactClick(event, 'email', 'profile_cta_section')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </a>
                )}
                <a 
                  href={primaryCtaUrl}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  data-gtm-event="directory_cta"
                  data-gtm-cta="request_appraisal"
                  data-gtm-surface="profile_cta_section"
                  data-clarity-action="profile_online_appraisal"
                  data-gtm-appraiser-id={gtmAppraiserId}
                  data-gtm-appraiser-name={gtmAppraiserName}
                  onClick={() => handleCtaClick('profile_cta_section')}
                >
                  Get an online appraisal from Appraisily
                </a>
                {!hasDirectContact && (
                  <a
                    href={appraiser.address.city ? buildSiteUrl(`/location/${citySlug}`) : SITE_URL}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {appraiser.address.city
                      ? `Back to ${appraiser.address.city} appraisers`
                      : 'Browse all locations'}
                  </a>
                )}
              </div>
              {contactFeedback?.placement === 'profile_cta_section' && (
                <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 font-medium animate-pulse" role="status" aria-live="polite">
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {contactFeedback.message}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
