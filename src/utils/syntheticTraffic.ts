const QA_MARKER_STORAGE_KEY = 'appraisily_qa_marker';

const SYNTHETIC_MARKER_FAMILIES = {
  qa: 'qa',
  synthetic_browser: 'qa',
  customer_qa: 'qa',
  browser_automation: 'browser_automation',
  agent: 'agent',
  canary: 'monitoring',
  smoke: 'monitoring',
  monitoring: 'monitoring',
  staff: 'staff',
} as const;

export function getSyntheticContext(): { marker?: string; family?: string } {
  if (typeof window === 'undefined') return {};
  let marker: string | undefined;
  try {
    const params = new URLSearchParams(window.location.search || '');
    const explicit = String(params.get('appraisily_synthetic') || '').trim().toLowerCase();
    if (explicit in SYNTHETIC_MARKER_FAMILIES) {
      marker = explicit;
    } else if (params.get('appraisily_qa') === '1') {
      marker = 'synthetic_browser';
    }
    if (marker) {
      window.sessionStorage.setItem(QA_MARKER_STORAGE_KEY, marker);
    } else {
      const stored = String(window.sessionStorage.getItem(QA_MARKER_STORAGE_KEY) || '')
        .trim()
        .toLowerCase();
      if (stored in SYNTHETIC_MARKER_FAMILIES) marker = stored;
    }
  } catch {
    // Synthetic evidence must not break the page when storage is unavailable.
  }
  return marker
    ? { marker, family: SYNTHETIC_MARKER_FAMILIES[marker as keyof typeof SYNTHETIC_MARKER_FAMILIES] }
    : {};
}

export function isSyntheticTelemetrySession(): boolean {
  return Boolean(getSyntheticContext().marker);
}
