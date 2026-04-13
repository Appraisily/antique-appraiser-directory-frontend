/* eslint-disable @typescript-eslint/no-explicit-any */

import { capturePosthogEvent } from '../lib/posthog';
import { getClickIdsFromRuntime } from './startAttribution';

const isBrowser = typeof window !== 'undefined';
const CONTROL_PLANE_ENDPOINT = 'https://appraisily.com/api/public/analytics/collect';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const APP_ID = 'antique_appraiser_directory_frontend';
const SURFACE_ID = 'antique_appraiser_directory';

type DataLayerEvent = Record<string, any>;
type RuntimeEnv = Partial<Record<string, unknown>> & {
  ANALYTICS_CONTROL_PLANE_URL?: string;
  VITE_ANALYTICS_CONTROL_PLANE_URL?: string;
  PUBLIC_ANALYTICS_CONTROL_PLANE_URL?: string;
};

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
    dataLayer?: DataLayerEvent[];
  }
}

function firstNonEmpty(source: RuntimeEnv | undefined, keys: string[]): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function readRuntimeEnv(): RuntimeEnv | undefined {
  if (!isBrowser) return undefined;
  return window.__ENV__;
}

function getControlPlaneEndpoint(): string {
  return (
    firstNonEmpty(readRuntimeEnv(), [
      'ANALYTICS_CONTROL_PLANE_URL',
      'VITE_ANALYTICS_CONTROL_PLANE_URL',
      'PUBLIC_ANALYTICS_CONTROL_PLANE_URL',
    ]) || CONTROL_PLANE_ENDPOINT
  );
}

function getPagePath(): string {
  if (!isBrowser) return '/';
  return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
}

function getTrafficContext(): Record<string, string> {
  if (!isBrowser) return {};

  const traffic: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search || '');

  for (const key of UTM_KEYS) {
    const value = sanitizeString(params.get(key), 200);
    if (value) {
      traffic[key] = value;
    }
  }

  const clickIds = getClickIdsFromRuntime();
  for (const [key, value] of Object.entries(clickIds)) {
    const safeValue = sanitizeString(value, 128);
    if (safeValue) {
      traffic[key] = safeValue;
    }
  }

  const landingPage = sanitizeString(window.location.href, 4096);
  if (landingPage) {
    traffic.landing_page = landingPage;
  }

  const referrer = sanitizeString(document.referrer, 2048);
  if (referrer) {
    traffic.referrer = referrer;
  }

  return traffic;
}

function sendControlPlaneEvent(event: string, params: Record<string, any> = {}) {
  if (!isBrowser || !event.trim()) {
    return;
  }

  const pageContext = derivePageContext(window.location.pathname || '/');
  const payload = {
    event,
    occurred_at: new Date().toISOString(),
    routing_version: 'control-plane-v1',
    source: {
      app: APP_ID,
      surface: SURFACE_ID,
      page_path: getPagePath(),
      page_key: pageContext.pageCategory,
    },
    traffic: getTrafficContext(),
    payload: {
      page_location: window.location.href,
      page_title: document.title,
      page_path: getPagePath(),
      ...params,
    },
  };

  try {
    void fetch(getControlPlaneEndpoint(), {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

export function pushToDataLayer(payload: DataLayerEvent) {
  if (!isBrowser) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);

  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  if (!eventName) {
    return;
  }

  const rest = { ...payload };
  delete rest.event;
  sendControlPlaneEvent(eventName, rest);
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
