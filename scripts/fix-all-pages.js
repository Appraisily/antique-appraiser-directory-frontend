#!/usr/bin/env node

/**
 * Fix-All-Pages.js
 * 
 * This script fixes all the static HTML files for the site:
 * 1. Fixes React hydration issues
 * 2. Injects fallback image handler
 * 3. Rebuilds with correct paths
 * 4. Generates static HTML files for all location pages
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import chalk from 'chalk';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CITIES_PATH = path.join(ROOT_DIR, 'src', 'data', 'cities.json');

// Log with color and timestamp
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toISOString();
  let coloredMessage;

  switch (type) {
    case 'warning':
      coloredMessage = chalk.yellow(message);
      break;
    case 'error':
      coloredMessage = chalk.red(message);
      break;
    case 'success':
      coloredMessage = chalk.green(message);
      break;
    default:
      coloredMessage = chalk.blue(message);
  }

  console.log(`[${timestamp}] ${coloredMessage}`);
}

/**
 * Run a script as a subprocess and return its output
 */
function runScript(command, args = []) {
  return new Promise((resolve, reject) => {
    const cmdString = `${command} ${args.join(' ')}`;
    log(`Running command: ${cmdString}`, 'info');
    
    exec(cmdString, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
      if (error) {
        log(`Error running script: ${error.message}`, 'error');
        log(stderr, 'error');
        reject(error);
        return;
      }
      
      resolve(stdout);
    });
  });
}

/**
 * Get all HTML files in the dist directory
 */
async function getAllHtmlFiles(dir = DIST_DIR) {
  const files = await fs.readdir(dir);
  let htmlFiles = [];
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      const nestedFiles = await getAllHtmlFiles(filePath);
      htmlFiles = [...htmlFiles, ...nestedFiles];
    } else if (file.endsWith('.html')) {
      htmlFiles.push(filePath);
    }
  }
  
  return htmlFiles;
}

/**
 * Fix React hydration in all HTML files - Optimized version
 * This processes files in batches to prevent excessive subprocess spawning
 */
async function fixAllHydrationIssues() {
  log('Fixing React hydration issues in all HTML files...', 'info');
  
  try {
    const htmlFiles = await getAllHtmlFiles();
    log(`Found ${htmlFiles.length} HTML files to process.`, 'info');
    
    // Instead of processing each file individually, run the script once
    // for specific important files, then let it handle everything else
    
    // Process the main index.html first
    const mainIndex = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(mainIndex)) {
      log('Processing main index.html...', 'info');
      await runScript('node', [path.join(__dirname, 'fix-react-hydration.js'), 'index.html']);
    }
    
    // Process the Cleveland location page 
    const clevelandPage = path.join(DIST_DIR, 'location', 'cleveland', 'index.html');
    if (fs.existsSync(clevelandPage)) {
      log('Processing Cleveland location page...', 'info');
      await runScript('node', [path.join(__dirname, 'fix-react-hydration.js'), 'location/cleveland/index.html']);
    }
    
    // Now run the script without a specific file, which will make it process all files
    log('Processing all remaining HTML files...', 'info');
    const output = await runScript('node', [path.join(__dirname, 'fix-react-hydration.js')]);
    
    log('Completed hydration fixes', 'success');
    return htmlFiles.length;
  } catch (error) {
    log(`Error fixing hydration issues: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Create HTML files for all location pages
 */
async function generateLocationPages() {
  log('Generating static HTML files for all location pages...', 'info');
  
  try {
    // Check if cities data exists
    if (!fs.existsSync(CITIES_PATH)) {
      log('⚠️ Cities data file not found!', 'warning');
      return 0;
    }

    // Read cities data
    const citiesData = JSON.parse(fs.readFileSync(CITIES_PATH, 'utf-8'));
    const cities = citiesData.cities || [];

    if (cities.length === 0) {
      log('⚠️ No cities found in the data file!', 'warning');
      return 0;
    }

    log(`📊 Found ${cities.length} cities to process`, 'info');
    let generatedCount = 0;

    // Create location directories and HTML files
    for (const city of cities) {
      const locationDir = path.join(DIST_DIR, 'location', city.slug);
      
      // Create directory if it doesn't exist
      fs.ensureDirSync(locationDir);
      
      // Read the index.html content to use as template
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (!fs.existsSync(indexPath)) {
        log(`⚠️ Index file not found at ${indexPath}!`, 'warning');
        continue;
      }
      
      const indexHtml = fs.readFileSync(indexPath, 'utf-8');
      
      // Create city-specific meta tags
      const title = `Art Appraisers in ${city.name}, ${city.state} | Expert Art Valuation Services`;
      const description = `Find certified art appraisers in ${city.name}, ${city.state}. Get expert art valuations, authentication services, and professional advice for your art collection.`;
      const canonicalUrl = `https://art-appraiser-directory.appraisily.com/location/${city.slug}`;
      
      // Update HTML with city-specific meta tags
      const cityHtml = indexHtml
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${description}"`)
        .replace(/<link rel="canonical" href=".*?"/, `<link rel="canonical" href="${canonicalUrl}"`);
      
      // Write the HTML file
      const locationHtmlPath = path.join(locationDir, 'index.html');
      fs.writeFileSync(locationHtmlPath, cityHtml);
      
      log(`✅ Generated page for ${city.name}, ${city.state}`, 'success');
      generatedCount++;
    }

    log(`🎉 Successfully generated ${generatedCount} location pages!`, 'success');
    return generatedCount;
  } catch (error) {
    log(`❌ Error generating location pages: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting comprehensive page fix process...', 'info');
    
    // Step 1: Rebuild the static files if needed
    const shouldRebuild = process.argv.includes('--rebuild');
    if (shouldRebuild) {
      log('Rebuilding static files...', 'info');
      const rebuildOutput = await runScript('npm run rebuild-static');
      log(rebuildOutput, 'info');
    }
    
    // Step 2: Fix React hydration issues in all HTML files
    await fixAllHydrationIssues();
    
    // Step 3: Inject fallback image handler
    const fallbackOutput = await runScript('node', [path.join(__dirname, 'inject-fallback-image-handler.js')]);
    log(fallbackOutput, 'info');
    
    // Step 4: Generate static HTML files for all location pages
    await generateLocationPages();
    
    log('\nAll pages fixed successfully!', 'success');
    log('Next steps:', 'info');
    log('1. Run `npm run serve:static` to test the site locally', 'info');
    log('2. Commit and push the changes', 'info');
    log('3. Deploy to Netlify', 'info');
  } catch (error) {
    log(`Error fixing pages: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();