import React from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { Footer } from '../components/Footer';
import Navbar from '../components/Navbar';
import { AnalyticsTracker } from '../components/AnalyticsTracker';
import { CanonicalLinkUpdater } from '../components/CanonicalLinkUpdater';
import { PosthogTracker } from '../components/PosthogTracker';
import { ContentFeedback } from '../components/ContentFeedback';
import { PrerenderCleanup } from '../components/PrerenderCleanup';

export function RootLayout() {
  const location = useLocation();
  const navigationType = useNavigationType();

  React.useLayoutEffect(() => {
    if (navigationType === 'POP' || location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.hash, location.pathname, location.search, navigationType]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AnalyticsTracker />
      <PosthogTracker />
      <CanonicalLinkUpdater />
      <PrerenderCleanup />
      <Navbar />
      <div className="flex-1 pt-16">
        <Outlet />
      </div>
      <ContentFeedback />
      <Footer />
    </div>
  );
}
