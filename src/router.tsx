import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import { StandardizedLocationPage } from './pages/StandardizedLocationPage';
import { StandardizedAppraiserPage } from './pages/StandardizedAppraiserPage';
import { RootLayout } from './layouts/RootLayout';

// The key is to ensure the router handles all paths correctly in a production environment
export const router = createBrowserRouter([
  // Route for AppraisersDirectory that now uses the root path
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <App />
      },
      {
        path: 'location/:citySlug',
        element: <StandardizedLocationPage />
      },
      {
        path: 'appraiser/:appraiserId',
        element: <StandardizedAppraiserPage />
      },
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ],
  },
], {
  basename: '' // Removed the '/directory' basename
});
