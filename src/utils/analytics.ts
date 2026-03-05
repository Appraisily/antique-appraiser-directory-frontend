/* eslint-disable @typescript-eslint/no-explicit-any */

import { capturePosthogEvent } from '../lib/posthog';
import { getClickIdsFromRuntime } from './startAttribution';

const isBrowser = typeof window !== 'undefined';

type DataLayerEvent = Record<string, any>;

export function pushToDataLayer(payload: DataLayerEvent) {
  if (!isBrowser) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/**
 * Track an event to both GTM (dataLayer) and PostHog.
 * Ensures cross-platform funnel visibility for SEO → conversion attribution.
 * Includes click IDs (gclid, etc.) for ad attribution continuity.
 */
export function trackEvent(event: string, params: Record<string, any> = {}) {
  const clickIds = getClickIdsFromRuntime();
  const enrichedParams = {
    ...params,
    source: 'antique_directory',
    ...(Object.keys(clickIds).length ? { click_ids: clickIds } : {}),
  };

  // Push to GTM/GA4
  pushToDataLayer({
    event,
    ...enrichedParams
  });

  // Mirror to PostHog for unified funnel analysis
  capturePosthogEvent(event, enrichedParams);
}

export function derivePageContext(pathname: string) {
  const [firstSegment, secondSegment] = pathname.split('/').filter(Boolean);

  if (!firstSegment) {
    return {
      pageType: 'home',
      pageCategory: 'directory_home' as const,
      citySlug: undefined,
      appraiserSlug: undefined
    };
  }

  if (firstSegment === 'location') {
    return {
      pageType: 'location',
      pageCategory: 'directory_city' as const,
      citySlug: secondSegment,
      appraiserSlug: undefined
    };
  }

  if (firstSegment === 'appraiser') {
    return {
      pageType: 'appraiser',
      pageCategory: 'directory_profile' as const,
      citySlug: undefined,
      appraiserSlug: secondSegment
    };
  }

  return {
    pageType: 'content',
    pageCategory: 'marketing' as const,
    citySlug: undefined,
    appraiserSlug: undefined
  };
}
