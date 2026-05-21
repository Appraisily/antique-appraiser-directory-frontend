# Static Publish Scripts

This directory contains the supported scripts for validating and patch-publishing the antique appraiser directory static site.

`public_site/` is the canonical published artifact. Profile and city page content under `public_site/appraiser/**` and `public_site/location/**` must not be mass-edited by scripts.

## Supported Workflow

For normal static validation:

```
npm run build
npm run check:static
```

## Deployment

Use patch publish for homepage, nav, footer, managed CTA block, CSS, or asset-only
deploys:

```
npm run publish:patch
```

Patch publish clones the active release first, overlays only allow-listed static
paths from `public_site/`, then updates shared envelope blocks on existing
appraiser/location pages. It refuses direct `appraiser/` and `location/` path
overlays and verifies protected profile/city content before flipping `current`.

Full generated publish is disabled from npm. Individual appraiser and location
HTML content should only change through direct, reviewed HTML edits. Do not use
scripts to mass-edit `public_site/appraiser/**` or `public_site/location/**`.

## Remaining Scripts

Most script entrypoints in this directory are compatibility wrappers around
`/srv/repos/tools/directory-site-utils`. Keep the local wrapper paths because
package scripts and operator runbooks call them directly.

- `publish-patch.mjs`: patch publisher for homepage/assets/shared envelope blocks.
- `serve-static.js`: local static server for `public_site/`.
- `test-html.js`: read-only HTML diagnostics; use `--strict` only when missing local assets should fail the command.
- `count-appraisers.js`: read-only data count/report helper.
- `env-check.mjs`: environment validation.
- `gsc-weekly-title-tuning.mjs`: read-only Search Console title tuning report.
- `list-imagekit-images.js`, `check-imagekit-connection.js`, `check-images.js`, `check-image-coverage.js`: image diagnostics.

## Removed Build Path

The old `dist`/Netlify/full-regeneration path is removed from the normal workflow.

Do not reintroduce scripts that rebuild or mass-rewrite profile/location HTML in this repo.
