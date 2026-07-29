#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const ORIGIN = 'https://antique-appraiser-directory.appraisily.com';
const REVIEW_DATE = '2026-07-29';
const REVIEW_DATE_LONG = 'July 29, 2026';
const LIMITED_ARTWORK_VERSION = '20260728-limited-trust';
const DEFAULT_PACKET_ROOT =
  '/srv/manager/projects/art-directory-consolidation-20260727/evidence/directory-research/packets';
const SHARE_IMAGE =
  'https://assets.appraisily.com/logo-exploration/appraisily-logo-2026-07-09/concept-01-monogram-picture-frame.png';
const SHORT_MOBILE_COMPOSITING_STYLE = '<style data-appraisily-short-mobile-compositing="1">@media (max-width:500px){nav.fixed{background-color:#fff!important}.backdrop-blur-md{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}.bg-gradient-to-r.from-blue-50.to-white{background-image:none!important;background-color:#eff6ff!important}}</style>';

function parseArgs(argv) {
  const options = {
    publicDir: path.join(ROOT, 'public_site'),
    decisions: path.join(ROOT, 'data/provider-packet-approval-decisions.json'),
    facts: path.join(ROOT, 'data/approved-provider-packet-claims.json'),
    manifest: path.join(ROOT, 'data/provider-publication-manifest.json'),
    packetRoot: DEFAULT_PACKET_ROOT,
    refreshPackets: false,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--public-dir') options.publicDir = path.resolve(argv[++index] || '');
    else if (token === '--decisions') options.decisions = path.resolve(argv[++index] || '');
    else if (token === '--facts') options.facts = path.resolve(argv[++index] || '');
    else if (token === '--manifest') options.manifest = path.resolve(argv[++index] || '');
    else if (token === '--packet-root') options.packetRoot = path.resolve(argv[++index] || '');
    else if (token === '--refresh-packets') options.refreshPackets = true;
    else if (token === '--write') options.write = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function splitList(value) {
  return String(value || '')
    .split(/\s*[;,]\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function packetCitySlug(packetId, citySlugs) {
  const overrides = {
    'washingtonian-appraisals': 'washington-dc',
    'salt-lake-dodworth-stauffer': 'salt-lake-city',
  };
  if (overrides[packetId]) return overrides[packetId];
  return [...citySlugs]
    .sort((left, right) => right.length - left.length)
    .find((slug) => packetId === slug || packetId.startsWith(`${slug}-`)) || '';
}

function sourceFor(packet) {
  const reachable = (packet.sources || []).filter((source) => source.reachable);
  return reachable.find((source) => source.sourceType === 'official_provider')
    || reachable.find((source) => source.sourceType === 'professional_registry')
    || reachable[0]
    || null;
}

function approvedClaims(packet) {
  return (packet.claims || []).filter((claim) => claim.eligibleForHumanApproval);
}

async function importFacts(options, decisions, citySlugs) {
  const dispositions = new Map([
    ...decisions.approvedForProfile.map((id) => [id, 'approved_for_profile']),
    ...decisions.listedWithLimitedClaims.map((id) => [id, 'listed_with_limited_claims']),
    ...decisions.rejectedOrHeld.map((id) => [id, 'rejected_or_held']),
  ]);
  const records = [];
  for (const [packetId, disposition] of dispositions) {
    const packetPath = path.join(options.packetRoot, packetId, 'evidence-packet.json');
    const packet = JSON.parse(await fs.readFile(packetPath, 'utf8'));
    const source = sourceFor(packet);
    const override = decisions.overrides?.[packetId] || {};
    const claims = approvedClaims(packet).map((claim) => ({
      claimKind: claim.claimKind,
      value: claim.value,
      paraphrase: claim.paraphrase,
      supportingUrl: claim.supportingUrl,
      sourceType: claim.sourceType,
      retrievalDate: claim.retrievalDate,
      sourceResponseSha256: claim.sourceResponseSha256,
    }));
    if (override.identity) {
      claims.unshift({
        claimKind: 'identity',
        value: override.identity,
        paraphrase: override.identity,
        supportingUrl: source?.finalUrl || source?.url || '',
        sourceType: source?.sourceType || 'professional_registry',
        retrievalDate: REVIEW_DATE,
        sourceResponseSha256: source?.responseSha256 || '',
      });
    }
    records.push({
      packetId,
      taskId: packet.task.taskId,
      disposition,
      canonicalSlug:
        override.canonicalSlug
        || new URL(packet.task.canonicalUrl).pathname.split('/').filter(Boolean).at(-1),
      citySlug: packetCitySlug(packetId, citySlugs),
      entityName: override.identity || packet.task.entity.name,
      sourceUrl: source?.finalUrl || source?.url || '',
      sourceType: source?.sourceType || '',
      sourceResponseSha256: source?.responseSha256 || '',
      sourceRetrievedAt: source?.retrievedAt || '',
      claims,
      overrideNote: override.note || '',
    });
  }
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    reviewDate: REVIEW_DATE,
    decisionsAuthority: decisions.authority,
    records,
  };
  await fs.writeFile(options.facts, stableJson(payload));
  return payload;
}

function claimsOf(record, kind) {
  return record.claims.filter((claim) => claim.claimKind === kind);
}

function firstClaim(record, ...kinds) {
  for (const kind of kinds) {
    const claim = claimsOf(record, kind)[0];
    if (claim?.value) return claim;
  }
  return null;
}

function recordName(record) {
  const identity = firstClaim(record, 'identity')?.value || record.entityName;
  return String(identity).split(/\s*[;/]\s*/)[0].trim();
}

function verifiedDetails(record) {
  const location = firstClaim(record, 'primary_location', 'service_area')?.value || '';
  const credential = firstClaim(record, 'credential')?.value || '';
  const specialtyValues = claimsOf(record, 'specialty').flatMap((claim) => splitList(claim.value));
  const serviceValues = [
    ...claimsOf(record, 'service'),
    ...claimsOf(record, 'assignment_purpose'),
    ...claimsOf(record, 'inspection_mode'),
    ...claimsOf(record, 'fee_basis').map((claim) => ({
      ...claim,
      value: `Published fee basis: ${claim.value}`,
    })),
  ].flatMap((claim) => splitList(claim.value));
  const specialties = [...new Set(specialtyValues)];
  const services = [...new Set(serviceValues)];
  if (services.length < 2 && specialties.length > 0) {
    services.push(`Appraisal work involving ${specialties.join(', ')}`);
  }
  if (!location) throw new Error(`${record.packetId}: verified profile lacks location/service-area evidence`);
  if (specialties.length < 2) throw new Error(`${record.packetId}: verified profile needs at least two specialty facts`);
  if (services.length < 2) throw new Error(`${record.packetId}: verified profile needs at least two service/assignment facts`);
  return {
    location,
    credential,
    specialties,
    services,
    inspection: firstClaim(record, 'inspection_mode')?.value || 'Confirm inspection and travel requirements directly',
    fee: firstClaim(record, 'fee_basis')?.value || 'Confirm the current fee basis and timing directly',
  };
}

function schemaLocation(location) {
  const parts = location.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  return {
    '@type': 'PostalAddress',
    addressLocality: parts[0] || location,
    ...(parts[1] ? { addressRegion: parts[1] } : {}),
  };
}

function renderVerified(record) {
  const name = recordName(record);
  const details = verifiedDetails(record);
  const canonical = `${ORIGIN}/appraiser/${record.canonicalSlug}/`;
  const description = `${name} has a verified directory profile for ${details.location}. Review source-backed specialties, assignment uses, preparation guidance, and the source log.`;
  const about = `${name} is published from directly retrieved professional or provider evidence for ${details.location}. The reviewed packet supports work involving ${details.specialties.slice(0, 4).join(', ')}. Confirm current availability, inspection requirements, assignment acceptance, and engagement terms directly before relying on the listing.`;
  const claimScope = [
    'identity',
    'website',
    'primary_location',
    ...(details.credential ? ['qualification'] : []),
    'specialties',
    'fine_art_services',
  ];
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name,
      description,
      address: schemaLocation(details.location),
      url: canonical,
      sameAs: record.sourceUrl,
      serviceType: details.services,
      dateModified: REVIEW_DATE,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Appraiser directory', item: `${ORIGIN}/appraiser/` },
        { '@type': 'ListItem', position: 3, name, item: canonical },
      ],
    },
  ];
  const specialties = details.specialties.map((value) => `<li>${escapeHtml(value)}</li>`).join('');
  const services = details.services.map((value) => `<li>${escapeHtml(value)}</li>`).join('');
  const credentialFact = details.credential
    ? `<dt>Professional evidence</dt><dd>${escapeHtml(details.credential)}</dd>`
    : '<dt>Professional evidence</dt><dd>See the source log; confirm current standing directly</dd>';
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(name)} | Verified Appraiser Profile</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <meta name="appraisily:provider-publication-status" content="verified">
  <meta name="appraisily:provider-source" content="${escapeHtml(record.sourceUrl)}">
  <meta name="appraisily:provider-source-checked" content="${REVIEW_DATE}">
  <meta name="appraisily:provider-claim-scope" content="${claimScope.join(',')}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="Appraisily Directory">
  <meta property="og:title" content="${escapeHtml(name)} | Verified Appraiser Profile">
  <meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SHARE_IMAGE}"><meta property="og:image:alt" content="Appraisily Directory">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(name)} | Verified Appraiser Profile">
  <meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${SHARE_IMAGE}">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>body{margin:0;background:#faf8f3;color:#29251f;font:16px/1.6 system-ui,-apple-system,sans-serif}a{color:#815817}.top{background:#fff;border-bottom:1px solid #e6e2d8}.top div,main,footer{max-width:900px;margin:auto;padding:18px}.top div{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.brand{color:#29251f;font-weight:700;text-decoration:none}main{padding-top:38px}.crumbs{font-size:14px;color:#6a6252}.card{background:#fff;border:1px solid #e6e2d8;border-radius:14px;padding:24px;margin:18px 0}h1,h2{font-family:Georgia,serif;line-height:1.2}.review{border-color:#b9d8c2;background:#f1faf3}.badge{display:inline-flex;padding:4px 10px;border-radius:999px;background:#dff4e4;color:#185b2d;font-weight:700;font-size:14px}.facts{display:grid;grid-template-columns:minmax(130px,.6fr) 1.4fr;gap:8px 18px}.facts dt{font-weight:700}.facts dd{margin:0}.actions{display:flex;gap:12px;flex-wrap:wrap}.button{display:inline-flex;min-height:44px;align-items:center;padding:0 18px;border-radius:999px;background:#815817;color:#fff;text-decoration:none}footer{border-top:1px solid #e6e2d8;color:#6a6252;font-size:14px}@media(max-width:600px){main{padding-top:20px}.card{padding:18px}.facts{grid-template-columns:1fr}.facts dd{margin:0 0 8px}}</style>
  ${SHORT_MOBILE_COMPOSITING_STYLE}
