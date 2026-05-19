import fs from 'fs-extra';
import path from 'path';
import { JSDOM } from 'jsdom';

export async function getAllHtmlFiles(dir) {
  let results = [];
  const items = await fs.readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(await getAllHtmlFiles(fullPath));
    } else if (item.endsWith('.html')) {
      results.push(fullPath);
    }
  }

  return results;
}

export async function validateHtmlFile(filePath, publicDir) {
  const results = {
    file: filePath,
    valid: true,
    errors: [],
    warnings: [],
    missingResources: [],
  };

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const dom = new JSDOM(content);
    const { document } = dom.window;

    document.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) {
        results.errors.push('Image without src attribute found');
        results.valid = false;
        return;
      }
      checkLocalResource(src, filePath, publicDir, 'image', results);
    });

    document.querySelectorAll('script[src]').forEach((script) => {
      checkLocalResource(script.getAttribute('src'), filePath, publicDir, 'script', results);
    });

    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      checkLocalResource(link.getAttribute('href'), filePath, publicDir, 'CSS', results);
    });

    if (!document.querySelector('meta[name="viewport"]')) {
      results.warnings.push('No viewport meta tag found');
    }

    if (!document.querySelector('main')) {
      results.warnings.push('No <main> element found');
    }
  } catch (error) {
    results.valid = false;
    results.errors.push(`Failed to parse HTML: ${error.message}`);
  }

  return results;
}

function checkLocalResource(value, filePath, publicDir, label, results) {
  if (!value || isExternalResource(value)) return;

  const cleanValue = value.split(/[?#]/, 1)[0];
  if (!cleanValue || cleanValue.startsWith('#')) return;

  const localPath = cleanValue.startsWith('/')
    ? path.join(publicDir, cleanValue)
    : path.resolve(path.dirname(filePath), cleanValue);

  if (!fs.existsSync(localPath)) {
    results.missingResources.push(`Missing ${label}: ${value}`);
    results.valid = false;
  }
}

function isExternalResource(value) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value)
    || /^(?:data|mailto|tel):/i.test(value);
}
