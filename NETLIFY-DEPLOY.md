# Netlify Deployment Guide

This document provides information about how the Art Appraiser Directory is deployed to Netlify, including SEO optimizations and build process details.

## Overview

The site uses a custom build process to ensure all SEO optimizations are properly applied. This includes:

1. Static HTML generation for all pages
2. Optimized images
3. Comprehensive sitemap generation
4. SEO metadata and structured data
5. Security headers
6. Performance optimizations

## Deployment Strategies

### Strategy 1: Pre-built Deployment (Recommended)

This project now primarily uses a pre-built deployment strategy for Netlify. This means:

1. We build the site locally (or in a CI environment)
2. We commit the built files to the repository
3. Netlify simply serves these pre-built files without running its own build process

#### Steps:

1. Ensure you have Node.js 18 or higher installed
2. Run the Netlify-ready build:
   ```
   npm run build:netlify-ready
   ```
3. Commit the changes to your Git repository (including the `dist` directory):
   ```
   git add dist netlify.toml
   git commit -m "Update pre-built files for Netlify deployment"
   git push
   ```
4. Netlify will deploy the pre-built files directly

### Strategy 2: Netlify Build Environment (Alternative)

If you prefer to have Netlify build the site:

1. Ensure your `netlify.toml` file has `NODE_VERSION = "18"` or higher
2. Set the build command to `npm run build:production`
3. Set the publish directory to `dist`

## Netlify Configuration

The deployment is controlled by the `netlify.toml` file in the root directory. This file defines:

- Build command (if using Strategy 2)
- Publish directory: `dist`
- Environment variables for the build
- URL redirects and rewrites for SPA functionality
- HTTP headers for security and caching

## SEO Optimizations

The site includes several SEO optimizations:

- Semantic HTML structure
- Schema.org structured data (LocalBusiness, FAQPage, BreadcrumbList)
- City-specific meta tags and keywords
- "Near me" optimized content
- OpenGraph and Twitter Card metadata
- Comprehensive XML sitemap
- Properly configured robots.txt
- Mobile-friendly design
- Accessible content

## Troubleshooting

If you encounter build issues on Netlify:

1. Check the Netlify logs for specific error messages
2. Verify Node.js version is set to 18 or higher in `netlify.toml`
3. Fall back to pre-built deployment if Netlify's build environment continues to cause issues
4. Run `npm run site-check` locally to validate all links before deploying

## Deployment Commands

- **Build for Netlify**: `npm run build:netlify-ready`
- **Full Build**: `npm run build:production`
- **Deploy Directly**: `npm run deploy:direct`
- **Test Build Locally**: `npm run build:seo-optimized`
- **Validate Site**: `npm run site-check`

## Environment Variables

The following environment variables should be set in the Netlify deployment settings:

- `SITE_URL`: The base URL of the site (e.g., `https://art-appraiser-directory.appraisily.com`)
- `NODE_VERSION`: Set to `18` for compatibility

## Notes for Future Developers

When making changes to the site structure or adding new pages:

1. Update the sitemap generation script if needed (`scripts/generate-sitemap.js`)
2. Ensure new page types have proper SEO metadata and schema markup
3. Check that all images have appropriate alt text and optimized formats
4. Validate that city-specific keywords are maintained in location pages
5. Test the site with both JavaScript enabled and disabled
6. Verify mobile responsiveness of all new components