# Image Generation for Appraiser Directories

This document provides detailed information about the image generation features integrated into both the Art Appraiser Directory and Antique Appraiser Directory.

## Overview

The appraiser directories include automatic image generation features that:

1. Identify appraisers without proper images
2. Generate custom professional images for them using AI
3. Update the appraiser data with the new image URLs

## Art Appraiser Image Generation

### Integration with Build Process

The feature is fully integrated into the build pipeline:

1. When you run `npm run build`, the system will:
   - Build the React application
   - Check for appraisers with missing or improperly formatted images
   - Generate new images for those appraisers using the image generation service
   - Update the appraiser data with the new image URLs
   - Generate the static HTML files
   - Copy the static files to the distribution directory

### Technical Implementation

The image generation service is an external API that:
- Accepts a POST request with appraiser data, prompt, and filename
- Generates an AI image based on the appraiser's specialties
- Uploads the image to ImageKit with the specified filename
- Returns the URL of the uploaded image

The frontend uses the `generate-missing-images.js` script that:
1. Scans all location JSON files for appraisers
2. Identifies appraisers without proper image URLs
3. For each missing image:
   - Generates a unique filename
   - Creates a prompt based on the appraiser's specialties
   - Calls the image generation API
   - Updates the appraiser data with the new image URL

## Antique Appraiser Image Generation

### Image Generation Service

The antique appraiser directory uses a dedicated image generation service available at:
```
https://image-generation-service-856401495068.us-central1.run.app
```

It provides an API endpoint for generating images:
```
POST /api/generate
```

### Scripts for Antique Directory

We have several scripts for generating images:

1. **Single Image Generation**
   - Script: `scripts/generate-antique-appraiser-images.js`
   - Command: `npm run generate:antique-images [count]`
   - This script randomly selects a specified number of appraisers (default: 3) and generates images for them.

2. **Test Image Generation for Specific Cities**
   - Script: `scripts/generate-antique-appraiser-images-test.js`
   - Command: `npm run generate:antique-images-test`
   - This script generates images for one appraiser each in New York, Chicago, and San Francisco.

3. **Batch Image Generation**
   - Script: `scripts/generate-antique-appraiser-images-batch.js`
   - Command: `npm run generate:antique-images-batch [batchSize]`
   - This script processes appraisers in batches (default batch size: 5) and keeps track of progress.

### Generated Images for Antique Appraisers

Here are the URLs for the images that have been generated so far:

1. New York - Prestige Estate Services:  
   `https://ik.imagekit.io/appraisily/appraiser-images/appraiser_new_york-prestige-estate-services_1742079322455_B8CCRPlQR.jpg`

2. Chicago - Adams Appraisal LLC:  
   `https://ik.imagekit.io/appraisily/appraiser-images/appraiser_chicago-adams-appraisal-llc_1742079326595_NI13K4cjC.jpg`

3. San Francisco - Turner Auctions + Appraisals:  
   `https://ik.imagekit.io/appraisily/appraiser-images/appraiser_san_francisco-1-turner-auctions-appraisals_1742079329924_eIV6H2sWp.jpg`

### How to Generate Images for All Antique Appraisers

To generate images for all antique appraisers, run the batch script multiple times:

```bash
# Generate images for the first batch of 5 appraisers
npm run generate:antique-images-batch

# Generate images for the next batch of 10 appraisers
npm run generate:antique-images-batch 10

# Continue running the command until all appraisers have images
```

The batch script keeps track of progress in a file called `image-generation-progress.json` in the root directory. This allows you to stop and resume the process at any time.

## Filename Format

All generated images follow a standardized naming pattern:

```
appraiser_{appraiser.id}_{timestamp}_{randomId}.jpg
```

For example:
```
appraiser_chicago-adams-appraisal-llc_1742079326595_NI13K4cjC.jpg
```

This naming convention ensures:
- Each image has a unique name
- Images are easily identifiable by appraiser
- Version tracking through timestamps and random IDs

## Customizing Image Generation

The image generation for antique appraisers uses a custom prompt:
```
Make a photorealistic image of an antique appraiser located in [city], [state]
```

You can modify the prompt in the scripts to generate different types of images.

## Troubleshooting

If you encounter issues with image generation:

1. Check if the image generation service is running
   ```bash
   curl https://image-generation-service-856401495068.us-central1.run.app/health
   ```

2. Look for error messages in the console output

3. Check the tracking file (`image-generation-progress.json`) to see progress

4. If an image fails to generate, the script will skip it and move on to the next appraiser

## Future Enhancements

Planned improvements to the image generation system:

1. Improved prompt engineering for more consistent results
2. Image regeneration capability for specific appraisers
3. Preview system for reviewing generated images before applying them
4. Integration with a content management system for manual overrides