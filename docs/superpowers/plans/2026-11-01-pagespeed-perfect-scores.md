# PageSpeed 100 on Mobile and Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demonstrate 100 Performance, Accessibility, Best Practices, and SEO on both devices in three consecutive fresh Google PageSpeed results per device.

**Architecture:** Keep Jekyll, GitHub Pages, the existing theme script, and the existing audit runner. Correct CSP delivery and remove Cloudflare script injection, add WebP portrait variants, and inline the small CSS bundle during Jekyll rendering. Use strict local/CI checks plus independent production PageSpeed evidence.

**Tech Stack:** Jekyll 4.4.x, Liquid, Sass, Ruby 3.2 in CI, Node.js 22 in CI, Playwright, Axe, pinned Lighthouse 13.6.0, GitHub Actions/Pages, existing Cloudflare proxy; one-time `cwebp` conversion.

**Spec:** [2026-11-01-pagespeed-perfect-scores-design.md](../specs/2026-11-01-pagespeed-perfect-scores-design.md). Read it before implementation; it records the verified baseline, owner-selected edge behavior, design tradeoffs, and acceptance limits.

## Global Constraints

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

## Review Focus

1. CDN/client variation and stale HTML: normal mobile and desktop visitors must receive the full page without injected analytics/detection scripts; framing protection must come from HTTP headers (Tasks 1, 5, 6).
2. First paint, JavaScript disabled, storage denied, and OS changes: CSS inlining must preserve the initial theme and existing interaction fallbacks (Task 3).
3. Portrait DPR, baseurl, unsupported format, and unsafe stems: choose an appropriate same-origin image, retain JPEG fallback, and reject unsafe configured paths (Task 2).
4. Alternate layouts, articles, and hostile metadata: optimization must retain content, landmarks, escaping, accessible names, and readable colors (Tasks 1–3).
5. Missing/malformed reports, a single 99, or changing lab conditions: validation must fail honestly and preserve every run (Task 4 and final acceptance).

---

## File map and execution order

| Files | Responsibility |
| --- | --- |
| `_includes/header.html`, `tests/themes.mjs` | Correct meta CSP; test real framing headers and unsuppressed errors |
| `_includes/masthead.html`, `assets/styles.scss`, `assets/profile/dayan-{150,300,450}.webp` | Responsive modern portrait with existing JPEG fallback |
| `_plugins/inline-styles.rb`, `_includes/header.html`, `_config.yml` | Inline the canonical, compiled CSS at build time |
| `tests/lighthouse-plan.mjs`, `tests/lighthouse-contract.mjs`, `.github/workflows/checks.yml` | Strict category gate and malformed-report handling |
| `tests/edge-response.mjs`, `tests/edge-response.test.mjs` | Deterministic edge-contract tests and live response verification |
| `README.md`, `docs/performance/edge-delivery.md` | Reproducible image/build commands and exact provider changes/rollback |
| `docs/performance/acceptance-<release-sha>.md` | Measured release receipt; raw reports remain ignored/outside site output |

Tasks 1–4 are branch-local work. Apply and verify Task 5's edge headers before publishing Task 1's removal of the ineffective meta directive. Task 6 publishes the validated candidate and verifies the complete result. Do not create separate mobile and desktop implementations.

At execution start, inspect status/worktrees/branches again, preserve `.scratch/`, and refresh remote state. Use the worktree skill if isolation is needed. Run `bundle install`, `npm ci`, and install the three Playwright browsers when needed. Retain a fresh baseline under a unique ignored report directory using `npm run audit -- --url https://dayanruben.com/ --output lighthouse-reports/baseline-<timestamp>`. Do not reuse another task's reports or overwrite this plan's historical baseline.

### Task 1: Correct CSP expectations and eliminate the source-side console error

**Files:**
- Modify: `_includes/header.html` (meta CSP), `tests/themes.mjs` (HTTPS fixture server and console/CSP assertions).

