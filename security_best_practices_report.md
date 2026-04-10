# Security Best Practices Report

Remediation note: findings 1 and 2 were addressed after this report was written by vendoring Primer locally and adding browser-side policy hardening in the shared head template.

## Executive Summary

This repository is a small Jekyll static site rather than a dynamic web application. I did not find evidence of high-impact client-side sinks such as `innerHTML`, `eval`, `postMessage`, browser storage of sensitive data, or backend request handling. The main actionable issue in the repo is a mutable third-party stylesheet import from `unpkg.com`, which creates an avoidable supply-chain dependency for every page render.

I also did not find any visible Content Security Policy or related browser hardening policy in the repo. For a static site this is primarily a defense-in-depth gap rather than an immediately exploitable bug, but it is still worth addressing or verifying at the deployment layer.

## Scope And Method

- Stack identified:
  - Jekyll/Ruby site configuration in `Gemfile:1-5` and `_config.yml:1-63`
  - Liquid/HTML templates in `_includes/` and `_layouts/`
  - Sass stylesheet in `assets/styles.scss`
- Closest matching security guidance loaded:
  - `javascript-general-web-frontend-security.md`
- Review focus:
  - Third-party assets
  - Template output and URL construction
  - Browser-side injection sinks and client-side data handling
  - Visible browser security policy configuration

## Critical Findings

No critical findings were identified in the reviewed code.

## High Findings

No high-severity findings were identified in the reviewed code.

## Medium Findings

### 1. Mutable Third-Party Stylesheet Loaded From CDN

- Severity: Medium
- Location: `assets/styles.scss:3`
- Evidence:

```scss
@import url('https://unpkg.com/primer/build/build.css');
```

- Impact: Every page render depends on a remote stylesheet that is neither self-hosted nor version-pinned. If the CDN response changes unexpectedly, the upstream package is compromised, or the path behavior changes, the site can be defaced or rendered incorrectly without any repo change.
- Why this matters: Third-party assets execute with page-level influence. For a static site, CSS is lower risk than third-party JavaScript, but it is still a supply-chain dependency with full presentation control and no integrity enforcement in this form.
- Fix:
  - Prefer vendoring the Primer CSS into the repo and serving it from the site origin.
  - If remote hosting must remain, pin to an exact version and use a `<link rel="stylesheet">` with SRI instead of CSS `@import`.
- Mitigation: Restrict allowed style sources with CSP once the asset strategy is finalized.
- False positive notes: This is a real configuration risk, not a speculative runtime issue.

## Low Findings

### 2. No Visible Browser Security Policy In Repo

- Severity: Low
- Location: `_includes/header.html:23-31`
- Evidence:

```html
<head>
  <meta charset="utf-8">
  <title>{{ page_title }}</title>
  <meta name="description" content="{{ meta_description }}" />
  <meta property="og:title" content="{{ user.name }}" />
  <meta property="og:image" content="{{ user.avatar_url }}" />
  <meta property="og:description" content="{{ meta_description }}" />
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <link href="{{ "/assets/styles.css" | relative_url }}" rel="stylesheet" type="text/css">
```

- Impact: If a future template injection bug or third-party asset issue is introduced, the site currently has no visible in-repo browser policy to reduce blast radius. On a static site, a restrictive CSP is one of the few strong defense-in-depth controls available.
- Fix:
  - Add a restrictive CSP as an HTTP response header if deployment infrastructure supports it.
  - If headers are not configurable, add a `<meta http-equiv="Content-Security-Policy" ...>` very early in the `<head>` and account for the known limitations of meta-delivered CSP.
  - Because the site does not appear to require inline scripts, a simple policy should be feasible after the external stylesheet dependency is cleaned up.
- Mitigation: Verify whether GitHub Pages or an upstream CDN already injects CSP, `Referrer-Policy`, and similar headers at runtime before changing the template.
- False positive notes: This is a repo-level absence, not proof that production headers are missing. It must be verified against the deployed site.

## Positive Observations

- No evidence of dangerous DOM XSS sinks such as `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, or `new Function` in the repo.
- No evidence of `postMessage`, `localStorage`, `sessionStorage`, `fetch`, or `XMLHttpRequest` usage in the site code.
- Meta descriptions are sanitized before insertion with `strip_html`, `strip_newlines`, and `xml_escape` in `_includes/header.html:13-18`.
- The site appears to be static-content driven, which significantly reduces attack surface compared with a dynamic application.

## Residual Risk And Follow-Up

- I did not perform a live dependency advisory or CVE scan for the Ruby gems because that would require current advisory data outside the repo.
- I did not verify runtime headers on the deployed domain from this environment. That should be checked separately against the live site.
- If you want, the next step should be either:
  - fix finding 1 by self-hosting or pinning Primer, or
  - add a conservative CSP after the stylesheet source is finalized.
