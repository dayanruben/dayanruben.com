# Production edge delivery

Verified on 2026-11-02 UTC using the authenticated Cloudflare plugin and independent HTTP requests. GitHub Pages remains the origin; no Worker, hosting migration, DNS change, or zone-wide bot change was needed.

## Effective configuration

- Account: `1d39a57831124cd72dbc3a60a01ce9f4` (`dayanruben`).
- Zone: `31ac2eeaa95a02edb1c77ce06dcbca2b` (`dayanruben.com`).
- Response-header ruleset: `6110a33ce4f14f91bdfa7e275aa20799`, phase `http_response_headers_transform`.
- Every rule below matches exactly `(http.host eq "dayanruben.com")`; it does not match `www` or another zone.

| Rule | ID | Effect |
| --- | --- | --- |
| `dayanruben-com-framing` | `b292ae7d809d4f7596959b4831d2f429` | Add a separate HTTP CSP `frame-ancestors 'none'`; set `X-Frame-Options: DENY` |
| `dayanruben_com_preserve_payload` | `4d59b2731e8147a6b543be9a61baccd2` | Append `no-transform` to the existing origin Cache-Control value |

The payload-preservation rule uses a **Set dynamic** operation on `cache-control`:

```text
concat(http.response.headers["cache-control"][0], ", no-transform")
```

For HTML, the observed result is `Cache-Control: max-age=600, no-transform`. The origin TTL remains 600 seconds; other assets retain their own existing TTL. Gzip compression is still delivered. The `no-transform` directive prevents Cloudflare from changing the body to inject Web Analytics or JavaScript-detection code.

The meta CSP continues to supply the site's other restrictions, including `script-src 'self'`. It must not contain `frame-ancestors`: browsers enforce that directive only from an HTTP header. The additional HTTP CSP adds framing protection without replacing another policy.

## Why this differs from switching off bot settings

Read-only inventory found free-plan Bot Fight Mode enabled, with JavaScript detection enabled. Turning the zone-wide mode off would also affect the related `www` hostname. The owner requested suppression for the canonical hostname, so the implementation uses the documented `no-transform` response control instead.

Readback confirmed that `fight_mode: true`, `enable_js: true`, and the other bot settings remain unchanged. Automatic analytics configuration also remains unchanged; the payload-preservation rule prevents injection on the canonical hostname only. The separate `cameralog.app` analytics configuration remains enabled and unchanged.

Before this task, the zone had only Cloudflare-managed rulesets and no response-header transform entry point. The two rules above were added after a successful provider dry run. No existing rules were replaced. `www.dayanruben.com` still returns its original 301 redirect to the canonical HTTPS hostname and does not receive these added headers on that redirect.

## Verify after any deployment or provider change

```sh
node --test tests/edge-response.test.mjs
node tests/edge-response.mjs --url https://dayanruben.com/
npm run audit -- --url https://dayanruben.com/ --runs 3 --strict --output lighthouse-reports/live-<release-sha>
```

The edge command requests complete HTML with normal mobile and desktop user agents. It fails for missing HTTP framing protection, challenge/non-200 pages, incomplete HTML, or either injected script. It establishes edge delivery, not Google PageSpeed acceptance. Keep all Lighthouse results and independently collect the Google-hosted acceptance series described in the implementation plan.

Use the Cloudflare plugin to read the current entry point and bot/analytics configuration before a change. The existing Wrangler OAuth login can read the zone but returns 403 for these configuration APIs; do not replace credentials, expose tokens, or create a Worker as an authentication workaround.

## Rollback

1. Read the current ruleset and preserve any rules added by other work since this task.
2. To restore the previous payload behavior, disable only rule `4d59b2731e8147a6b543be9a61baccd2`. This restores the original Cache-Control header and allows automatic script injection again; the strict CSP may then log blocked-script errors.
3. Keep the framing rule enabled during a source rollback. Remove/disable `b292ae7d809d4f7596959b4831d2f429` only as an explicitly requested rollback of HTTP framing protection, with its resulting limitation understood. Never delete the entire entry point if it contains other rules.
4. Read back effective configuration and run the live edge check. Record the reason and result; do not describe a rollback with restored console errors as accepted PageSpeed 100.

## Primary references

- [Cloudflare response-header transforms](https://developers.cloudflare.com/rules/transform/response-header-modification/): additive policies, dynamic values, and rule ordering.
- [Web Analytics and no-transform](https://developers.cloudflare.com/web-analytics/faq/): preventing automatic beacon injection.
- [JavaScript Detections and no-transform](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/): preventing injected detection code without changing the zone mode.
