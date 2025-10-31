import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  DEFAULT_OG_IMAGE,
  SITE_FAVICON,
  SITE_NAME,
  SITE_TWITTER_HANDLE,
  SITE_URL,
  SITE_DESCRIPTION,
  GOOGLE_SITE_VERIFICATION
} from '../config/site';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  schema?: Record<string, unknown> | Record<string, unknown>[];
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  alternateLanguages?: { lang: string; url: string }[];
  noIndex?: boolean;
  noFollow?: boolean;
  pageUrl?: string;
  ogLocale?: string;
  path?: string;
  articleCategory?: string; 
  articleTags?: string[];
  videoUrl?: string;
  preload?: Array<{ as: string; href: string; type?: string; crossorigin?: boolean }>;
  preconnect?: string[];
  dnsPrefetch?: string[];
}

export function SEO({ 
  title, 
  description, 
  keywords, 
  schema, 
  canonicalUrl,
  ogImage = 'https://ik.imagekit.io/appraisily/appraisily-og-image.jpg',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  author = 'Appraisily',
  publishedDate,
  modifiedDate,
  alternateLanguages,
  noIndex = false,
  noFollow = false,
  pageUrl,
  ogLocale = 'en_US',
  path,
  articleCategory,
  articleTags,
  videoUrl,
  preload = [],
  preconnect = ['https://ik.imagekit.io', 'https://fonts.googleapis.com', 'https://www.googletagmanager.com'],
  dnsPrefetch = ['https://ik.imagekit.io', 'https://www.google-analytics.com', 'https://fonts.gstatic.com']
}: SEOProps) {
  const finalKeywords = keywords ?? [
    'antique appraiser near me',
    'antique appraisers',
    'antique valuation',
    'antique evaluation',
    'antique price guide',
    'antique authentication',
    'antique expert',
    'find antique appraiser',
    'antique appraisal services'
  ];

  const metaRobots = [];
  if (noIndex) metaRobots.push('noindex');
  if (noFollow) metaRobots.push('nofollow');

  const buildAbsoluteUrl = (inputPath: string) => {
    try {
      if (inputPath.startsWith('http://') || inputPath.startsWith('https://')) {
        return inputPath;
      }
      return new URL(inputPath.replace(/^\//, ''), SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`).toString();
    } catch (error) {
      console.error('Invalid URL supplied to SEO component:', inputPath, error);
      return SITE_URL;
    }
  };

  const canonical = canonicalUrl
    ? buildAbsoluteUrl(canonicalUrl)
    : path
      ? buildAbsoluteUrl(path)
      : SITE_URL;

  const effectiveUrl = pageUrl ? buildAbsoluteUrl(pageUrl) : canonical;
  const ogImageUrl = ogImage ?? DEFAULT_OG_IMAGE;
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={finalKeywords.join(', ')} />
      {metaRobots.length > 0 && <meta name="robots" content={metaRobots.join(', ')} />}
      {author && <meta name="author" content={author} />}
      {SITE_FAVICON && (
        <>
          <link rel="icon" type="image/png" href={SITE_FAVICON} />
          <link rel="shortcut icon" href={SITE_FAVICON} />
          <link rel="apple-touch-icon" href={SITE_FAVICON} />
        </>
      )}
      
      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Schema.org markup */}
      {schema && Array.isArray(schema) ? schema.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      )) : schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {effectiveUrl && <meta property="og:url" content={effectiveUrl} />}
      {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
      {ogImageUrl && <meta property="og:image:width" content="1200" />}
      {ogImageUrl && <meta property="og:image:height" content="630" />}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={ogLocale} />
      {publishedDate && <meta property="article:published_time" content={publishedDate} />}
      {modifiedDate && <meta property="article:modified_time" content={modifiedDate} />}
      {articleCategory && <meta property="article:section" content={articleCategory} />}
      {articleTags && articleTags.map((tag, index) => (
        <meta key={`article:tag:${index}`} property="article:tag" content={tag} />
      ))}
      
      {/* Video meta tags if video exists */}
      {videoUrl && (
        <>
          <meta property="og:video" content={videoUrl} />
          <meta property="og:video:type" content="video/mp4" />
          <meta property="og:video:width" content="1280" />
          <meta property="og:video:height" content="720" />
        </>
      )}
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      <meta name="twitter:site" content={SITE_TWITTER_HANDLE} />
      {author && <meta name="twitter:creator" content={SITE_TWITTER_HANDLE} />}
      
      {/* Alternate Languages */}
      {alternateLanguages?.map((altLang) => (
        <link 
          key={altLang.lang} 
          rel="alternate" 
          hrefLang={altLang.lang} 
          href={altLang.url} 
        />
      ))}
      
      {/* Add x-default for international SEO */}
      {alternateLanguages && alternateLanguages.length > 0 && effectiveUrl && (
        <link rel="alternate" href={effectiveUrl} hrefLang="x-default" />
      )}
      
      {/* Mobile Optimization */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      <meta name="theme-color" content="#1a56db" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Appraisily - Antique Appraisers" />
      
      {/* Resource hints for performance */}
      {preconnect.map(url => (
        <link key={`preconnect-${url}`} rel="preconnect" href={url} crossOrigin="anonymous" />
      ))}
      
      {dnsPrefetch.map(url => (
        <link key={`dns-prefetch-${url}`} rel="dns-prefetch" href={url} />
      ))}
      
      {preload.map((resource, index) => (
        <link 
          key={`preload-${index}`} 
          rel="preload" 
          as={resource.as} 
          href={resource.href}
          {...(resource.type ? { type: resource.type } : {})}
          {...(resource.crossorigin ? { crossOrigin: "anonymous" } : {})}
        />
      ))}
      
      {/* Verification tags */}
      {GOOGLE_SITE_VERIFICATION && (
        <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />
      )}
      
      {/* Additional SEO Tags */}
      <meta name="format-detection" content="telephone=no" />
      
      {/* Basic security headers */}
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      
      {/* Geo tags for local SEO */}
      <meta name="geo.region" content="US" />
      <meta name="geo.position" content="39.8283;-98.5795" />
      <meta name="ICBM" content="39.8283, -98.5795" />
      
      {/* SEO Keywords for Antique Appraisers */}
      <meta name="subject" content={SITE_NAME} />
      <meta name="topic" content={SITE_DESCRIPTION} />
      <meta name="classification" content="Antique Appraisal" />
      
      {/* Locality-specific meta tags */}
      {pageUrl && pageUrl.includes('/location/') && (
        <>
          <meta name="directory" content="submission" />
          <meta name="target" content="Antique Appraisers in a Specific Location" />
          <meta name="HandheldFriendly" content="True" />
        </>
      )}
    </Helmet>
  );
}
