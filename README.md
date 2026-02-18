# Antique Appraiser Directory Frontend

This repository contains a React/TypeScript frontend for the Antique Appraiser Directory website. It uses Vite for building, with a focus on generating static HTML files for improved SEO and performance.

## Features

- Standardized data model for consistent UI and maintenance
- Static HTML generation for all appraiser and location pages
- Integration with ImageKit for appraiser profile images
- SEO optimization with structured schema.org data
- Fast and responsive UI with Tailwind CSS
- Automatic sitemap generation
- Netlify-ready configuration for easy deployment

## Standardized Data Model

The project now uses a standardized data format for all appraiser data:

- Consistent field names and data structures
- Comprehensive appraiser profiles with detailed information
- Rich schema.org markup for improved SEO
- See [DATA_STANDARDIZATION.md](./DATA_STANDARDIZATION.md) for details

## Build Process

The codebase offers two build approaches:

### Standardized Build (Recommended)

```bash
npm run build  # or npm run build:standardized
```

This build process:
1. Ensures standardized data is available
2. Builds the React application
3. Generates SEO files
4. Updates links for the main domain
5. Prepares for Netlify deployment

See [STANDARDIZED_BUILD.md](./STANDARDIZED_BUILD.md) for more details.
4. Generate static HTML files for each appraiser and location
5. Fix any page issues and optimize
6. Prepare for Netlify deployment

## Development Commands

```bash
# Start development server
npm run dev

# Build for production (includes all steps)
npm run build

# Fetch images from ImageKit
npm run fetch:imagekit

# Randomize images for appraisers
npm run randomize:images

# Serve the built static files locally
npm run serve:static

# Run lint checks
npm run lint

# Clean the dist directory
npm run clean
```

## Deployment to Netlify

1. Run `npm run build` to create a complete static site in the `dist` directory
2. The `netlify.toml` file is configured to use these pre-built static files
3. When you push to your repository, Netlify will deploy these files without running any build commands

## VPS Static Publish (recommended)

The VPS deployment serves plain HTML from an nginx container, with content bind-mounted from a release directory (articles-style).

- Canonical editable surface: `public_site/`
- Publish (creates a release under `/mnt/srv-storage/antique-appraiser-directory/releases`, flips `current`, restarts the container):
  - `npm run publish`

## Project Structure

- `/src` - React TypeScript source code
- `/scripts` - Build and utility scripts
- `/data` - JSON data files for appraisers and locations
- `/dist` - Generated static output files

## Image Handling

Appraiser profile images are sourced from the ImageKit service, using the `/appraiser-images` folder. The build process fetches available images, randomly assigns them to appraisers, and ensures they are correctly displayed in the generated HTML.

## SEO Optimization Features

This directory frontend implements comprehensive SEO features to maximize Google ranking potential:

### Technical SEO Implementation

- **Pre-rendered HTML**: All pages are pre-rendered for optimal indexing by search engines
- **Schema.org Structured Data**: Rich structured data for appraisers, locations, and FAQs
- **Optimized Meta Tags**: Complete set of meta tags including title, description, canonical URLs
- **Social Sharing**: OpenGraph and Twitter Card tags for better sharing on social media
- **Semantic HTML**: Proper HTML5 semantic elements for better content parsing
- **Performance Optimization**: Minified HTML/CSS/JS with deferred script loading
- **Sitemap Generation**: Dynamic XML sitemap with priority and frequency attributes
- **Robots.txt**: Custom robots.txt with sitemap reference

### Content Optimization

- **Keyword-rich Content**: Pages are structured for relevant antique appraisal keywords
- **Structured Content**: Clear content hierarchy with proper heading structure
- **Local SEO**: Location-specific pages optimized for local search queries
- **FAQ Schema**: Structured FAQ content for potential featured snippets
- **Breadcrumbs**: Clear navigation paths with breadcrumb structured data

### Revenue-Focused SEO Ops (Current)

- **Selective appraiser indexing**: `scripts/apply-indexing-rules.mjs` now indexes only a curated, high-trust subset of appraiser profiles (verified/listed provider sources) while keeping low-confidence profile pages noindex.
- **High-intent city templates**: `scripts/generate-location-pages.mjs` now generates `/location/<city>/estate-appraisal/`, `/insurance-appraisal/`, and `/donation-appraisal/` pages for the top ROI city set.
- **Weekly title tuning loop**: run `npm run seo:title-tuning` (or `node scripts/gsc-weekly-title-tuning.mjs --days 28`) to generate data-driven title/description recommendations from Search Console into `/srv/manager/seo/<date>-location-title-tuning/`.
