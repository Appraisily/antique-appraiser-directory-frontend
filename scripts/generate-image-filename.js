import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

// Function to generate a standardized image filename for the image generator
function generateImageFilename(appraiser, citySlug) {
  // Create a base filename using the appraiser ID
  const baseFilename = `appraiser_${appraiser.id}`;
  
  // Add timestamp and random ID to match the pattern
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  
  // Final filename in the format: appraiser_[id]_[timestamp]_V[randomId].jpg
  return `${baseFilename}_${timestamp}_V${randomId}.jpg`;
}

// Example usage
console.log("Image Filename Generator");
console.log("=======================");
console.log("This script demonstrates how to generate image filenames for the image generator.");
console.log("");

// Read a sample location file
const locationFiles = fs.readdirSync(LOCATIONS_DIR)
  .filter(file => file.endsWith('.json') && !file.includes('copy'));

if (locationFiles.length > 0) {
  const sampleFile = locationFiles[0];
  const citySlug = sampleFile.replace('.json', '');
  const locationData = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, sampleFile)));
  
  if (locationData.appraisers && locationData.appraisers.length > 0) {
    const sampleAppraiser = locationData.appraisers[0];
    
    console.log(`Sample appraiser: ${sampleAppraiser.name} (ID: ${sampleAppraiser.id})`);
    console.log(`City: ${citySlug}`);
    console.log("");
    
    const filename = generateImageFilename(sampleAppraiser, citySlug);
    console.log(`Generated filename: ${filename}`);
    console.log(`Full ImageKit URL would be: https://ik.imagekit.io/appraisily/appraiser-images/${filename}`);
    
    console.log("");
    console.log("Implementation for image-generation submodule:");
    console.log("--------------------------------------------");
    console.log(`
// In your image-generation API endpoint:

// 1. Add a new parameter to accept the desired filename
app.post('/generate-image', async (req, res) => {
  const { prompt, style, filename } = req.body;
  
  // 2. Generate the image as usual
  const imageBuffer = await generateImage(prompt, style);
  
  // 3. Use the provided filename when uploading to ImageKit
  const uploadResult = await imagekit.upload({
    file: imageBuffer,
    fileName: filename || \`generated_image_\${Date.now()}.jpg\`, // Use provided filename or fallback
    folder: '/appraiser-images/'
  });
  
  // 4. Return the result with the exact filename that was used
  res.json({
    success: true,
    imageUrl: uploadResult.url,
    filename: uploadResult.name
  });
});
`);
  }
} 