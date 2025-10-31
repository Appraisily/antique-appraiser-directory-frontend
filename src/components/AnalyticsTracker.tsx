import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { GOOGLE_TAG_MANAGER_ID } from '../config/site';
import { derivePageContext, pushToDataLayer } from '../utils/analytics';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const isBrowser = typeof window !== 'undefined';

export function AnalyticsTracker() {
  const location = useLocation();

  const { scriptContent, noscriptContent } = useMemo(() => {
    const id = GOOGLE_TAG_MANAGER_ID;
    const script = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
    const noscript = `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;

    return {
      scriptContent: script,
      noscriptContent: noscript
    };
  }, [GOOGLE_TAG_MANAGER_ID]);

  useEffect(() => {
    if (!isBrowser || !GOOGLE_TAG_MANAGER_ID) {
      return;
    }

    const context = derivePageContext(location.pathname);

    const payload: Record<string, unknown> = {
      event: 'page_view',
      page_location: window.location.href,
      page_path: `${location.pathname}${location.search}${location.hash}`,
      page_title: document.title,
      page_type: context.pageType,
      page_category: context.pageCategory
    };

    if (context.citySlug) {
      payload.city_slug = context.citySlug;
    }

    if (context.appraiserSlug) {
      payload.appraiser_slug = context.appraiserSlug;
    }

    pushToDataLayer(payload);

    const fallbackIframe = document.querySelector<HTMLIFrameElement>(
      'noscript iframe[src*="googletagmanager.com/ns.html"]'
    );

    if (fallbackIframe && !fallbackIframe.src.includes(GOOGLE_TAG_MANAGER_ID)) {
      fallbackIframe.src = `https://www.googletagmanager.com/ns.html?id=${GOOGLE_TAG_MANAGER_ID}`;
    }
  }, [location]);

  if (!GOOGLE_TAG_MANAGER_ID) {
    return null;
  }

  return (
    <Helmet
      script={[
        {
          id: 'gtm-script',
          type: 'text/javascript',
          innerHTML: scriptContent
        }
      ]}
      noscript={[
        {
          id: 'gtm-noscript',
          innerHTML: noscriptContent
        }
      ]}
    />
  );
}
