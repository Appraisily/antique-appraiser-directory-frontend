(function () {
  'use strict';

  var pages = {
    '/location/philadelphia/': {
      title: 'Philadelphia, PA Antique Appraisers | Local & Online Reports',
      description: 'Compare Philadelphia antique and art appraisers for estates, insurance, donation, furniture, and personal property—or start a paid online report from photos.',
      h1: 'Philadelphia Antique Appraisers & Art Appraisal Services'
    },
    '/location/wichita/': {
      title: 'Wichita Antique Appraisers | Vintage Items & Online Reports',
      description: 'Compare Wichita antique appraisers for antiques, vintage items, estates, insurance, and donations. Free screening is a first look; written reports are paid.',
      h1: 'Wichita Antique Appraisers for Antiques & Vintage Items'
    },
    '/location/new-orleans/': {
      title: 'New Orleans, LA Antique Appraisers | Local & Online Reports',
      description: 'Compare New Orleans and Metairie antique-appraisal options for art, estates, and insurance, or start a paid signed online report from photos.',
      h1: 'New Orleans, LA Antique & Art Appraisers',
      clarifyFreeFirstLook: true
    },
    '/location/raleigh/': {
      title: 'Raleigh, NC Antique Appraisers | Local & Online Options',
      description: 'Review Raleigh antique-appraiser availability and nearby published city pages for estate, furniture, insurance, or personal-property needs, or start a paid online report.',
      h1: 'Raleigh, NC Antique Appraisers & Nearby Options',
      clarifyFreeFirstLook: true
    },
    '/location/baltimore/': {
      title: 'Baltimore Antique Appraisers | Maryland Furniture Appraisal',
      description: 'Compare Baltimore and Maryland antique-furniture appraisers for estates, insurance, and donations, or start a paid signed online report from photos.',
      h1: 'Baltimore Antique & Art Appraisers'
    },
    '/location/pittsburgh/': {
      title: 'Pittsburgh Antique Appraisers Near You | Online Reports',
      description: 'Compare Pittsburgh antique and art appraisers near you for estates, insurance, donations, and personal property—or start a paid online report from photos.',
      h1: 'Pittsburgh Antique Appraisers Near You'
    },
    '/location/chicago/': {
      title: 'Chicago Antique Appraisers Near You | Signed Online Reports',
      description: 'Compare Chicago antique and art appraisers near you for estates, insurance, and donations, or upload photos for a paid signed online report.',
      h1: 'Chicago Antique & Art Appraisals'
    }
  };

  function currentPage() {
    try {
      var path = window.location.pathname.replace(/\/+$/, '/') || '/';
      return pages[path] || null;
    } catch (_) {
      return null;
    }
  }

  function setMeta(selector, value) {
    var node = document.querySelector(selector);
    if (node && node.getAttribute('content') !== value) node.setAttribute('content', value);
  }

  function patchMetadata(page) {
    if (document.title !== page.title) document.title = page.title;
    setMeta('meta[name="description"]', page.description);
    setMeta('meta[property="og:title"]', page.title);
    setMeta('meta[property="og:description"]', page.description);
    setMeta('meta[name="twitter:title"]', page.title);
    setMeta('meta[name="twitter:description"]', page.description);
  }

  function patchHeading(page) {
    var heading = document.querySelector('h1');
    if (heading && String(heading.textContent || '').trim() !== page.h1) heading.textContent = page.h1;
  }

  function patchProfessionalIntake() {
    var links = document.querySelectorAll('a[href*="appraisily.com/start"]');
    for (var index = 0; index < links.length; index += 1) {
      var link = links[index];
      try {
        var destination = new URL(link.getAttribute('href'), window.location.href);
        if (destination.hostname !== 'appraisily.com' || destination.pathname.replace(/\/+$/, '') !== '/start') continue;
        if (destination.searchParams.get('service') === 'regular') continue;
        destination.searchParams.set('service', 'regular');
        link.setAttribute('href', destination.toString());
      } catch (_) {}
    }
  }

  function removeUnpublishedDurhamLinks() {
    var links = document.querySelectorAll('a[href*="/location/durham"]');
    for (var index = 0; index < links.length; index += 1) links[index].remove();
  }

  function clarifyFreeFirstLook(page) {
    if (!page.clarifyFreeFirstLook) return;
    var paragraphs = document.querySelectorAll('p');
    for (var index = 0; index < paragraphs.length; index += 1) {
      var paragraph = paragraphs[index];
      var copy = String(paragraph.textContent || '').trim();
      if (copy !== 'Start with a free online photo check, or compare providers in a nearby city. We do not show unverified profiles as local options.') continue;
      paragraph.textContent = 'Use the free photo screener for an initial look. A professional written appraisal is a separate paid service, available from Start Appraisal.';
    }
  }

  function apply() {
    var page = currentPage();
    if (!page) return;
    patchMetadata(page);
    patchHeading(page);
    patchProfessionalIntake();
    removeUnpublishedDurhamLinks();
    clarifyFreeFirstLook(page);
  }

  apply();
  if (typeof MutationObserver === 'function') {
    var observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(function () { observer.disconnect(); }, 8000);
  }
  [50, 250, 800, 1600, 3200].forEach(function (delay) {
    window.setTimeout(apply, delay);
  });
})();
