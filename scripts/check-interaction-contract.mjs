import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/components/DecisionRouter.tsx'), 'utf8');
const locationSource = fs.readFileSync(path.join(root, 'src/pages/StandardizedLocationPage.tsx'), 'utf8');
const navbarSource = fs.readFileSync(path.join(root, 'src/components/Navbar.tsx'), 'utf8');
const footerSource = fs.readFileSync(path.join(root, 'src/components/Footer.tsx'), 'utf8');
const feedbackSource = fs.readFileSync(path.join(root, 'src/components/ContentFeedback.tsx'), 'utf8');
const profileSource = fs.readFileSync(path.join(root, 'src/pages/StandardizedAppraiserPage.tsx'), 'utf8');
const failures = [];

if (source.includes('data-appraisily-directory-sample-proof="1"\n        role="link"')) {
  failures.push('The sample-proof container must not duplicate its nested link interaction.');
}
if (!source.includes('data-clarity-action="directory_sample_report_open"')) {
  failures.push('The sample-report link needs a stable Clarity action.');
}
for (const snippet of [
  'data-directory-empty-state="true"',
  'data-clarity-action="location_empty_state_screener"',
  'Try Appraisily’s free photo check',
  'data-clarity-action="location_empty_state_nearby"',
  'We do not show unverified profiles as local options.',
  "handleEmptyLocationClick('free_photo_check'",
  "handleEmptyLocationClick('nearby_city'",
  'Looking for a fine-art appraiser?',
  'Browse reviewed art appraisers by location',
  'href="https://art-appraisers-directory.appraisily.com/location/"',
]) {
  if (!locationSource.includes(snippet)) {
    failures.push(`The location empty state must include ${JSON.stringify(snippet)}.`);
  }
}
for (const misleadingPromise of [
  'Looking for art-specific appraisers in {cityName}?',
  'View {citySearchName} art appraisers',
  'art-appraisers-directory.appraisily.com/location/${validCitySlug}',
]) {
  if (locationSource.includes(misleadingPromise)) {
    failures.push(`The Art Directory bridge must not include ${JSON.stringify(misleadingPromise)}.`);
  }
}
if (locationSource.includes("We're currently updating our database of antique appraisers")) {
  failures.push('The location empty state must not ask visitors to check back without an immediate recovery path.');
}
for (const [label, checkedSource, snippets] of [
  ['navbar', navbarSource, ['if (isCurrentLocation(city))', 'aria-current="page"', 'Current']],
  ['footer', footerSource, ['if (isCurrentLocation)', 'aria-current="page"', 'Current page']],
  [
    'feedback',
    feedbackSource,
    ['disabled={submitted}', 'Select Yes or No before sending feedback.'],
  ],
  [
    'profile',
    profileSource,
    [
      'const hasDirectContact = Boolean(',
      'Get an online appraisal from Appraisily',
      'No direct contact details are currently available',
      'Back to {appraiser.address.city} appraisers',
    ],
  ],
]) {
  for (const snippet of snippets) {
    if (!checkedSource.includes(snippet)) {
      failures.push(`${label} friction contract must include ${JSON.stringify(snippet)}.`);
    }
  }
}
if (navbarSource.includes('event.preventDefault();\n      setCitiesDropdownOpen(false);')) {
  failures.push('Current-city navigation must not render a clickable link whose default action is cancelled.');
}
if (feedbackSource.includes('disabled={helpful === null}')) {
  failures.push('Feedback submission must stay clickable so the missing-vote guidance can run.');
}

if (failures.length) {
  console.error('Directory interaction contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Directory interaction contract passed.');