**Interfaces:**
- Consumes: existing meta CSP and fixture HTTPS responses.
- Produces: unchanged restrictive meta policy except for removal of `frame-ancestors`; fixture HTTP `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. Production headers are supplied by Task 5, not by Jekyll.

- [ ] **Step 1: Add the failing `CSP is effective and console-clean` assertions.** In the route checks, keep the existing meta-policy checks but assert:

```js
assert.match(metaPolicy, /script-src 'self'/);
assert.doesNotMatch(metaPolicy, /frame-ancestors/);
assert.match(response.headers()['content-security-policy'], /frame-ancestors 'none'/);
assert.equal(response.headers()['x-frame-options'], 'DENY');
assert.deepEqual(errors, []);
```

Remove `expectedBrowserWarnings` and collect all console errors, including security errors. Add a separate JavaScript-disabled embedding check against the fixture: a parent page attempting to frame it must not expose the child `main` content. Keep expected rejection messages confined to that negative-test context.

- [ ] **Step 2: Run `RUBYOPT="-r$PWD/.github/ruby-compat.rb" npm test`.** Expect failure because the current meta directive remains and the fixture response has no framing header.
- [ ] **Step 3: Correct policy delivery.** Delete only `frame-ancestors 'none';` from the meta CSP. Set the two real headers on fixture HTML responses. Preserve every other directive, the script's position, all escaping, and all theme code.
- [ ] **Step 4: Run the full three-browser suite.** Expect no ignored CSP errors, real header assertions passing, blocked framing without JavaScript, and existing metadata/Axe/theme checks passing on both layouts and article fixtures.
- [ ] **Step 5: Commit the two intended paths** with `fix: correct CSP delivery and console checks`. Do not publish before Task 5's production framing headers are verified.

### Task 2: Deliver smaller responsive portraits without losing fallbacks

**Files:**
- Create: `assets/profile/dayan-150.webp`, `assets/profile/dayan-300.webp`, `assets/profile/dayan-450.webp`.
- Modify: `_includes/masthead.html`, `assets/styles.scss`, `tests/themes.mjs`, `README.md` (portrait refresh instructions).
- Reuse unchanged: `_includes/profile-stem.html` and the three JPEGs.

**Interfaces:**
- Consumes: validated `profile_stem`, `relative_url`, and existing JPEG candidates.
- Produces: `.profile-avatar picture` with `source[type="image/webp"]`, 150/300/450w candidates and `sizes="150px"`; existing `img` remains the JPEG fallback. Open Graph remains JPEG.

- [ ] **Step 1: Extend the existing `safePortrait` assertions with a failing WebP contract.** Require a WebP `<source>` using `/profile-safe/assets/profile/dayan-{150,300,450}.webp`; retain exact JPEG `src`, `srcset`, dimensions, alt text, `loading="eager"`, and `fetchpriority="high"` expectations. Add these byte/signature assertions:

```js
for (const [size, limit] of [[150, 4096], [300, 12288], [450, 24576]]) {
  const image = readFileSync(join(root, 'assets/profile', `dayan-${size}.webp`));
  assert.ok(image.length <= limit);
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
}
```

In fresh browser contexts at DPR 1, 2, and 3, wait for image decode and assert `currentSrc` ends with the corresponding 150/300/450 WebP. Change the source's type to an unsupported MIME type and verify JPEG selection still decodes. Retain hostile-stem/baseurl cases and assert rejected stems emit no WebP candidates.

- [ ] **Step 2: Run the browser suite.** Expect missing WebP files/source assertions to fail.
- [ ] **Step 3: Generate each derivative** with `cwebp -q 75 -m 6 assets/profile/dayan-<size>.jpg -o assets/profile/dayan-<size>.webp`. Use the official package-manager `webp` tool if absent; add no runtime or Bundler dependency. Inspect the three outputs at displayed size before accepting them.
- [ ] **Step 4: Add the `<picture>` markup.** Build WebP URLs from the already-validated stem using `relative_url` and `escape`. Keep the JPEG fallback and metadata logic. Change the avatar display selector to cover the nested picture/image so the overlay keeps its geometry; retain theme variables and the 44-pixel control.
- [ ] **Step 5: Document the exact refresh commands and run the full browser suite.** Expect byte budgets, DPR selection, JPEG fallback, prefixes, unsafe-stem cases, alt text, overlay geometry, and all three engines to pass. Confirm JPEG and WebP MIME types through the fixture server.
- [ ] **Step 6: Commit only these paths** with `perf: add responsive WebP profile portraits`.

### Task 3: Remove both stylesheet round trips at build time

**Files:**
- Create: `_plugins/inline-styles.rb`.
- Modify: `_includes/header.html` (mark the two owned CSS links), `_config.yml` (`sass.style: compressed`), `tests/themes.mjs` (copy plugin into fixtures and assert rendered delivery), `README.md` (build behavior).
- Read unchanged: `assets/styles.scss`, `assets/vendor/primer.css`, `assets/vendor/primer.full.css`.

**Interfaces:**
- Consumes: compiled Jekyll page output for `/assets/styles.css`, static Primer subset bytes, and the two header links marked `data-site-styles="primer"` / `data-site-styles="theme"`.
- Produces: Ruby `DayanRuben::InlineStyles.apply(site)` called by `Jekyll::Hooks.register :site, :post_render`; one `<style id="site-styles">` in each rendered HTML page/document, Primer first and theme CSS second. Original CSS files remain generated/available; only their owned link tags are replaced.

- [ ] **Step 1: Add failing `inline CSS preserves complete styling` assertions.** In each rendered HTML fixture, require exactly one `style#site-styles`, no owned external stylesheet links, and the Primer/normalize license notices. Replace the obsolete assertion requiring a timestamped external CSS link. On each homepage require `gzipSync(Buffer.from(rendered)).length <= 14 * 1024`. Preserve the existing Primer subset/provenance tests.

