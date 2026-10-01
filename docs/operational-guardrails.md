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

- Do not publish through npm, GitHub Actions, Netlify, or repo-local scripts.
- Do not use npm commands or scripts to mass-edit `public_site/appraiser/**` or `public_site/location/**`.
- Individual profile and city page content may only change through direct, reviewed HTML edits.
