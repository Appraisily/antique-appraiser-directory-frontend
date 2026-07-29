import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function PrerenderCleanup() {
  const location = useLocation();

  useEffect(() => {
    const preRenderRoot = document.querySelector('[data-prerender]');
    if (!preRenderRoot) return;
    const authoritative = preRenderRoot.querySelector<HTMLElement>(
      '[data-directory-static-authoritative="true"][data-city-slug]'
    );
    const authoritativePath = authoritative
      ? `/location/${authoritative.dataset.citySlug}/`
      : null;
    const currentPath = location.pathname.endsWith('/')
      ? location.pathname
      : `${location.pathname}/`;
    if (authoritativePath === currentPath) return;

    requestAnimationFrame(() => {
      preRenderRoot.remove();
    });
  }, [location.pathname]);

  return null;
}
