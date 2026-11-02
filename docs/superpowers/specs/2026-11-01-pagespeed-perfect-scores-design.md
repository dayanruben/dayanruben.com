# PageSpeed 100 on mobile and desktop — design and acceptance

## Request and scope

Reach a displayed **100 for Performance, Accessibility, Best Practices, and SEO** on both devices at `https://dayanruben.com/`. The implementation plan is [here](../plans/2026-11-01-pagespeed-perfect-scores.md). This is one site-quality project: the templates, portrait, styles, edge configuration, and audit evidence all contribute to the same eight category scores.

The owner selected this direction during planning: **“Remove these injections for this hostname, preserving the strict CSP (simpler; may require changing bot settings).”** This includes the analytics and bot-detection injections identified below. It does not authorize changes to other hostnames, unrelated Cloudflare rules, or a hosting migration.

The current deliverable is a plan. Implementation, provider configuration changes, commits, and publication follow the plan review and execution handoff. The only configuration change accompanying these documents is excluding `docs` from Jekyll output.

## Verified baseline

Source inspected: local `main`, commit `38c65cb8c5539824c42215fe08f848721f7b876c`. The initial working tree had unrelated, untracked `.scratch/`; preserve it. Git state and deployed content must be rechecked at execution time; a PageSpeed report does not identify the deployed Git SHA.

