# PageSpeed acceptance receipt

**Accepted code release:** `8771eafb42ca1be8ad5017c7e96c39a71092fe93`.

**Canonical URL:** https://dayanruben.com/ — measured 2026-11-02 UTC.

**Result:** three consecutive, independent Google PageSpeed measurements per device, with all **24 category score values equal to 100**.

## Google-hosted acceptance

Each link opens the actual Google report. Requests were spaced by 60 seconds, and every device measurement has a distinct fetch time newer than its analysis request. No URL variants, audit exclusions, custom throttling, or reduced page content were used.

| Run | Device | Fetch time (UTC) | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | [mobile](https://pagespeed.web.dev/analysis/https-dayanruben-com/qs6zzqzun2?form_factor=mobile) | 2026-11-02T00:57:13.247Z | 100 | 100 | 100 | 100 |
| 1 | [desktop](https://pagespeed.web.dev/analysis/https-dayanruben-com/qs6zzqzun2?form_factor=desktop) | 2026-11-02T00:57:14.019Z | 100 | 100 | 100 | 100 |
| 2 | [mobile](https://pagespeed.web.dev/analysis/https-dayanruben-com/ovjz72a84s?form_factor=mobile) | 2026-11-02T00:58:26.898Z | 100 | 100 | 100 | 100 |
| 2 | [desktop](https://pagespeed.web.dev/analysis/https-dayanruben-com/ovjz72a84s?form_factor=desktop) | 2026-11-02T00:58:26.451Z | 100 | 100 | 100 | 100 |
| 3 | [mobile](https://pagespeed.web.dev/analysis/https-dayanruben-com/r1k1z0pahm?form_factor=mobile) | 2026-11-02T00:59:40.150Z | 100 | 100 | 100 | 100 |
| 3 | [desktop](https://pagespeed.web.dev/analysis/https-dayanruben-com/r1k1z0pahm?form_factor=desktop) | 2026-11-02T00:59:40.276Z | 100 | 100 | 100 | 100 |

## Measured lab metrics

| Run | Device | FCP (ms) | LCP (ms) | Speed Index (ms) | TBT (ms) | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | mobile | 903 | 903 | 2238 | 0 | 0 |
| 1 | desktop | 242 | 242 | 291 | 0 | 0 |
| 2 | mobile | 903 | 903 | 903 | 0 | 0 |
| 2 | desktop | 242 | 242 | 268 | 0 | 0 |
| 3 | mobile | 902 | 902 | 902 | 0 | 0 |
| 3 | desktop | 242 | 242 | 242 | 0 | 0 |

Lighthouse version: **13.6.0**. The accepted Google runner used **HeadlessChrome/153.0.8010.36**. These are lab measurements, not guarantees for every network or future Lighthouse version. PageSpeed returned no CrUX record for either URL or origin on either device; field Core Web Vitals/INP is unavailable, not reported as passing.

An earlier immediately repeated series also returned 100s but reused two fetch timestamps. It is retained locally as non-acceptance evidence; the table above uses only the subsequent independent series. No low run was discarded or replaced with a best-of selection.

## Source, hosted checks, and publication

- [Code release](https://github.com/dayanruben/dayanruben.com/commit/8771eafb42ca1be8ad5017c7e96c39a71092fe93).
- [Exact-release Checks](https://github.com/dayanruben/dayanruben.com/actions/runs/41369345533): Static analysis, all three browsers, and strict six-report Lighthouse job completed successfully. The hosted log independently contains 24 category scores of 100.
- [Exact-release deployment](https://github.com/dayanruben/dayanruben.com/actions/runs/41369345571): build and deploy completed successfully.
- [Push on main](https://github.com/dayanruben/dayanruben.com/actions/runs/41369345253): completed successfully.
- Owner-authorized direct-main delivery used the repository's existing bypass rights; PR/check protection was not changed. After the push, `HEAD == origin/main`, divergence `0 0`.
- A fresh-context whole-change review ran before publication. Its edge-check completeness finding was repaired with three RED→GREEN negative test groups; 12/12 edge units and the full Chromium/Firefox/WebKit suite then passed.

Local pre-push checks included locked `npm ci`/Bundler dependencies, production build, all browser/metadata/Axe checks, JavaScript lint, Prettier, Ruby syntax, actionlint, the audit contract, dependency audit, and six strict Lighthouse runs. The same six-run strict CLI check against the published site also passed. Those CLI results remain distinct from the Google-hosted table. The dependency gate has zero high/critical findings; the unchanged development toolchain still reports nine moderate advisories.

## Artifact and provider verification

The live homepage byte-matches the built release artifact:

```text
SHA256 92741815de65bbd0a993f9f6d1b42fc5c88129da3fe4922cd435c1b81c637947
```

The homepage is 11,535 bytes when gzip-compressed. All 24 public endpoints were checked against the exact downloaded Pages artifact: 23 matched byte for byte. The exception is the existing Cloudflare-managed `/.well-known/security.txt` response, independently confirmed through its provider configuration and preserved. The repository's HTTPS-contact version is present in the Pages artifact; no public contact record was overwritten. Only the two intended `.well-known` files appear as hidden public output. Documentation, validation code, raw reports, dependency directories, plugin source and local scratch are excluded.

Live mobile/desktop edge checks verified actual HTTP framing headers, completed homepage structure, and absence of analytics and challenge-platform injection. WebP MIME types, critical asset bytes, robots, feed, sitemap, and public endpoints were checked. Hostname-scoped `no-transform` retains the existing TTL and gzip while leaving zone-wide Bot Fight Mode and other sites' analytics unchanged; see [the edge runbook](edge-delivery.md).

This receipt and the web-perf report are excluded documentation. Their publication commit must receive its own exact-SHA CI/deployment check and unchanged-homepage hash verification; the measurements above remain attributed to the code release instead of being relabeled to a later documentation commit.

## Retained evidence and limitations

Ignored local evidence directories: `lighthouse-reports/pagespeed-8771eaf-series-2/`, `final-local/`, `live-8771eaf/`, `web-perf-local/`, `web-perf-live/`, `candidate-8771eaf/`, and `deployed-8771eaf/`. The earlier cached series remains separately retained. Google report links and GitHub workflow links above provide externally reviewable evidence; raw JSON, traces and screenshots are not committed or published in the site.

[The web-perf audit](web-perf-2026-11-02.md) records the waterfall, traces, accessibility snapshot, optimization impact and remaining advisories. One nonblocking review finding remains deferred: optional Jekyll `--incremental` mode can retain stale inline CSS. This delivery and CI use full builds.

A 100 Accessibility score is not a complete accessibility certification; 100 SEO is not a ranking guarantee. The repeated results establish this release's observed acceptance, not perpetual perfect scores.