</head><body>
  <header class="top"><div><a class="brand" href="/">Antique Appraiser Directory</a><nav><a href="/appraiser/">Appraisers</a> · <a href="/location/">Locations</a> · <a href="/methodology/">Methodology</a></nav></div></header>
  <main>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/appraiser/">Appraiser directory</a> / ${escapeHtml(name)}</nav>
    <section class="card"><h1>${escapeHtml(name)}</h1><p>${escapeHtml(details.location)}</p><p data-provider-specific-about="true">${escapeHtml(about)}</p><div class="actions"><a class="button" href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noopener noreferrer" data-gtm-event="directory_cta" data-gtm-cta="website">View reviewed source</a></div></section>
    <div class="card review" data-provider-publication-status="verified"><span class="badge">Verified listing</span><p><strong>Last verified:</strong> ${REVIEW_DATE_LONG}. Claims are limited to the reviewed source packet. Confirm current availability, standing, scope, and engagement terms directly.</p></div>
    <section class="card"><h2>About</h2><p data-provider-specific-about="true">${escapeHtml(about)}</p></section>
    <section class="card"><h2>Quick facts</h2><dl class="facts"><dt>Primary location</dt><dd>${escapeHtml(details.location)}</dd><dt>Specialty</dt><dd>${escapeHtml(details.specialties.join('; '))}</dd><dt>Assignment fit</dt><dd>${escapeHtml(details.services.join('; '))}</dd><dt>Inspection mode</dt><dd>${escapeHtml(details.inspection)}</dd><dt>Fees and timing</dt><dd>${escapeHtml(details.fee)}</dd>${credentialFact}</dl></section>
    <section class="card"><h2>Specialties</h2><ul>${specialties}</ul></section>
    <section class="card"><h2>Services</h2><ul>${services}</ul></section>
    <section class="card"><h2>Prepare before contacting this provider</h2><ul><li>Overall, reverse, signature, label, frame, and condition photographs</li><li>Dimensions, materials, maker or artist information, and condition notes</li><li>Receipts, provenance, prior reports, and the intended use</li></ul><p><a href="/methodology/#preparation-checklist">Use the printable appraisal preparation checklist</a>.</p></section>
    <section class="card"><h2>Verification</h2><p><strong>Source and scope.</strong> Reviewed ${REVIEW_DATE_LONG} from <a href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">the directly retrieved source</a>. Only the visible identity, location or service-area context, specialties, assignment uses, services, and exact professional evidence above were approved. Fees, timing, service radius, recipient acceptance, and current availability remain subject to direct confirmation unless explicitly shown.</p></section>
    <p><a href="https://appraisily.com/contact?source=directory_listing&amp;provider=${escapeHtml(record.canonicalSlug)}" data-provider-correction-link="true">Report or correct this listing</a></p>
  </main><footer>Independent provider listing · <a href="/get-listed/">Suggest or correct a listing</a> · An Appraisily directory</footer>
