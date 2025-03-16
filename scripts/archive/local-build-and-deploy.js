import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

/**
 * This script automates the process of building and preparing files for Netlify deployment
 * It performs the following steps:
 * 1. Checks if the local image generation service is running
 * 2. Configures the build to use the local image service
 * 3. Runs the build process
 * 4. Fixes React hydration issues in generated HTML
 * 5. Validates the generated files
 * 6. Provides instructions for deployment to Netlify
 */

const IMAGE_GEN_SERVICE_URL = process.env.IMAGE_GENERATION_API || 'https://image-generation-service-856401495068.us-central1.run.app/api/generate';

// Check if image generation service is running
async function checkImageService() {
  console.log(`\n🔍 Checking if image generation service is running at ${IMAGE_GEN_SERVICE_URL}...`);
  
  // Extract hostname and path from URL
  const url = new URL(IMAGE_GEN_SERVICE_URL);
  
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: '/health',
        method: 'GET',
      },
      (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Image generation service is running!');
          resolve(true);
        } else {
          console.log('⚠️ Image generation service returned non-200 status code.');
          resolve(false);
        }
      }
    );
    
    req.on('error', () => {
      console.log('❌ Cannot connect to image generation service.');
      console.log(`ℹ️ You can start the service by running the following commands:`);
      console.log(`   1. cd ../image-generation-service`);
      console.log(`   2. npm install (if not already done)`);
      console.log(`   3. npm start`);
      console.log(`   Then run this script again.`);
      resolve(false);
    });
    
    req.end();
  });
}

// Run the build process
async function runBuild() {
  console.log('\n🏗️ Running build process...');
  
  try {
    // Set environment variable for the build
    process.env.IMAGE_GENERATION_API = IMAGE_GEN_SERVICE_URL;
    
    // Run the build commands
    console.log('📦 Building React application...');
    execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR });
    
    console.log('✅ Build completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    return false;
  }
}

// Fix React hydration issues in all HTML files
async function fixReactHydration() {
  console.log('\n🔧 Fixing React hydration issues in HTML files...');
  
  try {
    // Run the hydration fix script
    console.log('🛠️ Running hydration fix script...');
    execSync('node scripts/fix-react-hydration.js', { stdio: 'inherit', cwd: ROOT_DIR });
    
    console.log('✅ Hydration fixes applied successfully!');
    return true;
  } catch (error) {
    console.error('❌ Hydration fix failed:', error.message);
    console.log('⚠️ Continuing without hydration fixes...');
    return true; // Continue with the process despite errors
  }
}

// Validate the generated files
async function validateBuild() {
  console.log('\n🔍 Validating generated files...');
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Dist directory does not exist!');
    return false;
  }
  
  // Check for key files
  const hasIndexHtml = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  const has404Html = fs.existsSync(path.join(DIST_DIR, '404.html'));
  const hasAssetsDir = fs.existsSync(path.join(DIST_DIR, 'assets'));
  const hasLocationDir = fs.existsSync(path.join(DIST_DIR, 'location'));
  const hasAppraiserDir = fs.existsSync(path.join(DIST_DIR, 'appraiser'));
  
  if (!hasIndexHtml || !has404Html || !hasAssetsDir || !hasLocationDir || !hasAppraiserDir) {
    console.error('❌ Missing critical files in dist directory!');
    console.error(`   - index.html: ${hasIndexHtml ? '✅' : '❌'}`);
    console.error(`   - 404.html: ${has404Html ? '✅' : '❌'}`);
    console.error(`   - assets/: ${hasAssetsDir ? '✅' : '❌'}`);
    console.error(`   - location/: ${hasLocationDir ? '✅' : '❌'}`);
    console.error(`   - appraiser/: ${hasAppraiserDir ? '✅' : '❌'}`);
    return false;
  }
  
  console.log('✅ Build validation passed!');
  return true;
}

// Generate sitemap if not already done
async function ensureSitemap() {
  console.log('\n🗺️ Checking for sitemap...');
  
  const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
  
  if (!fs.existsSync(sitemapPath)) {
    console.log('📝 Generating sitemap...');
    try {
      execSync('npm run build:sitemap', { stdio: 'inherit', cwd: ROOT_DIR });
      console.log('✅ Sitemap generated successfully!');
    } catch (error) {
      console.error('⚠️ Failed to generate sitemap:', error.message);
      console.log('⚠️ Continuing without sitemap...');
    }
  } else {
    console.log('✅ Sitemap already exists.');
  }
}

// Provide deployment instructions
function showDeploymentInstructions() {
  console.log('\n🚀 Ready for deployment!');
  console.log('\nTo deploy to Netlify, you can:');
  console.log('1. Use the Netlify CLI:');
  console.log('   netlify deploy --dir=dist --prod');
  console.log('\n2. Or manually upload the dist folder to Netlify:');
  console.log('   - Go to https://app.netlify.com/');
  console.log('   - Drag and drop the dist folder to the deploy section');
  console.log('\n3. Or use Netlify\'s continuous deployment with GitHub:');
  console.log('   - Connect your repository to Netlify');
  console.log('   - Set the build command to: npm run build');
  console.log('   - Set the publish directory to: dist');
}

// Main function
async function main() {
  console.log('🚀 Starting local build and deploy process...');
  
  // Check if image service is running
  const serviceRunning = await checkImageService();
  
  // Continue even if service is not running
  console.log('⚠️ Continuing build process without image service...');
  
  // Run the build process
  const buildSuccess = await runBuild();
  if (!buildSuccess) {
    return;
  }
  
  // Fix React hydration issues
  await fixReactHydration();
  
  // Validate the build
  const validBuild = await validateBuild();
  if (!validBuild) {
    return;
  }
  
  // Ensure sitemap exists
  await ensureSitemap();
  
  // Show deployment instructions
  showDeploymentInstructions();
}

// Run the main function
main().catch(error => {
  console.error('❌ An unexpected error occurred:', error);
  process.exit(1);
}); 