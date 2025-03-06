import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');
const LOCATIONS_DIR = path.join(__dirname, '../src/data/locations');

// Configuration 
const BASE_URL = process.env.SITE_URL || 'https://art-appraiser-directory.appraisily.com';
const SITEMAP_PATH = path.join(DIST_DIR, 'sitemap.xml');

// Recursive function to find all HTML files
function findAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fileList = findAllHtmlFiles(filePath, fileList);
    } else if (file === 'index.html') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

async function generateSitemap() {
  console.log('Generating comprehensive sitemap...');

  try {
    // Ensure dist directory exists
    fs.ensureDirSync(DIST_DIR);

    // Track routes with their metadata
    const routesWithMetadata = [];
    
    // 1. Add main routes with high priority
    const mainRoutes = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/start', priority: '0.9', changefreq: 'weekly' },
      { url: '/about', priority: '0.8', changefreq: 'weekly' },
      { url: '/services', priority: '0.8', changefreq: 'weekly' },
      { url: '/expertise', priority: '0.8', changefreq: 'weekly' },
      { url: '/team', priority: '0.7', changefreq: 'monthly' }
    ];
    
    mainRoutes.forEach(route => {
      routesWithMetadata.push(route);
    });

    // 2. Add location pages
    const locationFiles = fs.readdirSync(LOCATIONS_DIR)
      .filter(file => file.endsWith('.json') && !file.includes('copy') && !file.includes('lifecycle'));
    
    locationFiles.forEach(file => {
      const citySlug = file.replace('.json', '');
      const url = `/location/${citySlug}`;
      
      routesWithMetadata.push({
        url,
        priority: '0.7',
        changefreq: 'weekly'
      });
      
      // Add appraiser pages for each location
      try {
        const locationData = JSON.parse(fs.readFileSync(path.join(LOCATIONS_DIR, file)));
        
        locationData.appraisers?.forEach(appraiser => {
          if (appraiser.id) {
            routesWithMetadata.push({
              url: `/appraiser/${appraiser.id}`,
              priority: '0.6',
              changefreq: 'weekly'
            });
          }
        });
      } catch (err) {
        console.error(`Error processing location file ${file}:`, err);
      }
    });
    
    // Generate XML content
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Add all routes to XML
    routesWithMetadata.forEach(route => {
      xmlContent += '  <url>\n';
      xmlContent += `    <loc>${BASE_URL}${route.url}</loc>\n`;
      xmlContent += `    <lastmod>${formattedDate}</lastmod>\n`;
      xmlContent += `    <changefreq>${route.changefreq || 'monthly'}</changefreq>\n`;
      xmlContent += `    <priority>${route.priority || '0.5'}</priority>\n`;
      xmlContent += '  </url>\n';
    });
    
    xmlContent += '</urlset>';
    
    // Write sitemap to file
    fs.writeFileSync(SITEMAP_PATH, xmlContent);
    
    // Generate robots.txt
    const robotsContent = `User-agent: *
Allow: /
Sitemap: ${BASE_URL}/sitemap.xml

# Block access to admin and system files
User-agent: *
Disallow: /admin/
Disallow: /*.json$
Disallow: /*.js$
Disallow: /*.css$
`;
    
    fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsContent);
    
    console.log(`Sitemap with ${routesWithMetadata.length} URLs generated at: ${SITEMAP_PATH}`);
    console.log(`robots.txt generated at: ${path.join(DIST_DIR, 'robots.txt')}`);
    
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

// Execute immediately
generateSitemap(); 