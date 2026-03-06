const ATTRIB_COOKIE = 'appraisily_attrib';
const ATTRIB_RETENTION_DAYS = 90;
const COOKIE_MAX_AGE_SECONDS = ATTRIB_RETENTION_DAYS * 24 * 60 * 60;

const CLICK_ID_KEYS = ['gclid', 'wbraid', 'gbraid', 'fbclid', 'twclid', 'msclkid', 'ttclid'] as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

type ClickIdKey = typeof CLICK_ID_KEYS[number];
type UtmKey = typeof UTM_KEYS[number];

type ClickIdMap = Partial<Record<ClickIdKey, string>>;
type UtmMap = Partial<Record<UtmKey, string>>;
type AttribCookiePayload = {
  v: 1;
  clickIds?: ClickIdMap;
  utm?: UtmMap;
  referrer?: string;
  landingPage?: string;
  landing_page?: string;
};

type TrafficContext = {
  referrer?: string;
  landingPage?: string;
  landing_page?: string;
};

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

function toBase64Url(input: string): string {
  const b64 = btoa(input);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): string | null {
  if (!input) return null;
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  try {
    return atob(padded);
  } catch {
    return null;
  }
}

function sanitizeClickIds(input: Record<string, unknown> | null | undefined): ClickIdMap {
  if (!input || typeof input !== 'object') return {};
  const out: ClickIdMap = {};
  for (const key of CLICK_ID_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim().slice(0, 128);
    }
  }
  return out;
}

function sanitizeUtm(input: Record<string, unknown> | null | undefined): UtmMap {
  if (!input || typeof input !== 'object') return {};
  const out: UtmMap = {};
  for (const key of UTM_KEYS) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function parseCookiePayload(raw: string | null): AttribCookiePayload {
  if (!raw) return { v: 1 };

  const parseCandidate = (candidate: string): AttribCookiePayload | null => {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const clickSource =
        parsed?.clickIds && typeof parsed.clickIds === 'object'
          ? (parsed.clickIds as Record<string, unknown>)
          : parsed;
      const utmSource =
        parsed?.utm && typeof parsed.utm === 'object'
          ? (parsed.utm as Record<string, unknown>)
          : parsed;
      return {
        v: 1,
        clickIds: sanitizeClickIds(clickSource),
        utm: sanitizeUtm(utmSource),
        referrer: sanitizeString(parsed?.referrer, 2048),
        landingPage:
          sanitizeString(parsed?.landingPage, 4096) ||
          sanitizeString(parsed?.landing_page, 4096),
        landing_page:
          sanitizeString(parsed?.landing_page, 4096) ||
          sanitizeString(parsed?.landingPage, 4096),
      };
    } catch {
      return null;
    }
  };

  const direct = parseCandidate(raw);
  if (direct) return direct;

  const decoded = fromBase64Url(raw);
  if (!decoded) return { v: 1 };
  return parseCandidate(decoded) || { v: 1 };
}

function getCookieDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const host = String(window.location?.hostname || '').toLowerCase();
  if (!host) return null;
  if (host === 'appraisily.com' || host.endsWith('.appraisily.com')) return '.appraisily.com';
  return null;
}

function writeAttribCookie(payload: AttribCookiePayload): void {
  if (typeof document === 'undefined') return;
  const domain = getCookieDomain();
  const encoded = toBase64Url(JSON.stringify(payload));
  const parts = [
    `${ATTRIB_COOKIE}=${encoded}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

function getAttribPayloadFromCookie(): AttribCookiePayload {
  return parseCookiePayload(readCookie(ATTRIB_COOKIE));
}

function getTrafficContextFromCookie(): TrafficContext {
  const payload = getAttribPayloadFromCookie();
  const landingPage = payload.landingPage || payload.landing_page;
  return {
    ...(payload.referrer ? { referrer: payload.referrer } : {}),
    ...(landingPage ? { landingPage, landing_page: landingPage } : {}),
  };
}

export function getClickIdsFromCookie(): ClickIdMap {
  return getAttribPayloadFromCookie().clickIds || {};
}

function getUtmFromCookie(): UtmMap {
  return getAttribPayloadFromCookie().utm || {};
}

export function getClickIdsFromCurrentQuery(): ClickIdMap {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: ClickIdMap = {};
  for (const key of CLICK_ID_KEYS) {
    const value = params.get(key);
    if (value && value.trim()) out[key] = value.trim().slice(0, 128);
  }
  return out;
}

function getUtmFromCurrentQuery(): UtmMap {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: UtmMap = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value && value.trim()) out[key] = value.trim();
  }
  return out;
}

export function getClickIdsFromRuntime(): ClickIdMap {
  return {
    ...getClickIdsFromCookie(),
    ...getClickIdsFromCurrentQuery(),
  };
}

function getUtmFromRuntime(): UtmMap {
  return {
    ...getUtmFromCookie(),
    ...getUtmFromCurrentQuery(),
  };
}

export function captureAttributionFromQueryToCookie(): void {
  if (typeof window === 'undefined') return;
  const existingContext = getTrafficContextFromCookie();
  const mergedClickIds = {
    ...getClickIdsFromCookie(),
    ...getClickIdsFromCurrentQuery(),
  };
  const mergedUtm = {
    ...getUtmFromCookie(),
    ...getUtmFromCurrentQuery(),
  };
  const referrer =
    existingContext.referrer ||
    sanitizeString(typeof document !== 'undefined' ? document.referrer : '', 2048);
  const landingPage =
    existingContext.landingPage ||
    sanitizeString(window.location.href, 4096);
  if (
    !Object.keys(mergedClickIds).length &&
    !Object.keys(mergedUtm).length &&
    !referrer &&
    !landingPage
  ) {
    return;
  }
  writeAttribCookie({
    v: 1,
    ...(Object.keys(mergedClickIds).length ? { clickIds: mergedClickIds } : {}),
    ...(Object.keys(mergedUtm).length ? { utm: mergedUtm } : {}),
    ...(referrer ? { referrer } : {}),
    ...(landingPage ? { landingPage, landing_page: landingPage } : {}),
  });
}

export function appendStartAttributionParams(url: URL): URL {
  const next = new URL(url.toString());

  const clickIds = getClickIdsFromRuntime();
  for (const key of CLICK_ID_KEYS) {
    const value = clickIds[key];
    if (value && !next.searchParams.has(key)) {
      next.searchParams.set(key, value);
    }
  }

  const utm = getUtmFromRuntime();
  for (const key of UTM_KEYS) {
    const value = utm[key];
    if (value && !next.searchParams.has(key)) {
      next.searchParams.set(key, value);
    }
  }

  return next;
}
