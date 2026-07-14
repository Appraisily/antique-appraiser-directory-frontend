# Directory image asset policy

The Antique Appraiser Directory does not generate or upload profile images during validation or deployment.

## Canonical sources

- Shared content assets must use verified URLs under `https://assets.appraisily.com`.
- Small interface assets may be packaged with the site.
- Appraiser records without a reviewed, owned image use `https://assets.appraisily.com/assets/directory/placeholder.jpg`.
- Do not infer a first-party URL by stripping or replacing another provider's host. Verify the final URL returns `200`, non-empty bytes, and an `image/*` content type before adding it.

## Publishing contract

`npm run build` validates the committed `public_site/` artifact. It does not generate images or rewrite profile records. Image changes must be reviewed in the authoritative data and canonical static HTML, then promoted through the standard VPS deploy helper.

## Adding an image

1. Confirm Appraisily may publish the image.
2. Store it under a provider-neutral path on `assets.appraisily.com`.
3. Verify status, MIME type, and bytes.
4. Update the authoritative appraiser record and its canonical static page.
5. Run `npm run assets:check`, `npm run build`, and the relevant browser smoke checks.
