import fetch from 'node-fetch';\nimport fs from 'fs-extra';\nimport path from 'path';\nimport { fileURLToPath } from 'url';\n\nconst __dirname = path.dirname(fileURLToPath(import.meta.url));\nconst LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');\n\n// ImageKit base URL for appraiser images\nconst IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/appraisily/appraiser-images';\n\n// Image generation service URL\nconst IMAGE_GENERATION_SERVICE = 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';\n\n// Counters for reporting\nlet totalAppraisers = 0;\nlet checkedImages = 0;\nlet missingImages = 0;

// Function to check if an image URL exists
async function checkImage(url) {
  try {
    console.log('Checking image URL:', url);
    const response = await fetch(url, { method: 'HEAD' });
    console.log('Response status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('Error checking image:', error.message);
    return false;
  }
}
