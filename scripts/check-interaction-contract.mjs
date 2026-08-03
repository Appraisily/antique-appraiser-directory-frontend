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
const citySearchSource = fs.readFileSync(path.join(root, 'src/components/CitySearch.tsx'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const posthogSource = fs.readFileSync(path.join(root, 'src/lib/posthog.ts'), 'utf8');
const analyticsSource = fs.readFileSync(path.join(root, 'src/utils/analytics.ts'), 'utf8');
const analyticsTrackerSource = fs.readFileSync(path.join(root, 'src/components/AnalyticsTracker.tsx'), 'utf8');
const posthogTrackerSource = fs.readFileSync(path.join(root, 'src/components/PosthogTracker.tsx'), 'utf8');
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
  'Profiles without current publishable details are excluded from local options.',
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
for (const snippet of [
  'role="status"',
  'aria-live="polite"',
  'data-directory-search-feedback="1"',
  'data-directory-search-status={feedback.kind}',
  'No city page found for',
  'Location access was denied.',
  'We couldn’t determine your location.',
  'data-clarity-action="directory_search_geolocate"',
  'data-clarity-action="directory_search_browse_all"',
]) {
  if (!citySearchSource.includes(snippet)) {
    failures.push(`The directory search feedback contract must include ${JSON.stringify(snippet)}.`);
  }
}
const maskedQueryEcho = /<span\s+className="session-replay-mask"\s+data-ph-mask-text="true"\s+data-clarity-mask="true"\s*>\s*\{feedback\.query\}\s*<\/span>/m;
if (!maskedQueryEcho.test(citySearchSource)) {
  failures.push('The reflected no-match query must carry the PostHog and Clarity replay text-mask selectors.');
}
if (citySearchSource.replace(maskedQueryEcho, '').includes('{feedback.query}')) {
  failures.push('The no-match query must not be reflected anywhere outside its replay-masked wrapper.');
}
if (!posthogSource.includes("maskTextSelector: '.session-replay-mask, [data-ph-mask-text]'")) {
  failures.push('The PostHog replay contract must recognize both text-mask selectors used by the no-match query.');
}
if (!appSource.includes('data-clarity-action="directory_search_submit"')) {
  failures.push('The directory search submit button needs a stable Clarity action.');
}
if (!appSource.includes('// CitySearch has rendered an inline recovery status for a genuine miss.\n      return;')) {
  failures.push('A genuine search miss must remain at the inline recovery status instead of auto-scrolling.');
}
if (!analyticsSource.includes("eventName === 'page_view'")) {
  failures.push('Google page_view must have an explicit first-party ownership boundary.');
}
if (!analyticsSource.includes("sendControlPlaneEvent('surface_arrived'")) {
  failures.push('Directory page entry must use surface_arrived in the first-party collector.');
}
if (analyticsSource.includes("sendControlPlaneEvent('page_view'")) {
  failures.push('Raw page_view must not be copied to the first-party collector.');
}
if (!analyticsTrackerSource.includes('emittedPageViewRef.current === pageViewKey')) {
  failures.push('Directory page_view and arrival must be deduplicated per route entry.');
}
if (posthogTrackerSource.includes('capturePosthogEvent') || posthogTrackerSource.includes('capturePosthogPageview')) {
  failures.push('Named directory behavior must enter PostHog through the first-party control plane.');
}
if (!posthogTrackerSource.includes('trackFirstPartyEvent')) {
  failures.push('Directory behavior must use the first-party telemetry adapter.');
}
if (!feedbackSource.includes('trackFirstPartyEvent')) {
  failures.push('Directory feedback must be collected first-party before any vendor copy.');
}
if (analyticsSource.indexOf('const cookieValue = readCookie(ANONYMOUS_ID_KEY)') > analyticsSource.indexOf('window.localStorage.getItem(ANONYMOUS_ID_KEY)')) {
  failures.push('Directory identity must adopt the shared cookie before local storage.');
}
for (const snippet of [
  "const QA_MARKER_STORAGE_KEY = 'appraisily_qa_marker'",
  "params.get('appraisily_synthetic')",
  "params.get('appraisily_qa') === '1'",
  'synthetic_family: synthetic.family',
  'is_synthetic: true',
]) {
  if (!analyticsSource.includes(snippet)) {
    failures.push(`Directory synthetic evidence contract must include ${JSON.stringify(snippet)}.`);
  }
}

if (failures.length) {
  console.error('Directory interaction contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Directory interaction contract passed.');
