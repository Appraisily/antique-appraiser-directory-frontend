/* eslint-disable @typescript-eslint/no-explicit-any */

import { getPosthogDistinctId } from '../lib/posthog';
import { getClickIdsFromRuntime } from './startAttribution';
import { getSyntheticContext, isSyntheticTelemetrySession } from './syntheticTraffic';

const isBrowser = typeof window !== 'undefined';
const CONTROL_PLANE_ENDPOINT = 'https://appraisily.com/api/public/analytics/collect';
const ANONYMOUS_ID_KEY = 'appraisily_analytics_anonymous_id';
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

function readCookie(name: string): string | undefined {
  if (!isBrowser) return undefined;
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const parts = String(document.cookie || '').split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length)).trim() || undefined;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

function writeCookie(name: string, value: string) {
  if (!isBrowser) return;
  try {
    const maxAge = 60 * 60 * 24 * 395;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; Domain=.appraisily.com; SameSite=Lax; Secure`;
  } catch {
    // ignore
  }
}

function getAnonymousId(): string | undefined {
  if (!isBrowser) return undefined;
  const cookieValue = readCookie(ANONYMOUS_ID_KEY);
  if (cookieValue) {
    try {
      window.localStorage.setItem(ANONYMOUS_ID_KEY, cookieValue);
    } catch {
      // ignore
    }
    return cookieValue;
  }

  try {
    const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing && existing.trim()) {
      const normalized = existing.trim();
      writeCookie(ANONYMOUS_ID_KEY, normalized);
      return normalized;
    }
  } catch {
    // ignore
  }

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    window.localStorage.setItem(ANONYMOUS_ID_KEY, generated);
  } catch {
    // ignore
  }
  writeCookie(ANONYMOUS_ID_KEY, generated);
  return generated;
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
  return window.location.pathname || '/';
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
  const anonymousId = getAnonymousId();
  const posthogDistinctId = getPosthogDistinctId();
  const synthetic = getSyntheticContext();
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
    identity: {
      anonymous_id: anonymousId,
      posthog_distinct_id: posthogDistinctId,
    },
    traffic: {
      ...getTrafficContext(),
      ...(synthetic.marker ? { synthetic: synthetic.marker, synthetic_family: synthetic.family } : {}),
    },
    payload: {
      page_location: new URL(getPagePath(), window.location.origin).toString(),
      page_title: document.title,
      page_path: getPagePath(),
      ...params,
      ...(synthetic.marker
        ? { qa_marker: synthetic.marker, is_synthetic: true, synthetic_family: synthetic.family }
        : {}),
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

export function trackFirstPartyEvent(event: string, params: Record<string, any> = {}) {
  sendControlPlaneEvent(event, params);
}

export function recordSurfaceArrival(params: Record<string, any> = {}) {
  const arrival = { ...params };
  delete arrival.event;
  delete arrival.page_location;
  delete arrival.page_title;
  sendControlPlaneEvent('surface_arrived', {
    ...arrival,
    arrival_owner: 'directory_route_analytics',
  });
}

export function pushToDataLayer(payload: DataLayerEvent) {
  if (!isBrowser) {
    return;
  }

  const eventName = typeof payload.event === 'string' ? payload.event.trim() : '';
  const rest = { ...payload };
  delete rest.event;
  if (eventName === 'page_view') {
    recordSurfaceArrival(rest);
  } else if (eventName) {
    sendControlPlaneEvent(eventName, rest);
  }

  if (isSyntheticTelemetrySession()) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/**
 * Record a named directory event first-party. Vendor copies are controlled by
 * the server routing contract, never by direct browser SDK calls.
 */
export function trackEvent(event: string, params: Record<string, any> = {}) {
  const clickIds = getClickIdsFromRuntime();
  const enrichedParams = {
    ...params,
    source: 'antique_directory',
    ...(Object.keys(clickIds).length ? { click_ids: clickIds } : {}),
  };

  trackFirstPartyEvent(event, enrichedParams);
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
