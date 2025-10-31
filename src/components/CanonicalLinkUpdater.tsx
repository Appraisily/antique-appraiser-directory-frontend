import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_URL } from '../config/site';

function canonicalizeHref(rawHref: string): string {
  try {
    const url = new URL(rawHref, SITE_URL);
    url.protocol = 'https:';
    url.port = '';
    return url.toString();
  } catch (error) {
    console.error('Failed to canonicalize link', { href: rawHref, error });
    return rawHref;
  }
}

/**
 * Converts internal links to canonical HTTPS URLs and forces navigation
 * through the canonical hostname to avoid odd ports getting appended by
 * intermediaries (Cloudflare, cached redirects, user history, etc).
 */
export function CanonicalLinkUpdater() {
  const location = useLocation();

  useEffect(() => {
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href]');

    const hasTrackingAttributes = (element: HTMLAnchorElement) => {
      return Array.from(element.attributes).some(attr => attr.name.startsWith('data-gtm'));
    };

    anchors.forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#')) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (hasTrackingAttributes(anchor)) return;

      const canonical = canonicalizeHref(href);
      anchor.setAttribute('href', canonical);
    });

    const handleClick = (event: MouseEvent) => {
      // Ignore modified clicks (new tab, etc.)
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
      if (hasTrackingAttributes(target)) return;

      const canonical = canonicalizeHref(href);
      event.preventDefault();
      window.location.assign(canonical);
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [location.pathname, location.search, location.hash]);

  return null;
}
