/**
 * Script to fix asset paths in the HTML files
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('🔄 Fixing HTML file paths...');

// Get actual asset filenames
function getAssetFilenames() {
  const assetDir = path.join(DIST_DIR, 'assets');
  if (!fs.existsSync(assetDir)) {
    console.error('❌ Assets directory not found!');
    return { jsFiles: [], cssFiles: [] };
  }

  const files = fs.readdirSync(assetDir);
  const jsFiles = files.filter(file => file.endsWith('.js'));
  const cssFiles = files.filter(file => file.endsWith('.css'));
  
  return { jsFiles, cssFiles };
}

// Fix preloaded assets in HTML files
function fixHtmlFile(filePath, assetInfo) {
  try {
    const { jsFiles, cssFiles } = assetInfo;
    const mainJs = jsFiles.find(file => file.startsWith('index-'));
    const mainCss = cssFiles.find(file => file.startsWith('index-'));

    if (!mainJs || !mainCss) {
      console.warn(`⚠️ Could not find main JS or CSS files for ${filePath}`);
      return false;
    }

    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parse the HTML
    const dom = new JSDOM(content);
    const { document } = dom.window;
    
    let modified = false;
    
    // 1. Fix preload links that point to non-existent files
    const preloadLinks = document.querySelectorAll('link[rel="preload"]');
    preloadLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === '/assets/index.css') {
        link.setAttribute('href', `/assets/${mainCss}`);
        modified = true;
      } else if (href === '/assets/index.js') {
        link.setAttribute('href', `/assets/${mainJs}`);
        modified = true;
      }
    });
    
    // 2. Remove any script or link tags that point to non-existent files
    const scriptTags = document.querySelectorAll('script[src]');
    scriptTags.forEach(script => {
      const src = script.getAttribute('src');
      if (src === '/assets/index.js') {
        // Either remove the script or update to the correct path
        if (mainJs) {
          script.setAttribute('src', `/assets/${mainJs}`);
        } else {
          script.parentNode.removeChild(script);
        }
        modified = true;
      }
    });
    
    const linkTags = document.querySelectorAll('link[href]');
    linkTags.forEach(link => {
      const href = link.getAttribute('href');
      if (href === '/assets/index.css') {
        // Either remove the link or update to the correct path
        if (mainCss) {
          link.setAttribute('href', `/assets/${mainCss}`);
        } else {
          link.parentNode.removeChild(link);
        }
        modified = true;
      }
    });
    
    // 3. Make sure the correct script is included
    const mainScriptIncluded = Array.from(scriptTags).some(script => 
      script.getAttribute('src')?.includes(mainJs)
    );
    
    if (!mainScriptIncluded && mainJs) {
      const scriptEl = document.createElement('script');
      scriptEl.setAttribute('type', 'module');
      scriptEl.setAttribute('crossorigin', '');
      scriptEl.setAttribute('src', `/assets/${mainJs}`);
      scriptEl.setAttribute('defer', '');
      document.head.appendChild(scriptEl);
      modified = true;
    }
    
    // 4. Make sure the correct stylesheet is included
    const mainStyleIncluded = Array.from(linkTags).some(link => 
      link.getAttribute('href')?.includes(mainCss)
    );
    
    if (!mainStyleIncluded && mainCss) {
      const linkEl = document.createElement('link');
      linkEl.setAttribute('rel', 'stylesheet');
      linkEl.setAttribute('crossorigin', '');
      linkEl.setAttribute('href', `/assets/${mainCss}`);
      document.head.appendChild(linkEl);
      modified = true;
    }

    if (modified) {
      // Write the modified HTML back to the file
      fs.writeFileSync(filePath, dom.serialize(), 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

try {
  // Get actual asset filenames
  const assetInfo = getAssetFilenames();
  console.log('📊 Found assets:', {
    js: assetInfo.jsFiles.length ? assetInfo.jsFiles[0] + '...' : 'none',
    css: assetInfo.cssFiles.length ? assetInfo.cssFiles[0] + '...' : 'none'
  });

  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('Dist directory not found! Run a build first.');
  }

  // Fix index.html
  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    console.log('📄 Processing index.html...');
    const fixed = fixHtmlFile(indexHtmlPath, assetInfo);
    console.log(fixed ? '✅ Fixed index.html paths' : '⚠️ No changes needed for index.html');
  }

  // Process all HTML files in the location directory
  const locationDir = path.join(DIST_DIR, 'location');
  if (fs.existsSync(locationDir)) {
    console.log('📂 Processing location directory HTML files...');
    
    // Function to recursively process directories
    const processDirectory = (dirPath) => {
      const items = fs.readdirSync(dirPath);
      
      items.forEach(item => {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          processDirectory(itemPath);
        } else if (item.endsWith('.html')) {
          console.log(`📄 Processing ${itemPath.replace(DIST_DIR, '')}...`);
          const fixed = fixHtmlFile(itemPath, assetInfo);
          console.log(fixed 
            ? `✅ Fixed paths in ${itemPath.replace(DIST_DIR, '')}` 
            : `⚠️ No changes needed for ${itemPath.replace(DIST_DIR, '')}`);
        }
      });
    };
    
    processDirectory(locationDir);
    console.log('✅ Processed location directory HTML files');
  }

  // Also run the fix-react-hydration script
  console.log('🔄 Running hydration fixes...');
  try {
    // We need to dynamically import the module since this is ESM
    const { default: fixReactHydration } = await import('./fix-react-hydration.js');
    await fixReactHydration();
  } catch (err) {
    console.error('❌ Error running hydration fixes:', err.message);
  }

  console.log('🎉 All HTML paths fixed successfully');
} catch (error) {
  console.error('❌ Error fixing HTML paths:', error.message);
  process.exit(1);
}