import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  buildCityDescription,
  buildCityMetadata,
  buildCityTitle,
  buildHubMetadata,
  isReplaceableDescription,
  trimTitleAtSeparators,
} from '../scripts/lib/directory-metadata.mjs';

const kitchener = { city: 'Kitchener', regionCode: 'ON', regionName: 'Ontario', listings: 0, specialists: 0 };
const PROMISES = /\$\s?\d|\bfees?\b|\bpric(?:e|es|ing)\b|\bcosts?\b|\bcertified\b|\bverified\b/i;

test('template titles keep the ranking words and state the real listing count', () => {
  assert.equal(buildCityTitle(kitchener, 'Antique & Art Appraisers in Kitchener, ON | Appraisily'),
    'Antique & Art Appraisers in Kitchener, ON | Free Photo Check');
  assert.equal(buildCityTitle({ ...kitchener, city: 'Oakland', regionCode: 'CA', listings: 2 }, 'Antique & Art Appraisers in Oakland, CA: 2 Listings'),
    'Antique & Art Appraisers in Oakland, CA: 2 Listings');
  assert.equal(buildCityTitle({ ...kitchener, city: 'Kelowna', regionCode: 'BC', listings: 1 }, ''),
    'Antique & Art Appraisers in Kelowna, BC: 1 Listing');
  assert.equal(buildCityTitle({ ...kitchener, city: 'Miami', regionCode: 'FL', listings: 1 }, ''),
    'Antique & Art Appraisers in Miami, FL: 1 Listing');
});

test('titles stay within the length Google shows, falling back tail by tail', () => {
  for (const city of ['Fort Lauderdale', 'Salt Lake City', 'Charlottetown', 'Thunder Bay', 'Ab']) {
    for (const listings of [0, 1, 2, 12, null]) {
      const title = buildCityTitle({ city, regionCode: 'XX', listings }, '');
      assert.ok(title.startsWith(`Antique & Art Appraisers in ${city}, XX`), title);
      assert.ok(title.length <= TITLE_MAX || title === `Antique & Art Appraisers in ${city}, XX${listings ? `: ${listings} Listing${listings === 1 ? '' : 's'}` : ''}`, title);
    }
  }
  assert.equal(buildCityTitle({ city: 'Baton Rouge', regionCode: 'LA', listings: 0 }, ''), 'Antique & Art Appraisers in Baton Rouge, LA | Appraisily');
  assert.equal(buildCityTitle({ city: 'Colorado Springs', regionCode: 'CO', listings: 0 }, ''), 'Antique & Art Appraisers in Colorado Springs, CO');
});

test('a count of 0 or a missing count never puts a number in the title', () => {
  assert.doesNotMatch(buildCityTitle({ ...kitchener, listings: 0 }, ''), /\d|Listing/);
  assert.doesNotMatch(buildCityTitle({ ...kitchener, listings: null }, ''), /\d|Listing/);
  assert.doesNotMatch(buildCityTitle({ ...kitchener, listings: undefined }, ''), /\d|Listing/);
  assert.doesNotMatch(buildCityTitle({ ...kitchener, listings: -1 }, ''), /\d|Listing/);
});

test('custom titles keep their wording; only a cut-off tail is dropped at a separator', () => {
  assert.equal(buildCityTitle(kitchener, 'Ottawa Antique & Art Appraisers | Estate, Insurance, Donation'),
    'Ottawa Antique & Art Appraisers | Estate, Insurance, Donation'); // 61 chars, kept
  assert.equal(buildCityTitle(kitchener, 'Toronto Antique Appraisers & Art Appraisal Services | Estate, Insurance, Donation'),
    'Toronto Antique Appraisers & Art Appraisal Services');
  assert.equal(buildCityTitle(kitchener, 'Austin Antique Appraisers | Compare Local Experts & Online Options'),
    'Austin Antique Appraisers | Free Photo Check');
  assert.equal(trimTitleAtSeparators('A very long single phrase without any separator at all that runs past sixty'),
    'A very long single phrase without any separator at all that runs past sixty');
  assert.equal(trimTitleAtSeparators('Short | Tail that is long enough to push the whole title past sixty'), 'Short');
});

test('missing city or region keeps the current title instead of inventing one', () => {
  assert.equal(buildCityTitle({ city: null, regionCode: null, listings: 0 }, 'Denver Antique Appraisers & Art Appraisal | Online Signed Reports'),
    'Denver Antique Appraisers & Art Appraisal | Online Signed Reports');
  assert.equal(buildCityTitle({ city: null, regionCode: 'CO', listings: 0 }, ''), '');
});

