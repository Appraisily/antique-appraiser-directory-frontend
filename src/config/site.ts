import { withAiAssistantParams } from '../utils/aiAttribution';

export const SITE_NAME = 'Antique Appraiser Directory';
export const SITE_URL = 'https://antique-appraiser-directory.appraisily.com';
export const SITE_DESCRIPTION =
  'Discover certified antique appraisers near you. Compare expertise, pricing models, and verified reviews for valuations, authentication, and estate services.';
export const SITE_TWITTER_HANDLE = '@appraisily';
export const DEFAULT_OG_IMAGE = 'https://ik.imagekit.io/appraisily/appraisily-og-image.jpg';
export const PARENT_SITE_URL = 'https://appraisily.com';
const BASE_CTA_URL = `${PARENT_SITE_URL}/start`;
const DEFAULT_CTA_PARAMS = {
  utm_source: 'antique_directory',
  utm_medium: 'referral',
  utm_campaign: 'directory_to_start',
  utm_content: 'primary_cta',
} as const;
export const SITE_FAVICON = 'https://ik.imagekit.io/appraisily/WebPage/logo_new.png?updatedAt=1731919266638';
export const GOOGLE_SITE_VERIFICATION =
  import.meta.env.VITE_GOOGLE_SITE_VERIFICATION || '';
export const GOOGLE_TAG_MANAGER_ID =
  import.meta.env.VITE_GTM_ID || 'GTM-PSLHDGM';

export function getPrimaryCtaUrl(extraParams: Record<string, string> = {}): string {
  const tagged = withAiAssistantParams(BASE_CTA_URL, {
    defaultParams: DEFAULT_CTA_PARAMS,
    skipIfSourceExists: false,
  });

  try {
    const url = new URL(tagged);
    for (const [key, value] of Object.entries(extraParams)) {
      if (typeof value === 'undefined') continue;
      url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    const query = new URLSearchParams(extraParams).toString();
    if (!query) return tagged;
    return `${tagged}${tagged.includes('?') ? '&' : '?'}${query}`;
  }
}

export const CTA_URL = BASE_CTA_URL;

/**
 * Builds a canonical URL for this site, ensuring we never leak container ports
 * like :8080 when generating absolute links.
 */
export function buildSiteUrl(path = ''): string {
  try {
    const base = SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;
    return new URL(path, base).toString();
  } catch (error) {
    console.error('Failed to build site URL', { path, error });
    const normalizedBase = SITE_URL.replace(/\/$/, '');
    const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';
    return `${normalizedBase}${normalizedPath}`;
  }
}
