const ATTRIB_COOKIE = 'appraisily_attrib';
const COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const CLICK_ID_KEYS = ['gclid', 'wbraid', 'gbraid', 'fbclid', 'twclid', 'msclkid', 'ttclid'] as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

type ClickIdKey = typeof CLICK_ID_KEYS[number];
type UtmKey = typeof UTM_KEYS[number];

type ClickIdMap = Partial<Record<ClickIdKey, string>>;
type UtmMap = Partial<Record<UtmKey, string>>;

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

function parseCookiePayload(raw: string | null): ClickIdMap {
  if (!raw) return {};

  // Legacy/raw JSON format
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.clickIds && typeof parsed.clickIds === 'object') {
      return sanitizeClickIds(parsed.clickIds as Record<string, unknown>);
    }
    return sanitizeClickIds(parsed);
  } catch {
    // ignore and try base64url path
  }

  // Canonical main-page format: base64url-encoded JSON with { v, clickIds }
  try {
    const decoded = fromBase64Url(raw);
    if (!decoded) return {};
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    if (parsed?.clickIds && typeof parsed.clickIds === 'object') {
      return sanitizeClickIds(parsed.clickIds as Record<string, unknown>);
    }
    return sanitizeClickIds(parsed);
  } catch {
    return {};
  }
}

function getCookieDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const host = String(window.location?.hostname || '').toLowerCase();
  if (!host) return null;
  if (host === 'appraisily.com' || host.endsWith('.appraisily.com')) return '.appraisily.com';
  return null;
}

function writeCookieClickIds(clickIds: ClickIdMap): void {
  if (typeof document === 'undefined') return;
  const domain = getCookieDomain();
  const payload = { v: 1, clickIds };
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

export function getClickIdsFromCookie(): ClickIdMap {
  return parseCookiePayload(readCookie(ATTRIB_COOKIE));
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

export function getClickIdsFromRuntime(): ClickIdMap {
  // Query ids override cookie ids for the current navigation.
  return {
    ...getClickIdsFromCookie(),
    ...getClickIdsFromCurrentQuery(),
  };
}

export function captureAttributionFromQueryToCookie(): void {
  if (typeof window === 'undefined') return;
  const fromQuery = getClickIdsFromCurrentQuery();
  if (!Object.keys(fromQuery).length) return;
  const merged = {
    ...getClickIdsFromCookie(),
    ...fromQuery,
  };
  writeCookieClickIds(merged);
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

export function appendStartAttributionParams(url: URL): URL {
  const next = new URL(url.toString());

  // Preserve click ids across cross-subdomain handoff into /start.
  const clickIds = getClickIdsFromRuntime();
  for (const key of CLICK_ID_KEYS) {
    const value = clickIds[key];
    if (value && !next.searchParams.has(key)) {
      next.searchParams.set(key, value);
    }
  }

  // Preserve term/content when present on entry URL.
  const utm = getUtmFromCurrentQuery();
  for (const key of UTM_KEYS) {
    const value = utm[key];
    if (value && !next.searchParams.has(key)) {
      next.searchParams.set(key, value);
    }
  }

  return next;
}
