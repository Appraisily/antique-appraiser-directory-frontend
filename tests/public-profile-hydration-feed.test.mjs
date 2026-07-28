import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEnrichedFeed } from '../scripts/enrich-public-appraiser-feed.mjs';

const profileHtml = ({ status, scope, title = 'Profile title', description = 'Profile description' }) => `
<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="https://example.test/appraiser/provider/">
    <meta name="appraisily:provider-publication-status" content="${status}">
    <meta name="appraisily:provider-source" content="https://provider.test/">
    <meta name="appraisily:provider-source-checked" content="2026-07-28">
    <meta name="appraisily:provider-claim-scope" content="${scope.join(',')}">
    <meta name="appraisily:provider-claimed" content="false">
  </head>
</html>`;

test('limited records retain identity, website, provenance, and service area without leaking private facts', () => {
  const feed = {
    appraisers: [{
      slug: 'provider',
      url: 'https://example.test/appraiser/provider/',
      name: 'Provider',
      website: 'https://provider.test/',
      telephone: '555-0100',
      email: 'private@example.test',
      address: { streetAddress: 'Private street', city: 'Ottawa', region: 'ON' },
      rating: 4.9,
      reviewCount: 42,
      specialties: ['Antiques'],
      services: ['Appraisals'],
    }],
  };
  const manifest = {
    providers: [{
      slug: 'provider',
      publicationStatus: 'limited',
      sourceUrl: 'https://provider.test/',
      verifiedAt: '2026-07-28',
      claimScope: ['identity', 'website'],
    }],
  };
  const locations = {
    locations: [{
      slug: 'ottawa',
      city: 'Ottawa',
      region: 'ON',
      country: 'CA',
      url: 'https://example.test/location/ottawa/',
      listedAppraisers: [{ slug: 'provider', publicRouteAvailable: true }],
    }],
  };

  const result = buildEnrichedFeed({
    feed,
    manifest,
    locations,
    readProfileHtml: () => profileHtml({ status: 'limited', scope: ['identity', 'website'] }),
  });
  const entry = result.appraisers[0];

  assert.equal(entry.name, 'Provider');
  assert.equal(entry.website, 'https://provider.test/');
  assert.equal(entry.publication.status, 'limited');
  assert.deepEqual(entry.serviceAreas, [{
    slug: 'ottawa',
    city: 'Ottawa',
    region: 'ON',
    country: 'CA',
    url: 'https://example.test/location/ottawa/',
  }]);
  for (const field of ['telephone', 'email', 'address', 'rating', 'reviewCount', 'specialties', 'services']) {
    assert.equal(field in entry, false, `${field} should not cross the limited publication boundary`);
  }
});

test('verified records retain only fields named by the approved claim scope', () => {
  const scope = ['identity', 'website', 'primary_location', 'specialties', 'fine_art_services', 'qualification'];
  const result = buildEnrichedFeed({
    feed: {
      appraisers: [{
        slug: 'verified',
        url: 'https://example.test/appraiser/verified/',
        name: 'Verified Provider',
        website: 'https://verified.test/',
        address: { city: 'Boston', region: 'MA' },
        specialties: ['Fine art'],
        services: ['Appraisals'],
        telephone: '555-0100',
      }],
    },
    manifest: {
      providers: [{
        slug: 'verified',
        publicationStatus: 'verified',
        sourceUrl: 'https://verified.test/',
        verifiedAt: '2026-07-28',
        claimScope: scope,
      }],
    },
    locations: { locations: [] },
    readProfileHtml: () => profileHtml({ status: 'verified', scope }),
  });
  const entry = result.appraisers[0];

  assert.deepEqual(entry.address, { city: 'Boston', region: 'MA' });
  assert.deepEqual(entry.specialties, ['Fine art']);
  assert.deepEqual(entry.services, ['Appraisals']);
  assert.equal(entry.publication.credentialVerified, true);
  assert.equal('telephone' in entry, false);
});

test('a complete explicitly approved record retains contact and review facts', () => {
  const scope = ['identity', 'website', 'primary_location', 'phone', 'email', 'reviews'];
  const result = buildEnrichedFeed({
    feed: {
      appraisers: [{
        slug: 'complete',
        url: 'https://example.test/appraiser/complete/',
        name: 'Complete Provider',
        website: 'https://complete.test/',
        telephone: '555-0100',
        email: 'public@complete.test',
        address: { streetAddress: '1 Public Way', city: 'Boston', region: 'MA' },
        rating: 4.8,
        reviewCount: 12,
        reviews: [{ author: 'Customer', rating: 5, content: 'Helpful' }],
      }],
    },
    manifest: {
      providers: [{
        slug: 'complete',
        publicationStatus: 'verified',
        sourceUrl: 'https://complete.test/',
        verifiedAt: '2026-07-28',
        claimScope: scope,
      }],
    },
    locations: { locations: [] },
    readProfileHtml: () => profileHtml({ status: 'verified', scope }),
  });
  const entry = result.appraisers[0];

  assert.equal(entry.telephone, '555-0100');
  assert.equal(entry.email, 'public@complete.test');
  assert.equal(entry.rating, 4.8);
  assert.equal(entry.reviewCount, 12);
  assert.equal(entry.reviews.length, 1);
});

test('manifest and static publication facts must match', () => {
  assert.throws(
    () => buildEnrichedFeed({
      feed: { appraisers: [{ slug: 'provider', name: 'Provider', url: 'https://example.test/appraiser/provider/' }] },
      manifest: {
        providers: [{
          slug: 'provider',
          publicationStatus: 'limited',
          claimScope: ['identity', 'website'],
        }],
      },
      locations: { locations: [] },
      readProfileHtml: () => profileHtml({ status: 'verified', scope: ['identity', 'website'] }),
    }),
    /static status verified does not match manifest limited/
  );
});
