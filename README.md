# Art Appraiser Directory Frontend

This submodule is a specialized part of the Appraisily website focused on SEO-optimized content for art appraisers and locations. It generates static HTML pages that can be directly deployed to Netlify or integrated into the main site.

## 🚀 SEO Optimization Features

This directory frontend implements comprehensive SEO features to maximize Google ranking potential:

### 1. Technical SEO Implementation

- **Pre-rendered HTML**: All pages are pre-rendered for optimal indexing by search engines
- **Schema.org Structured Data**: Rich structured data for appraisers, locations, and FAQs
- **Optimized Meta Tags**: Complete set of meta tags including title, description, canonical URLs
- **Social Sharing**: OpenGraph and Twitter Card tags for better sharing on social media
- **Semantic HTML**: Proper HTML5 semantic elements for better content parsing
- **Responsive Images**: Optimized image loading with srcset and lazy loading
- **Performance Optimization**: Minified HTML/CSS/JS with deferred script loading
- **Sitemap Generation**: Dynamic XML sitemap with priority and frequency attributes
- **Robots.txt**: Custom robots.txt with sitemap reference

### 2. Content Optimization

- **Keyword-rich Content**: Pages are structured for relevant art appraisal keywords
- **Structured Content**: Clear content hierarchy with proper heading structure
- **Local SEO**: Location-specific pages optimized for local search queries
- **FAQ Schema**: Structured FAQ content for potential featured snippets
- **Breadcrumbs**: Clear navigation paths with breadcrumb structured data

## 📋 Development & Deployment Guide

### Prerequisites

- Node.js 18+ and npm
- Access to the Appraisily ImageKit account (for image optimization)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/main-site-index.git
cd main-site-index/art-appraiser-directory-frontend

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

### Building

We offer several build options:

```bash
# Standard build
npm run build

# Simplified build (skips linting)
npm run build:simple

# SEO-optimized build (includes image optimization and HTML minification)
npm run build:seo-optimized
```

### Image Optimization

The project includes tools for optimizing images:

```bash
# Optimize existing images in the generated files
npm run optimize-images

# Check for missing or broken images
npm run check-images

# List all available images from ImageKit
npm run list-imagekit-images

# Randomize appraiser images using ImageKit
npm run randomize-imagekit-images

# Build with ImageKit images (no generation needed)
npm run build:imagekit
```

The project uses a collection of pre-generated images stored in ImageKit (in the `/appraiser-images` folder) which are randomly assigned to appraisers. This approach eliminates the need to generate new images for each build and provides consistent, high-quality images across the site. The `build:imagekit` command handles the complete build process using these pre-existing images.

## 🔍 SEO Maintenance Guide

To maintain optimal SEO performance, follow these guidelines:

### 1. Content Updates

- **Page Titles**: Keep titles under 60 characters and include primary keywords
- **Meta Descriptions**: Write compelling descriptions under 155 characters
- **Image Alt Text**: Always provide descriptive alt text for images
- **Content Freshness**: Regularly update content to maintain freshness signals

### 2. Technical Maintenance

- **Schema Validation**: Test structured data using [Google's Rich Results Test](https://search.google.com/test/rich-results)
- **Mobile Friendliness**: Verify mobile experience using [Google's Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- **Page Speed**: Monitor performance using [PageSpeed Insights](https://pagespeed.web.dev/)
- **Canonical URLs**: Ensure canonical URLs are correctly implemented
- **XML Sitemap**: Keep sitemap updated when adding new content

### 3. Keyword Optimization

For best results, focus on these high-value keywords:

- "art appraiser [location]"
- "art appraisal services"
- "fine art appraiser near me"
- "art valuation expert"
- "certified art appraiser"
- "art authentication services"
- "painting valuation [location]"
- "antique art appraisal"

## 📈 Analytics & Monitoring

To track SEO performance:

1. **Google Search Console**: Monitor indexing, search performance, and errors
2. **Google Analytics**: Track user behavior and conversion metrics
3. **Rank Tracking**: Monitor position for target keywords
4. **Backlink Analysis**: Regularly check for new backlinks

## ⚙️ Configuration

Key configuration files:

- `vite.config.ts`: Vite bundler configuration
- `scripts/generate-static.js`: Static HTML generation settings
- `scripts/generate-sitemap.js`: Sitemap configuration
- `src/utils/schemaGenerators.ts`: Structured data templates

## 🧩 Deployment to Netlify

This project is designed to be built locally and then deployed to Netlify:

1. Build the static files locally using one of these commands:
   - `npm run build:local` - Basic local build
   - `npm run build:local:with-images` - Build with image generation
   - `npm run build:production` - Full production build with optimizations
   - `npm run build:imagekit` - Complete build using ImageKit images (no generation)

2. Test the build locally with `npm run serve:static`

3. Deploy the pre-built files to Netlify:
   - The netlify.toml is configured to use pre-built files from the dist directory
   - Netlify will NOT run a build process and will simply serve the pre-built files
   - This approach prevents build errors on Netlify and ensures image consistency

⚠️ **IMPORTANT**: Do not configure Netlify to run its own build. The project must be built locally to ensure all image and data consistency issues are resolved before deployment.

## 📞 Support

For questions or support, contact the development team at [dev@appraisily.com](mailto:dev@appraisily.com).