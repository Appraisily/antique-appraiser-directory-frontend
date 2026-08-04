(function installAppraisilyDirectoryTelemetry(window, document) {
  'use strict';

  if (window.__appraisilyDirectoryTelemetryV1) return;
  window.__appraisilyDirectoryTelemetryV1 = true;

  var CONTROL_PLANE = 'https://appraisily.com/api/public/analytics/collect';
  var GTM_ID = 'GTM-PSLHDGM';
  var ANONYMOUS_ID_KEY = 'appraisily_analytics_anonymous_id';
  var QA_MARKER_KEY = 'appraisily_qa_marker';
  var QA_FAMILIES = {
    qa: 'qa',
    synthetic_browser: 'qa',
    customer_qa: 'qa',
    browser_automation: 'browser_automation',
    agent: 'agent',
    canary: 'monitoring',
    smoke: 'monitoring',
    monitoring: 'monitoring',
    staff: 'staff'
  };
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid', 'msclkid'];
  var originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  var originalInsertBefore = window.Node && window.Node.prototype.insertBefore;
  var originalAppendChild = window.Node && window.Node.prototype.appendChild;
  var recentFirstPartyEvents = Object.create(null);
  var arrivalPaths = Object.create(null);
  var googlePageViewPaths = Object.create(null);
  var gtmSystemStarted = false;
  var gtmScriptInserted = false;

  function bounded(value, limit) {
    if (typeof value !== 'string') return undefined;
    value = value.trim();
    return value ? value.slice(0, limit) : undefined;
  }

  function canonicalPath(value) {
    try {
      var path = new URL(value || window.location.pathname || '/', window.location.origin).pathname || '/';
      path = path.replace(/\/{2,}/g, '/');
      return (path.charAt(0) === '/' ? path : '/' + path).slice(0, 512);
    } catch (_error) {
      return '/';
    }
  }

  function canonicalExternalUrl(value) {
    try {
      var parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
      return (parsed.origin + canonicalPath(parsed.pathname)).slice(0, 1024);
    } catch (_error) {
      return undefined;
    }
  }

  function readCookie(name) {
    try {
      var prefix = encodeURIComponent(name) + '=';
      var parts = String(document.cookie || '').split(';');
      for (var index = 0; index < parts.length; index += 1) {
        var part = parts[index].trim();
        if (part.indexOf(prefix) === 0) return bounded(decodeURIComponent(part.slice(prefix.length)), 128);
      }
    } catch (_error) {
      // Storage failures must not break the directory.
    }
    return undefined;
  }

  function writeSharedId(value) {
    try {
      window.localStorage.setItem(ANONYMOUS_ID_KEY, value);
    } catch (_error) {
      // Ignore blocked storage.
    }
    try {
      document.cookie = encodeURIComponent(ANONYMOUS_ID_KEY) + '=' + encodeURIComponent(value) +
        '; Max-Age=34128000; Path=/; Domain=.appraisily.com; SameSite=Lax; Secure';
    } catch (_error) {
      // Ignore blocked cookies.
    }
  }

  function getJourneyId() {
    var shared = readCookie(ANONYMOUS_ID_KEY);
    if (!shared) {
      try {
        shared = bounded(window.localStorage.getItem(ANONYMOUS_ID_KEY), 128);
      } catch (_error) {
        // Ignore blocked storage.
      }
    }
    if (!shared) {
      shared = window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : 'anon_' + Date.now() + '_' + Math.random().toString(16).slice(2);
    }
    writeSharedId(shared);
    return shared;
  }

  function getSyntheticContext() {
    var marker;
    try {
      var params = new URLSearchParams(window.location.search || '');
      var explicit = String(params.get('appraisily_synthetic') || '').trim().toLowerCase();
      if (QA_FAMILIES[explicit]) marker = explicit;
      else if (params.get('appraisily_qa') === '1') marker = 'synthetic_browser';
      if (marker) window.sessionStorage.setItem(QA_MARKER_KEY, marker);
      else {
        var stored = String(window.sessionStorage.getItem(QA_MARKER_KEY) || '').trim().toLowerCase();
        if (QA_FAMILIES[stored]) marker = stored;
      }
    } catch (_error) {
      // The explicit URL marker still works when session storage is unavailable.
    }
    return marker ? { marker: marker, family: QA_FAMILIES[marker] } : {};
  }

  function isLikelyBot() {
    try {
      var userAgent = String(window.navigator && window.navigator.userAgent || '');
      if (window.navigator && window.navigator.webdriver) return true;
      return /HeadlessChrome|PhantomJS|Playwright|Puppeteer|bot|crawler|spider|slurp|googlebot|bingpreview|facebookexternalhit|twitterbot|linkedinbot/i.test(userAgent);
    } catch (_error) {
      return false;
    }
  }

  function surfaceContract() {
    var art = window.location.hostname.indexOf('art-appraisers-directory.') === 0;
    return art
      ? { app: 'art_appraiser_directory_frontend', surface: 'art_appraisers_directory' }
      : { app: 'antique_appraiser_directory_frontend', surface: 'antique_appraiser_directory' };
  }

  function pageContext(path) {
    var parts = path.split('/').filter(Boolean);
    var first = parts[0];
    var second = bounded(parts[1], 128);
    if (!first) return { page_type: 'home', page_category: 'directory_home' };
    if (first === 'location') return { page_type: 'location', page_category: 'directory_city', city_slug: second };
    if (first === 'appraiser') return { page_type: 'appraiser', page_category: 'directory_profile', appraiser_slug: second };
    return { page_type: 'content', page_category: 'marketing' };
  }

  var synthetic = getSyntheticContext();
  var vendorExcluded = Boolean(synthetic.marker) || isLikelyBot();
  var journeyId = getJourneyId();

  function acquisitionContext() {
    var result = {};
    try {
      var params = new URLSearchParams(window.location.search || '');
      UTM_KEYS.concat(CLICK_ID_KEYS).forEach(function addAcquisition(key) {
        var value = bounded(params.get(key), CLICK_ID_KEYS.indexOf(key) >= 0 ? 128 : 200);
        if (value) result[key] = value;
      });
    } catch (_error) {
      // Ignore malformed query strings.
    }
    result.landing_page = (window.location.origin + canonicalPath(window.location.pathname)).slice(0, 1024);
    var referrer = canonicalExternalUrl(document.referrer);
    if (referrer) result.referrer = referrer;
    if (synthetic.marker) {
      result.synthetic = synthetic.marker;
      result.synthetic_family = synthetic.family;
    }
    return result;
  }

  function noOpResponse() {
    return Promise.resolve({
      ok: true,
      status: 204,
      text: function text() { return Promise.resolve(''); },
      json: function json() { return Promise.resolve({}); }
    });
  }

  function eventKey(event, path) {
    return event + '|' + path;
  }

  function sendFirstParty(event, params, markRecent) {
    if (!originalFetch || !event) return;
    var path = canonicalPath(params && params.page_path || window.location.pathname);
    var contract = surfaceContract();
    var context = pageContext(path);
    var cleanParams = Object.assign({}, params || {});
    delete cleanParams.event;
    delete cleanParams.page_location;
    delete cleanParams.page_title;
    cleanParams.page_path = path;
    cleanParams.journey_id = journeyId;
    if (synthetic.marker) {
      cleanParams.qa_marker = synthetic.marker;
      cleanParams.is_synthetic = true;
      cleanParams.synthetic_family = synthetic.family;
    }
    if (markRecent) recentFirstPartyEvents[eventKey(event, path)] = Date.now();
    var envelope = {
      event: event,
      occurred_at: new Date().toISOString(),
      routing_version: 'control-plane-v1',
      source: {
        app: contract.app,
        surface: contract.surface,
        page_path: path,
        page_key: context.page_category
      },
      identity: { anonymous_id: journeyId },
      traffic: acquisitionContext(),
      payload: Object.assign({
        page_location: window.location.origin + path,
        page_title: bounded(document.title, 200),
        page_path: path,
        page_type: context.page_type,
        page_category: context.page_category
      }, context.city_slug ? { city_slug: context.city_slug } : {},
      context.appraiser_slug ? { appraiser_slug: context.appraiser_slug } : {}, cleanParams)
    };
    try {
      originalFetch(CONTROL_PLANE, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      }).catch(function ignoreCollectionFailure() {});
    } catch (_error) {
      // Telemetry must never interrupt navigation.
    }
  }

  function recordArrival(path) {
    path = canonicalPath(path);
    if (arrivalPaths[path]) return;
    arrivalPaths[path] = true;
    sendFirstParty('surface_arrived', {
      page_path: path,
      arrival_owner: 'directory_static_bootstrap'
    }, false);
  }

  function vendorKind(value) {
    try {
      var host = new URL(String(value), window.location.origin).hostname.toLowerCase();
      if (host === 'posthog.com' || host.endsWith('.posthog.com')) return 'posthog';
      if (host === 'clarity.ms' || host.endsWith('.clarity.ms')) return 'clarity';
      if (host.indexOf('googletagmanager.com') >= 0 || host.indexOf('google-analytics.com') >= 0 ||
          host.indexOf('googleadservices.com') >= 0 || host.indexOf('doubleclick.net') >= 0) return 'google';
    } catch (_error) {
      // Not a URL we own or need to filter.
    }
    return undefined;
  }

  function shouldBlockVendor(value) {
    var kind = vendorKind(value);
    return kind === 'posthog' || (vendorExcluded && Boolean(kind));
  }

  if (originalFetch) {
    window.fetch = function governedDirectoryFetch(input, init) {
      var url = typeof input === 'string' ? input : input && input.url;
      if (shouldBlockVendor(url)) return noOpResponse();
      if (url && new URL(String(url), window.location.origin).toString().indexOf(CONTROL_PLANE) === 0) {
        try {
          var body = init && typeof init.body === 'string' ? JSON.parse(init.body) : null;
          var event = body && bounded(body.event, 100);
          var path = canonicalPath(body && body.source && body.source.page_path || window.location.pathname);
          if (event === 'page_view') return noOpResponse();
          var recentAt = event && recentFirstPartyEvents[eventKey(event, path)];
          if (recentAt && Date.now() - recentAt < 1500) return noOpResponse();
        } catch (_error) {
          // Preserve unrecognized first-party collector requests.
        }
      }
      return originalFetch(input, init);
    };
  }

  if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
    var xhrOpen = window.XMLHttpRequest.prototype.open;
    var xhrSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.open = function governedXhrOpen(method, url) {
      this.__appraisilyVendorBlocked = shouldBlockVendor(url);
      if (this.__appraisilyVendorBlocked) return undefined;
      return xhrOpen.apply(this, arguments);
    };
    window.XMLHttpRequest.prototype.send = function governedXhrSend() {
      if (this.__appraisilyVendorBlocked) return undefined;
      return xhrSend.apply(this, arguments);
    };
  }

  if (window.navigator && typeof window.navigator.sendBeacon === 'function') {
    var originalSendBeacon = window.navigator.sendBeacon.bind(window.navigator);
    window.navigator.sendBeacon = function governedSendBeacon(url, data) {
      if (shouldBlockVendor(url)) return true;
      return originalSendBeacon(url, data);
    };
  }

  function isBlockedScript(node) {
    if (!node || String(node.tagName || '').toUpperCase() !== 'SCRIPT') return false;
    var kind = vendorKind(node.src || '');
    if (kind === 'posthog') return true;
    if (kind === 'google') return vendorExcluded || gtmScriptInserted;
    if (kind === 'clarity') return vendorExcluded;
    return false;
  }

  if (originalInsertBefore) {
    window.Node.prototype.insertBefore = function governedInsertBefore(node, reference) {
      if (isBlockedScript(node)) return node;
      return originalInsertBefore.call(this, node, reference);
    };
  }
  if (originalAppendChild) {
    window.Node.prototype.appendChild = function governedAppendChild(node) {
      if (isBlockedScript(node)) return node;
      return originalAppendChild.call(this, node);
    };
  }

  var layer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
  var nativePush = Array.prototype.push;
  layer.push = function governedDataLayerPush() {
    for (var index = 0; index < arguments.length; index += 1) {
      var entry = arguments[index];
      var event = entry && typeof entry.event === 'string' ? entry.event.trim() : '';
      if (event === 'page_view') {
        var path = canonicalPath(entry.page_path || entry.page_location || window.location.pathname);
        recordArrival(path);
        if (vendorExcluded || googlePageViewPaths[path]) continue;
        googlePageViewPaths[path] = true;
        var context = pageContext(path);
        nativePush.call(layer, Object.assign({
          event: 'page_view',
          page_location: window.location.origin + path,
          page_path: path,
          page_title: bounded(entry.page_title || document.title, 200),
          page_type: context.page_type,
          page_category: context.page_category
        }, context.city_slug ? { city_slug: context.city_slug } : {},
        context.appraiser_slug ? { appraiser_slug: context.appraiser_slug } : {}));
      } else if (event === 'gtm.js') {
        if (!vendorExcluded && !gtmSystemStarted) {
          gtmSystemStarted = true;
          nativePush.call(layer, entry);
        }
      } else if (event && event.indexOf('gtm.') !== 0) {
        var eventParams = Object.assign({}, entry);
        delete eventParams.event;
        sendFirstParty(event, eventParams, true);
      } else if (!vendorExcluded) {
        nativePush.call(layer, entry);
      }
    }
    return layer.length;
  };
  window.dataLayer = layer;

  layer.push({
    event: 'page_view',
    page_path: canonicalPath(window.location.pathname),
    page_title: document.title
  });

  if (!vendorExcluded && originalInsertBefore) {
    var firstScript = document.getElementsByTagName('script')[0];
    var gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    gtmScript.setAttribute('data-appraisily-telemetry-owner', 'directory-static-bootstrap');
    layer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    gtmScriptInserted = true;
    if (firstScript && firstScript.parentNode) originalInsertBefore.call(firstScript.parentNode, gtmScript, firstScript);
    else if (document.head && originalAppendChild) originalAppendChild.call(document.head, gtmScript);
  }
})(window, document);