In browser checks, assert the theme script still has neither `async` nor `defer`, remains before the style, and keeps its same-origin `src`. Add a first-animation-frame check with a saved dark preference and light OS preference: the first visible body background must already be `rgb(13, 17, 23)`. Run the existing no-JavaScript, denied-storage, OS-change, typography, and syntax-highlighting checks unchanged.

- [ ] **Step 2: Run the browser suite.** Expect the single-inline-style assertion to fail against the current two-link output.
- [ ] **Step 3: Implement `DayanRuben::InlineStyles.apply(site)` in the new plugin.** Use Jekyll's site-level post-render hook so Sass conversion has finished. Process HTML pages and collection documents only; obtain theme CSS from the compiled page, read the canonical Primer subset, and replace exactly the two marked links with one style element. Fail the build on missing CSS, missing/duplicate markers, or CSS containing a closing `</style` token; never silently publish partial styling. Leave feeds, sitemap, and other non-HTML output untouched.
- [ ] **Step 4: Wire the same plugin into fixture builds and set compressed Sass output.** Add `_plugins` to the fixture source-copy list. Keep all styling sources and color tokens in their existing locations, and keep the early external theme script synchronous.
- [ ] **Step 5: Run the full browser suite and a production build.** Check homepage compression against the 14-KiB budget, licenses, HTML/feed/sitemap validity, styles in both layouts/articles, and absence of `_plugins` source in output. Run a diagnostic local Lighthouse pair and compare FCP/Speed Index against the retained baseline. Target mobile FCP ≤1,000 ms and Speed Index ≤1,700 ms; keep TBT/CLS at zero. The final strict gate remains decisive.
- [ ] **Step 6: Commit the intended plugin, template, config, test, and documentation paths** with `perf: inline the small site stylesheet bundle`. If measured results regress, keep the failed reports and revise this task before retaining the optimization.

### Task 4: Make all four scores a strict, retained CI contract

**Files:**
- Modify: `tests/lighthouse-plan.mjs`, `tests/lighthouse-contract.mjs`, `.github/workflows/checks.yml`, `README.md`.
- Reuse unchanged unless a failing contract requires repair: `tests/lighthouse-audit.mjs`.

**Interfaces:**
- Consumes: existing `planRuns`, `readCategories`, `verdict`, and `npm run audit` CLI.
- Produces: same interfaces and displayed-score semantics; `readCategories(report)` additionally rejects non-finite/out-of-range scores. CI invokes `npm run audit -- --serve "$RUNNER_TEMP/site" --runs 3 --strict`; all six reports remain artifacts.

- [ ] **Step 1: Extend `lighthouse-contract.mjs` with failing malformed-score/CI expectations.** Add assertions equivalent to:

```js
for (const score of [NaN, Infinity, -0.01, 1.01]) {
  assert.throws(() => plan.readCategories({ categories: {
    performance: { score }, accessibility: { score: 1 },
    'best-practices': { score: 1 }, seo: { score: 1 },
  } }), /performance/);
}
assert.equal(plan.verdict({ strict: true, planned, reports: keptLow }).ok, false);
assert.equal(plan.verdict({ strict: true, planned, reports: reports.slice(0, 5) }).ok, false);
```

Update the existing workflow-command expectation to the strict command above. Keep tests proving diagnostic mode is not PageSpeed acceptance, one pair cannot satisfy strict mode, every category is required, runs are serial, and reports cannot be under `_site`.

