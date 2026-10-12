# Antique Appraiser Directory Frontend

This repo uses the same deployment discipline as the art directory.

## Deployment Rule

- Promote reviewed HTML only through the standard VPS deploy helper for `antique-appraiser-directory`.
- Individual appraiser and location page content must stay intact during patch deploys.
- `npm run build` is validation-only.
- `npm run publish`, `npm run publish:patch`, and `npm run deploy` are hard blockers.

## Guardrails

- The shared static telemetry bootstrap stamps owned Appraisily handoff links
  with `seo_site`, `ref_path`, and the shared `journey_id`. Generic directory
  UTMs become `antique_directory`; explicit acquisition tags remain intact.
  Synthetic markers follow the handoff; provider links and local anchors stay intact.
  Deferred page scripts that replace links are observed and the same tags are
  restored idempotently before navigation.

- Sitemap-listed online-appraisal and local-provider links must carry
  `data-gtm-event="directory_cta"`. The shared static bootstrap remains the
  single click-event owner; HTML annotations do not add another transport.
  `tests/directory-click-coverage.test.mjs` checks the published cohort and
  the Chicago hero/provider-card regression before the static build gate.

- Published sitemap documents ship their reviewed static HTML only. They must
  not load the legacy client app (`/assets/index-*.js`): it replaced authored
  content after load, added a second title/canonical/description and provider
  schema, removed provider website links and rendered unsupported trust claims.
  `tests/static-document-ownership.test.mjs` gates this in the build, and
  `npm run test:settled-browser -- --mode focal|sweep` compares authored and
  settled documents in a real browser at 1365/390/320px with JavaScript on and
  off. Authored utility classes the legacy stylesheet never compiled live in
  `/assets/directory-authored-utilities-20261012.css`.

- Fine-art specialist website links use the provider-contact pattern:
  `data-cta-kind="provider_contact"` and `data-gtm-placement` equal to their
  `data-gtm-surface`.

- Sitemap pages without their own topbar carry one static site header
  (`scripts/inject-directory-site-header.mjs`, checked in the build): logo and
  "Antique Directory" to `/`, Browse cities to `/location/`, and Start to
  `appraisily.com/start` with `utm_source=directory&utm_medium=header` and the
  page's own campaign slug. Both links carry `directory_cta`, a
  `data-cta-kind` (`navigation` / `signed_report`) and
  `data-gtm-placement="header"`. Edit the injector, then rerun it with
  `--write`; do not hand-edit the block. Chicago and Baltimore are held until
  the choice-pilot read (todo `directory-choice-day28-20261026`).

- Do not publish through npm, GitHub Actions, Netlify, or repo-local scripts.
- Do not use npm commands or scripts to mass-edit `public_site/appraiser/**` or `public_site/location/**`.
- Individual profile and city page content may only change through direct, reviewed HTML edits.
