# Art Appraiser Directory Data Standardization

## Overview

This document outlines the standardization of the art appraiser data for the Art Appraiser Directory frontend.

## Project Structure

The new standardized data is stored in:
- `/src/data/standardized/` - Contains standardized JSON files for each location

## Standardized Schema

We've implemented a robust, structured data format for art appraisers that includes:

- Core information (ID, name, image)
- Structured address details
- Contact information
- Business details (hours, pricing, ratings)
- Expertise and certifications
- Content sections for marketing
- Reviews from customers
- Metadata for tracking

See the complete schema in `/src/data/standardized/README.md`.

## Scripts and Utilities

Only read-only reporting remains in the active script surface:

- `scripts/count-appraisers.js` - Counts and analyzes appraiser distribution

## Current Status

- **Total Locations**: 49
- **Total Appraisers**: 420
- **Average Per Location**: 8.57

## NPM Commands

```bash
# Count appraisers across all locations
npm run count:appraisers
```

## Next Steps

1. Update the frontend components to use the standardized data format
2. Enhance search functionality using the new structured data
3. Improve SEO with structured schema.org data based on this format
4. Create admin tools for updating the standardized data
