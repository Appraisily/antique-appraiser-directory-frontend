import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { router } from './router';
import { SITE_URL } from './config/site';
import './index.css';
import './styles/animations.css';
import { tagAiAssistantReferrer } from './utils/aiAttribution';
import { captureAttributionFromQueryToCookie } from './utils/startAttribution';

declare global {
  interface Window {
    __APPRAISILY_CLIENT_RENDER_ONLY__?: boolean;
  }
}

// Ensure we always serve the canonical origin (no stray ports)
try {
  const canonicalOrigin = new URL(SITE_URL);
  const isSameHost = window.location.hostname === canonicalOrigin.hostname;
  const hasUnexpectedPort =
    window.location.port &&
    window.location.port !== canonicalOrigin.port &&
    window.location.port !== '443' &&
    window.location.port !== '80';

  if (isSameHost && hasUnexpectedPort) {
    const target = `${canonicalOrigin.protocol}//${canonicalOrigin.hostname}${
      canonicalOrigin.port ? `:${canonicalOrigin.port}` : ''
    }${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }
} catch (error) {
  console.error('Failed to enforce canonical origin', error);
}

// Add debug logging to help diagnose issues
if (import.meta.env.DEV) {
  console.log('🔍 Antique Appraiser Directory initializing...');
  console.log('📊 Environment info:', {
    mode: import.meta.env.MODE,
    base: import.meta.env.BASE_URL,
    timestamp: new Date().toISOString(),
  });
}

// Marker used by publish/build checks to ensure we're not accidentally shipping a hydration build.
window.__APPRAISILY_CLIENT_RENDER_ONLY__ = true;

// Ensure AI referrals are tagged before hydration/render
try {
  tagAiAssistantReferrer();
  captureAttributionFromQueryToCookie();
} catch (error) {
  console.error('Failed to tag AI assistant referrer', error);
}

// Determine if we should hydrate or create a new root
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found! DOM structure may be incorrect.');
} else {
  try {
    // Check if the page was pre-rendered (has child nodes)
    // Treat only actual DOM content (not comments/whitespace placeholders) as pre-rendered output.
    const hasPreRenderedContent = Array.from(rootElement.childNodes).some(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return (node as HTMLElement).outerHTML.trim().length > 0;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent || '').trim().length > 0;
      }
      return false;
    });
    if (import.meta.env.DEV) {
      console.log('🧩 Content status:', { hasPreRenderedContent, childNodes: rootElement.childNodes.length });
      console.log(
        hasPreRenderedContent
          ? '🧯 Pre-rendered HTML detected; preserving until SPA mounts'
          : '🌱 No pre-rendered HTML; client render only'
      );
    }

    let renderTarget = rootElement;
    if (hasPreRenderedContent) {
      const preRenderRoot = document.createElement('div');
      preRenderRoot.setAttribute('data-prerender', 'true');
      while (rootElement.firstChild) {
        preRenderRoot.appendChild(rootElement.firstChild);
      }
      rootElement.appendChild(preRenderRoot);

      const spaRoot = document.createElement('div');
      spaRoot.setAttribute('data-spa-root', 'true');
      rootElement.appendChild(spaRoot);
      renderTarget = spaRoot;
    }

    createRoot(renderTarget).render(
      <StrictMode>
        <HelmetProvider>
          <RouterProvider router={router} />
        </HelmetProvider>
      </StrictMode>
    );
    if (import.meta.env.DEV) {
      console.log('✅ Rendering complete');
    }

    const scrollToHashTarget = () => {
      const rawHash = window.location.hash;
      if (!rawHash) return;
      const id = decodeURIComponent(rawHash.replace('#', ''));
      if (!id) return;

      let attempts = 0;
      const maxAttempts = 20;
      let observer: MutationObserver | null = null;

      const tryScroll = (): boolean => {
        const target = document.getElementById(id);
        if (!target) return false;
        const nav = document.querySelector('nav');
        const navHeight = nav instanceof HTMLElement ? nav.offsetHeight : 0;
        const offset = navHeight + 16;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        return true;
      };

      const scheduleRetry = () => {
        if (attempts >= maxAttempts) return;
        attempts += 1;
        window.setTimeout(() => {
          if (!tryScroll()) {
            scheduleRetry();
          }
        }, 200);
      };

      if (!tryScroll()) {
        scheduleRetry();
        observer = new MutationObserver(() => {
          if (tryScroll() && observer) {
            observer.disconnect();
            observer = null;
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.setTimeout(() => {
          if (observer) {
            observer.disconnect();
            observer = null;
          }
        }, 8000);
      }
    };

    scrollToHashTarget();
    window.addEventListener('hashchange', scrollToHashTarget);
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    if (import.meta.env.DEV) {
      console.log('📑 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    // Show error UI to user (use textContent to avoid XSS from error.message)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:20px;text-align:center;font-family:sans-serif;';
    const heading = document.createElement('h2');
    heading.textContent = 'Something went wrong';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'The application failed to initialize. Please try refreshing the page.';
    const pre = document.createElement('pre');
    pre.style.cssText = 'text-align:left;background:#f5f5f5;padding:10px;overflow:auto;max-width:100%;font-size:12px;';
    pre.textContent = error.message || 'Unknown error';
    wrapper.appendChild(heading);
    wrapper.appendChild(paragraph);
    wrapper.appendChild(pre);
    rootElement.replaceChildren(wrapper);
  }
}
