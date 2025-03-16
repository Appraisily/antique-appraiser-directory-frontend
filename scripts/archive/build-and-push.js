import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const TEMP_DIR = path.join(ROOT_DIR, 'temp_deploy');

// Configuration - update these values
const GITHUB_REPO = 'https://github.com/yourusername/art-appraiser-dist.git'; // Replace with your repo
const BRANCH_NAME = 'main';
const BASE_URL = 'https://art-appraiser.yourdomain.com'; // Replace with your domain

// Set environment variable for sitemap generation
process.env.SITE_URL = BASE_URL;

async function buildAndPush() {
  try {
    console.log('🚀 Starting build and push process...');

    // Step 1: Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    fs.removeSync(DIST_DIR);
    fs.removeSync(TEMP_DIR);
    
    // Step 2: Build the application
    console.log('🏗️ Building application...');
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    
    // Step 3: Generate enhanced sitemap
    console.log('🗺️ Generating comprehensive sitemap...');
    await import('./generate-sitemap.js');
    
    // Step 4: Validate the build
    console.log('🔍 Validating build...');
    validateBuild();
    
    // Step 5: Set up temp directory for the dist branch
    console.log('📁 Setting up temp directory...');
    fs.ensureDirSync(TEMP_DIR);
    
    // Step 6: Clone the repository (only the specified branch, with depth 1 for performance)
    try {
      console.log(`🔄 Cloning ${BRANCH_NAME} branch...`);
      execSync(`git clone ${GITHUB_REPO} ${TEMP_DIR} --branch ${BRANCH_NAME} --single-branch --depth 1`, { stdio: 'inherit' });
    } catch (error) {
      // If the branch doesn't exist yet, clone without branch specification and create it
      console.log(`🌱 Branch ${BRANCH_NAME} doesn't exist yet, creating it...`);
      execSync(`git clone ${GITHUB_REPO} ${TEMP_DIR} --depth 1`, { stdio: 'inherit' });
      execSync(`cd ${TEMP_DIR} && git checkout -b ${BRANCH_NAME}`, { stdio: 'inherit' });
    }
    
    // Step 7: Remove all files in the temp directory except .git
    console.log('🗑️ Cleaning temp directory...');
    const filesToRemove = fs.readdirSync(TEMP_DIR)
      .filter(file => file !== '.git')
      .map(file => path.join(TEMP_DIR, file));
      
    filesToRemove.forEach(file => {
      fs.removeSync(file);
    });
    
    // Step 8: Copy dist to temp directory
    console.log('📋 Copying built files to temp directory...');
    fs.copySync(DIST_DIR, TEMP_DIR);

    // Copy and rename netlify-dist.toml to netlify.toml in the temp directory
    console.log('📝 Setting up Netlify configuration...');
    fs.copyFileSync(
      path.join(__dirname, 'netlify-dist.toml'),
      path.join(TEMP_DIR, 'netlify.toml')
    );

    // Copy the dist-specific .gitignore file
    console.log('📝 Setting up dist-specific .gitignore...');
    fs.copyFileSync(
      path.join(__dirname, 'dist-gitignore'),
      path.join(TEMP_DIR, '.gitignore')
    );
    
    // Step 9: Commit and push changes
    console.log('📤 Committing and pushing changes...');
    const timestamp = new Date().toISOString();
    execSync(`cd ${TEMP_DIR} && git add . && git commit -m "Deploy: ${timestamp}" && git push -u origin ${BRANCH_NAME}`, { stdio: 'inherit' });
    
    console.log('✅ Build and push completed successfully!');
    
    // Step 10: Clean up temp directory
    fs.removeSync(TEMP_DIR);
    
  } catch (error) {
    console.error('❌ Error during build and push:', error);
    process.exit(1);
  }
}

// Function to validate the build
function validateBuild() {
  // Check if the dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('Dist directory does not exist after build');
  }
  
  // Check if index.html exists
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error('index.html not found in dist directory');
  }
  
  // Check for assets directory
  const assetsDir = path.join(DIST_DIR, 'assets');
  if (!fs.existsSync(assetsDir)) {
    throw new Error('Assets directory not found in dist directory');
  }
  
  // Check for CSS and JS files
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find(file => file.endsWith('.css'));
  const jsFile = files.find(file => file.endsWith('.js'));
  
  if (!cssFile) {
    throw new Error('No CSS file found in assets directory');
  }
  
  if (!jsFile) {
    throw new Error('No JS file found in assets directory');
  }
  
  // Check if sitemap.xml exists
  if (!fs.existsSync(path.join(DIST_DIR, 'sitemap.xml'))) {
    throw new Error('sitemap.xml not found in dist directory');
  }
  
  console.log('✓ Build validation passed!');
  console.log(`  - CSS file: ${cssFile}`);
  console.log(`  - JS file: ${jsFile}`);
}

// Run the build and push process
buildAndPush(); 