import React from 'react';
import { Helmet } from 'react-helmet-async';

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
  breadcrumbItems?: { name: string; url: string }[];
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
  breadcrumbItems,
  articleCategory,
  articleTags,
  videoUrl,
  preload = [],
  preconnect = ['https://ik.imagekit.io', 'https://fonts.googleapis.com', 'https://www.googletagmanager.com'],
  dnsPrefetch = ['https://ik.imagekit.io', 'https://www.google-analytics.com', 'https://fonts.gstatic.com']
}: SEOProps) {
  const metaRobots = [];
  if (noIndex) metaRobots.push('noindex');
  if (noFollow) metaRobots.push('nofollow');

  // Calculate effective URL for meta tags
  const effectiveUrl = canonicalUrl || pageUrl || '';
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords.join(', ')} />}
      {metaRobots.length > 0 && <meta name="robots" content={metaRobots.join(', ')} />}
      {author && <meta name="author" content={author} />}
      
      {/* Canonical URL */}
      {effectiveUrl && <link rel="canonical" href={effectiveUrl} />}
      
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
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogImage && <meta property="og:image:width" content="1200" />}
      {ogImage && <meta property="og:image:height" content="630" />}
      <meta property="og:site_name" content="Appraisily" />
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
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      <meta name="twitter:site" content="@appraisily" />
      {author && <meta name="twitter:creator" content="@appraisily" />}
      
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
      <meta name="apple-mobile-web-app-title" content="Appraisily" />
      
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
      <meta name="google-site-verification" content="your-google-verification-code" />
      
      {/* Additional SEO Tags */}
      <meta name="format-detection" content="telephone=no" />
      
      {/* Basic security headers */}
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      
      {/* Geo tags for local SEO */}
      <meta name="geo.region" content="US" />
      <meta name="geo.position" content="39.8283;-98.5795" />
      <meta name="ICBM" content="39.8283, -98.5795" />
    </Helmet>
  );
}