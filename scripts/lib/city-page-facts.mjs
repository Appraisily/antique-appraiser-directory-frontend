// Facts a city page actually shows, read from its published HTML.
//
// The listing count follows tests/city-metadata-honesty.test.mjs: distinct
// sitemap provider profiles linked from #root, plus listed fine-art
// specialists. Metadata may only state counts taken from here.
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

export const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';

export function readSitemapProfiles(publicDir) {
  const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
  return new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => new URL(match[1]).pathname)
      .filter((route) => /^\/appraiser\/[^/]+\/$/.test(route)),
  );
}

function serviceSchema(document) {
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed;
    try {
      parsed = JSON.parse(node.textContent);
    } catch {
      continue;
    }
    for (const item of [].concat(parsed)) {
      if (item && item['@type'] === 'Service') return item;
    }
  }
  return null;
}

/**
 * @returns {{ city: string|null, regionCode: string|null, regionName: string|null,
 *   listings: number|null, specialists: number|null }}
 * listings/specialists are null when the page has no #root to count from.
 */
export function cityPageFacts(html, profiles, route = '/') {
  const dom = new JSDOM(html, { url: `${ORIGIN}${route}` });
  try {
    const { document } = dom.window;
    const service = serviceSchema(document);
    const address = service?.areaServed?.address || {};
    const city = address.addressLocality || service?.areaServed?.name || null;
    const regionCode = address.addressRegion || null;
    let regionName = null;
    const name = String(service?.name || '');
    if (city && name.includes(`${city}, `)) regionName = name.slice(name.lastIndexOf(`${city}, `) + city.length + 2).trim() || null;

    const root = document.getElementById('root');
    if (!root) return { city, regionCode, regionName, listings: null, specialists: null };
    const linked = new Set(
      [...root.querySelectorAll('a[href]')]
        .map((link) => new URL(link.getAttribute('href'), ORIGIN))
        .filter((url) => url.origin === ORIGIN && profiles.has(url.pathname))
        .map((url) => url.pathname),
    );
    const specialists = root.querySelectorAll('[data-gtm-surface="fine_art_specialist"]').length;
    return { city, regionCode, regionName, listings: linked.size, specialists };
  } finally {
    dom.window.close();
  }
}

/** Counts shown on the two "near me" hubs. */
export function hubFacts(html) {
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    const sectionCards = (heading) => {
      for (const section of document.querySelectorAll('section')) {
        const h2 = section.querySelector('h2');
        if (h2 && h2.textContent.trim() === heading) return section.querySelectorAll('.city-card').length;
      }
      return 0;
    };
    return {
      reviewedSpecialists: sectionCards('Reviewed fine-art specialists'),
      cityPages: sectionCards('City pages'),
    };
  } finally {
    dom.window.close();
  }
}
