# Static Publish Scripts

This directory contains supported validation and HTML-maintenance scripts for the antique appraiser directory static site.

`public_site/` is the canonical published artifact. Profile and city page content under `public_site/appraiser/**` and `public_site/location/**` must not be mass-edited by scripts.

## Supported Workflow

For normal static validation:

```
npm run build
npm run check:static
```

## Deployment

Production publishing is not supported from this directory. Use the standard
VPS deploy helper for `antique-appraiser-directory` after validation and review.

## Remaining Scripts

Most script entrypoints in this directory are compatibility wrappers around
`/srv/repos/tools/directory-site-utils`. Keep the local wrapper paths because
package scripts and operator runbooks call them directly.

- `serve-static.js`: local static server for `public_site/`.
- `test-html.js`: read-only HTML diagnostics; use `--strict` only when missing local assets should fail the command.
- `count-appraisers.js`: read-only data count/report helper.
- `env-check.mjs`: environment validation.
- `gsc-weekly-title-tuning.mjs`: read-only Search Console title tuning report.
- `gsc-location-ctr-cohort.mjs`: read-only Search Console cohort report for the priority location-page CTR rewrite test.
- `build-indexing-manifest.mjs`: classifies sitemap URLs and writes only eligible static canonical pages.
- `check-indexing-contract.mjs`: audits every sitemap URL for static HTML, robots, canonical, H1, description, JSON-LD, and visible FAQ parity.
- `repair-faq-schema.mjs`: regenerates FAQ JSON-LD from visible FAQ sections and removes unsupported FAQ claims.
- `repair-short-mobile-compositing.mjs`: applies the 390x500 solid-nav/hero fallback for Chromium compositing stability.
- `repair-internal-location-links.mjs`: repairs links to missing location/profile routes without creating thin pages.
- `inject-donation-purpose-bridge.mjs` and `inject-directory-intent-chooser.mjs`: targeted marked-section patches on city/hub HTML, not full-page rewrites.
- `check-images.js`, `check-image-coverage.js`: legacy image diagnostics.

## Removed Build Path

The old `dist`/Netlify/full-regeneration path is removed from the normal workflow.

Do not reintroduce scripts that rebuild or mass-rewrite profile/location HTML in this repo.
