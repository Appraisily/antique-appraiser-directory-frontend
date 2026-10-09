(function preserveFineArtSpecialists() {
  // City pages mounted by the client app replace the static document; keep the
  // authored fine-art specialist section visible after each client render.
  const selector = '[data-fine-art-specialists="1"]';
  let preserved = null;
  let restoreQueued = false;

  function capture() {
    const section = document.querySelector(selector);
    if (section && !preserved) {
      preserved = section.cloneNode(true);
    }
  }

  function restore() {
    restoreQueued = false;
    capture();
    if (!preserved || document.querySelector(selector)) return;

    const bridge = document.querySelector('[data-appraisily-national-service-bridge="1"]');
    const emptyState = document.querySelector('[data-directory-empty-state="true"]');
    const firstResult = document.querySelector('article[data-gtm-surface="location_results"]');
    const insertionPoint = bridge || firstResult?.parentElement || emptyState || document.getElementById('local-appraisers');
    if (!insertionPoint) return;
    insertionPoint.insertAdjacentElement(bridge ? 'beforebegin' : 'afterend', preserved.cloneNode(true));
  }

  function queueRestore() {
    if (restoreQueued) return;
    restoreQueued = true;
    queueMicrotask(restore);
  }

  capture();

  const observer = new MutationObserver(queueRestore);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', queueRestore);
  window.addEventListener('load', () => {
    queueRestore();
    window.setTimeout(queueRestore, 250);
    window.setTimeout(queueRestore, 1000);
  });
})();
