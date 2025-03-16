import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DirectoryApp from './DirectoryIntegration';

/**
 * Main Site Routes Example
 * 
 * This demonstrates how to integrate the Directory component into the main site
 * directly, without a separate build process or submodule complexity.
 */

const MainSiteRoutes = () => {
  return (
    <Routes>
      {/* Main site routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      
      {/* Directory routes - all handled by the DirectoryApp component */}
      <Route path="/directory/*" element={<DirectoryApp baseUrl="/directory" />} />
      
      {/* Fallback route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// Example main site components
const HomePage = () => (
  <div className="main-site-page">
    <h1>Welcome to Appraisily</h1>
    <p>Your trusted source for art appraisal services.</p>
    <div className="featured-section">
      <h2>Find Art Appraisers Near You</h2>
      <p>
        Looking for professional art appraisal services? Visit our 
        <a href="/directory">Art Appraiser Directory</a> to find 
        certified experts in your area.
      </p>
    </div>
  </div>
);

const AboutPage = () => (
  <div className="main-site-page">
    <h1>About Appraisily</h1>
    <p>Information about our company and services.</p>
  </div>
);

const ContactPage = () => (
  <div className="main-site-page">
    <h1>Contact Us</h1>
    <p>Get in touch with our team.</p>
  </div>
);

const NotFoundPage = () => (
  <div className="main-site-page">
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
  </div>
);

export default MainSiteRoutes; 