# Antique Appraiser Directory Frontend

This repository now operates as a static publishing system for the Antique Appraiser Directory website.

The production surface is plain HTML served directly from `public_site/` through the VPS release directory. Source data still lives in the repo, but the canonical published artifact is the final static HTML, not a rebuilt SPA bundle.

Operational guardrails: [docs/operational-guardrails.md](docs/operational-guardrails.md).

## Features

- Standardized data model for consistent UI and maintenance
- Static HTML publishing for all appraiser and location pages
- Integration with ImageKit for appraiser profile images
- SEO optimization with structured schema.org data
- Fast and responsive UI with Tailwind CSS
- Release-directory patch publish flow for VPS deployment

## Standardized Data Model

The project now uses a standardized data format for all appraiser data:

- Consistent field names and data structures
- Comprehensive appraiser profiles with detailed information
- Rich schema.org markup for improved SEO
- See [DATA_STANDARDIZATION.md](./DATA_STANDARDIZATION.md) for details

## Static-First Workflow

The normal workflow is now `public_site`-first.

### Recommended Commands

```bash
npm run build
npm run serve:static
npm run publish:patch
```

`npm run build` is validation-only. It does not compile a new app shell or refresh generated profile/location HTML.

## Development Commands

```bash
# Start development server
npm run dev

# Validate the canonical static site in public_site/
npm run build

# Fetch images from ImageKit
npm run fetch:imagekit

# Serve the canonical static site locally
npm run serve:static

# Patch homepage/assets/envelope over the active release without replacing directory content
npm run publish:patch

# Run lint checks
npm run lint

```

## VPS Static Publish (recommended)

The VPS deployment serves plain HTML from an nginx container, with content bind-mounted from a release directory (articles-style).

- Canonical editable surface: `public_site/`
- Patch publish for homepage/nav/footer/static-only changes:
  - `npm run publish:patch`
- Validate without mutating generated profile/location HTML:
  - `npm run build`

`npm run publish:patch` is the default for envelope-only changes. It starts from
the active release, overlays homepage/assets from `public_site/`, updates shared
managed envelope blocks on existing appraiser/location pages, and verifies that
protected profile/city content is unchanged before flipping `current`.

Full generated publish is disabled from npm. Use direct reviewed HTML edits for
individual profile or city content. Do not use scripts to mass-edit
`public_site/appraiser/**` or `public_site/location/**`.

## Project Structure

- `/src` - React TypeScript source code
- `/scripts` - Build and utility scripts
- `/data` - JSON data files for appraisers and locations
- `/public_site` - Canonical static HTML served in production

## Image Handling

Appraiser profile images are sourced from the ImageKit service, using the `/appraiser-images` folder. The remaining ImageKit scripts are diagnostics only; profile HTML should not be rewritten by image automation.

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

- **Static-first route governance**: profile and location pages are changed by direct reviewed HTML edits, not regeneration scripts.
- **Weekly title tuning loop**: run `npm run seo:title-tuning` (or `node scripts/gsc-weekly-title-tuning.mjs --days 28`) to generate data-driven title/description recommendations from Search Console into `/srv/manager/seo/<date>-location-title-tuning/`.
