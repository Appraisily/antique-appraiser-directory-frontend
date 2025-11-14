import React, { useEffect, useState } from 'react';
import { Facebook, Twitter, Instagram, Mail, ArrowRight, MapPin } from 'lucide-react';
import citiesData from '../data/cities.json';
import { PARENT_SITE_URL, SITE_NAME, buildSiteUrl, getPrimaryCtaUrl } from '../config/site';
import { trackEvent } from '../utils/analytics';

const links = {
  quickLinks: [
    { name: 'Services', href: `${PARENT_SITE_URL}/services` },
    { name: 'How It Works', href: `${PARENT_SITE_URL}/how-it-works` },
    { name: 'Free AI Art Analysis', href: `${PARENT_SITE_URL}/screener` },
    { name: 'Terms of Service', href: `${PARENT_SITE_URL}/terms` }
  ],
  legal: [
    { name: 'Privacy Policy', href: `${PARENT_SITE_URL}/privacy` },
    { name: 'Terms of Service', href: `${PARENT_SITE_URL}/terms` }
  ],
  social: [
    { name: 'Facebook', icon: Facebook, href: 'https://www.facebook.com/appraisily' },
    { name: 'Twitter', icon: Twitter, href: 'https://twitter.com/appraisily' },
    { name: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/appraisily/' }
  ]
};

type FooterCity = typeof citiesData.cities[number];

export function Footer() {
  const [cities, setCities] = useState<FooterCity[]>([]);
  const primaryCtaUrl = getPrimaryCtaUrl();
  
  useEffect(() => {
    // Load cities from the imported data
    setCities(citiesData.cities);
  }, []);

  const handleFooterCtaClick = () => {
    trackEvent('cta_click', {
      placement: 'footer_primary',
      destination: primaryCtaUrl
    });
    window.location.assign(primaryCtaUrl);
  };

  const handleFooterCityClick = (city: FooterCity) => {
    trackEvent('footer_city_click', {
      city_slug: city.slug,
      city_name: city.name,
      state: city.state
    });
  };

  const handleFooterLinkClick = (name: string, section: 'quick' | 'legal') => {
    trackEvent('footer_link_click', {
      section,
      link_text: name
    });
  };

  const handleSocialLinkClick = (network: string) => {
    trackEvent('social_link_click', {
      network,
      placement: 'footer'
    });
  };

  return (
    <footer className="relative overflow-hidden bg-white">
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white" />
        
        {/* Animated gradient blobs */}
        <div className="absolute top-0 -left-4 w-3/4 h-3/4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-[0.08] animate-blob" />
        <div className="absolute -bottom-8 right-0 w-3/4 h-3/4 bg-gradient-to-l from-blue-500 to-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-[0.08] animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 -left-4 w-3/4 h-3/4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-[0.08] animate-blob animation-delay-4000" />
        
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#3b82f620_1px,transparent_1px),linear-gradient(to_bottom,#3b82f620_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      {/* Cities Subfooter */}
      <div className="relative border-b border-gray-200">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Find Antique Appraisers Near You
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {cities.map((city) => (
              <a 
                key={city.slug}
                href={buildSiteUrl(`/location/${city.slug}`)}
                className="text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center gap-1"
                data-gtm-event="footer_city_click"
                data-gtm-city={city.slug}
                data-gtm-state={city.state}
                onClick={() => handleFooterCityClick(city)}
              >
                <MapPin className="h-3 w-3" /> {city.name}, {city.state}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="relative max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center">
              <img 
                src="https://ik.imagekit.io/appraisily/WebPage/logo_new.png?updatedAt=1731919266638"
                alt="Appraisily Logo"
                className="h-8 w-auto mr-3"
                loading="lazy"
              />
              <span className="text-2xl font-bold text-gray-900">{SITE_NAME}</span>
            </div>
            <p className="text-gray-600 max-w-md">
              Professional online art and antique appraisals. Get accurate valuations from certified experts within 48 hours.
            </p>
            <button 
              type="button"
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md flex items-center"
              data-gtm-event="cta_click"
              data-gtm-placement="footer_primary"
              onClick={handleFooterCtaClick}
            >
              Start Appraisal <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
          
          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {links.quickLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href}
                    className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
                    data-gtm-event="footer_link_click"
                    data-gtm-section="quick"
                    data-gtm-label={link.name}
                    onClick={() => handleFooterLinkClick(link.name, 'quick')}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Contact Us
            </h3>
            <div className="space-y-3">
              <a 
                href="mailto:info@appraisily.com"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm"
              >
                <Mail className="h-4 w-4 mr-2" />
                info@appraisily.com
              </a>
              <div className="flex space-x-4">
              {links.social.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                    aria-label={`Visit our ${social.name} page`}
                    data-gtm-event="social_link_click"
                    data-gtm-network={social.name}
                    onClick={() => handleSocialLinkClick(social.name)}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-1 text-sm">
              <span className="text-gray-600">©</span>
              <span className="text-gray-900 font-medium">{new Date().getFullYear()} Appraisily.</span>
              <span className="text-gray-600">All rights reserved.</span>
            </div>
            <nav className="flex items-center gap-6">
              {links.legal.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  data-gtm-event="footer_link_click"
                  data-gtm-section="legal"
                  data-gtm-label={link.name}
                  onClick={() => handleFooterLinkClick(link.name, 'legal')}
                >
                  {link.name}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
