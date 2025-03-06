import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { router } from './router';
import './index.css';
import './styles/animations.css';

// Determine if we should hydrate or create a new root
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Root element not found');
} else {
  // Check if the page was pre-rendered (has child nodes)
  const hasPreRenderedContent = rootElement.childNodes.length > 0;

  if (hasPreRenderedContent) {
    // Use hydration for server-rendered content
    console.log('Hydrating pre-rendered content');
    hydrateRoot(
      rootElement,
      <StrictMode>
        <HelmetProvider>
          <RouterProvider router={router} />
        </HelmetProvider>
      </StrictMode>
    );
  } else {
    // Use regular rendering for client-only rendering
    console.log('Creating new React root');
    createRoot(rootElement).render(
      <StrictMode>
        <HelmetProvider>
          <RouterProvider router={router} />
        </HelmetProvider>
      </StrictMode>
    );
  }
}
