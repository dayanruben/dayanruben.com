import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function assertEdgeResponse({ status, headers, html }) {
  assert.equal(status, 200, 'Production HTML must return HTTP 200');
  assert.match(headers.get('content-type') ?? '', /^text\/html(?:\s*;|$)/i, 'Response must be HTML');
  assert.match(html, /<main(?:\s|>)/i, 'Response must contain the complete main content');
  assert.match(headers.get('content-security-policy') ?? '', /(?:^|[;,])\s*frame-ancestors\s+'none'\s*(?:;|,|$)/i, 'HTTP CSP must enforce framing protection');
  assert.equal((headers.get('x-frame-options') ?? '').toUpperCase(), 'DENY', 'HTTP framing protection must include DENY');
  assert.doesNotMatch(html, /static\.cloudflareinsights\.com\/beacon/i, 'Cloudflare analytics injection remains');
  assert.doesNotMatch(html, /\/cdn-cgi\/challenge-platform\//i, 'Cloudflare JavaScript detection injection remains');
}

export async function verifyEdge(url, fetchImpl = fetch) {
  const clients = [
    ['mobile', 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36'],
    ['desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'],
  ];
  for (const [preset, userAgent] of clients) {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': userAgent, 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(30000),
    });
    try {
      assertEdgeResponse({ status: response.status, headers: response.headers, html: await response.text() });
    } catch (error) {
      throw new Error(`${preset}: ${error.message}`, { cause: error });
    }
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--url') {
      throw new Error('Usage: node tests/edge-response.mjs --url https://dayanruben.com/');
    }
    await verifyEdge(process.argv[3]);
    console.log('PASS edge delivery: mobile and desktop HTTP headers, complete HTML, and no injected scripts');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