</body></html>\n`;
}

function renderLimited(record) {
  const name = recordName(record);
  const canonical = `${ORIGIN}/appraiser/${record.canonicalSlug}/`;
  const artworkPath = `/assets/generated-appraiser-profiles/${record.canonicalSlug}.svg?v=${LIMITED_ARTWORK_VERSION}`;
  const description = `${name} has a limited source-listed directory profile. Identity and the reviewed source were checked ${REVIEW_DATE_LONG}; all other details are not verified and should be confirmed directly.`;
  const schema = [
    { '@context': 'https://schema.org', '@type': 'ProfessionalService', name, description, url: canonical, sameAs: record.sourceUrl },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Appraiser directory', item: `${ORIGIN}/appraiser/` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ] },
  ];
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(name)} | Limited Directory Listing</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow">
  <meta name="appraisily:provider-publication-status" content="limited"><meta name="appraisily:provider-source" content="${escapeHtml(record.sourceUrl)}"><meta name="appraisily:provider-source-checked" content="${REVIEW_DATE}"><meta name="appraisily:provider-claim-scope" content="identity,website">
  <link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Appraisily Directory"><meta property="og:title" content="${escapeHtml(name)} | Limited Directory Listing"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SHARE_IMAGE}"><meta property="og:image:alt" content="Appraisily Directory"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(name)} | Limited Directory Listing"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${SHARE_IMAGE}">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>body{margin:0;background:#faf8f3;color:#29251f;font:16px/1.6 system-ui,-apple-system,sans-serif}a{color:#815817}.top{background:#fff;border-bottom:1px solid #e6e2d8}.top div,main,footer{max-width:900px;margin:auto;padding:18px}.top div{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.brand{color:#29251f;font-weight:700;text-decoration:none}main{padding-top:38px}.crumbs{font-size:14px;color:#6a6252}.card{background:#fff;border:1px solid #e6e2d8;border-radius:14px;padding:24px;margin:18px 0}h1,h2{font-family:Georgia,serif;line-height:1.2}.notice{border-color:#ead59e;background:#fff9e8}.art{display:block;width:min(100%,640px);height:auto;margin:18px 0;border-radius:12px;border:1px solid #e6e2d8}.button{display:inline-flex;min-height:44px;align-items:center;padding:0 18px;border-radius:999px;background:#815817;color:#fff;text-decoration:none}footer{border-top:1px solid #e6e2d8;color:#6a6252;font-size:14px}@media(max-width:600px){main{padding-top:20px}.card{padding:18px}}</style>
  ${SHORT_MOBILE_COMPOSITING_STYLE}
</head><body><header class="top"><div><a class="brand" href="/">Antique Appraiser Directory</a><nav><a href="/appraiser/">Appraisers</a> · <a href="/location/">Locations</a> · <a href="/methodology/">Methodology</a></nav></div></header><main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/appraiser/">Appraiser directory</a> / ${escapeHtml(name)}</nav>
  <section class="card"><h1>${escapeHtml(name)}</h1><img class="art" src="${artworkPath}" width="1200" height="900" alt="Generated directory artwork for ${escapeHtml(name)}; not a likeness"><p>${escapeHtml(description)}</p><a class="button" href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noopener noreferrer" data-gtm-event="directory_cta" data-gtm-cta="website">View reviewed source</a></section>
  <p class="card notice" data-provider-publication-status="limited" data-provider-claim-scope="identity website"><strong>Limited listing.</strong> Identity and the reviewed source were checked ${REVIEW_DATE_LONG}. All other details are not verified; confirm them directly. This is not a recommendation or endorsement.</p>
  <section class="card"><h2>What to confirm directly</h2><ul><li>Current location and service area</li><li>Whether the item category and intended use are accepted</li><li>Qualifications, report scope, inspection needs, fees, timing, conflicts, and availability</li></ul></section>
  <section class="card"><h2>Official source</h2><p><a href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">Reviewed source for ${escapeHtml(name)}</a></p></section>
  <p><a href="https://appraisily.com/contact?source=directory_listing&amp;provider=${escapeHtml(record.canonicalSlug)}" data-provider-correction-link="true">Report or correct this listing</a></p>
</main><footer>Independent provider listing · <a href="/get-listed/">Suggest or correct a listing</a> · An Appraisily directory</footer></body></html>\n`;
}

