import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { router } from './router';
import './index.css';
import './styles/animations.css';

// Add debug logging to help diagnose issues
console.log('🔍 Art Appraiser Directory initializing...');

// Log environment info
console.log('📊 Environment info:', {
  mode: import.meta.env.MODE,
  base: import.meta.env.BASE_URL,
  timestamp: new Date().toISOString(),
});

// Determine if we should hydrate or create a new root
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found! DOM structure may be incorrect.');
} else {
  try {
    // Check if the page was pre-rendered (has child nodes)
    const hasPreRenderedContent = rootElement.childNodes.length > 0;
    console.log('🧩 Content status:', { hasPreRenderedContent, childNodes: rootElement.childNodes.length });

    if (hasPreRenderedContent) {
      // Use hydration for server-rendered content
      console.log('💧 Hydrating pre-rendered content');
      hydrateRoot(
        rootElement,
        <StrictMode>
          <HelmetProvider>
            <RouterProvider router={router} />
          </HelmetProvider>
        </StrictMode>
      );
      console.log('✅ Hydration complete');
    } else {
      // Use regular rendering for client-only rendering
      console.log('🌱 Creating new React root (client-only rendering)');
      createRoot(rootElement).render(
        <StrictMode>
          <HelmetProvider>
            <RouterProvider router={router} />
          </HelmetProvider>
        </StrictMode>
      );
      console.log('✅ Rendering complete');
    }
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