The [supplied PageSpeed report](https://pagespeed.web.dev/analysis/https-dayanruben-com/1usxpcgrah?form_factor=mobile) embeds both device reports. Their Lighthouse version is **13.6.0**, with Chrome **153.0.8010.36** on the runner.

| Device | Report fetch time, UTC | Performance | Accessibility | Best Practices | SEO |
| --- | --- | ---: | ---: | ---: | ---: |
| Mobile | 2026-11-01 23:48:17.375 | 99 | 100 | 92 | 100 |
| Desktop | 2026-11-01 23:48:16.751 | 100 | 100 | 92 | 100 |

| Lab measurement | Mobile | Desktop |
| --- | ---: | ---: |
| First Contentful Paint | 1,532 ms | 431 ms |
| Largest Contentful Paint | 1,532 ms | 431 ms |
| Speed Index | 2,670 ms | 641 ms |
| Total Blocking Time | 0 ms | 0 ms |
| Cumulative Layout Shift | 0 | 0 |

The scored Best Practices failures are `errors-in-console` and `inspector-issues`, each with weight 1. Both reports identify an injected `static.cloudflareinsights.com/beacon.min.js` blocked by `script-src 'self'`. They also log that `frame-ancestors 'none'` is ignored in a meta CSP. The repository does not contain the injected beacon.

A separate, real-network **local CLI** audit on 2026-11-01, beginning at 23:57 UTC, returned mobile **97/100/92/100** and desktop **100/100/92/100**. Its mobile report additionally caught an injected inline Cloudflare challenge-platform bootstrap blocked by the CSP. A direct HTML fetch also contained that bootstrap. These are current corroborating diagnostics, not additional Google PageSpeed results. They demonstrate both delivery variation and performance variation.

The saved mobile report estimates **450 ms** of render-blocking savings across the early theme script and the two stylesheets. Only FCP and Speed Index lose weighted performance points; LCP, TBT, and CLS already have metric score 1. The mobile portrait is a 21,280-byte, 300-pixel JPEG with estimated image savings of 6,280 bytes. The desktop portrait is a 7,893-byte, 150-pixel JPEG.

Caching is a separate diagnostic: assets have a reported four-hour browser TTL. `cache-insight`, `image-delivery-insight`, and `render-blocking-insight` are not directly weighted category points in these reports. Improving the underlying loading metrics matters; clearing every advisory is not the acceptance definition. The document-latency insight already passes, so there is no evidence for a hosting migration.

## Existing capabilities to reuse

- `_includes/header.html` has a same-origin, early theme script; two CSS links; escaped descriptions; language and viewport metadata; and a meta CSP.
- `_includes/masthead.html` already has local JPEG `srcset` candidates at 150/300/450 pixels, explicit 150×150 dimensions, eager loading, and high fetch priority. `_includes/profile-stem.html` validates the configured site-root stem.
- `assets/vendor/primer.css` is already a small subset, with `primer.full.css` retained for provenance. Do not repeat the completed Primer pruning work.
- `tests/themes.mjs` builds isolated fixtures, tests three browser engines, and checks metadata, themes, contrast, and Axe. It currently ignores the meta `frame-ancestors` console error and incorrectly treats that meta directive as framing protection; correct both expectations.
- `tests/lighthouse-audit.mjs` and `tests/lighthouse-plan.mjs` already support serial mobile/desktop audits and `--runs 3 --strict`. Strict mode requires every retained run to show four 100s. The current CI job is diagnostic and does not use those strict flags.
- `npm test` and Lighthouse are intentionally separate commands. Keep that separation.

## Chosen design

1. Remove the ineffective directive from the meta CSP, preserve its other restrictions, and enforce framing protection through real HTTP response headers at Cloudflare. Update tests to require the actual header and stop ignoring the console error.
2. Add 150/300/450-pixel WebP portraits through `<picture>`, retaining the existing JPEG fallback and JPEG Open Graph image. Use no additional runtime or Jekyll dependency for image conversion.
3. Inline the site's small, complete CSS bundle at build time through a Jekyll `:site, :post_render` hook. Keep the existing Sass tokens and Primer sources canonical; preserve their order and licenses. This removes both CSS round trips without asynchronous CSS handlers, theme flashes, or inline JavaScript. The current custom Actions/Bundler build supports local plugins; fixture builds must load the same plugin.
4. Remove automatic analytics and JavaScript-detection injection through hostname-scoped Cloudflare settings. Read the effective bot mode, scope, and dependent rules before changing them. A zone-wide switch must not silently affect another hostname. If the provider cannot express the approved scope, report that concrete limitation and obtain a revised edge design rather than silently expanding scope.
5. Enable the existing strict Lighthouse check in CI, retain all reports, and perform separate live edge and Google PageSpeed acceptance checks after publication.

Inlining trades repeat-visit stylesheet caching for faster initial rendering on this small site. Limit the compressed homepage HTML to **14 KiB**, preserve the normal CSS assets, and measure the result. Retain this change only when it improves the mobile FCP/Speed Index distribution without regressing desktop or visual behavior.

Do not change TTLs or introduce immutable caching in this implementation: the existing asset filenames are replaceable. Longer browser caching without content-addressed URLs would create a separate invalidation problem. Revisit caching only if new evidence makes it necessary for the agreed scores.

## Global constraints

- Target the four displayed category scores on the production homepage, on both mobile and desktop; require three consecutive fresh PageSpeed results per device with all four scores equal to 100.
- Preserve `script-src 'self'`; do not add third-party script allowances or `'unsafe-inline'` to scripts.
- Remove Cloudflare analytics and JavaScript-detection injection for `dayanruben.com` only; preserve unrelated hostnames and rules.
- Preserve the `system` default and the System → Light → Dark cycle in `assets/theme.js`; keep storage failure and older `matchMedia` behavior working.
- Preserve metadata escaping, URL validation, accessible names, keyboard behavior, contrast, content, and both layouts.
- Keep Sass tokens in `assets/styles.scss`, the early same-origin theme script in the head, and existing Primer license/provenance material.
- Keep documentation, validation code, reports, dependency directories, and plugin source out of published output; preserve intentional `.well-known/` output.
- Do not lower score thresholds, suppress console errors, exclude failing audits, discard low runs, or serve a reduced page to audit clients.
- Keep locked Ruby/Node toolchains, full-SHA Actions pins, least-privilege permissions, and `BUNDLE_FROZEN`.
- Claim publication only after exact-SHA terminal Checks/deployment verification; claim PageSpeed acceptance only from fresh Google-hosted results.

## Acceptance and limits

The release receipt must contain six fresh Google-hosted reports: mobile runs 1–3 and desktop runs 1–3. All **24 category score values** must display 100, with timestamps and report URLs/exports retained. A low result remains part of the record; after a repair, start a new, clearly labeled consecutive acceptance series. Never select the best three out of a larger set.

Before that final gate: pass the complete existing browser suite, static checks, a production build, six strict local Lighthouse runs, live HTTP-header/injection checks, and six strict CLI audits against the published site. The last set exercises the CDN but still is not Google PageSpeed acceptance.

Use mobile FCP ≤1,000 ms and Speed Index ≤1,700 ms as engineering targets for headroom, while preserving TBT=0 and CLS=0. These are optimization targets, not a substitute for the actual scoring curve. Preserve desktop's existing 100; compare the observed metric distributions rather than promising a fixed timing on every network.

Do not present a 100 Accessibility score as a complete accessibility certification or 100 SEO as a ranking guarantee. Preserve manual keyboard and reading-order checks. Core Web Vitals/CrUX is a different, rolling field-data assessment; report its availability and observed state separately, including “insufficient data” when applicable. Neither a local Lighthouse result nor a green CI run proves those outcomes.

If performance remains below 100 after the specified optimizations, the task remains incomplete. Retain the failing reports, identify the weighted metric and its critical-path cause, and propose a measured follow-up for that cause. Do not change security policy, content, hosting, or the acceptance threshold as an unreviewed workaround. Future service/network variation means this plan establishes demonstrated repeatable acceptance, not a perpetual score guarantee.

## Primary references

- [Original mobile report](https://pagespeed.web.dev/analysis/https-dayanruben-com/1usxpcgrah?form_factor=mobile) and [desktop view](https://pagespeed.web.dev/analysis/https-dayanruben-com/1usxpcgrah?form_factor=desktop): baseline measurements and failing audits.
- [PageSpeed's lab/field-data contract and variability](https://developers.google.com/speed/docs/insights/v5/about): separate acceptance evidence from CrUX.
- [Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring): weighted metrics and diminishing returns near 100.
- [Render-blocking guidance](https://developer.chrome.com/docs/performance/insights/render-blocking): the rationale and tradeoff for inlining small CSS.
- [Jekyll hooks](https://jekyllrb.com/docs/plugins/hooks/): supported build-time integration.
- [Cloudflare Web Analytics setup](https://developers.cloudflare.com/web-analytics/get-started/): site-level automatic-injection controls.
- [Cloudflare JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/): bot-mode constraints and CSP incompatibility.
- [Cloudflare response-header transforms](https://developers.cloudflare.com/rules/transform/response-header-modification/): real HTTP framing headers and rule ordering.

## Execution note: hostname-scoped edge control

The deployed edge rules append `no-transform` to the existing Cache-Control header on the canonical hostname. Independent mobile and desktop HTTP checks confirmed that this removes both injected scripts while preserving the origin TTL and gzip compression. Zone-wide Bot Fight Mode, JavaScript-detection settings, the `www` redirect, and the separate camera-log analytics configuration remain unchanged. This replaces the initially proposed global analytics/bot toggles with narrower response control; see [the verified runbook](../../performance/edge-delivery.md).
