import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '../dist');

// Configuration 
const BASE_URL = process.env.SITE_URL || 'https://antique-appraiser-directory.appraisily.com';
const SITEMAP_PATH = path.join(DIST_DIR, 'sitemap.xml');

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function findAllHtmlFiles(dir, relativeDir = '', fileList = []) {
  const currentDir = path.join(dir, relativeDir);
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  entries.forEach((entry) => {
    if (entry.name.startsWith('.')) return;
    const childRel = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const childPath = path.join(dir, childRel);

    if (entry.isDirectory()) {
      findAllHtmlFiles(dir, childRel, fileList);
      return;
    }

    if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'sitemap.xml') {
      fileList.push(childPath);
    }
  });

  return fileList;
}

function shouldIncludeInSitemap(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (/<meta\s+http-equiv=(['"])refresh\1/i.test(content)) return false;
  if (/<meta\s+name=(['"])robots\1[^>]*content=(['"])\s*[^"']*noindex/i.test(content)) return false;
  return true;
}

function resolveUrlFromHtmlPath(filePath) {
  const relative = toPosix(path.relative(DIST_DIR, filePath));
  const withoutIndex = relative.replace(/\/index\.html$/i, '/').replace(/index\.html$/i, '');
  if (!withoutIndex) return '/';
  return `/${withoutIndex}`.replace(/\/{2,}/g, '/');
}

function getRouteMetadata(url) {
  if (url === '/') return { priority: '1.0', changefreq: 'daily' };
  if (url.startsWith('/location/')) return { priority: '0.7', changefreq: 'weekly' };
  if (url.startsWith('/appraiser/')) return { priority: '0.6', changefreq: 'weekly' };
  return { priority: '0.5', changefreq: 'monthly' };
}

async function generateSitemap() {
  console.log('Generating comprehensive sitemap...');

  try {
    // Ensure dist directory exists
    fs.ensureDirSync(DIST_DIR);

    const htmlFiles = findAllHtmlFiles(DIST_DIR).filter((filePath) => shouldIncludeInSitemap(filePath));
    const routeMap = new Map();

    htmlFiles.forEach((filePath) => {
      const url = resolveUrlFromHtmlPath(filePath);
      if (!url) return;
      routeMap.set(url, {
        url,
        ...getRouteMetadata(url),
      });
    });

    if (!routeMap.has('/')) {
      routeMap.set('/', { url: '/', priority: '1.0', changefreq: 'daily' });
    }

    const routesWithMetadata = [...routeMap.values()].sort((a, b) => {
      if (a.url === '/') return -1;
      if (b.url === '/') return 1;
      return a.url.localeCompare(b.url);
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
Disallow: /admin/

Sitemap: ${BASE_URL}/sitemap.xml
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
