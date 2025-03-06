#!/usr/bin/env node

/**
 * HTML testing server
 * Serves and validates static HTML files from the dist directory
 */

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import open from 'open';
import { 
  log, 
  getAllHtmlFiles, 
  validateHtmlFile, 
  fixHtmlIssues, 
  generateHtmlReport 
} from './utils/html-test-utils.js';
import { createServer } from 'net';

// Get the project root directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const REPORT_DIR = path.join(ROOT_DIR, 'test-reports');
const REPORT_PATH = path.join(REPORT_DIR, 'html-validation-report.html');
const BASE_PORT = 3000;

// Ensure the dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  log(`Dist directory not found at ${DIST_DIR}. Please run a build first.`, 'error');
  process.exit(1);
}

// Create reports directory if it doesn't exist
fs.ensureDirSync(REPORT_DIR);

// Create and configure the Express app
const app = express();

// Serve static files from the dist directory
app.use(express.static(DIST_DIR));

// Routes
app.get('/', async (req, res) => {
  res.redirect('/report');
});

app.get('/report', async (req, res) => {
  // Check if a report already exists
  if (fs.existsSync(REPORT_PATH)) {
    const report = await fs.readFile(REPORT_PATH, 'utf8');
    return res.send(report);
  }
  
  // Generate a new report
  await generateValidationReport();
  const report = await fs.readFile(REPORT_PATH, 'utf8');
  res.send(report);
});

app.get('/regenerate-report', async (req, res) => {
  await generateValidationReport();
  res.redirect('/report');
});

app.get('/fix-issues', async (req, res) => {
  await fixCommonIssues();
  await generateValidationReport();
  res.redirect('/report');
});

app.get('/view/*', (req, res) => {
  const filePath = req.params[0];
  res.sendFile(path.join(DIST_DIR, filePath));
});

// Start the server with a free port
const specificFile = process.argv[2];
if (!specificFile) {
  (async () => {
    try {
      const port = await findFreePort(BASE_PORT);
      app.listen(port, () => {
        log(`HTML Testing Server is running at http://localhost:${port}`, 'success');
        log(`View the validation report at http://localhost:${port}/report`, 'info');
        
        // Open the browser automatically
        open(`http://localhost:${port}`);
      });
    } catch (error) {
      log(`Failed to start server: ${error.message}`, 'error');
      process.exit(1);
    }
  })();
} else {
  const filePath = path.join(DIST_DIR, specificFile);
  if (fs.existsSync(filePath)) {
    log(`Testing specific file: ${specificFile}`, 'info');
    validateHtmlFile(filePath).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else {
    log(`File not found: ${specificFile}`, 'error');
  }
}

/**
 * Generate a validation report for all HTML files
 */
async function generateValidationReport() {
  log('Generating validation report...', 'info');
  
  try {
    // Get all HTML files
    const htmlFiles = await getAllHtmlFiles(DIST_DIR);
    log(`Found ${htmlFiles.length} HTML files to validate`, 'info');
    
    // Validate each file
    const validationResults = [];
    for (const [index, file] of htmlFiles.entries()) {
      log(`Validating ${index + 1}/${htmlFiles.length}: ${file.replace(DIST_DIR, '')}`, 'info');
      const result = await validateHtmlFile(file);
      validationResults.push(result);
      
      if (!result.valid) {
        log(`Issues found in ${file.replace(DIST_DIR, '')}`, 'warning');
      }
    }
    
    // Generate the report
    const reportHtml = generateHtmlReport(validationResults);
    await fs.writeFile(REPORT_PATH, reportHtml, 'utf8');
    
    log(`Validation report generated at ${REPORT_PATH}`, 'success');
    
    // Print summary
    const validCount = validationResults.filter(r => r.valid).length;
    const invalidCount = validationResults.length - validCount;
    log(`Summary: ${validCount} valid files, ${invalidCount} files with issues`, 
      invalidCount > 0 ? 'warning' : 'success');
    
    return validationResults;
  } catch (error) {
    log(`Error generating validation report: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Fix common issues in all HTML files
 */
async function fixCommonIssues() {
  log('Attempting to fix common issues in HTML files...', 'info');
  
  try {
    // Get all HTML files
    const htmlFiles = await getAllHtmlFiles(DIST_DIR);
    log(`Found ${htmlFiles.length} HTML files to process`, 'info');
    
    // Validate and fix each file
    let fixedCount = 0;
    for (const [index, file] of htmlFiles.entries()) {
      log(`Processing ${index + 1}/${htmlFiles.length}: ${file.replace(DIST_DIR, '')}`, 'info');
      const result = await validateHtmlFile(file);
      
      if (!result.valid) {
        const fixed = await fixHtmlIssues(file, result);
        if (fixed) {
          fixedCount++;
          log(`Fixed issues in ${file.replace(DIST_DIR, '')}`, 'success');
        }
      }
    }
    
    log(`Fixed issues in ${fixedCount} files`, fixedCount > 0 ? 'success' : 'info');
  } catch (error) {
    log(`Error fixing issues: ${error.message}`, 'error');
    throw error;
  }
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