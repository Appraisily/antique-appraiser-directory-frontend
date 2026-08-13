(function () {
  'use strict';

  if (window.location.pathname !== '/location/virginia-beach/') return;

  var cityLabel = 'Virginia Beach, Virginia';

  function repairCard(card) {
    if (!(card instanceof HTMLElement)) return;

    var image = card.querySelector('img');
    if (image instanceof HTMLImageElement) {
      var hideTinyImage = function () {
        if (!image.complete) return;
        if (image.naturalWidth > 1 || image.naturalHeight > 1) return;
        image.style.display = 'none';
        image.dataset.tinyPlaceholderHidden = 'true';
      };
      image.addEventListener('load', hideTinyImage, { once: true });
      hideTinyImage();
    }

    var location = card.querySelector('.lucide-map-pin + span');
    if (location instanceof HTMLElement && !location.textContent.trim()) {
      location.textContent = cityLabel;
      location.dataset.locationFallbackApplied = 'true';
    }
  }

  function repairCards() {
    document
      .querySelectorAll('article[data-clarity-action="location_appraiser_card"]')
      .forEach(repairCard);
  }

  repairCards();

  var observer = new MutationObserver(repairCards);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(function () {
    repairCards();
    observer.disconnect();
  }, 8000);
})();
