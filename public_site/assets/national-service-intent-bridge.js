(function preserveNationalServiceIntentBridge() {
  const selector = '[data-appraisily-national-service-bridge="1"]';
  const localResultsId = 'local-appraisers';
  let preservedBridge = null;
  let restoreQueued = false;

  function captureBridge() {
    const bridge = document.querySelector(selector);
    if (bridge && !preservedBridge) {
      preservedBridge = bridge.cloneNode(true);
    }
  }

  function restoreBridge() {
    restoreQueued = false;
    captureBridge();
    if (!preservedBridge || document.querySelector(selector)) return;

    const localHeading = document.getElementById(localResultsId);
    const emptyState = document.querySelector('[data-directory-empty-state="true"]');
    const firstResult = document.querySelector('article[data-gtm-surface="location_results"]');
    const insertionPoint = firstResult?.parentElement || emptyState || localHeading;
    if (!insertionPoint) return;
    insertionPoint.insertAdjacentElement('afterend', preservedBridge.cloneNode(true));
  }

  function queueRestore() {
    if (restoreQueued) return;
    restoreQueued = true;
    queueMicrotask(restoreBridge);
  }

  captureBridge();

  const observer = new MutationObserver(queueRestore);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', queueRestore);
  window.addEventListener('load', () => {
    queueRestore();
    window.setTimeout(queueRestore, 250);
    window.setTimeout(queueRestore, 1000);
  });
})();