function renderLimitedArtwork(record) {
  const name = recordName(record);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'AD';
  const safeName = escapeHtml(name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-labelledby="title desc">
  <title id="title">${safeName} profile artwork</title>
  <desc id="desc">Generated non-likeness directory artwork for ${safeName}; location not verified.</desc>
  <defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f1e8"/><stop offset="1" stop-color="#ffffff"/></linearGradient><pattern id="ticks" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M0 54 L54 0" stroke="#253f3f" stroke-opacity=".045" stroke-width="2"/><circle cx="8" cy="8" r="2" fill="#b8794d" fill-opacity=".18"/></pattern></defs>
  <rect width="1200" height="900" fill="url(#paper)"/><rect width="1200" height="900" fill="url(#ticks)"/>
  <path d="M0 168 C230 298, 360 138, 590 278 S980 388, 1200 220" fill="none" stroke="#b8794d" stroke-width="42" stroke-opacity=".22"/><path d="M0 730 C220 560, 420 820, 620 650 S920 520, 1200 610" fill="none" stroke="#253f3f" stroke-width="5" stroke-opacity=".18"/>
  <g transform="translate(600 386) rotate(3)"><rect x="-176" y="-176" width="352" height="352" rx="28" fill="#fff" stroke="#253f3f" stroke-opacity=".22" stroke-width="8"/><rect x="-140" y="-140" width="280" height="280" rx="20" fill="#253f3f"/><text x="0" y="54" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="700" fill="#fff">${escapeHtml(initials)}</text></g>
  <g font-family="Inter, Arial, sans-serif" text-anchor="middle"><text x="600" y="660" font-size="48" font-weight="700" fill="#253f3f">${safeName}</text><text x="600" y="720" font-size="28" font-weight="600" fill="#253f3f" opacity=".72">Location not verified</text><text x="600" y="768" font-size="22" font-weight="500" fill="#253f3f" opacity=".52">Generated directory artwork, not a likeness</text></g>
</svg>
`;
}

function cityProviderSection(record, name) {
  return `<section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" data-approved-provider-packet="${escapeHtml(record.packetId)}"><h2 class="text-2xl font-semibold text-gray-900">Source-reviewed provider</h2><article class="mt-4 rounded-lg border border-slate-200 p-4"><h3 class="text-xl font-semibold"><a href="/appraiser/${escapeHtml(record.canonicalSlug)}/" data-gtm-event="appraiser_card_click" data-gtm-provider-status="${record.disposition === 'approved_for_profile' ? 'verified' : 'limited'}">${escapeHtml(name)}</a></h3><p class="mt-2 text-sm text-slate-700">${record.disposition === 'approved_for_profile' ? `Verified profile · approved claim scope · checked ${REVIEW_DATE_LONG}` : `Source-listed profile · identity and source only · checked ${REVIEW_DATE_LONG}`}</p><p class="mt-2"><a class="text-blue-700 underline hover:no-underline" href="/appraiser/${escapeHtml(record.canonicalSlug)}/" aria-label="View ${escapeHtml(name)} profile">View profile and source log</a></p></article></section>`;
}

function citySchema(record, name) {
  const route = `${ORIGIN}/appraiser/${record.canonicalSlug}/`;
  return `<script type="application/ld+json" data-approved-provider-packet-schema="${escapeHtml(record.packetId)}">${JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', position: 1, name, url: route }] },
    { '@context': 'https://schema.org', '@type': 'Service', provider: [{ '@type': 'ProfessionalService', name, url: route }] },
  ])}</script>`;
}

async function applyCityRelation(options, record, name) {
  if (!record.citySlug) throw new Error(`${record.packetId}: target city slug is unresolved`);
  const filename = path.join(options.publicDir, 'location', record.citySlug, 'index.html');
  let html = await fs.readFile(filename, 'utf8');
  const routePattern = new RegExp(`href=["']/appraiser/${record.canonicalSlug}/["']`, 'i');
  if (!routePattern.test(html)) {
    const moduleMarker = /<section\b[^>]*data-dpe005-provider-comparison=/i;
    if (moduleMarker.test(html)) html = html.replace(moduleMarker, `${cityProviderSection(record, name)}\n$&`);
    else if (/<\/main>/i.test(html)) html = html.replace(/<\/main>/i, `${cityProviderSection(record, name)}\n</main>`);
    else html = html.replace(/\n\s*<script>/i, `\n${cityProviderSection(record, name)}\n<script>`);
  }
  const schemaPattern = new RegExp(
    `<script\\b[^>]*data-approved-provider-packet-schema=["']${record.packetId}["'][^>]*>[\\s\\S]*?<\\/script>`,
    'i',
  );
  if (schemaPattern.test(html)) html = html.replace(schemaPattern, citySchema(record, name));
  else html = html.replace(/<\/head>/i, `${citySchema(record, name)}\n</head>`);
  await fs.writeFile(filename, html);
}

async function updateSitemap(options, records) {
  const filename = path.join(options.publicDir, 'sitemap.xml');
  let sitemap = await fs.readFile(filename, 'utf8');
  const existingUrls = new Set();
  sitemap = sitemap.replace(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g, (block, url) => {
    if (existingUrls.has(url)) return '';
    existingUrls.add(url);
    return block;
  });
  const additions = [];
  for (const record of records) {
    if (record.disposition === 'rejected_or_held') continue;
    const url = `${ORIGIN}/appraiser/${record.canonicalSlug}/`;
    if (!existingUrls.has(url)) {
      additions.push(`<url><loc>${url}</loc><lastmod>${REVIEW_DATE}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
      existingUrls.add(url);
    }
  }
  if (additions.length) sitemap = sitemap.replace('</urlset>', `${additions.join('\n')}\n</urlset>`);
  await fs.writeFile(filename, sitemap);
}

async function rebuildAppraiserIndex(options, manifest) {
  const filename = path.join(options.publicDir, 'appraiser', 'index.html');
  let html = await fs.readFile(filename, 'utf8');
  const published = manifest.providers
    .filter((provider) => ['verified', 'limited'].includes(provider.publicationStatus))
    .sort((left, right) => left.name.localeCompare(right.name));
  const list = `<ul>${published.map((provider) => `<li><a href="/appraiser/${escapeHtml(provider.slug)}/">${escapeHtml(provider.name)}</a></li>`).join('')}</ul>`;
  html = html.replace(/<div class="meta">\d+ reviewed profiles<\/div>/, `<div class="meta">${published.length} reviewed profiles</div>`);
  const filterCard = /(<div class="filter-row">[\s\S]*?<\/div>)\s*<ul>[\s\S]*?<\/ul>/;
  if (!filterCard.test(html)) throw new Error('Appraiser index filter/list anchor not found');
  html = html.replace(filterCard, `$1\n        ${list}`);
  const recently = /<section class="card" aria-labelledby="reviewed-fine-art-heading"[\s\S]*?<\/section>/;
  if (recently.test(html)) html = html.replace(recently, '');
  html = html.replace(/[ \t]+$/gm, '');
  await fs.writeFile(filename, html);
}

async function validateOutput(options, facts, manifest) {
  const failures = [];
  const manifestMap = new Map(manifest.providers.map((provider) => [provider.slug, provider]));
  for (const record of facts.records) {
    const profilePath = path.join(options.publicDir, 'appraiser', record.canonicalSlug, 'index.html');
    if (record.disposition === 'rejected_or_held') continue;
    const expectedStatus = record.disposition === 'approved_for_profile' ? 'verified' : 'limited';
    const provider = manifestMap.get(record.canonicalSlug);
    if (provider?.publicationStatus !== expectedStatus) failures.push(`${record.packetId}: manifest status mismatch`);
    try {
      const html = await fs.readFile(profilePath, 'utf8');
      if (!html.includes(`content="${expectedStatus}"`)) failures.push(`${record.packetId}: static status mismatch`);
      if (!html.includes(`href="${escapeHtml(record.sourceUrl)}"`)) failures.push(`${record.packetId}: reviewed source link missing`);
      const cityHtml = await fs.readFile(path.join(options.publicDir, 'location', record.citySlug, 'index.html'), 'utf8');
      if (!cityHtml.includes(`/appraiser/${record.canonicalSlug}/`)) failures.push(`${record.packetId}: city relationship missing`);
    } catch (error) {
      failures.push(`${record.packetId}: ${error.message}`);
    }
  }
  return failures;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const decisions = JSON.parse(await fs.readFile(options.decisions, 'utf8'));
  const citySlugs = new Set(
    (await fs.readdir(path.join(options.publicDir, 'location'), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const facts = options.refreshPackets
    ? await importFacts(options, decisions, citySlugs)
    : JSON.parse(await fs.readFile(options.facts, 'utf8'));
  let manifest = JSON.parse(await fs.readFile(options.manifest, 'utf8'));
  const manifestMap = new Map(manifest.providers.map((provider) => [provider.slug, provider]));
  const primaryBySlug = new Map();

  if (options.write) {
    for (const record of facts.records) {
      if (record.disposition === 'rejected_or_held') continue;
      if (!record.sourceUrl) throw new Error(`${record.packetId}: approved record has no reachable reviewed source`);
      const name = recordName(record);
      if (!primaryBySlug.has(record.canonicalSlug)) {
        primaryBySlug.set(record.canonicalSlug, record);
        const publicationStatus = record.disposition === 'approved_for_profile' ? 'verified' : 'limited';
        const details = publicationStatus === 'verified' ? verifiedDetails(record) : null;
        const claimScope = publicationStatus === 'verified'
          ? ['identity', 'website', 'primary_location', ...(details.credential ? ['qualification'] : []), 'specialties', 'fine_art_services']
          : ['identity', 'website'];
        const previous = manifestMap.get(record.canonicalSlug) || {};
        manifestMap.set(record.canonicalSlug, {
          ...previous,
          slug: record.canonicalSlug,
          name,
          publicationStatus,
          reason: 'operator_approved_source_packet',
          sourceUrl: record.sourceUrl,
          sourceType: record.sourceType,
          verifiedAt: REVIEW_DATE,
          verifiedBy: 'Appraisily Directory Research Team',
          claimScope,
          previousUrl: previous.previousUrl || `${ORIGIN}/appraiser/${record.canonicalSlug}/`,
          canonicalProviderId: previous.canonicalProviderId || `provider:${slugify(name)}`,
          evidencePacket: record.packetId,
        });
        const profileDir = path.join(options.publicDir, 'appraiser', record.canonicalSlug);
        await fs.mkdir(profileDir, { recursive: true });
        await fs.writeFile(
          path.join(profileDir, 'index.html'),
          publicationStatus === 'verified' ? renderVerified(record) : renderLimited(record),
        );
        if (publicationStatus === 'limited') {
          const artworkDir = path.join(
            options.publicDir,
            'assets',
            'generated-appraiser-profiles',
          );
          await fs.mkdir(artworkDir, { recursive: true });
          await fs.writeFile(
            path.join(artworkDir, `${record.canonicalSlug}.svg`),
            renderLimitedArtwork(record),
          );
        }
      }
      await applyCityRelation(options, record, name);
    }
    manifest = {
      ...manifest,
      generatedAt: new Date().toISOString(),
      policyVersion: 'provider-packet-approval-v1',
      providers: [...manifestMap.values()].sort((left, right) => left.slug.localeCompare(right.slug)),
    };
    manifest.summary = {
      total: manifest.providers.length,
      verified: manifest.providers.filter((provider) => provider.publicationStatus === 'verified').length,
      limited: manifest.providers.filter((provider) => provider.publicationStatus === 'limited').length,
      suppressed: manifest.providers.filter((provider) => !['verified', 'limited'].includes(provider.publicationStatus)).length,
    };
    await fs.writeFile(options.manifest, stableJson(manifest));
    await updateSitemap(options, facts.records);
    await rebuildAppraiserIndex(options, manifest);
  }

  const failures = await validateOutput(options, facts, manifest);
  const result = {
    action: options.write ? 'applied-approved-provider-packets' : 'checked-approved-provider-packets',
    ok: failures.length === 0,
    approvedForProfile: facts.records.filter((record) => record.disposition === 'approved_for_profile').length,
    listedWithLimitedClaims: facts.records.filter((record) => record.disposition === 'listed_with_limited_claims').length,
    rejectedOrHeld: facts.records.filter((record) => record.disposition === 'rejected_or_held').length,
    uniquePublishedProfiles: new Set(facts.records.filter((record) => record.disposition !== 'rejected_or_held').map((record) => record.canonicalSlug)).size,
    failures,
  };
  console.log(stableJson(result));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
