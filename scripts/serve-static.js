#!/usr/bin/env node

/**
 * Serve static HTML files from the build directory
 * For testing generated HTML files without client-side React
 */

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import open from 'open';
import chalk from 'chalk';
import { createServer } from 'net';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BASE_PORT = 3000;

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
 * Find a free port to use
 * @param {number} startPort - Port to start checking from
 * @returns {Promise<number>} - A free port
 */
function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
    
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

// Ensure the dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  log(`Dist directory not found at ${DIST_DIR}. Please run a build first.`, 'error');
  process.exit(1);
}

// Create Express app
const app = express();

// Middleware to transform HTML files to fix path issues
app.use((req, res, next) => {
  const filePath = path.join(DIST_DIR, req.path);
  
  // If requesting a directory, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    req.url = path.join(req.url, 'index.html');
  }
  
  // Only process HTML files
  if (!req.path.endsWith('.html') && !req.path.endsWith('/')) {
    return next();
  }
  
  // Determine the file path
  const htmlPath = req.path.endsWith('/')
    ? path.join(DIST_DIR, req.path, 'index.html')
    : path.join(DIST_DIR, req.path);
  
  // If HTML file doesn't exist, continue to next middleware
  if (!fs.existsSync(htmlPath)) {
    return next();
  }
  
  try {
    // Read the HTML file
    let content = fs.readFileSync(htmlPath, 'utf8');
    
    // Disable React hydration by removing React-specific scripts
    // This allows viewing the static HTML without React errors
    content = content.replace(/<script src=".*?index-.*?\.js".*?><\/script>/g, '');
    
    // Fix asset paths
    content = content.replace(/src="\//g, `src=".`);
    content = content.replace(/href="\//g, `href=".`);
    
    // Add static HTML notice
    content = content.replace(/<body>/,
      `<body>
        <div style="position: fixed; top: 0; left: 0; right: 0; background-color: #ffeb3b; padding: 5px 10px; text-align: center; z-index: 9999; font-family: sans-serif;">
          <strong>STATIC HTML VIEW</strong> - Client-side React is disabled for testing
        </div>`
    );
    
    // Send the modified HTML
    res.set('Content-Type', 'text/html');
    res.send(content);
  } catch (error) {
    log(`Error processing ${htmlPath}: ${error.message}`, 'error');
    next();
  }
});

// Serve static files from the dist directory
app.use(express.static(DIST_DIR));

// Create a directory listing page
app.get('/', (req, res) => {
  try {
    const locations = fs.readdirSync(path.join(DIST_DIR, 'location'))
      .filter(item => fs.statSync(path.join(DIST_DIR, 'location', item)).isDirectory());
    
    const appraisers = fs.readdirSync(path.join(DIST_DIR, 'appraiser'))
      .filter(item => fs.statSync(path.join(DIST_DIR, 'appraiser', item)).isDirectory());
    
    // Generate HTML for the directory listing
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Art Appraiser Directory - Static HTML Testing</title>
        <style>
          body {
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.5;
            max-width: 1200px;
            margin: 40px auto 20px;
            padding: 0 20px;
          }
          .header-notice {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background-color: #ffeb3b;
            padding: 5px 10px;
            text-align: center;
            z-index: 9999;
          }
          h1, h2 {
            color: #212529;
          }
          .container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
          }
          .card {
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 15px;
          }
          .location-card {
            background-color: #e9ecef;
          }
          .appraiser-card {
            background-color: #f8f9fa;
          }
          a {
            color: #0d6efd;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .card a {
            display: block;
            margin-bottom: 5px;
          }
          .stats {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header-notice">
          <strong>STATIC HTML TESTING</strong> - Client-side React is disabled
        </div>
        
        <h1>Art Appraiser Directory - Static HTML Testing</h1>
        
        <div class="stats">
          <p><strong>Total Locations:</strong> ${locations.length}</p>
          <p><strong>Total Appraisers:</strong> ${appraisers.length}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <h2>Location Pages</h2>
        <div class="container">
          ${locations.map(location => `
            <div class="card location-card">
              <h3>${location.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
              <a href="/location/${location}">View Location Page</a>
            </div>
          `).join('')}
        </div>
        
        <h2>Appraiser Pages</h2>
        <div class="container">
          ${appraisers.slice(0, 12).map(appraiser => `
            <div class="card appraiser-card">
              <h3>${appraiser.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
              <a href="/appraiser/${appraiser}">View Appraiser Page</a>
            </div>
          `).join('')}
          ${appraisers.length > 12 ? `
            <div class="card appraiser-card">
              <h3>+ ${appraisers.length - 12} more appraisers</h3>
              <p>Too many to show all at once.</p>
            </div>
          ` : ''}
        </div>
        
        <h2>Problem Pages</h2>
        <div class="container">
          <div class="card" style="border-left: 5px solid #dc3545;">
            <h3>Cleveland</h3>
            <p>This page had reported issues with React hydration.</p>
            <a href="/location/cleveland">View Cleveland Page</a>
          </div>
        </div>
        
        <footer style="margin-top: 40px; border-top: 1px solid #dee2e6; padding-top: 20px;">
          <p>
            <a href="/test-html">Run HTML Tests</a> | 
            <a href="/fix-react">Fix React Hydration Issues</a>
          </p>
        </footer>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    log(`Error generating directory listing: ${error.message}`, 'error');
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Route to run HTML tests
app.get('/test-html', (req, res) => {
  try {
    log('Running HTML tests...', 'info');
    const testScript = path.join(ROOT_DIR, 'scripts', 'test-html.js');
    
    // Execute the test script
    const { execSync } = require('child_process');
    execSync(`node ${testScript}`, { stdio: 'inherit' });
    
    res.redirect('/');
  } catch (error) {
    log(`Error running HTML tests: ${error.message}`, 'error');
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Route to fix React hydration issues
app.get('/fix-react', (req, res) => {
  try {
    log('Fixing React hydration issues...', 'info');
    const fixScript = path.join(ROOT_DIR, 'scripts', 'fix-react-hydration.js');
    
    // Execute the fix script
    const { execSync } = require('child_process');
    execSync(`node ${fixScript}`, { stdio: 'inherit' });
    
    res.redirect('/');
  } catch (error) {
    log(`Error fixing React hydration issues: ${error.message}`, 'error');
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Start the server with a free port
(async () => {
  try {
    const port = await findFreePort(BASE_PORT);
    app.listen(port, () => {
      log(`Static HTML server is running at http://localhost:${port}`, 'success');
      
      // Open the browser automatically
      open(`http://localhost:${port}`);
    });
    
    log('Press Ctrl+C to stop the server', 'info');
  } catch (error) {
    log(`Failed to start server: ${error.message}`, 'error');
    process.exit(1);
  }
})(); 