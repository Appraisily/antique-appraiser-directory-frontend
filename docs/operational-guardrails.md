# Antique Appraiser Directory Frontend

This repo is moving to the same deployment discipline as the art directory.

## Deployment Rule

- Use `npm run publish:patch` for homepage, nav, footer, managed CTA, CSS, and asset changes.
- Patch publish starts from the active release and updates only shared envelope/static blocks on existing profile and city pages.
- Individual appraiser and location page content must stay intact during patch deploys.
- `npm run build` is validation-only.
- Full generated publish is disabled from npm. Any content or route snapshot promotion requires an explicit reviewed plan and direct script invocation.

## Guardrails

- Do not use a full rebuild/publish to ship visual-only footer, nav, homepage, CSS, or asset changes.
- Do not directly overlay `appraiser/` or `location/` paths in patch publish unless the work is explicitly a content migration.
- Do not use npm commands or scripts to mass-edit `public_site/appraiser/**` or `public_site/location/**`.
- Individual profile and city page content may only change through direct, reviewed HTML edits.
