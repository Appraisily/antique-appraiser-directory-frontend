# Browse hubs — September 29, 2026

Approved scope: /srv/manager/seo/2026-09-29-directory-next-pass/README.md.
Release and measurement evidence: /srv/manager/seo/2026-09-29-directory-next-pass/IMPLEMENTATION.md.

The canonical static appraiser and location hub HTML now loads directory-browse-v1.js and directory-browse-v1.css. The assets are hub-only: do not add them to city/profile pages or a global injection. Static links remain visible with JavaScript disabled; controls progressively appear when filtering is available. Filters do not change URLs or send search text to analytics. directory_cta uses the existing directory_static_bootstrap owner. Header Start links now carry antique_directory source and hub-specific utm_content; public QA identified those pre-existing header links as untagged, unlike the lower report actions.

The location hub has 101 unique canonical destinations, down from 130 duplicate rows. Counts and JSON-LD agree. Browse controls/results precede the unchanged national-service and intent guidance. All 253 provider profiles are labeled limited; existing public locations are shown without claiming service coverage. 242 have a city, one has only a region, and ten have neither. Specialty filtering is deliberately deferred because the publication manifest does not support those claims. Homepage fine-art navigation now points to the restored Art host. The local box-sizing rule fixes the lower action-link overflow; the misleading Free screener label on this hub is now Photo screener without inventing a price.

Run npm run build and npm run lint. scripts/test-directory-browse.mjs checks static inventory, labels, unique destinations, schema counts, statuses, location parity, search, facets, reset, empty state and search privacy. Browser QA must also cover all four hubs at 390/320/1365 pixels, including bottom actions. The Art full-lint baseline has three unrelated unused-variable errors in unchanged check-isolated-nginx-candidate.mjs; changed-script lint passes.

Do not overwrite the September 28 experiment pages or their October 5/12/26 measurement gates. Hub-assisted traffic is an overlapping acquisition treatment even when destination documents are unchanged. Separate direct search landings from hub-assisted journeys; no uplift claim at deployment.
