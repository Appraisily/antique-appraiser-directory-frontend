(function () {
  'use strict';

  var pathname = window.location.pathname;
  var isVirginiaBeach = pathname === '/location/virginia-beach/';
  var isMilwaukee = pathname === '/location/milwaukee/';
  if (!isVirginiaBeach && !isMilwaukee) return;

  var cityLabel = 'Virginia Beach, Virginia';
  var milwaukeeProviderSlug = 'cedarburg-auction-appraisals-llc';
  var milwaukeeIllustration =
    '/assets/generated-appraiser-profiles/cedarburg-auction-appraisals-llc.svg';

  function repairMilwaukeeCard(card) {
    var providerLink = card.querySelector(
      'a[href$="/appraiser/' + milwaukeeProviderSlug + '/"]',
    );
    if (!(providerLink instanceof HTMLAnchorElement)) return;

    var image = card.querySelector('img');
    if (image instanceof HTMLImageElement) {
      image.src = milwaukeeIllustration;
      image.alt = 'Directory illustration for Cedarburg Auction & Appraisals LLC';
      image.style.display = '';
      delete image.dataset.tinyPlaceholderHidden;
    }

    if (!card.querySelector('[data-directory-illustration-disclosure]')) {
      var disclosure = document.createElement('p');
      disclosure.dataset.directoryIllustrationDisclosure = 'true';
      disclosure.className = 'px-3 py-2 text-xs text-gray-600';
      disclosure.textContent = 'Directory illustration; not a provider likeness.';
      var imageShell = image && image.parentElement;
      if (imageShell) imageShell.insertAdjacentElement('afterend', disclosure);
    }
  }

  function repairCard(card) {
    if (!(card instanceof HTMLElement)) return;

    if (isMilwaukee) {
      repairMilwaukeeCard(card);
      return;
    }

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
