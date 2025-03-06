/**
 * Performance optimization utilities for the art appraiser directory
 * Handles resource hints, critical CSS, image optimization, and core web vitals improvements
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

/**
 * Generates resource hint tags for improved performance
 * @param {Object} options - Resource hint options
 * @returns {string} HTML resource hint tags
 */
export function generateResourceHints(options = {}) {
  const {
    preconnectUrls = [
      'https://ik.imagekit.io',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com'
    ],
    prefetchUrls = [],
    preloadAssets = []
  } = options;
  
  let hints = '';
  
  // Add preconnect hints for third-party domains
  preconnectUrls.forEach(url => {
    hints += `<link rel="preconnect" href="${url}" crossorigin>\n`;
    hints += `<link rel="dns-prefetch" href="${url}">\n`;
  });
  
  // Add prefetch hints for anticipated navigation
  prefetchUrls.forEach(url => {
    hints += `<link rel="prefetch" href="${url}">\n`;
  });
  
  // Add preload hints for critical assets
  preloadAssets.forEach(asset => {
    const { url, as, type = '', crossorigin = false } = asset;
    hints += `<link rel="preload" href="${url}" as="${as}"${type ? ` type="${type}"` : ''}${crossorigin ? ' crossorigin' : ''}>\n`;
  });
  
  return hints;
}

/**
 * Extracts critical CSS from a file
 * @param {string} cssFilePath - Path to the CSS file
 * @param {number} maxBytes - Maximum size in bytes (default: 10KB)
 * @returns {Promise<string>} Critical CSS
 */
export async function extractCriticalCss(cssFilePath, maxBytes = 10240) {
  try {
    if (!await fs.pathExists(cssFilePath)) {
      console.error(`CSS file not found: ${cssFilePath}`);
      return '';
    }
    
    const cssContent = await fs.readFile(cssFilePath, 'utf8');
    
    // Extract critical CSS rules (simplified approach)
    // A more sophisticated implementation would analyze HTML to determine critical CSS
    
    // Focus on above-the-fold elements
    const criticalSelectors = [
      'body', 'html', '.container', 'header', 'nav', 'h1', 'h2', '.appraiser-card',
      '.bg-white', '.rounded-lg', '.shadow-md', '.overflow-hidden', '.flex',
      '.w-full', '.text-', '.font-', '.mb-', '.p-', '.py-', '.px-'
    ];
    
    // Extract CSS rules that match critical selectors
    const cssRules = cssContent.match(/[^}]+\{[^}]+\}/g) || [];
    let criticalCss = '';
    
    for (const rule of cssRules) {
      if (criticalSelectors.some(selector => rule.includes(selector))) {
        criticalCss += rule + '\n';
      }
      
      // Stop if we've reached the maximum size
      if (criticalCss.length > maxBytes) {
        criticalCss = criticalCss.substring(0, maxBytes);
        break;
      }
    }
    
    return criticalCss;
  } catch (error) {
    console.error('Error extracting critical CSS:', error.message);
    return '';
  }
}

/**
 * Generates inline scripts for performance monitoring
 * @returns {string} Inline performance monitoring JavaScript
 */
export function generatePerformanceMonitoring() {
  return `
<script>
  // Performance monitoring for Core Web Vitals
  (function() {
    // Create a performance observer
    if (PerformanceObserver) {
      try {
        // Observe LCP
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            console.log('LCP:', entry.startTime, entry);
            // Send to analytics in production
          }
        }).observe({type: 'largest-contentful-paint', buffered: true});
        
        // Observe FID
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const delay = entry.processingStart - entry.startTime;
            console.log('FID:', delay, entry);
            // Send to analytics in production
          }
        }).observe({type: 'first-input', buffered: true});
        
        // Observe CLS
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              console.log('CLS update:', clsValue, entry);
              // Send to analytics in production
            }
          }
        }).observe({type: 'layout-shift', buffered: true});
      } catch(e) {
        console.error('Performance monitoring error:', e);
      }
    }
  })();
</script>
  `.trim();
}

/**
 * Generate a content hash for cache busting
 * @param {string} content - Content to hash
 * @returns {string} Content hash
 */
export function generateContentHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

