// Title and meta-description builder for the directory city pages and the two
// "near me" hubs (CTR pass 2, 2026-11-11).
//
// Builds on the 2026-10-12 honesty pass (d79ac74f, bc4bf74d):
// - City titles keep their ranking wording "Antique & Art Appraisers in
//   {City}, {ST}" and the real ": N Listing(s)" count. Only the tail changes:
//   the free photo check replaces the bare brand when it fits.
// - Custom city titles are kept; when longer than Google shows, they are cut at
//   their own " | " separators so the front wording stays exactly as it is.
// - Descriptions lead with what the page gives (listings, or how to choose)
//   instead of "No local listings yet", which now comes second.
// Every number comes from the page itself (scripts/lib/city-page-facts.mjs).
// No prices, no fee or comparison promises, no certification claims.

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
export const CITY_TITLE_PREFIX = 'Antique & Art Appraisers in ';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const isCount = (value) => Number.isInteger(value) && value >= 0;

function firstThatFits(candidates, max) {
  const fits = candidates.find((candidate) => candidate.length <= max);
  return fits ?? candidates.reduce((shortest, candidate) => (candidate.length < shortest.length ? candidate : shortest));
}

/** Cut a custom title at its own " | " separators until it fits; never mid-phrase. */
export function trimTitleAtSeparators(title, max = TITLE_MAX) {
  let parts = String(title).split(' | ');
  while (parts.join(' | ').length > max && parts.length > 1) parts = parts.slice(0, -1);
  return parts.join(' | ');
}

// Custom titles up to this length are left alone: Google usually shows them
// whole, and the October pass kept them on purpose (e.g. Ottawa, 61 chars).
export const CUSTOM_TITLE_KEEP_MAX = 65;
const PHOTO_CHECK_TAIL = ' | Free Photo Check';

export function buildCityTitle({ city, regionCode, listings }, currentTitle = '') {
  if (currentTitle && !currentTitle.startsWith(CITY_TITLE_PREFIX)) {
    // Custom, reviewed wording: only drop the tail Google cuts off, keeping
    // the front words exactly, then add the photo check if it still fits.
    if (currentTitle.length <= CUSTOM_TITLE_KEEP_MAX) return currentTitle;
    const trimmed = trimTitleAtSeparators(currentTitle);
    if (trimmed.endsWith(PHOTO_CHECK_TAIL)) return trimmed;
    return firstThatFits([`${trimmed}${PHOTO_CHECK_TAIL}`, trimmed], TITLE_MAX);
  }
  if (!city || !regionCode) return currentTitle ? trimTitleAtSeparators(currentTitle) : '';
  const base = `${CITY_TITLE_PREFIX}${city}, ${regionCode}`;
  const counted = isCount(listings) && listings > 0 ? `${base}: ${plural(listings, 'Listing')}` : base;
  return firstThatFits([`${counted}${PHOTO_CHECK_TAIL}`, `${counted} | Appraisily`, counted], TITLE_MAX);
}

export function buildCityDescription({ city, regionName, regionCode, listings, specialists }) {
  const place = `${city}, ${regionName || regionCode}`;
  const online = 'try a free photo check and paid written appraisals online';
  if (!isCount(listings)) {
    return firstThatFits([
      `How to choose an antique or art appraiser in ${place}: what to prepare and what to ask. Or ${online}.`,
      `How to choose an antique or art appraiser in ${place}. Or ${online}.`,
      `How to choose an antique or art appraiser in ${place}, plus a free photo check online.`,
    ], DESCRIPTION_MAX);
  }
  const fineArt = isCount(specialists) ? specialists : 0;
  if (listings > 0 && fineArt > 0) {
    return firstThatFits([
      `${plural(listings, 'antique and art appraiser listing')} for ${place}, plus ${plural(fineArt, 'fine-art specialist')}. Confirm services directly, or ${online}.`,
      `${plural(listings, 'antique and art appraiser listing')} for ${place}, plus ${plural(fineArt, 'fine-art specialist')}. Or ${online}.`,
      `${plural(listings, 'antique and art appraiser listing')} for ${place}, plus ${plural(fineArt, 'fine-art specialist')}. Free photo check online.`,
    ], DESCRIPTION_MAX);
  }
  if (listings > 0) {
    return firstThatFits([
      `${plural(listings, 'antique and art appraiser listing')} for ${place}. Confirm services directly, or ${online}.`,
      `${plural(listings, 'antique and art appraiser listing')} for ${place}. Or ${online}.`,
      `${plural(listings, 'antique and art appraiser listing')} for ${place}. Free photo check online.`,
    ], DESCRIPTION_MAX);
  }
  if (fineArt > 0) {
    return firstThatFits([
      `${plural(fineArt, 'listed fine-art specialist')} for ${place}; no local antique listing yet. How to choose an appraiser, or ${online}.`,
      `${plural(fineArt, 'listed fine-art specialist')} for ${place}; no local antique listing yet. Or ${online}.`,
      `${plural(fineArt, 'listed fine-art specialist')} for ${place}; no local antique listing yet. Free photo check online.`,
    ], DESCRIPTION_MAX);
  }
  return firstThatFits([
    `How to choose an antique or art appraiser in ${place}: what to prepare and ask. No local listings yet; ${online}.`,
    `How to choose an antique or art appraiser in ${place}. No local listings yet; ${online}.`,
    `How to choose an antique or art appraiser in ${place}. No local listings yet; free photo check online.`,
  ], DESCRIPTION_MAX);
}

/** Descriptions this pass replaces; reviewed custom copy that fits is kept. */
export function isReplaceableDescription(description) {
  const text = String(description || '');
  return (
    /^(No local listings yet for |\d+ antique and art appraiser listings? for |\d+ listed fine-art specialists? for )/.test(text) ||
    /…$/.test(text) ||
    text.length > 160
  );
}

export function buildCityMetadata(facts, current = {}) {
  const title = buildCityTitle(facts, current.title || '');
  const description = !current.description || isReplaceableDescription(current.description)
    ? buildCityDescription(facts)
    : current.description;
  return { title, description };
}

export function buildHubMetadata(kind, { reviewedSpecialists, cityPages }) {
  if (kind === 'art') {
    const k = isCount(reviewedSpecialists) ? reviewedSpecialists : 0;
    const title = k >= 2
      ? firstThatFits([
        `Art Appraisers Near Me: ${k} Reviewed Fine-Art Specialists`,
        `Art Appraisers Near Me: ${k} Reviewed Specialists`,
      ], TITLE_MAX)
      : 'Art Appraisers Near Me | Local Options & Free Photo Check';
    const description = k >= 2
      ? firstThatFits([
        `${k} fine-art appraisers reviewed against their official websites, listed by city. Compare them, or start with a free photo check before you book.`,
        `${k} fine-art appraisers reviewed against their official websites. Compare them, or start with a free photo check.`,
      ], DESCRIPTION_MAX)
      : 'How to find an art appraiser near you, what to check before you book, and a free photo check online.';
    return { title, description };
  }
  const c = isCount(cityPages) ? cityPages : 0;
  return {
    title: 'Antique Appraisers Near Me: Local Options & Free Photo Check',
    description: c > 0
      ? firstThatFits([
        `Browse ${plural(c, 'city page')} for local antique appraisers, see what to compare before you book, or start with a free photo check online.`,
        `Browse ${plural(c, 'city page')} for local antique appraisers, or start with a free photo check online.`,
      ], DESCRIPTION_MAX)
      : 'How to find a local antique appraiser, what to compare before you book, and a free photo check online.',
  };
}
