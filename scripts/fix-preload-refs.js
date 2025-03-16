/**
 * Script to fix preloaded asset references in HTML files
 * Specifically addresses the "/assets/index.js" and "/assets/index.css" 404s
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('🔄 Fixing preloaded asset references...');

// Find the real asset filenames
function getActualAssetFilenames() {
  const assetDir = path.join(DIST_DIR, 'assets');
  if (!fs.existsSync(assetDir)) {
    console.error(chalk.red('❌ Assets directory not found!'));
    return { js: null, css: null };
  }

  const files = fs.readdirSync(assetDir);
  const mainJs = files.find(file => file.startsWith('index-') && file.endsWith('.js'));
  const mainCss = files.find(file => file.startsWith('index-') && file.endsWith('.css'));
  
  if (!mainJs) {
    console.error(chalk.red('❌ Could not find main JS file in assets directory'));
  }
  
  if (!mainCss) {
    console.error(chalk.red('❌ Could not find main CSS file in assets directory'));
  }
  
  return { js: mainJs, css: mainCss };
}

// Process a single HTML file
function fixHtmlFile(filePath, assetNames) {
  const { js, css } = assetNames;
  if (!js && !css) {
    console.warn(chalk.yellow(`⚠️ No assets to reference in ${filePath}`));
    return false;
  }
  
  // Read the file
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Parse the HTML
    const dom = new JSDOM(content);
    const { document } = dom.window;
    
    // Check if we should use /directory/assets/ or /assets/ prefix
    const useDirectoryPrefix = document.querySelector('link[href^="/directory/assets/"]') !== null;
    const assetPrefix = useDirectoryPrefix ? '/directory/assets/' : '/assets/';
    
    console.log(chalk.blue(`📂 Using asset prefix ${assetPrefix} for ${path.relative(DIST_DIR, filePath)}`));
    
    // Fix preload links
    const preloadLinks = document.querySelectorAll('link[rel="preload"]');
    for (const link of preloadLinks) {
      const href = link.getAttribute('href');
      
      // Always add crossorigin attribute to preload links to fix credentials mismatch warning
      if (!link.hasAttribute('crossorigin')) {
        console.log(chalk.blue(`📌 Adding crossorigin attribute to preload in ${path.relative(DIST_DIR, filePath)}`));
        link.setAttribute('crossorigin', '');
        modified = true;
      }
      
      if (href === '/assets/index.js' && js) {
        console.log(chalk.blue(`📌 Fixing JS preload in ${path.relative(DIST_DIR, filePath)}`));
        link.setAttribute('href', `${assetPrefix}${js}`);
        modified = true;
      } else if (href === '/assets/index.css' && css) {
        console.log(chalk.blue(`📌 Fixing CSS preload in ${path.relative(DIST_DIR, filePath)}`));
        link.setAttribute('href', `${assetPrefix}${css}`);
        modified = true;
      } else if (href === '/directory/assets/index.js' && js) {
        console.log(chalk.blue(`📌 Fixing JS preload in ${path.relative(DIST_DIR, filePath)}`));
        link.setAttribute('href', `${assetPrefix}${js}`);
        modified = true;
      } else if (href === '/directory/assets/index.css' && css) {
        console.log(chalk.blue(`📌 Fixing CSS preload in ${path.relative(DIST_DIR, filePath)}`));
        link.setAttribute('href', `${assetPrefix}${css}`);
        modified = true;
      }
    }
    
    // Remove duplicate links and scripts with different prefixes
    const removePrefix = useDirectoryPrefix ? '/assets/' : '/directory/assets/';
    
    // Remove duplicate links
    const allLinks = document.querySelectorAll('link[href]');
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      if (href && href.startsWith(removePrefix)) {
        console.log(chalk.yellow(`🧹 Removing duplicate link in ${path.relative(DIST_DIR, filePath)}: ${href}`));
        link.parentNode.removeChild(link);
        modified = true;
      }
    }
    
    // Remove duplicate scripts
    const allScripts = document.querySelectorAll('script[src]');
    for (const script of allScripts) {
      const src = script.getAttribute('src');
      if (src && src.startsWith(removePrefix)) {
        console.log(chalk.yellow(`🧹 Removing duplicate script in ${path.relative(DIST_DIR, filePath)}: ${src}`));
        script.parentNode.removeChild(script);
        modified = true;
      }
    }
    
    // Fix direct script and link references
    const existingCss = document.querySelector(`link[href="${assetPrefix}${css}"]`);
    const existingJs = document.querySelector(`script[src="${assetPrefix}${js}"]`);
    
    // Add missing CSS file reference if needed
    if (!existingCss && css) {
      console.log(chalk.green(`📌 Adding CSS link in ${path.relative(DIST_DIR, filePath)}`));
      const linkEl = document.createElement('link');
      linkEl.setAttribute('rel', 'stylesheet');
      linkEl.setAttribute('crossorigin', '');
      linkEl.setAttribute('href', `${assetPrefix}${css}`);
      document.head.appendChild(linkEl);
      modified = true;
    }
    
    // Add missing JS file reference if needed
    if (!existingJs && js) {
      console.log(chalk.green(`📌 Adding JS script in ${path.relative(DIST_DIR, filePath)}`));
      const scriptEl = document.createElement('script');
      scriptEl.setAttribute('type', 'module');
      scriptEl.setAttribute('crossorigin', '');
      scriptEl.setAttribute('src', `${assetPrefix}${js}`);
      scriptEl.setAttribute('defer', '');
      document.head.appendChild(scriptEl);
      modified = true;
    }
    
    if (modified) {
      // Write the changes back to the file
      fs.writeFileSync(filePath, dom.serialize(), 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(chalk.red(`❌ Error processing ${filePath}: ${error.message}`));
    return false;
  }
}

// Process all HTML files recursively
function processDirectory(dir, assetNames) {
  let fixedCount = 0;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively process subdirectories
      fixedCount += processDirectory(filePath, assetNames);
    } else if (file.endsWith('.html')) {
      // Process HTML files
      if (fixHtmlFile(filePath, assetNames)) {
        fixedCount++;
      }
    }
  }
  
  return fixedCount;
}

try {
  // Get the actual asset filenames
  const assetNames = getActualAssetFilenames();
  console.log(chalk.blue(`📊 Found assets: JS=${assetNames.js || 'none'}, CSS=${assetNames.css || 'none'}`));
  
  // Process all HTML files
  const fixedCount = processDirectory(DIST_DIR, assetNames);
  
  if (fixedCount > 0) {
    console.log(chalk.green(`✅ Fixed asset references in ${fixedCount} files`));
  } else {
    console.log(chalk.yellow('⚠️ No files needed fixing'));
  }
  
} catch (error) {
  console.error(chalk.red(`❌ Error: ${error.message}`));
  process.exit(1);
}