test('descriptions state the count from the page, lead with what it gives, and fit', () => {
  const zero = buildCityDescription(kitchener);
  assert.match(zero, /^How to choose an antique or art appraiser in Kitchener, Ontario/);
  assert.match(zero, /No local listings yet/);
  assert.match(zero, /free photo check/);

  const one = buildCityDescription({ ...kitchener, listings: 1 });
  assert.match(one, /^1 antique and art appraiser listing for Kitchener, Ontario\./);
  assert.doesNotMatch(one, /no local listings/i);

  const two = buildCityDescription({ ...kitchener, listings: 2 });
  assert.match(two, /^2 antique and art appraiser listings for /);

  const specialist = buildCityDescription({ ...kitchener, specialists: 1 });
  assert.match(specialist, /^1 listed fine-art specialist for Kitchener, Ontario; no local antique listing yet\./);

  const both = buildCityDescription({ ...kitchener, listings: 1, specialists: 2 });
  assert.match(both, /^1 antique and art appraiser listing for Kitchener, Ontario, plus 2 fine-art specialists\./);

  const missing = buildCityDescription({ ...kitchener, listings: null, specialists: null });
  assert.doesNotMatch(missing, /\d|no local listings/i, 'no count claim without data');

  for (const description of [zero, one, two, specialist, both, missing]) {
    assert.ok(description.length <= DESCRIPTION_MAX, `${description.length}: ${description}`);
    assert.doesNotMatch(description, PROMISES);
    assert.doesNotMatch(description, /\bcompar(?:e|es|ing|ison)\b/i);
  }
});

test('long place names still fit by falling back to shorter wording', () => {
  for (const regionName of ['Newfoundland and Labrador', 'Prince Edward Island', 'District of Columbia']) {
    for (const facts of [{ listings: 0, specialists: 0 }, { listings: 3, specialists: 2 }, { listings: 0, specialists: 1 }, { listings: null }]) {
      const description = buildCityDescription({ city: "St. John's", regionName, ...facts });
      assert.ok(description.length <= DESCRIPTION_MAX, `${description.length}: ${description}`);
    }
  }
});

test('only template, truncated or overlong descriptions are replaced; the result is stable', () => {
  assert.ok(isReplaceableDescription('No local listings yet for Kitchener, Ontario. How to choose...'));
  assert.ok(isReplaceableDescription('2 antique and art appraiser listings for Austin, Texas. Confirm...'));
  assert.ok(isReplaceableDescription('1 listed fine-art specialist for Boston, Massachusetts; no local...'));
  assert.ok(isReplaceableDescription('Compare antique and art appraisers near Boise, Idaho. Or try Appraisily’s free screener first, then upgra…'));
  assert.ok(isReplaceableDescription('x'.repeat(161)));
  assert.ok(!isReplaceableDescription('Compare Seattle antique and art appraisers, or upload photos for a signed online appraisal report for estate and insurance needs.'));

  const custom = { title: 'Seattle Antique & Art Appraisals | Signed Online Reports', description: 'Compare Seattle antique and art appraisers, or upload photos.' };
  assert.deepEqual(buildCityMetadata({ ...kitchener, city: 'Seattle' }, custom), custom);

  const once = buildCityMetadata(kitchener, { title: 'Antique & Art Appraisers in Kitchener, ON | Appraisily', description: 'No local listings yet for Kitchener, Ontario.' });
  assert.deepEqual(buildCityMetadata(kitchener, once), once, 'idempotent');
});

test('hub metadata uses the counts shown on the hub and falls back without them', () => {
  const art = buildHubMetadata('art', { reviewedSpecialists: 14, cityPages: 12 });
  assert.equal(art.title, 'Art Appraisers Near Me: 14 Reviewed Fine-Art Specialists');
  assert.match(art.description, /^14 fine-art appraisers reviewed against their official websites/);

  for (const count of [0, 1, null, undefined]) {
    const fallback = buildHubMetadata('art', { reviewedSpecialists: count, cityPages: 0 });
    assert.doesNotMatch(fallback.title, /\d/);
    assert.doesNotMatch(fallback.description, /\d|\bcompar/i, 'no comparison with fewer than two listed');
  }

  const antique = buildHubMetadata('antique', { reviewedSpecialists: 0, cityPages: 12 });
  assert.equal(antique.title, 'Antique Appraisers Near Me: Local Options & Free Photo Check');
  assert.match(antique.description, /^Browse 12 city pages /);
  assert.doesNotMatch(buildHubMetadata('antique', { cityPages: 0 }).description, /\d/);

  for (const meta of [art, antique]) {
    assert.ok(meta.title.length <= TITLE_MAX, meta.title);
    assert.ok(meta.description.length <= DESCRIPTION_MAX, meta.description);
    assert.doesNotMatch(`${meta.title} ${meta.description}`, PROMISES);
  }
});
