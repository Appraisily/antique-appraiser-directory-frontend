const STORAGE_KEY = 'appraisily-ai-ref-tagged';
const DETAILS_STORAGE_KEY = 'appraisily-ai-ref-details';

type KnownAssistant =
  | 'chatgpt'
  | 'openai'
  | 'perplexity';

interface AssistantDescriptor {
  hostIncludes: string[];
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
}

interface AssistantAttribution {
  assistant: KnownAssistant;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
  taggedAt: string;
}

const ASSISTANTS: Record<KnownAssistant, AssistantDescriptor> = {
  chatgpt: {
    hostIncludes: ['chatgpt.com', 'www.chatgpt.com'],
    utmSource: 'chatgpt',
    utmMedium: 'referral',
    utmCampaign: 'ai_assistant',
    utmContent: 'ai_referral',
  },
  openai: {
    hostIncludes: ['chat.openai.com'],
    utmSource: 'chatgpt',
    utmMedium: 'referral',
    utmCampaign: 'ai_assistant',
    utmContent: 'ai_referral',
  },
  perplexity: {
    hostIncludes: ['perplexity.ai', 'www.perplexity.ai'],
    utmSource: 'perplexity',
    utmMedium: 'referral',
    utmCampaign: 'ai_assistant',
    utmContent: 'ai_referral',
  },
};

function shouldSkip(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markTagged(details: AssistantAttribution): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
    window.sessionStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(details));
  } catch {
    // no-op if storage unavailable
  }
}

function findAssistant(referrer: string): { key: KnownAssistant; descriptor: AssistantDescriptor } | null {
  if (!referrer) return null;
  let hostname: string | null = null;
  try {
    hostname = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [key, assistant] of Object.entries(ASSISTANTS) as [KnownAssistant, AssistantDescriptor][]) {
    if (assistant.hostIncludes.some((fragment) => hostname!.includes(fragment))) {
      return { key, descriptor: assistant };
    }
  }
  return null;
}

function buildAttributionPayload(key: KnownAssistant, descriptor: AssistantDescriptor): AssistantAttribution {
  return {
    assistant: key,
    utmSource: descriptor.utmSource,
    utmMedium: descriptor.utmMedium,
    utmCampaign: descriptor.utmCampaign,
    utmContent: descriptor.utmContent,
    taggedAt: new Date().toISOString(),
  };
}

type UrlLike = string | URL;

function normaliseUrl(input: UrlLike): URL | null {
  try {
    return input instanceof URL
      ? new URL(input.toString())
      : /^\w+:\/\//.test(input)
      ? new URL(input)
      : new URL(input, window.location.origin);
  } catch {
    return null;
  }
}

function getStoredAttribution(): AssistantAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(DETAILS_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AssistantAttribution;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tagAiAssistantReferrer(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (shouldSkip()) return;

  const referrer = document.referrer;
  const result = findAssistant(referrer);
  if (!result) return;
  const { key, descriptor } = result;

  const currentUrl = new URL(window.location.href);
  const hasSource = currentUrl.searchParams.has('utm_source');
  if (hasSource) {
    markTagged(buildAttributionPayload(key, descriptor));
    return;
  }

  currentUrl.searchParams.set('utm_source', descriptor.utmSource);
  currentUrl.searchParams.set('utm_medium', descriptor.utmMedium);
  currentUrl.searchParams.set('utm_campaign', descriptor.utmCampaign);
  currentUrl.searchParams.set('utm_content', descriptor.utmContent ?? 'ai_referral');

  const updated = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.history.replaceState({}, '', updated);
  markTagged(buildAttributionPayload(key, descriptor));
}

export function getAiAssistantAttribution(): AssistantAttribution | null {
  if (typeof window === 'undefined') return null;

  const stored = getStoredAttribution();
  if (stored) return stored;

  try {
    const url = new URL(window.location.href);
    const source = url.searchParams.get('utm_source');
    const medium = url.searchParams.get('utm_medium');
    const campaign = url.searchParams.get('utm_campaign');
    const content = url.searchParams.get('utm_content') || undefined;

    if (source && medium && campaign) {
      return {
        assistant: 'chatgpt',
        utmSource: source,
        utmMedium: medium,
        utmCampaign: campaign,
        utmContent: content,
        taggedAt: new Date().toISOString(),
      };
    }
  } catch {
    /* ignore */
  }

  return null;
}

interface WithAiParamsOptions {
  defaultParams?: Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content', string>>;
  preferStoredParams?: boolean;
  skipIfSourceExists?: boolean;
  overrideContent?: string;
}

export function withAiAssistantParams(input: UrlLike, options: WithAiParamsOptions = {}): string {
  if (typeof window === 'undefined') {
    return input instanceof URL ? input.toString() : String(input);
  }

  const url = normaliseUrl(input);
  if (!url) return input instanceof URL ? input.toString() : String(input);

  if (options.skipIfSourceExists && url.searchParams.has('utm_source')) {
    return url.toString();
  }

  const attribution = options.preferStoredParams === false ? null : getAiAssistantAttribution();
  const params = attribution
    ? {
        utm_source: attribution.utmSource,
        utm_medium: attribution.utmMedium,
        utm_campaign: attribution.utmCampaign,
        utm_content: options.overrideContent ?? attribution.utmContent,
      }
    : {
        utm_source: options.defaultParams?.utm_source,
        utm_medium: options.defaultParams?.utm_medium,
        utm_campaign: options.defaultParams?.utm_campaign,
        utm_content: options.overrideContent ?? options.defaultParams?.utm_content,
      };

  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }

  return url.toString();
}
