import fs from 'fs-extra';
import path from 'path';

const DIST_DIR = path.join(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const DIRECTORY_ASSETS_DIR = path.join(DIST_DIR, 'directory', 'assets');

/**
 * Fix the directory structure for deployment
 */
async function fixDirectoryStructure() {
  try {
    console.log('Fixing directory structure for deployment...');
    
    // 1. Create the directory/assets folder if it doesn't exist
    await fs.ensureDir(DIRECTORY_ASSETS_DIR);
    
    // 2. Copy assets from /assets to /directory/assets
    console.log('Copying assets to directory/assets folder...');
    await fs.copy(ASSETS_DIR, DIRECTORY_ASSETS_DIR);
    
    // 3. Remove the root index.html which points to wrong assets
    console.log('Removing conflicting root index.html...');
    const rootIndexPath = path.join(DIST_DIR, 'index.html');
    
    if (await fs.pathExists(rootIndexPath)) {
      await fs.remove(rootIndexPath);
    }
    
    // 4. Create a new root index.html that redirects to a location page
    console.log('Creating new root index.html with redirect...');
    const redirectHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=/location/new-york/">
  <title>Art Appraiser Directory - Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="/location/new-york/">Art Appraisers in New York</a>...</p>
</body>
</html>
`;
    
    await fs.writeFile(rootIndexPath, redirectHtml);
    
    console.log('Directory structure fixed!');
    console.log('Next steps:');
    console.log('1. Commit and push these changes');
    console.log('2. Deploy to Netlify');
    
  } catch (error) {
    console.error('Error fixing directory structure:', error);
    process.exit(1);
  }
}

// Run the script
fixDirectoryStructure(); 