import posthog from 'posthog-js';

const DEFAULT_HOST = 'https://us.i.posthog.com';

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

const apiKey =
  import.meta.env.VITE_POSTHOG_API_KEY ||
  import.meta.env.POSTHOG_API_KEY ||
  import.meta.env.VITE_POSTHOG_KEY ||
  import.meta.env.POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST || import.meta.env.POSTHOG_HOST || DEFAULT_HOST;
const replayEnabled = toBoolean(
  import.meta.env.VITE_POSTHOG_REPLAY_ENABLED ?? import.meta.env.POSTHOG_REPLAY_ENABLED,
  true
);
const replaySampleRate = Math.min(
  Math.max(toNumber(import.meta.env.VITE_POSTHOG_REPLAY_SAMPLE_RATE ?? import.meta.env.POSTHOG_REPLAY_SAMPLE_RATE, 1), 0),
  1
);
const debug = toBoolean(import.meta.env.VITE_POSTHOG_DEBUG ?? import.meta.env.POSTHOG_DEBUG, false);

let initialized = false;
let replaySampledIn: boolean | null = null;

function shouldStartReplay() {
  if (!replayEnabled) return false;
  if (replaySampledIn !== null) return replaySampledIn;
  replaySampledIn = Math.random() <= replaySampleRate;
  return replaySampledIn;
}

export function initPosthog() {
  if (initialized || typeof window === 'undefined') return;
  if (!apiKey) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[posthog] api key missing; skipping init');
    }
    return;
  }

  posthog.init(apiKey, {
    api_host: host || DEFAULT_HOST,
    autocapture: true,
    capture_pageview: false, // manual SPA tracking
    capture_pageleave: false,
    disable_session_recording: !replayEnabled,
    session_recording: replayEnabled
      ? {
          maskAllInputs: true,
          maskTextSelector: '.session-replay-mask, [data-ph-mask-text]',
          blockSelector: '.session-replay-block, [data-ph-block]',
        }
      : undefined,
    debug,
    opt_out_capturing_by_default: false,
    persistence: 'localStorage+cookie',
  });

  initialized = true;

  if (replayEnabled && shouldStartReplay()) {
    posthog.startSessionRecording(true);
  }
}

export function capturePosthogPageview(pathname: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture('$pageview', {
    $current_url: typeof window !== 'undefined' ? window.location.href : pathname,
    $pathname: pathname,
    $title: typeof document !== 'undefined' ? document.title : undefined,
    ...properties,
  });
}

export function capturePosthogEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}
