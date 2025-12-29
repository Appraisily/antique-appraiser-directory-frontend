import posthog from 'posthog-js';

const DEFAULT_HOST = 'https://us.i.posthog.com';
const CONSENT_COOKIE = 'cookieConsent';
const ATTRIB_COOKIE = 'appraisily_attrib';
const CLICK_ID_KEYS = ['gclid', 'wbraid', 'gbraid', 'fbclid', 'twclid', 'msclkid', 'ttclid'];

type RuntimeEnv = Partial<Record<string, unknown>> & {
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
  POSTHOG_DEBUG?: string | boolean;
  POSTHOG_AUTOCAPTURE?: string | boolean;
  POSTHOG_CAPTURE_PAGEVIEW?: string | boolean;
  POSTHOG_REPLAY_ENABLED?: string | boolean;
  POSTHOG_REPLAY_SAMPLE_RATE?: string | number;
  POSTHOG_IMPLICIT_CONSENT?: string | boolean;
};

function readRuntimeEnv(): RuntimeEnv | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __ENV__?: RuntimeEnv }).__ENV__;
}

function toBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function toNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

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
  } catch (error) {
    void error;
  }
  return null;
}

function readConsent(): 'granted' | 'declined' | 'dismissed' | undefined {
  const raw = readCookie(CONSENT_COOKIE);
  if (!raw) return undefined;
  if (raw === 'accepted') return 'granted';
  if (raw === 'declined') return 'declined';
  if (raw === 'dismissed') return 'dismissed';
  return undefined;
}

function readClickIds(): Record<string, string> {
  const raw = readCookie(ATTRIB_COOKIE);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const key of CLICK_ID_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

const runtimeEnv = readRuntimeEnv();

const apiKey =
  import.meta.env.VITE_POSTHOG_API_KEY ||
  import.meta.env.POSTHOG_API_KEY ||
  import.meta.env.VITE_POSTHOG_KEY ||
  import.meta.env.POSTHOG_KEY ||
  runtimeEnv?.POSTHOG_API_KEY;
const host =
  import.meta.env.VITE_POSTHOG_HOST ||
  import.meta.env.POSTHOG_HOST ||
  runtimeEnv?.POSTHOG_HOST ||
  DEFAULT_HOST;
const implicitConsentEnabled = toBoolean(
  import.meta.env.VITE_POSTHOG_IMPLICIT_CONSENT ??
    import.meta.env.POSTHOG_IMPLICIT_CONSENT ??
    runtimeEnv?.POSTHOG_IMPLICIT_CONSENT,
  true,
);
const replayEnabled = toBoolean(
  import.meta.env.VITE_POSTHOG_REPLAY_ENABLED ??
    import.meta.env.POSTHOG_REPLAY_ENABLED ??
    runtimeEnv?.POSTHOG_REPLAY_ENABLED,
  true
);
const replaySampleRate = Math.min(
  Math.max(
    toNumber(
      import.meta.env.VITE_POSTHOG_REPLAY_SAMPLE_RATE ??
        import.meta.env.POSTHOG_REPLAY_SAMPLE_RATE ??
        runtimeEnv?.POSTHOG_REPLAY_SAMPLE_RATE,
      1,
    ),
    0,
  ),
  1
);
const debug = toBoolean(
  import.meta.env.VITE_POSTHOG_DEBUG ?? import.meta.env.POSTHOG_DEBUG ?? runtimeEnv?.POSTHOG_DEBUG,
  false,
);
const autocapture = toBoolean(
  import.meta.env.VITE_POSTHOG_AUTOCAPTURE ?? import.meta.env.POSTHOG_AUTOCAPTURE ?? runtimeEnv?.POSTHOG_AUTOCAPTURE,
  true,
);

let initialized = false;
let replaySampledIn: boolean | null = null;

function shouldStartReplay() {
  if (!replayEnabled) return false;
  if (replaySampledIn !== null) return replaySampledIn;
  replaySampledIn = Math.random() <= replaySampleRate;
  return replaySampledIn;
}

function registerBaseProperties() {
  if (!initialized) return;
  if (!isCapturing()) return;
  try {
    const ids = readClickIds();
    const props: Record<string, unknown> = {};
    if (Object.keys(ids).length) props.click_ids = ids;
    if (typeof navigator !== 'undefined' && navigator.language) {
      props.locale_hint = navigator.language;
      const region = navigator.language.includes('-') ? navigator.language.split('-').pop() : undefined;
      if (region) props.country_hint = region.toUpperCase();
    }
    if (Object.keys(props).length) {
      posthog.register(props);
    }
  } catch (error) {
    void error;
  }
}

type PosthogCaptureState = {
  is_capturing?: () => boolean;
};

type PosthogRecordingControl = {
  startSessionRecording?: (force?: boolean) => void;
  stopSessionRecording?: () => void;
};

function isCapturing(): boolean {
  const maybe = posthog as unknown as PosthogCaptureState;
  if (typeof maybe.is_capturing !== 'function') return true;
  try {
    return Boolean(maybe.is_capturing());
  } catch (error) {
    void error;
    return true;
  }
}

function optIn(reason: string) {
  if (!initialized) return;
  posthog.opt_in_capturing({ captureEventName: false });
  registerBaseProperties();
  if (replayEnabled && shouldStartReplay()) {
    try {
      (posthog as unknown as PosthogRecordingControl).startSessionRecording?.(true);
    } catch (error) {
      void error;
    }
  }
  if (debug) {
    console.debug('[posthog] opt-in', { reason });
  }
}

function optOut(reason: string) {
  if (!initialized) return;
  posthog.opt_out_capturing({ captureEventName: false });
  try {
    (posthog as unknown as PosthogRecordingControl).stopSessionRecording?.();
  } catch (error) {
    void error;
  }
  if (debug) {
    console.debug('[posthog] opt-out', { reason });
  }
}

function applyStoredConsent(reason: string) {
  const stored = readConsent();
  if (stored === 'declined') {
    optOut('stored-decline');
    return false;
  }
  if (stored === 'granted') {
    optIn('stored-consent');
    return true;
  }
  if (implicitConsentEnabled) {
    optIn(`implicit-consent:${reason}`);
    return true;
  }
  optOut('no-consent');
  return false;
}

export function initPosthog() {
  if (initialized || typeof window === 'undefined') return;
  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.debug('[posthog] api key missing; skipping init');
    }
    return;
  }

  posthog.init(apiKey, {
    api_host: host || DEFAULT_HOST,
    autocapture,
    capture_pageview: false, // manual SPA tracking
    capture_pageleave: false,
    cross_subdomain_cookie: true,
    disable_session_recording: !replayEnabled,
    session_recording: replayEnabled
      ? {
          maskAllInputs: true,
          maskTextSelector: '.session-replay-mask, [data-ph-mask-text]',
          blockSelector: '.session-replay-block, [data-ph-block]',
        }
      : undefined,
    debug,
    opt_out_capturing_by_default: true,
    persistence: 'localStorage+cookie',
  });

  initialized = true;
  applyStoredConsent('init');
}

export function capturePosthogPageview(pathname: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  if (!isCapturing()) return;
  posthog.capture('$pageview', {
    $current_url: typeof window !== 'undefined' ? window.location.href : pathname,
    $pathname: pathname,
    $title: typeof document !== 'undefined' ? document.title : undefined,
    ...properties,
  });
}

export function capturePosthogEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  if (!isCapturing()) return;
  posthog.capture(event, properties);
}
