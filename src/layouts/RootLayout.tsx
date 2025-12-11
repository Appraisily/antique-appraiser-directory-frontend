import React from 'react';
import { Outlet } from 'react-router-dom';
import { Footer } from '../components/Footer';
import Navbar from '../components/Navbar';
import { AnalyticsTracker } from '../components/AnalyticsTracker';
import { CanonicalLinkUpdater } from '../components/CanonicalLinkUpdater';
import { PosthogTracker } from '../components/PosthogTracker';

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AnalyticsTracker />
      <PosthogTracker />
      <CanonicalLinkUpdater />
      <Navbar />
      <div className="flex-1 pt-16">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
