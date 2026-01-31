import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { router } from './router';
import { SITE_URL } from './config/site';
import './index.css';
import './styles/animations.css';
import { tagAiAssistantReferrer } from './utils/aiAttribution';

declare global {
  interface Window {
    __APPRAISILY_CLIENT_RENDER_ONLY__?: boolean;
  }
}

// Ensure we always serve the canonical origin (no stray ports)
if (typeof window !== 'undefined') {
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
}

// Add debug logging to help diagnose issues
console.log('🔍 Antique Appraiser Directory initializing...');

// Log environment info
console.log('📊 Environment info:', {
  mode: import.meta.env.MODE,
  base: import.meta.env.BASE_URL,
  timestamp: new Date().toISOString(),
});

// Marker used by publish/build checks to ensure we're not accidentally shipping a hydration build.
window.__APPRAISILY_CLIENT_RENDER_ONLY__ = true;

// Ensure AI referrals are tagged before hydration/render
try {
  tagAiAssistantReferrer();
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
    console.log('🧩 Content status:', { hasPreRenderedContent, childNodes: rootElement.childNodes.length });

    console.log(
      hasPreRenderedContent
        ? '🧯 Pre-rendered HTML detected; clearing container to avoid React hydration mismatch (client render only)'
        : '🌱 No pre-rendered HTML; client render only'
    );

    // This site serves pre-rendered (static) HTML for SEO. Our client app does not currently
    // receive a matching serialized data snapshot, so attempting to "take over" the existing
    // DOM can trigger React recoverable hydration mismatch errors (#418/#423).
    // Clear the container first to ensure a clean client render.
    if (hasPreRenderedContent) {
      rootElement.replaceChildren();
    }

    createRoot(rootElement).render(
      <StrictMode>
        <HelmetProvider>
          <RouterProvider router={router} />
        </HelmetProvider>
      </StrictMode>
    );
    console.log('✅ Rendering complete');
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    console.log('📑 Error details:', { 
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Show error UI to user
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h2>Something went wrong</h2>
        <p>The application failed to initialize. Please try refreshing the page.</p>
        <pre style="text-align: left; background: #f5f5f5; padding: 10px; overflow: auto; max-width: 100%; font-size: 12px;">
          ${error.message || 'Unknown error'}
        </pre>
      </div>
    `;
  }
}
