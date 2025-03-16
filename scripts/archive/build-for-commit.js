import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Configuration
const BASE_URL = process.env.SITE_URL || 'https://art-appraiser.appraisily.com';

// Set environment variable for sitemap generation
process.env.SITE_URL = BASE_URL;

async function buildForCommit() {
  try {
    console.log('🚀 Starting build process for direct committing...');

    // Step 1: Clean previous build
    console.log('🧹 Cleaning previous build...');
    fs.removeSync(DIST_DIR);
    
    // Step 2: Build the application
    console.log('🏗️ Building application...');
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    
    // Step 3: Generate enhanced sitemap
    console.log('🗺️ Generating comprehensive sitemap...');
    await import('./generate-sitemap.js');
    
    // Step 4: Validate the build
    console.log('🔍 Validating build...');
    validateBuild();
    
    // Step 5: Create a .gitignore exception for dist folder
    console.log('📝 Creating .gitignore exception for dist folder...');
    createGitignoreException();
    
    console.log('✅ Build completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Commit the changes including the dist folder');
    console.log('2. Push to your repository');
    console.log('3. Netlify will automatically deploy the updated site');
    
  } catch (error) {
    console.error('❌ Error during build:', error);
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

// Function to create a .gitignore exception for the dist folder
function createGitignoreException() {
  const gitignorePath = path.join(ROOT_DIR, '.gitignore');
  
  if (fs.existsSync(gitignorePath)) {
    let content = fs.readFileSync(gitignorePath, 'utf8');
    
    // Check if dist is ignored
    if (content.includes('/dist') || content.includes('dist/') || content.match(/^dist$/m)) {
      // Create a temporary backup of the original .gitignore
      fs.writeFileSync(`${gitignorePath}.bak`, content);
      
      // Add the exception for dist folder
      content = content.replace(/^dist\/?$/m, '# dist  # Uncommenting for Netlify deployment');
      content = content.replace(/^\/dist$/m, '# /dist  # Uncommenting for Netlify deployment');
      content = content.replace(/^dist\/$/m, '# dist/  # Uncommenting for Netlify deployment');
      
      // Add a notice at the top
      const notice = `# IMPORTANT: The dist folder is temporarily NOT ignored for Netlify deployment\n` +
                    `# Remember to revert this change after pushing to avoid committing build files in development\n\n`;
      
      fs.writeFileSync(gitignorePath, notice + content);
      
      console.log('Modified .gitignore to allow committing the dist folder');
      console.log('⚠️  IMPORTANT: Remember to restore original .gitignore after deployment!');
    } else {
      console.log('No need to modify .gitignore - dist folder is not ignored');
    }
  } else {
    console.log('No .gitignore file found');
  }
}

// Run the build
buildForCommit().catch(error => {
  console.error('Failed to build for commit:', error);
  process.exit(1);
}); 