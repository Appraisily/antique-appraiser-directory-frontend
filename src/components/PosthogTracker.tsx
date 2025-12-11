import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initPosthog, capturePosthogPageview } from '../lib/posthog';
import { derivePageContext } from '../utils/analytics';

export function PosthogTracker() {
  const location = useLocation();

  useEffect(() => {
    initPosthog();
  }, []);

  useEffect(() => {
    const context = derivePageContext(location.pathname);
    capturePosthogPageview(`${location.pathname}${location.search}`, {
      page_type: context.pageType,
      page_category: context.pageCategory,
      city_slug: context.citySlug,
      appraiser_slug: context.appraiserSlug,
    });
  }, [location.pathname, location.search]);

  return null;
}
