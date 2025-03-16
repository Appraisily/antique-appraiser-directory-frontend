# Build Scripts

This directory contains various scripts for building, fixing, and deploying the art appraiser directory frontend.

## Domain Configuration Scripts

The following scripts handle URL management between the main domain and subdomain:

### fix-appraiser-links.js

Fixes URLs in source code files (*.ts, *.tsx) to ensure all appraiser page links point to the subdomain instead of the main domain.

```
npm run fix:appraiser-links
```

### fix-subdomain-links.js

Processes all HTML files in the build output to update any URLs that point to appraiser pages on the main domain to use the subdomain instead.

```
npm run fix:all-subdomain-links
```

### fix-js-urls.js

Updates compiled JavaScript files to ensure any hardcoded URLs pointing to the main domain are corrected to use the subdomain.

```
npm run fix:js-urls
```

## Build Process

For a complete build with all fixes applied:

```
npm run rebuild:fixes
```

This will:
1. Fix appraiser links in source files
2. Clean the dist directory
3. Run the build process
4. Apply all asset and URL fixes

## Deployment

To prepare for Netlify deployment:

```
npm run build:netlify-ready
```

This runs the full build process and then prepares the files for Netlify deployment by:
1. Fixing all domain references
2. Creating proper headers configuration
3. Configuring the Netlify settings