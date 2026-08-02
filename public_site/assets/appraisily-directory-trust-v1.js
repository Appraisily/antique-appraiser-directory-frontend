(function () {
  'use strict';

  var replacements = {
    'Trusted antique valuation network': 'Independent appraisal directory',
    'Find certified antique appraisers and art valuation experts near you': 'Find antique appraiser listings and art valuation options near you',
    'Browse city guides for donation, estate, insurance, and resale valuations, then compare local experts or start an online appraisal.': 'Browse current city listings for donation, estate, insurance, and resale needs. Verify credentials, scope, fees, service area, and availability directly with each provider.',
    'Verified local specialists and online reports, city by city.': 'Current directory listings and online report options, city by city.',
    'Every submission is matched with a certified specialist who understands the historical context and market value of your antiques.': 'Appraisily reviews the photos and details you submit and explains the available next step. A signed report is optional and separate from the local directory listings.',
    'Find antique appraisers and art appraisal services in your city. Start with the highest-demand city guides below, then compare broader regional options across the United States.': 'Check current antique-appraiser and art-appraisal availability by city. Listing depth varies, so confirm each provider\'s service area and details directly.',
    'Featured Antique Appraisers': 'Firms readers may research',
    'Strong page to compare metro-area antique and art appraisal providers.': 'Check the currently listed Chicago-area options and verify details directly.',
    'Good fit for donation, estate, and insurance appraisal searches in Iowa.': 'Check current Des Moines-area availability before deciding between local and online service.',
    'Targets local appraisal intent for estate items, collections, and insurance work.': 'Check the currently listed Milwaukee-area options, including nearby service locations.',
    'Compare Chicago antique and art appraisers, or upload photos for a signed online report when you need estate, insurance, donation, or resale documentation.': 'Review the currently listed Chicago-area option, or upload photos for a signed online report when you need estate, insurance, donation, or resale documentation.',
    'Compare local appraisers or start online': 'Check local availability or start online',
    'Local specialists by city and niche': 'Current listings by city and niche',
    'Browse providers serving Chicago, Illinois and nearby areas, then shortlist by specialty fit.': 'Review the currently listed provider serving Chicago and nearby areas, then confirm its service area and specialty directly.',
    'Browse providers serving Milwaukee, Wisconsin and nearby areas, then shortlist by specialty fit.': 'Review the currently listed provider serving Milwaukee and nearby areas, then confirm its Brown Deer location, service area, and specialty directly.',
    'Local antique appraisers in Chicago, Illinois': 'Current antique appraisal listing serving Chicago and nearby areas',
    'Local antique appraisers in Milwaukee, Wisconsin': 'Current antique appraisal listing serving Milwaukee and nearby areas',
    'Use this list to contact in-person providers or compare them with Appraisily\u2019s online option.': 'Review the current listing and confirm location, credentials, scope, fees, and availability directly. Appraisily\u2019s online option is separate.',
    'Use this page to compare antique appraisers near me chicago, Chicago, Illinois art appraisal services, antique appraisals, and antiques appraisal options for estate, donation, insurance, resale, and personal-property decisions.': 'Use this page to review current Chicago-area antique and art appraisal availability for estate, donation, insurance, resale, and personal-property decisions.',
    'Compare specialties and services for antique and art appraisers serving Chicago, Illinois.': 'Review the currently listed provider serving Chicago and confirm credentials, scope, fees, and availability directly.',
    'This page lists 4 providers.': 'This page currently lists 1 provider.',
    'Antique Appraisers Near You in Milwaukee': 'Antique Appraisal Options Serving Milwaukee and Nearby Areas',
    'Find antique and art appraisers near you in Milwaukee. Compare local in-person experts for estate, donation, and insurance valuations \u2014 or choose a faster online appraisal.': 'Review the currently listed nearby provider, including its Brown Deer location, and confirm credentials, scope, fees, and availability directly, or start an online appraisal.',
    'Compare Milwaukee antique and art appraisers near you for estate, donation, insurance, and personal-property needs, then choose local or online support.': 'Review the currently listed nearby option, including its Brown Deer location, for estate, donation, insurance, and personal-property needs, or choose online support.',
    'Use this page to compare antique appraisers near me milwaukee, Milwaukee, Wisconsin art appraisal services, antique appraisals, and antiques appraisal options for estate, donation, insurance, resale, and personal-property decisions.': 'Use this page to review current antique and art appraisal availability serving Milwaukee and nearby areas for estate, donation, insurance, resale, and personal-property decisions.',
    'Compare specialties and services for antique and art appraisers serving Milwaukee, Wisconsin.': 'Review the currently listed nearby provider and confirm its Brown Deer service location, credentials, scope, fees, and availability directly.',
    'Compare Des Moines specialists, or upload photos for a signed appraisal report for estate, insurance, donation, or personal-property decisions.': 'Check current Des Moines-area availability, or upload photos for a signed appraisal report for estate, insurance, donation, or personal-property decisions.',
    'Use this page to compare des moines antique appraisals, Des Moines art appraisals, antique appraisals, and antiques appraisal options for estate, donation, insurance, resale, and personal-property decisions.': 'Use this page to check current Des Moines-area antique and art appraisal availability for estate, donation, insurance, resale, and personal-property decisions.',
    'No verified local appraiser profiles are currently listed for Des Moines, Iowa.': 'No local appraiser profiles are currently listed for Des Moines, Iowa.',
    'Antique Appraisers in Des Moines, Iowa': 'Des Moines Art and Antique Appraisal Options',
    'No verified local listings yet': 'No local listings currently published',
    'Start with a free online photo check, or compare providers in a nearby city. We do not show unverified profiles as local options.': 'Start with a free online photo check, or browse current listings in a nearby city. Profiles without current publishable details are excluded from local options.',
    'Compare providers in Cedar Rapids, Iowa': 'Browse current listings in Cedar Rapids, Iowa',
    'Use the local provider profiles above when you need an in-person specialist in Des Moines. When an in-person visit is not required, Appraisily can review artwork photos and documentation online for a signed report.': 'No local provider profiles are currently listed for Des Moines. Use the online option here or check another nearby city; when an in-person visit is not required, Appraisily can review photos and documentation online for a signed report.',
    'This page lists 3 providers.': 'This page currently lists 0 providers.',
    'Professional online art and antique appraisals. Get accurate valuations from certified experts within 48 hours.': 'Browse current local listings or start an online appraisal. Confirm provider credentials, scope, fees, availability, and report timing directly.'
  };

  function setText() {
    var nodes = document.querySelectorAll('h1, h2, h3, p, span, figcaption');
    for (var index = 0; index < nodes.length; index += 1) {
      var node = nodes[index];
      var current = String(node.textContent || '').trim();
      if (Object.prototype.hasOwnProperty.call(replacements, current)) {
        node.textContent = replacements[current];
      }
    }
  }

  function patchStats() {
    var statCopy = {
      'Cities covered nationwide': ['City-by-city', 'Current location guides'],
      'States & provinces covered': ['US & Canada', 'Availability varies by location'],
      'Average appraisal turnaround': ['Current', 'Check provider details before contacting']
    };
    var labels = document.querySelectorAll('p');
    for (var index = 0; index < labels.length; index += 1) {
      var label = labels[index];
      var current = String(label.textContent || '').trim();
      var replacement = statCopy[current];
      if (!replacement) continue;
      var value = label.previousElementSibling;
      if (value) value.textContent = replacement[0];
      label.textContent = replacement[1];
    }
  }

  function patchFeaturedDisclaimer() {
    var headings = document.querySelectorAll('h2');
    for (var index = 0; index < headings.length; index += 1) {
      var heading = headings[index];
      if (String(heading.textContent || '').trim() !== 'Firms readers may research') continue;
      if (heading.parentElement && heading.parentElement.querySelector('[data-directory-independence-note="1"]')) return;
      var note = document.createElement('p');
      note.setAttribute('data-directory-independence-note', '1');
      note.className = 'mx-auto mb-10 max-w-3xl text-center text-sm text-gray-600';
      note.textContent = 'Editorial examples only. Appraisily is not affiliated with, sponsored by, or endorsing these firms. Confirm current services, credentials, fees, and availability directly.';
      heading.insertAdjacentElement('afterend', note);
      return;
    }
  }

  function patchMetadata() {
    var path = window.location.pathname.replace(/\/+$/, '/') || '/';
    var title = null;
    var description = null;
    if (path === '/') {
      title = 'Antique Appraisers Near Me | Check Local Availability by City | Appraisily';
      description = 'Browse current antique-appraiser listings by city. Verify credentials, scope, fees, service area, and availability directly with each provider.';
    } else if (path === '/location/milwaukee/') {
      title = 'Antique Appraisal Options Serving Milwaukee & Nearby Areas';
      description = 'Review the currently listed appraisal option serving Milwaukee and nearby areas, including its Brown Deer location, or start with an online appraisal.';
    } else if (path === '/location/des-moines/') {
      title = 'Des Moines Art Appraisal Options | Check Local Availability';
      description = 'Check current Des Moines appraisal availability or get a signed online appraisal from photos for estate, insurance, donation, or personal-property needs.';
    }
    if (title && document.title !== title) document.title = title;
    if (description) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta && meta.getAttribute('content') !== description) meta.setAttribute('content', description);
    }
  }

  function apply() {
    setText();
    patchStats();
    patchFeaturedDisclaimer();
    patchMetadata();
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