- [ ] **Step 2: Run `node tests/lighthouse-contract.mjs`.** Expect malformed numeric scores or the old diagnostic CI command to fail.
- [ ] **Step 3: Validate finite scores in `[0, 1]` and enable strict CI.** Preserve Lighthouse-compatible displayed-score rounding and default diagnostic CLI behavior. Keep artifact upload under `if: always()`; retain every low run. Document both command modes and the distinction between local, live CLI, and PageSpeed acceptance.
- [ ] **Step 4: Run the contract, ESLint, Prettier, actionlint, locked dependency checks, and audit.** Run a production build followed by `npm run audit -- --serve <absolute-build-directory> --runs 3 --strict --output lighthouse-reports/local-<candidate>`. Expect six rows with four 100s each and exit 0. A 99 means this gate is unmet; inspect its weighted metrics instead of lowering or bypassing the check. Verify whether repository branch rules actually require the job before calling it a merge gate.
- [ ] **Step 5: Commit the intended paths** with `ci: require retained Lighthouse scores of 100`.

### Task 5: Remove the actual Cloudflare causes and verify the edge contract

**Files/configuration:**
- Create: `tests/edge-response.mjs`, `tests/edge-response.test.mjs`, `docs/performance/edge-delivery.md`.
- Modify: `.github/workflows/checks.yml` (unit test + lint paths).
- External: only the effective Web Analytics/bot settings for `dayanruben.com` and a scoped HTTP response-header transform.

**Interfaces:**
- `assertEdgeResponse({ status, headers, html }) -> void`: `headers` is a standard `Headers`; throws on failure.
- `verifyEdge(url, fetchImpl = fetch) -> Promise<void>`: fetches fresh complete HTML with normal mobile and desktop user agents; applies `assertEdgeResponse` to both.
- CLI: `node tests/edge-response.mjs --url https://dayanruben.com/`; nonzero for failed fetch/status/header/injection checks. This checks delivery, not category scores.

