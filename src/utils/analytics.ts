/* eslint-disable @typescript-eslint/no-explicit-any */

import { capturePosthogEvent } from '../lib/posthog';

const isBrowser = typeof window !== 'undefined';
const ATTRIB_COOKIE = 'appraisily_attrib';
const CLICK_ID_KEYS = ['gclid', 'wbraid', 'gbraid', 'fbclid', 'msclkid'];

type DataLayerEvent = Record<string, any>;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const parts = String(document.cookie || '').split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length));
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function getClickIds(): Record<string, string> {
  const raw = readCookie(ATTRIB_COOKIE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const key of CLICK_ID_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) {
        out[key] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

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
  const clickIds = getClickIds();
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
