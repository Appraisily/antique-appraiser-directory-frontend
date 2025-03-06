# Automatic Image Generation for Art Appraiser Directory

This document provides detailed information about the automatic image generation feature integrated into the Art Appraiser Directory.

## Overview

The Art Appraiser Directory now includes an automatic image generation feature that:

1. Identifies appraisers without proper images
2. Generates custom professional images for them using AI
3. Updates the appraiser data with the new image URLs

## Integration with Build Process

The feature is fully integrated into the build pipeline:

1. When you run `npm run build`, the system will:
   - Build the React application
   - Check for appraisers with missing or improperly formatted images
   - Generate new images for those appraisers using the image generation service
   - Update the appraiser data with the new image URLs
   - Generate the static HTML files
   - Copy the static files to the distribution directory

## Technical Implementation

### Image Generation Service

The image generation service is an external API that:
- Accepts a POST request with appraiser data, prompt, and filename
- Generates an AI image based on the appraiser's specialties
- Uploads the image to ImageKit with the specified filename
- Returns the URL of the uploaded image

### Client Integration

The frontend uses the `generate-missing-images.js` script that:
1. Scans all location JSON files for appraisers
2. Identifies appraisers without proper image URLs
3. For each missing image:
   - Generates a unique filename
   - Creates a prompt based on the appraiser's specialties
   - Calls the image generation API
   - Updates the appraiser data with the new image URL

### Filename Format

All generated images follow a standardized naming pattern:

```
appraiser_{appraiser.id}_{timestamp}_V{randomId}.jpg
```

For example:
```
appraiser_chicago-prestige-estate-services_1635789012345_Vx4f2z9b.jpg
```

This naming convention ensures:
- Each image has a unique name
- Images are easily identifiable by appraiser
- Version tracking through timestamps and random IDs

## Configuration

### Image Generation Service URL

By default, the script looks for the image generation service at `http://localhost:3000/api/generate`. 

You can set a custom URL by setting the environment variable:

```bash
# Windows
$env:IMAGE_GENERATION_API="http://your-image-service-url/api/generate"

# Linux/Mac
export IMAGE_GENERATION_API="http://your-image-service-url/api/generate"
```

### Prerequisites

Before running the build with image generation:

1. Ensure the image generation service is running and accessible
2. Make sure your API key for the service is properly configured
3. Verify that all appraisers have proper `id` values in the location JSON files

## Manual Usage

If you want to manually fix missing images without doing a full build:

```bash
npm run fix-images
```

After running this command, you should regenerate the static files:

```bash
npm run rebuild-static
```

## Troubleshooting

If you encounter issues with image generation:

1. Check if the image generation service is running
   ```bash
   curl http://localhost:3000/health
   ```

2. Verify environment variables are set correctly
   ```bash
   # Windows
   echo $env:IMAGE_GENERATION_API
   
   # Linux/Mac
   echo $IMAGE_GENERATION_API
   ```

3. Look for error messages in the build console output

4. If an image fails to generate, the system will use a placeholder image as a fallback

## Future Enhancements

Planned improvements to the image generation system:

1. Bulk image generation for faster processing
2. Image regeneration capability for specific appraisers
3. Preview system for reviewing generated images before applying them
4. Integration with a content management system for manual overrides 