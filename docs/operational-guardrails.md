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

- Do not publish through npm, GitHub Actions, Netlify, or repo-local scripts.
- Do not use npm commands or scripts to mass-edit `public_site/appraiser/**` or `public_site/location/**`.
- Individual profile and city page content may only change through direct, reviewed HTML edits.