- [ ] **Step 1: Write failing Node tests for the edge response contract.** Use `node:test` and built-in assertions. Require 200 HTML, HTTP CSP containing `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and absence of both the analytics beacon and injected `/cdn-cgi/challenge-platform/` bootstrap. Assert rejection of each injection, a 403/challenge page, and meta-only framing policy with no HTTP protection. Test both user-agent requests through an injected fake fetch.
- [ ] **Step 2: Run `node --test tests/edge-response.test.mjs`.** Expect missing-module/function failure.
- [ ] **Step 3: Implement the two interfaces and CLI using Node built-ins.** Preserve meaningful failure messages and return no successful result for a challenge or missing check. Add the unit command and both files to static CI checks/linting. Do not put provider credentials in fixtures, logs, or the repository.
- [ ] **Step 4: Inventory effective Cloudflare configuration read-only.** Identify the analytics site, bot mode, injection scope, applicable bot enforcement rules, and existing response-header transforms. Record nonsecret rule IDs, exact hostname scope, current values, and rollback values in the runbook. Use the Cloudflare skill/current provider API contracts at execution time. The selected hostname behavior is authorized for the reviewed implementation; unrelated hostname changes are not.
- [ ] **Step 5: Remove the two injections within the approved scope.** Set this site's automatic Web Analytics injection to Disable. Turn off JavaScript-detection injection for this hostname through its effective bot configuration, accounting for rules that require detection results so legitimate traffic is not newly challenged. Cloudflare Bot Fight Mode may bundle detection and require a broader mode change: verify scope first. If removing it would affect other hostnames or requires an unapproved security-mode change, stop the provider mutation and present that exact configuration conflict; do not quietly turn off zone-wide protection or broaden CSP.
- [ ] **Step 6: Deliver real framing headers before the source release.** Create/update the identified rule `dayanruben-com-framing`, expression `(http.host eq "dayanruben.com")`. Add `Content-Security-Policy: frame-ancestors 'none'` as a separate policy so existing HTTP CSPs are preserved; set `X-Frame-Options: DENY`. Read back effective rule ordering and preserve unrelated operations. Record exact rollback instructions.
- [ ] **Step 7: Run unit tests and live edge verification.** Expect both user agents to pass the script/header contract and normal requests to receive the full page. If stale content is proven, invalidate only the affected URLs, then verify again. The pre-release meta warning is removed by Task 1's eventual deployment; do not call this intermediate state 100 Best Practices.
- [ ] **Step 8: Commit only the tests, CI edits, and completed nonsecret runbook** with `test: verify production edge delivery`. External state must also be read back; a Git commit alone does not prove it.

### Task 6: Publish and establish independent PageSpeed acceptance

**Files:**
- Create at execution time: `docs/performance/acceptance-<release-sha>.md`.
- Reports: unique directories under ignored `lighthouse-reports/`, never `_site/`.

**Interfaces:**
- Consumes: Tasks 1–5, candidate SHA, exact-SHA GitHub results, original/default Lighthouse presets, fresh Google-hosted mobile/desktop reports.
- Produces: receipt with source/deployment identity, all measured scores/timings, report links, environment/version, and an honest accepted/unmet verdict.

- [ ] **Step 1: Run the final local release checks from the repository root.** Run `npm ci`, `bundle check`, full `npm test` with the compatibility shim when needed, the Lighthouse contract and edge unit tests, all affected JavaScript linting, specified Prettier checks, Ruby syntax checks (including the plugin), actionlint, `npm audit --audit-level=high`, and `git diff --check`. Build production into a unique temporary destination using the locked bundle, `JEKYLL_ENV=production`, and repository metadata. Assert `docs`, `tests`, `lighthouse-reports`, `node_modules`, and `_plugins` source are absent while `.well-known/security.txt` remains present. Keep every report from the strict six-run local gate.
- [ ] **Step 2: Publish the concrete validated candidate when publication is authorized.** Fetch `origin/main`, prove no divergence, stage only intended paths, and use the repository's authorized push/PR route. For direct main delivery, fetch after pushing and prove `HEAD == origin/main` and `git rev-list --left-right --count HEAD...origin/main` is `0 0`. Use `gh` to verify every applicable Checks and deployment job for that exact SHA reaches terminal success; do not substitute an older green run.
- [ ] **Step 3: Verify the complete published site.** Run `node tests/edge-response.mjs --url https://dayanruben.com/` and `npm run audit -- --url https://dayanruben.com/ --runs 3 --strict --output lighthouse-reports/live-<release-sha>`. Verify WebP content types, rendered inline CSS, HTTP framing headers, robots/sitemap links, metadata, normal keyboard use, and both themes. Confirm no analytics/bootstrap injection or console/Issues failures remain. These six CLI results must all be 100 but remain labeled CLI results.
- [ ] **Step 4: Collect three consecutive fresh PageSpeed reports per device.** Start fresh analyses of the canonical production URL, requesting both mobile and desktop results for each of three analyses. Retain all six exports/links, timestamps, Lighthouse/Chrome versions, and every category score. Use the default PageSpeed conditions; do not add cache-busting URL variants, audit-specific content, or exemptions.
- [ ] **Step 5: Evaluate acceptance and write the receipt.** Require 100 in all four columns of every one of the six Google-hosted reports: 24 score values. Include FCP/LCP/Speed Index/TBT/CLS, exact release identity, and local/CI/live/PageSpeed evidence as distinct records. Record CrUX availability/state separately. If any score is below 100, retain the series as unsuccessful, identify the actual failed audit/weighted metric, and return to its owning task; after a repair, begin a new labeled acceptance series. Do not report the objective achieved until this gate passes.
- [ ] **Step 6: Commit the completed receipt if requested as part of delivery.** A receipt-only commit is a different SHA and can trigger deployment: verify that SHA's build and unchanged public artifact identity rather than relabeling prior measurements. Prefer attaching the receipt to the measured release/PR when that avoids an unnecessary source-only deployment. No raw reports or generated site output belong in Git.

## Planning self-review and handoff

Coverage checked: all eight category targets, both injected script types, real framing protection, both device reports, portrait fallback, build-time CSS, full browser coverage, strict retention, exact-SHA release verification, and independent Google acceptance have owning tasks. Interfaces reuse the existing runner; the only new executable interfaces are the Jekyll hook and edge-response checker. Each Review Focus item has assertions in its owning task.

The main execution dependency is Cloudflare's effective bot mode and hostname scope; it cannot be established from repository source. The plan does not promise that a zone-wide-only control can be changed within a hostname-only authorization. No source implementation or provider changes were made while writing this plan.

Recommended execution: **Native**, because the tasks share a small number of template/test contracts and provider state is best handled in one continuous session. Use `superpowers:executing-plans`; after implementation, obtain one independent whole-branch review as described in the writing-plans handoff. Alternatively, choose subagent-driven execution with the corresponding required skill.
