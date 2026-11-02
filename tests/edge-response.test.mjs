import assert from 'node:assert/strict';
import test from 'node:test';

let edge = {};
try {
  edge = await import('./edge-response.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

function response(overrides = {}) {
  return {
    status: 200,
    headers: new Headers({
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
      'x-frame-options': 'DENY',
    }),
    html: '<!doctype html><html lang="en"><head><title>Dayan Ruben</title></head><body><main><div class="profile-avatar"><img src="/assets/profile/dayan-150.jpg" alt="Dayan Ruben"><button id="theme-toggle" type="button">Switch theme</button></div><h1>Dayan Ruben</h1></main></body></html>',
    ...overrides,
  };
}

test('accepts complete HTML protected by actual HTTP headers', () => {
  assert.doesNotThrow(() => edge.assertEdgeResponse(response()));
});

test('rejects analytics injection even when framing headers are correct', () => {
  assert.throws(() => edge.assertEdgeResponse(response({
    html: response().html.replace('</body>', '<script src="https://static.cloudflareinsights.com/beacon.min.js/version"></script></body>'),
  })), /analytics/i);
});

test('rejects the injected challenge-platform bootstrap', () => {
  assert.throws(() => edge.assertEdgeResponse(response({
    html: response().html.replace('</body>', '<script>load("/cdn-cgi/challenge-platform/scripts/jsd/main.js")</script></body>'),
  })), /detection|challenge/i);
});

test('rejects non-200 and challenge responses', () => {
  assert.throws(() => edge.assertEdgeResponse(response({ status: 403 })), /200/);
  assert.throws(() => edge.assertEdgeResponse(response({ html: '<title>Just a moment</title>' })), /main|complete/i);
});

test('rejects a non-HTML or empty response', () => {
  assert.throws(() => edge.assertEdgeResponse(response({ headers: new Headers({ 'content-type': 'application/json' }) })), /HTML/i);
  assert.throws(() => edge.assertEdgeResponse(response({ html: '' })), /main|complete/i);
});

test('rejects truncated HTML even when an opening main tag exists', () => {
  for (const html of ['<main>', response().html.replace('</html>', '')]) {
    assert.throws(() => edge.assertEdgeResponse(response({ html })), /complete/i);
  }
});

test('rejects a complete generic interstitial with an empty main', () => {
  const html = '<!doctype html><html><head><title>Just a moment</title></head><body><main></main></body></html>';
  assert.throws(() => edge.assertEdgeResponse(response({ html })), /profile|homepage/i);
});

test('requires the actual homepage profile and theme control markers', () => {
  for (const html of [response().html.replace('profile-avatar', 'other'), response().html.replace('theme-toggle', 'other')]) {
    assert.throws(() => edge.assertEdgeResponse(response({ html })), /profile|theme control/i);
  }
});

test('meta-only framing directives cannot satisfy the edge contract', () => {
  const value = response();
  value.headers.delete('content-security-policy');
  value.html = value.html.replace('</head>', '<meta http-equiv="Content-Security-Policy" content="frame-ancestors \'none\'"></head>');
  assert.throws(() => edge.assertEdgeResponse(value), /HTTP.*CSP|framing/i);
});

test('rejects a misleading CSP token and missing DENY protection', () => {
  const value = response();
  value.headers.set('content-security-policy', "script-src 'self' frame-ancestors 'none'");
  assert.throws(() => edge.assertEdgeResponse(value), /HTTP.*CSP|framing/i);
  const missingDeny = response();
  missingDeny.headers.delete('x-frame-options');
  assert.throws(() => edge.assertEdgeResponse(missingDeny), /DENY/);
});

test('checks fresh mobile and desktop responses independently', async () => {
  const requests = [];
  await edge.verifyEdge('https://dayanruben.com/', async (url, options) => {
    requests.push({ url, options });
    const value = response();
    return new Response(value.html, { status: value.status, headers: value.headers });
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(r => r.url), ['https://dayanruben.com/', 'https://dayanruben.com/']);
  assert.match(requests[0].options.headers['user-agent'], /Android.*Mobile/);
  assert.match(requests[1].options.headers['user-agent'], /Macintosh/);
  assert.equal(requests[0].options.headers['cache-control'], 'no-cache');
  assert.equal(requests[1].options.headers['cache-control'], 'no-cache');
});

test('does not accept a bad desktop response after a valid mobile response', async () => {
  let calls = 0;
  await assert.rejects(() => edge.verifyEdge('https://dayanruben.com/', async () => {
    calls += 1;
    const value = response({ status: calls === 2 ? 403 : 200 });
    return new Response(value.html, { status: value.status, headers: value.headers });
  }), /200/);
});
