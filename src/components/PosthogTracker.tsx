import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { initPosthog, capturePosthogEvent, capturePosthogPageview } from '../lib/posthog';
import { derivePageContext } from '../utils/analytics';

const SEO_SCROLL_THRESHOLDS = [25, 50, 75, 90] as const;

function computeScrollDepthPercent(): number {
  const doc = document.documentElement;
  const maxScroll = doc.scrollHeight - doc.clientHeight;
  if (maxScroll <= 0) return 100;
  return Math.max(0, Math.min(100, (window.scrollY / maxScroll) * 100));
}

export function PosthogTracker() {
  const location = useLocation();
  const viewStartAtRef = useRef(0);
  const engagedRef = useRef(false);
  const firedBucketsRef = useRef(new Set<number>());

  useEffect(() => {
    initPosthog();
  }, []);

  useEffect(() => {
    const context = derivePageContext(location.pathname);
    viewStartAtRef.current = Date.now();
    engagedRef.current = false;
    firedBucketsRef.current = new Set();

    capturePosthogPageview(`${location.pathname}${location.search}`, {
      page_type: context.pageType,
      page_category: context.pageCategory,
      city_slug: context.citySlug,
      appraiser_slug: context.appraiserSlug,
    });

    capturePosthogEvent('seo_page_view', {
      page_type: context.pageType,
      page_category: context.pageCategory,
      city_slug: context.citySlug,
      appraiser_slug: context.appraiserSlug,
      page_path: location.pathname,
    });

    const fireEngaged = (reason: string) => {
      if (engagedRef.current) return;
      engagedRef.current = true;
      capturePosthogEvent('seo_engaged', {
        page_type: context.pageType,
        page_category: context.pageCategory,
        city_slug: context.citySlug,
        appraiser_slug: context.appraiserSlug,
        page_path: location.pathname,
        reason,
        ms_on_page: Date.now() - viewStartAtRef.current,
      });
    };

    const onScroll = () => {
      const depth = computeScrollDepthPercent();
      for (const threshold of SEO_SCROLL_THRESHOLDS) {
        if (depth >= threshold && !firedBucketsRef.current.has(threshold)) {
          firedBucketsRef.current.add(threshold);
          capturePosthogEvent('seo_scroll_depth', {
            page_type: context.pageType,
            page_category: context.pageCategory,
            city_slug: context.citySlug,
            appraiser_slug: context.appraiserSlug,
            page_path: location.pathname,
            depth_percent: threshold,
            ms_on_page: Date.now() - viewStartAtRef.current,
          });
        }
      }
      if (depth >= 50) fireEngaged('scroll_50');
    };

    const timer = window.setTimeout(() => fireEngaged('time_20s'), 20_000);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      if (!href) return;

      let url: URL | null = null;
      try {
        url = href.startsWith('http') ? new URL(href) : new URL(href, window.location.origin);
      } catch {
        return;
      }

      const isStart =
        url.hostname.includes('appraisily.com') &&
        (url.pathname === '/start' || url.pathname.startsWith('/start/'));

      if (!isStart) return;

      const context = derivePageContext(window.location.pathname);
      const placement = anchor.closest('header')
        ? 'header'
        : anchor.closest('footer')
          ? 'footer'
          : 'content';

      capturePosthogEvent('seo_cta_click', {
        cta: 'start',
        placement,
        page_type: context.pageType,
        page_category: context.pageCategory,
        city_slug: context.citySlug,
        appraiser_slug: context.appraiserSlug,
        page_path: window.location.pathname,
      });
    };

    const capture = true;
    window.addEventListener('click', onClick, capture);
    return () => window.removeEventListener('click', onClick, capture);
  }, []);

  return null;
}
