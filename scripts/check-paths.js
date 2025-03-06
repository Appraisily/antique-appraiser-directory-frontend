import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');

async function checkPaths() {
  console.log('Checking asset paths in HTML files...');

  try {
    // Find all HTML files
    const htmlFiles = findAllHtmlFiles(DIST_DIR);
    console.log(`Found ${htmlFiles.length} HTML files`);

    // Read each HTML file and check for CSS and JS references
    let hasErrors = false;

    for (const htmlFile of htmlFiles) {
      const content = fs.readFileSync(htmlFile, 'utf8');
      const relativePath = path.relative(DIST_DIR, htmlFile);
      
      console.log(`\nChecking: ${relativePath}`);

      // Check for CSS references
      const cssRefs = content.match(/<link[^>]*rel=['"]stylesheet['"][^>]*href=['"]([^'"]+)['"]/g);
      if (cssRefs && cssRefs.length > 0) {
        cssRefs.forEach(ref => {
          const match = ref.match(/href=['"]([^'"]+)['"]/);
          if (match) {
            const cssPath = match[1];
            console.log(`  CSS: ${cssPath}`);
            
            // Check if the CSS file exists
            const fullPath = path.join(DIST_DIR, cssPath.startsWith('/') ? cssPath.substring(1) : cssPath);
            if (!fs.existsSync(fullPath)) {
              console.error(`  ❌ CSS file not found: ${cssPath} (full path: ${fullPath})`);
              hasErrors = true;
            } else {
              console.log(`  ✓ CSS file exists`);
            }
          }
        });
      } else {
        console.log('  ⚠️ No CSS references found');
      }

      // Check for JS references
      const jsRefs = content.match(/<script[^>]*src=['"]([^'"]+)['"]/g);
      if (jsRefs && jsRefs.length > 0) {
        jsRefs.forEach(ref => {
          const match = ref.match(/src=['"]([^'"]+)['"]/);
          if (match) {
            const jsPath = match[1];
            console.log(`  JS: ${jsPath}`);
            
            // Check if the JS file exists
            const fullPath = path.join(DIST_DIR, jsPath.startsWith('/') ? jsPath.substring(1) : jsPath);
            if (!fs.existsSync(fullPath)) {
              console.error(`  ❌ JS file not found: ${jsPath} (full path: ${fullPath})`);
              hasErrors = true;
            } else {
              console.log(`  ✓ JS file exists`);
            }
          }
        });
      } else {
        console.log('  ⚠️ No JS references found');
      }
    }

    if (hasErrors) {
      console.error('\n❌ Found errors in asset paths. Please fix before deployment.');
    } else {
      console.log('\n✅ All asset paths appear to be correct.');
    }
    
  } catch (error) {
    console.error('Error checking paths:', error);
    process.exit(1);
  }
}

// Helper function to find all HTML files recursively
function findAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findAllHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Run the check
checkPaths().catch(error => {
  console.error('Failed to check paths:', error);
  process.exit(1);
}); 