/**
 * Adds content hash to static asset URLs for cache busting
 * @param {string} html - HTML content
 * @param {Object} assetPaths - Map of asset paths to their content
 * @returns {string} HTML with cache-busted asset URLs
 */
export function addCacheBusting(html, assetPaths) {
  let result = html;
  
  for (const [assetPath, content] of Object.entries(assetPaths)) {
    // Skip if content is not available
    if (!content) continue;
    
    const hash = generateContentHash(content);
    const extension = path.extname(assetPath);
    const basePath = assetPath.substring(0, assetPath.length - extension.length);
    
    // Replace references in HTML
    const regex = new RegExp(assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, `${basePath}.${hash}${extension}`);
  }
  
  return result;
}

/**
 * Optimizes HTML by removing comments, whitespace, etc.
 * @param {string} html - HTML content to optimize
 * @param {Object} options - Optimization options
 * @returns {string} Optimized HTML
 */
export function optimizeHtml(html, options = {}) {
  const {
    removeComments = true,
    removeWhitespace = true,
    collapseWhitespace = true,
    preserveLineBreaks = false
  } = options;
  
  let result = html;
  
  // Remove HTML comments
  if (removeComments) {
    result = result.replace(/<!--(?![\s\S]*?nocompress[\s\S]*?-->)[\s\S]*?-->/g, '');
  }
  
  // Remove excessive whitespace
  if (removeWhitespace) {
    // Remove whitespace between HTML tags
    result = result.replace(/>\s+</g, '><');
    
    // Collapse multiple spaces to single space
    if (collapseWhitespace) {
      result = result.replace(/\s{2,}/g, ' ');
    }
    
    // Preserve line breaks if needed
    if (preserveLineBreaks) {
      result = result.replace(/\n\s+/g, '\n');
    } else {
      result = result.replace(/\n/g, '');
    }
  }
  
  return result;
}

/**
 * Adds async/defer attributes to script tags
 * @param {string} html - HTML content
 * @returns {string} HTML with optimized script loading
 */
