import { useEffect } from 'react';

export function PrerenderCleanup() {
  useEffect(() => {
    const preRenderRoot = document.querySelector('[data-prerender]');
    if (!preRenderRoot) return;
    requestAnimationFrame(() => {
      preRenderRoot.remove();
    });
  }, []);

  return null;
}
