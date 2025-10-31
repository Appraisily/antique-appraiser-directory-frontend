/* eslint-disable @typescript-eslint/no-explicit-any */

const isBrowser = typeof window !== 'undefined';

type DataLayerEvent = Record<string, any>;

export function pushToDataLayer(payload: DataLayerEvent) {
  if (!isBrowser) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

export function trackEvent(event: string, params: Record<string, any> = {}) {
  pushToDataLayer({
    event,
    ...params
  });
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
