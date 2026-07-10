# Antique Appraiser Directory Frontend

This repo uses the same deployment discipline as the art directory.

## Deployment Rule

- Promote reviewed HTML only through the standard VPS deploy helper for `antique-appraiser-directory`.
- Individual appraiser and location page content must stay intact during patch deploys.
- `npm run build` is validation-only.
- `npm run publish`, `npm run publish:patch`, and `npm run deploy` are hard blockers.

## Guardrails

- Do not publish through npm, GitHub Actions, Netlify, or repo-local scripts.
- Do not use npm commands or scripts to mass-edit `public_site/appraiser/**` or `public_site/location/**`.
- Individual profile and city page content may only change through direct, reviewed HTML edits.