export function optimizeScriptLoading(html) {
  // Don't modify script tags that already have async/defer attributes
  const scriptRegex = /<script(?![^>]*(?:async|defer|type=['"]module["']))[^>]*src=['"](.*?)['"][^>]*><\/script>/g;
  return html.replace(scriptRegex, (match, src) => {
    // Add async to most scripts, defer to anything that might affect page display
    if (src.includes('gtm.js') || src.includes('analytics') || src.includes('tag')) {
      return match.replace('<script', '<script async');
    } else {
      return match.replace('<script', '<script defer');
    }
  });
}

/**
 * Generates markup for lazy loading images that aren't in viewport
 * @param {Object} options - Lazy loading options
 * @returns {string} Script for lazy loading images
 */
export function generateLazyLoadingScript(options = {}) {
  const {
    rootMargin = '200px 0px',
    threshold = 0.01
  } = options;
  
  return `
<script>
  // Lazy load images that are below the fold
  document.addEventListener('DOMContentLoaded', function() {
    var lazyImages = [].slice.call(document.querySelectorAll('img[loading="lazy"]'));
    
    if ('IntersectionObserver' in window) {
      let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            let lazyImage = entry.target;
            if (lazyImage.dataset.src) {
              lazyImage.src = lazyImage.dataset.src;
              lazyImage.removeAttribute('data-src');
            }
            lazyImageObserver.unobserve(lazyImage);
          }
        });
      }, {
        rootMargin: '${rootMargin}',
        threshold: ${threshold}
      });
      
      lazyImages.forEach(function(lazyImage) {
        lazyImageObserver.observe(lazyImage);
      });
    } else {
      // Fallback for browsers that don't support IntersectionObserver
      let active = false;
      
      const lazyLoad = function() {
        if (active === false) {
          active = true;
          
          setTimeout(function() {
            lazyImages.forEach(function(lazyImage) {
              if ((lazyImage.getBoundingClientRect().top <= window.innerHeight && lazyImage.getBoundingClientRect().bottom >= 0) && getComputedStyle(lazyImage).display !== 'none') {
                if (lazyImage.dataset.src) {
                  lazyImage.src = lazyImage.dataset.src;
                  lazyImage.removeAttribute('data-src');
                }
                
                lazyImages = lazyImages.filter(function(image) {
                  return image !== lazyImage;
                });
                
                if (lazyImages.length === 0) {
                  document.removeEventListener('scroll', lazyLoad);
                  window.removeEventListener('resize', lazyLoad);
                  window.removeEventListener('orientationchange', lazyLoad);
                }
              }
            });
            
            active = false;
          }, 200);
        }
      };
      
      document.addEventListener('scroll', lazyLoad);
      window.addEventListener('resize', lazyLoad);
      window.addEventListener('orientationchange', lazyLoad);
      window.addEventListener('load', lazyLoad);
    }
  });
</script>
  `.trim();
}

/**
 * Adds responsive font loading for better performance
 * @returns {string} Script for responsive font loading
 */
export function generateFontLoadingScript() {
  return `
<script>
  // Responsive font loading with font-display swap
  if ('fonts' in document) {
    // This is used to track when fonts are loaded for layout calculations
    Promise.all([
      document.fonts.ready
    ]).then(function() {
      document.documentElement.classList.add('fonts-loaded');
    });
  } else {
    // Fallback - mark fonts as loaded immediately
    document.documentElement.classList.add('fonts-loaded');
  }
</script>
  `.trim();
}

/**
 * Adds media attribute to non-critical CSS to improve loading performance
 * @param {string} html - HTML content
 * @returns {string} HTML with optimized CSS loading
 */
export function optimizeCssLoading(html) {
  // Find all CSS links that aren't already optimized
  const cssRegex = /<link[^>]*rel=['"]stylesheet['"][^>]*href=['"]([^'"]+)['"][^>]*>/g;
  
  return html.replace(cssRegex, (match, href) => {
    // Don't modify if it already has media, disabled, or other optimization attributes
    if (match.includes('media=') || match.includes('disabled') || match.includes('onload=')) {
      return match;
    }
    
    // Use media="print" and onload to defer non-critical CSS
    return match.replace('<link', 
      '<link media="print" onload="this.media=\'all\'; this.onload=null;"');
  });
}

/**
 * Optimizes the page for Core Web Vitals
 * @param {string} html - HTML content
 * @param {Object} options - Optimization options
 * @returns {string} Optimized HTML
 */
export function optimizeForCoreWebVitals(html, options = {}) {
  let result = html;
  
  // Add resource hints
  result = result.replace('</head>', 
    `${generateResourceHints(options.resourceHints)}\n</head>`);
  
  // Add performance monitoring
  result = result.replace('</head>', 
    `${generatePerformanceMonitoring()}\n</head>`);
  
  // Optimize script loading
  result = optimizeScriptLoading(result);
  
  // Optimize CSS loading
  result = optimizeCssLoading(result);
  
  // Add lazy loading script
  result = result.replace('</body>', 
    `${generateLazyLoadingScript(options.lazyLoading)}\n</body>`);
  
  // Add font loading script
  result = result.replace('</head>', 
    `${generateFontLoadingScript()}\n</head>`);
  
  return result;
}

/**
 * Runs Google PageSpeed Insights test on a URL
 * @param {string} url - URL to test
 * @returns {Promise<Object>} PageSpeed Insights results
 */
export async function runPageSpeedTest(url) {
  try {
    const apiKey = process.env.PAGESPEED_API_KEY;
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile${apiKey ? `&key=${apiKey}` : ''}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`PageSpeed API returned ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error running PageSpeed test:', error.message);
    return null;
  }
}

/**
 * Creates an asset map to be used with addCacheBusting
 * @param {string} buildDir - Build directory
 * @returns {Promise<Object>} Asset map
 */
export async function createAssetMap(buildDir) {
  const assetMap = {};
  
  try {
    const assetsDir = path.join(buildDir, 'assets');
    
    if (await fs.pathExists(assetsDir)) {
      const files = await fs.readdir(assetsDir);
      
      for (const file of files) {
        // Only include CSS and JS files
        if (file.endsWith('.css') || file.endsWith('.js')) {
          const filePath = path.join(assetsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Add to asset map
          assetMap[`/assets/${file}`] = content;
        }
      }
    }
    
    return assetMap;
  } catch (error) {
    console.error('Error creating asset map:', error.message);
    return {};
  }
} 