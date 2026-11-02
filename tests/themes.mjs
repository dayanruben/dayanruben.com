import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { createServer, get as httpsGet } from 'node:https';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { chromium, firefox, webkit } from 'playwright';
import axe from 'axe-core';

const root = resolve(import.meta.dirname, '..');
const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'website-themes-')));
// macOS 27 blocks terminal-launched Firefox 157 from ~/Library/Application Support/Firefox.
if (process.platform === 'darwin' && !process.env.MOZ_APP_DATA) {
  const firefoxAppData = join(temporary, 'firefox-app-data');
  const firefoxLocalAppData = join(temporary, 'firefox-local-app-data');
  mkdirSync(firefoxAppData, { recursive: true });
  mkdirSync(firefoxLocalAppData, { recursive: true });
  process.env.MOZ_APP_DATA = firefoxAppData;
  process.env.MOZ_LOCAL_APP_DATA = firefoxLocalAppData;
}
const source = join(temporary, 'source');
const output = join(temporary, 'site');
const artifacts = resolve(process.env.THEME_ARTIFACTS || join(tmpdir(), 'website-theme-validation'));
mkdirSync(source); mkdirSync(output); mkdirSync(artifacts, { recursive: true });
const reports = [];
const metadataText = 'Profile "<b data-metadata>text</b> & friends';
const metadataOwner = {
  name: metadataText, login: metadataText, bio: metadataText,
  location: metadataText, email: `${metadataText}@example.test`,
  avatar_url: '/favicon.ico?label="avatar"&version=1',
};
const metadataRepository = {
  name: metadataText, description: metadataText, language: 'JavaScript',
  html_url: 'https://example.test/?label="repository"&version=1',
  stargazers_count: 7, forks_count: 2,
};
const metadataTopic = {
  name: '<b data-topic>topic</b>',
  web_url: 'javascript:alert(1)',
  image_url: 'javascript:alert(2)',
  description: '<i data-description>description</i>',
};
let server;
try {
  const primerLicense = 'Released under MIT license. Copyright (c) 2019 GitHub Inc.';
  const primerFull = join(root, 'assets/vendor/primer.full.css');
  const primerServed = readFileSync(join(root, 'assets/vendor/primer.css'));
  assert.ok(existsSync(primerFull), 'Keep the full Primer original for provenance');
  const primerOriginal = readFileSync(primerFull);
  assert.ok(primerOriginal.includes(primerLicense), 'Full Primer keeps its license');
  assert.ok(primerOriginal.includes('normalize.css v4.1.1'), 'Full Primer keeps the normalize license');
  assert.ok(primerServed.includes(primerLicense), 'Served Primer keeps the Primer license');
  assert.ok(primerServed.includes('normalize.css v4.1.1'), 'Served Primer keeps the normalize license');
  assert.ok(primerServed.length < primerOriginal.length, 'Served Primer is a subset of the original');
  for (const selector of ['.circle', '.tooltipped', '.container-lg', '.octicon']) {
    assert.ok(primerServed.includes(selector), `Served Primer keeps ${selector}`);
  }
  const primerGzip = gzipSync(primerServed).length;
  assert.ok(primerGzip < 12000, `Served Primer gzip ${primerGzip} bytes is substantially below 23KB`);
  const favicon = readFileSync(join(root, 'favicon.ico'));
  assert.ok(favicon.length < 8192, `favicon.ico is ${favicon.length} bytes; a large icon delays the mobile LCP image`);
  for (const path of ['_config.yml', '_data', '_includes', '_layouts', '_plugins', '_sass', 'assets', 'index.html', 'favicon.ico', 'package.json']) {
    cpSync(join(root, path), join(source, path), { recursive: true });
  }
  cpSync(join(root, 'tests/fixtures/preview.html'), join(source, 'preview.html'));
  mkdirSync(join(source, 'tests'));
  writeFileSync(join(source, 'tests/private.txt'), 'Validation fixtures must not be published.');
  mkdirSync(join(source, 'docs'));
  writeFileSync(join(source, 'docs/private.md'), 'Repository documentation must not be published.');
  mkdirSync(join(source, 'lighthouse-reports'));
  writeFileSync(join(source, 'lighthouse-reports/mobile-1.json'), '{"retained":true}\n');
  mkdirSync(join(source, '_posts'));
  writeFileSync(join(source, '_posts/2026-01-01-example.md'), '---\nlayout: post\ntitle: "<b data-title>Example article</b>"\npermalink: /article/\n---\nA paragraph with [a link](#example), **bold text**, and `inline code`.\n\n> A readable quotation.\n\n## Example\n\n```ruby\n# A comment\nputs "Hello"\n```\n');
  writeFileSync(join(source, '_posts/2026-01-02-empty.md'), '---\nlayout: post\ntitle: Empty article\npermalink: /empty-article/\n---\n\n');
  writeFileSync(join(source, 'explicit-description.html'), '---\nlayout: default\ntitle: Explicit description\ndescription: Explicit page description\npermalink: /explicit-description/\n---\nExplicit body.\n');
  writeFileSync(join(source, 'hostile-description.html'), '---\nlayout: default\ntitle: Hostile description\ndescription: \'Profile "<b data-metadata>text</b> & friends\'\npermalink: /hostile-description/\n---\nHostile body.\n');
  writeFileSync(join(source, 'blank-description.html'), '---\nlayout: default\ntitle: Blank description\ndescription: "   "\npermalink: /blank-description/\n---\nBlank body.\n');
  const fixture = readFileSync(join(root, 'tests/fixtures/config.yml'), 'utf8');
  const metadataConfig = join(temporary, 'metadata-values.yml');
  writeFileSync(metadataConfig, JSON.stringify({ github: { owner: metadataOwner, public_repositories: [metadataRepository] }, topics: [metadataTopic] }));
  const variants = { stacked: ['stacked', 'system'], sidebar: ['sidebar', 'system'], light: ['stacked', 'light'], dark: ['stacked', 'dark'], metadata: ['sidebar', 'system'] };
  for (const [name, [layout, theme]] of Object.entries(variants)) {
    const config = join(temporary, `${name}.yml`);
    writeFileSync(config, `${fixture}\nlayout: ${layout}\nstyle: ${theme}\nbaseurl: /${name}\n`);
    const configs = `${join(source, '_config.yml')},${config}${name === 'metadata' ? `,${metadataConfig}` : ''}`;
    const result = spawnSync('bundle', ['exec', 'jekyll', 'build', '--source', source, '--destination', join(output, name), '--config', configs], { timeout: 60000, cwd: source, env: { ...process.env, BUNDLE_GEMFILE: join(root, 'Gemfile'), JEKYLL_NO_BUNDLER_REQUIRE: 'true' }, encoding: 'utf8' });
    assert.equal(result.status, 0, `Jekyll ${name}: ${result.stderr}\n${result.stdout}`);
    assert.ok(!existsSync(join(output, name, 'tests')), 'Validation tools must not be published');
    assert.ok(!existsSync(join(output, name, 'docs')), 'Documentation must not be published');
    assert.ok(!existsSync(join(output, name, '_plugins')), 'Plugin source must not be published');
    assert.ok(!existsSync(join(output, name, 'lighthouse-reports')), 'Lighthouse reports must not be published');
    assert.ok(!existsSync(join(output, name, 'package.json')), 'Node tooling must not be published');
    const rendered = readFileSync(join(output, name, 'index.html'), 'utf8');
    assert.ok(rendered.includes('theme-toggle'), `Rendered theme control: ${result.stdout} ${result.stderr}`);
    assert.ok(!rendered.includes('theme-options'), 'The compact control must not render a theme menu');
    const inlineStyles = [...rendered.matchAll(/<style id="site-styles">([\s\S]*?)<\/style>/g)];
    assert.equal(inlineStyles.length, 1, 'Exactly one complete inline stylesheet');
    assert.ok(inlineStyles[0][1].includes(primerLicense), 'Inline CSS retains the Primer license');
    assert.ok(inlineStyles[0][1].includes('normalize.css v4.1.1'), 'Inline CSS retains the normalize license');
    assert.doesNotMatch(rendered, /<link\b[^>]*\brel="stylesheet"/, 'Styles do not require a blocking request');
    assert.ok(gzipSync(Buffer.from(rendered)).length <= 14 * 1024, 'Compressed homepage stays within 14 KiB');
    console.log(`PASS Jekyll build: ${name}`);
  }
  function expectInlineBuildFailure(name, mutate, expected) {
    const badSource = join(temporary, `inline-${name}`);
    cpSync(source, badSource, { recursive: true });
    mutate(badSource);
    const result = spawnSync('bundle', ['exec', 'jekyll', 'build', '--source', badSource, '--destination', join(output, `inline-${name}`), '--config', `${join(badSource, '_config.yml')},${join(temporary, 'stacked.yml')}`], { timeout: 60000, cwd: badSource, env: { ...process.env, BUNDLE_GEMFILE: join(root, 'Gemfile'), JEKYLL_NO_BUNDLER_REQUIRE: 'true' }, encoding: 'utf8' });
    assert.notEqual(result.status, 0, `Invalid ${name} must stop the build`);
    assert.match(result.stderr + result.stdout, expected, `${name} fails for the intended CSS contract`);
  }
  expectInlineBuildFailure('missing-css', bad => rmSync(join(bad, 'assets/styles.scss')), /Missing compiled site stylesheet/);
  expectInlineBuildFailure('missing-marker', bad => {
    const header = join(bad, '_includes/header.html');
    writeFileSync(header, readFileSync(header, 'utf8').replace('data-site-styles="theme"', ''));
  }, /Expected exactly one theme stylesheet link/);
  expectInlineBuildFailure('duplicate-marker', bad => {
    const header = join(bad, '_includes/header.html');
    writeFileSync(header, readFileSync(header, 'utf8').replace('</head>', '<link data-site-styles="primer" href="/duplicate.css" rel="stylesheet"></head>'));
  }, /Expected exactly one primer stylesheet link/);
  expectInlineBuildFailure('closing-style', bad => {
    const primer = join(bad, 'assets/vendor/primer.css');
    writeFileSync(primer, readFileSync(primer, 'utf8') + '\n/*! </style> */\n');
  }, /CSS contains a closing style tag/);
  console.log('PASS inline CSS and fail-closed builds');
  function descriptionContent(html, label) {
    const name = html.match(/<meta name="description" content="([^"]*)" \/>/);
    const openGraph = html.match(/<meta property="og:description" content="([^"]*)" \/>/);
    assert.ok(name && openGraph, `${label} description meta missing`);
    assert.equal(openGraph[1], name[1], `${label} Open Graph description reuses the resolved description`);
    return name[1];
  }
  function buildDescription(name, bioYaml) {
    const config = join(temporary, `description-${name}.yml`);
    writeFileSync(config, fixture.replace('    bio: Software engineer', `    bio: ${bioYaml}`));
    const destination = join(output, `description-${name}`);
    const result = spawnSync('bundle', ['exec', 'jekyll', 'build', '--source', source, '--destination', destination, '--config', `${join(source, '_config.yml')},${config}`], { timeout: 60000, cwd: source, env: { ...process.env, BUNDLE_GEMFILE: join(root, 'Gemfile'), JEKYLL_NO_BUNDLER_REQUIRE: 'true' }, encoding: 'utf8' });
    assert.equal(result.status, 0, `Jekyll description ${name}: ${result.stderr}\n${result.stdout}`);
    return destination;
  }
  const siteDescription = 'Local theme validation fixtures';
  for (const [name, bioYaml] of Object.entries({ empty: '""', nil: 'null', whitespace: '"   \\n   "', markup: '"<b></b>"' })) {
    const destination = buildDescription(name, bioYaml);
    assert.equal(descriptionContent(readFileSync(join(destination, 'index.html'), 'utf8'), name), siteDescription, `${name} bio falls back to the site description`);
    assert.equal(descriptionContent(readFileSync(join(destination, 'explicit-description/index.html'), 'utf8'), name), 'Explicit page description', `${name} bio still honors an explicit page description`);
    assert.equal(descriptionContent(readFileSync(join(destination, 'empty-article/index.html'), 'utf8'), name), siteDescription, `${name} empty article falls back to the site description`);
    const article = descriptionContent(readFileSync(join(destination, 'article/index.html'), 'utf8'), `${name} article`);
    assert.equal(article.startsWith('A paragraph with a link, bold text, and inline code.'), true, `${name} post keeps its excerpt: ${article}`);
  }
  const plain = buildDescription('plain', '"Software engineer"');
  const hostileHtml = readFileSync(join(plain, 'hostile-description/index.html'), 'utf8');
  assert.equal(descriptionContent(hostileHtml, 'hostile page'), 'Profile &quot;text &amp; friends', 'Hostile page description is stripped and escaped once');
  assert.equal(hostileHtml.includes('<b data-metadata>'), false, 'Hostile page description must not create elements');
  assert.equal(descriptionContent(readFileSync(join(plain, 'index.html'), 'utf8'), 'plain home'), 'Software engineer', 'A nonblank bio remains the home description');
  assert.equal(descriptionContent(readFileSync(join(plain, 'blank-description/index.html'), 'utf8'), 'blank page description'), 'Software engineer', 'A whitespace page description falls through to the bio');
  const metadataExplicit = descriptionContent(readFileSync(join(output, 'metadata/explicit-description/index.html'), 'utf8'), 'metadata explicit');
  assert.equal(metadataExplicit, 'Explicit page description', 'An explicit page description wins over a nonblank bio');
  console.log('PASS description selection');
  function avatarTag(html) {
    const match = html.match(/<img[^>]*class="circle"[^>]*>/);
    assert.ok(match, 'profile portrait img');
    return match[0];
  }
  function avatarAttr(tag, name) {
    const match = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
    return match ? match[1] : null;
  }
  function jpegSize(bytes) {
    assert.equal(bytes[0], 0xff, 'portrait is a JPEG');
    assert.equal(bytes[1], 0xd8, 'portrait is a JPEG');
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
    assert.fail('JPEG size missing');
  }
  function buildProfile(name, yamlValue) {
    const config = join(temporary, `profile-${name}.yml`);
    writeFileSync(config, `${fixture}\nlayout: stacked\nstyle: system\nbaseurl: /profile-${name}\nprofile_image: ${yamlValue}\n`);
    const destination = join(output, `profile-${name}`);
    const result = spawnSync('bundle', ['exec', 'jekyll', 'build', '--source', source, '--destination', destination, '--config', `${join(source, '_config.yml')},${config}`], { timeout: 60000, cwd: source, env: { ...process.env, BUNDLE_GEMFILE: join(root, 'Gemfile'), JEKYLL_NO_BUNDLER_REQUIRE: 'true' }, encoding: 'utf8' });
    assert.equal(result.status, 0, `Jekyll profile ${name}: ${result.stderr}\n${result.stdout}`);
    return readFileSync(join(destination, 'index.html'), 'utf8');
  }
  const safePortrait = buildProfile('safe', '"/assets/profile/dayan"');
  const safeTag = avatarTag(safePortrait);
  const safeSrc = '/profile-safe/assets/profile/dayan-150.jpg';
  assert.equal(avatarAttr(safeTag, 'src'), safeSrc, 'A safe portrait stem serves the 150px derivative');
  assert.equal(avatarAttr(safeTag, 'srcset'), `${safeSrc} 150w, /profile-safe/assets/profile/dayan-300.jpg 300w, /profile-safe/assets/profile/dayan-450.jpg 450w`, 'Portrait srcset covers 1x, 2x, and 3x');
  assert.equal(avatarAttr(safeTag, 'sizes'), '150px', 'The portrait slot is 150 CSS pixels');
  assert.equal(avatarAttr(safeTag, 'width'), '150');
  assert.equal(avatarAttr(safeTag, 'height'), '150');
  assert.equal(avatarAttr(safeTag, 'loading'), 'eager');
  assert.equal(avatarAttr(safeTag, 'fetchpriority'), 'high');
  assert.equal(avatarAttr(safeTag, 'alt'), 'Dayan Ruben', 'Portrait alt stays the profile name');
  assert.equal(avatarAttr(safeTag, 'src'), safePortrait.match(/<meta property="og:image" content="([^"]*)" \/>/)?.[1].replace('http://localhost', ''), 'Open Graph reuses the same-origin 150px portrait');
  assert.equal(safePortrait.match(/<meta property="og:image" content="([^"]*)" \/>/)?.[1], 'http://localhost/profile-safe/assets/profile/dayan-150.jpg');
  assert.match(safePortrait.match(/<source\b[^>]*>/)?.[0] ?? '', /<source\s+type="image\/webp"\s+srcset="\/profile-safe\/assets\/profile\/dayan-150\.webp 150w, \/profile-safe\/assets\/profile\/dayan-300\.webp 300w, \/profile-safe\/assets\/profile\/dayan-450\.webp 450w"\s+sizes="150px"/);
  for (const [size, limit] of [[150, 4096], [300, 12288], [450, 24576]]) {
    const image = readFileSync(join(root, 'assets/profile', `dayan-${size}.webp`));
    assert.ok(image.length <= limit, `${size}px WebP stays within ${limit} bytes`);
    assert.equal(image.toString('ascii', 0, 4), 'RIFF');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    assert.deepEqual(readFileSync(join(output, 'profile-safe/assets/profile', `dayan-${size}.webp`)), image, 'WebP derivative is published intact');
  }
  for (const size of [150, 300, 450]) {
    const published = readFileSync(join(output, 'profile-safe', 'assets', 'profile', `dayan-${size}.jpg`));
    assert.deepEqual(jpegSize(published), { width: size, height: size }, `${size}px portrait dimensions`);
  }
  for (const [name, yamlValue] of Object.entries({
    scheme: '"javascript:alert(1)"',
    https: '"https://evil.example/a.jpg"',
    protocol: '"//evil.example/a.jpg"',
    traversal: '"/assets/../secret.jpg"',
    slash: '"/assets/profile\\\\evil.jpg"',
    blank: '"   "',
  })) {
    const html = buildProfile(name, yamlValue);
    const tag = avatarTag(html);
    assert.equal(avatarAttr(tag, 'src'), '/favicon.ico', `${name} profile path keeps the configured avatar`);
    assert.equal(avatarAttr(tag, 'srcset'), null, `${name} profile path does not advertise derivatives`);
    assert.doesNotMatch(html, /<source\b/, `${name} profile path must not advertise WebP derivatives`);
    assert.equal(html.includes('javascript:'), false, `${name} profile path cannot create a script URL`);
    assert.equal(html.includes('evil.example'), false, `${name} profile path cannot emit the rejected host`);
  }
  console.log('PASS profile portrait');
  const types = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  // Use HTTPS so WebKit can enforce the production upgrade-insecure-requests CSP.
  const key = join(temporary, 'localhost.key');
  const certificate = join(temporary, 'localhost.crt');
  const tls = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-days', '1'], { encoding: 'utf8' });
  assert.equal(tls.status, 0, 'Generate a temporary local HTTPS certificate');
  const localCertificate = readFileSync(certificate);
  server = createServer({ key: readFileSync(key), cert: localCertificate }, (request, response) => {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/favicon.ico') path = '/stacked/favicon.ico';
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(output, `.${path}`);
    if (!file.startsWith(`${output}/`) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    if (extname(file) === '.html') {
      response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      response.setHeader('X-Frame-Options', 'DENY');
    }
    response.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${server.address().port}`;
  const tlsClientOptions = { ca: localCertificate };
  function portraitResponse(extension, options = tlsClientOptions) {
    return new Promise((resolvePromise, reject) => {
      httpsGet(`${origin}/profile-safe/assets/profile/dayan-150.${extension}`, options, response => {
        response.resume();
        resolvePromise({ type: response.headers['content-type'], authorized: response.socket.authorized });
      }).on('error', reject);
    });
  }
  for (const extension of ['jpg', 'webp']) {
    await assert.rejects(portraitResponse(extension, { ...tlsClientOptions, ca: [] }), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }, 'Reject an untrusted fixture certificate');
    await assert.rejects(portraitResponse(extension, { ...tlsClientOptions, servername: 'unrelated.invalid' }), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }, 'Reject the wrong server identity');
  }
  assert.deepEqual(await portraitResponse('jpg'), { type: 'image/jpeg', authorized: true }, 'Local portraits use authenticated HTTPS');
  assert.deepEqual(await portraitResponse('webp'), { type: 'image/webp', authorized: true }, 'Modern portraits use authenticated HTTPS');
  console.log('PASS fixture TLS: trusted issuer, matching identity, and rejected untrusted/mismatched certificates');
  const expected = { light: 'rgb(255, 255, 255)', dark: 'rgb(13, 17, 23)' };
  async function appearance(page, theme) {
    await page.waitForFunction(value => getComputedStyle(document.body).backgroundColor === value, expected[theme]);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), theme);
  }
  async function choose(page, value) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (await page.evaluate(theme => document.documentElement.getAttribute('data-theme') === theme, value)) break;
      await page.locator('#theme-toggle').click();
    }
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), value);
    assert.equal(await page.locator('#theme-toggle').getAttribute('data-effective-theme'), value === 'system' ? await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value);
    assert.equal(await page.locator('#theme-label').textContent(), value === 'system' ? 'System theme' : value[0].toUpperCase() + value.slice(1) + ' theme');
    assert.equal(await page.locator('.theme-toggle svg path:visible').count(), 1, 'Show one icon for the effective theme');
  }
  async function inspectColors(page) {
    return page.evaluate(() => {
      const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = color => rgb(color).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      const background = element => {
        for (let node = element; node; node = node.parentElement) {
          const color = getComputedStyle(node).backgroundColor;
          if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      return Array.from(document.querySelectorAll('svg path, svg circle, svg rect')).filter(element => {
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().width > 0 && style.fill !== 'none' && Number(style.fillOpacity) !== 0;
      }).map(element => {
        const style = getComputedStyle(element);
        const cutout = (element.getAttribute('fill') || '').includes('cutout');
        const against = cutout ? getComputedStyle(element.closest('a') || element.closest('svg')).color : background(element);
        return { icon: element.closest('a')?.getAttribute('aria-label') || element.closest('svg').getAttribute('aria-label') || 'control', fill: style.fill, expected: cutout ? getComputedStyle(document.documentElement).getPropertyValue('--color-icon-cutout').trim() : style.color, ratio: contrast(style.fill, against), cutout };
      });
    });
  }
  for (const [browserName, browserType] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await browserType.launch();
    try {
      // HTTP framing protection must work without the theme script's fallback.
      const embeddingContext = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled: false });
      try {
        const parent = await embeddingContext.newPage();
        await parent.setContent(`<iframe src="${origin}/stacked/"></iframe>`);
        await parent.waitForLoadState('networkidle');
        const child = parent.frames().find(frame => frame !== parent.mainFrame());
        assert.ok(child, 'The embedding attempt creates a child browsing context');
        // A blocked Firefox frame has no document execution context to query.
        if (browserName === 'firefox') {
          assert.notEqual(child.url(), `${origin}/stacked/`, 'HTTP headers prevent framing even without JavaScript');
        } else {
          assert.equal(await child.locator('main').count(), 0, 'HTTP headers prevent framing even without JavaScript');
        }
      } finally { await embeddingContext.close(); }
      for (const deviceScaleFactor of [1, 2, 3]) {
        const portraitContext = await browser.newContext({ ignoreHTTPSErrors: true, deviceScaleFactor, viewport: { width: 412, height: 823 } });
        try {
          const page = await portraitContext.newPage();
          await page.goto(`${origin}/profile-safe/`);
          const portrait = page.locator('.profile-avatar img');
          await portrait.evaluate(image => image.decode());
          assert.equal(await portrait.evaluate(image => image.currentSrc), `${origin}/profile-safe/assets/profile/dayan-${150 * deviceScaleFactor}.webp`, 'Fresh DPR context selects the appropriate modern portrait');
          await page.locator('.profile-avatar source').evaluate(source => { source.type = 'image/unsupported'; });
          await page.waitForFunction(() => document.querySelector('.profile-avatar img').currentSrc.endsWith('.jpg'));
          await portrait.evaluate(image => image.decode());
          assert.ok(await portrait.evaluate(image => image.complete && image.naturalWidth > 0), 'JPEG fallback decodes when WebP is unsupported');
        } finally { await portraitContext.close(); }
      }
      // API metadata is plain text even when it contains HTML or attribute quotes.
      const metadataContext = await browser.newContext({ ignoreHTTPSErrors: true });
      try {
        const page = await metadataContext.newPage();
        await page.goto(`${origin}/metadata/preview.html`);
        for (const theme of ['light', 'dark']) {
          await choose(page, theme); await appearance(page, theme);
          assert.equal(await page.locator('[data-metadata]').count(), 0, 'Metadata must not create HTML elements or attributes');
          assert.equal(await page.title(), metadataText);
          assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), metadataText);
          assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), 'Profile "text & friends');
          assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), metadataOwner.avatar_url);
          assert.equal(await page.locator('img.circle').getAttribute('alt'), metadataText);
          assert.equal(await page.locator('img.circle').getAttribute('src'), metadataOwner.avatar_url);
          assert.equal(await page.locator('[data-topic], [data-description]').count(), 0, 'Topic metadata must remain inert');
          assert.equal(await page.locator('a[href^="javascript:"]').count(), 0, 'Topic URLs must use safe schemes');
          assert.equal((await page.locator('h1').first().textContent()).trim(), metadataText);
          assert.equal((await page.locator('p.mb-3').textContent()).trim(), metadataText);
          assert.equal(await page.locator('a[href^="mailto:"]').getAttribute('href'), `mailto:${metadataOwner.email}`);
          assert.equal((await page.locator('a[href^="mailto:"]').textContent()).trim(), metadataOwner.email);
          assert.equal((await page.locator('.octicon-location').locator('..').textContent()).trim(), metadataText);
          assert.equal(await page.locator('a[href^="https://github.com/"]').first().getAttribute('href'), `https://github.com/${metadataOwner.login}`);
          const card = page.locator('.github-component').filter({ has: page.locator('.octicon-repo') });
          assert.equal((await card.locator('h1').textContent()).trim(), metadataText);
          assert.equal(await card.locator('.ws-normal').textContent(), metadataText);
          assert.equal(await card.locator('a').first().getAttribute('href'), metadataRepository.html_url);
          assert.equal(await card.locator('a').nth(1).getAttribute('href'), `${metadataRepository.html_url}/stargazers`);
          assert.equal(await card.locator('a').nth(2).getAttribute('href'), `${metadataRepository.html_url}/network/members`);
        }
      } finally { await metadataContext.close(); }
      console.log(`PASS ${browserName}: metadata stays literal in both themes`);
      for (const layout of ['stacked', 'sidebar']) {
        const context = await browser.newContext({ ignoreHTTPSErrors: true, colorScheme: 'light', viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        for (const route of ['/', '/preview.html', '/article/']) {
          const response = await page.goto(`${origin}/${layout}${route}`);
          assert.equal(response.status(), 200, `Page ${layout}${route} must exist`);
          assert.equal(await page.locator('main:visible').count(), 1, `Exactly one visible main landmark: ${layout}${route}`);
          if (route === '/') {
            assert.equal(await page.locator('main .profile-avatar').count(), 1, 'Homepage main includes the profile');
          } else {
            assert.equal(await page.locator('main .profile-avatar').count(), 0, 'Reading pages keep the profile outside main');
            assert.ok(await page.locator('main h1, main .article').count() > 0, 'Reading pages put the primary content in main');
          }
          assert.equal(await page.locator('#theme-toggle').count(), 1, `Theme control missing: ${layout}${route}: ${(await page.locator('body').innerText()).slice(0, 300)}`);
          const metaPolicy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
          assert.match(metaPolicy, /script-src 'self'/, 'Keep the restrictive script policy');
          assert.doesNotMatch(metaPolicy, /frame-ancestors/, 'Framing policy cannot be delivered through meta');
          assert.match(response.headers()['content-security-policy'] ?? '', /frame-ancestors 'none'/, 'HTTP CSP must block framing');
          assert.equal(response.headers()['x-frame-options'], 'DENY');
          const themeScript = page.locator('script[src$="/assets/theme.js"]');
          assert.equal(await themeScript.getAttribute('async'), null, 'Early theme initialization stays synchronous');
          assert.equal(await themeScript.getAttribute('defer'), null, 'Early theme initialization is not deferred');
          assert.equal(await themeScript.evaluate(script => Boolean(script.compareDocumentPosition(document.getElementById('site-styles')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, 'Theme initialization precedes inline CSS');
          if (route === '/article/') {
            assert.equal(await page.locator('[data-title]').count(), 0, 'Post titles must remain inert');
          }
          assert.equal(await page.locator('.profile-avatar #theme-toggle').count(), 1, 'Theme control must overlay the avatar');
          assert.equal(await page.locator('.profile-heading #theme-toggle').count(), 0, 'Theme control stays off the name row');
          const avatarBox = await page.locator('.profile-avatar').boundingBox();
          const toggleBox = await page.locator('#theme-toggle').boundingBox();
          assert.ok(toggleBox.x + toggleBox.width > avatarBox.x + avatarBox.width - 1, `Theme control overlaps avatar lower-right: ${JSON.stringify({ avatarBox, toggleBox })}`);
          assert.ok(toggleBox.y + toggleBox.height > avatarBox.y + avatarBox.height - 1, `Theme control overlaps avatar lower-right: ${JSON.stringify({ avatarBox, toggleBox })}`);
          console.log(`Checking ${browserName} ${layout}${route}`);
          if (route === '/preview.html') {
            assert.ok(await page.locator('.highlight span').count() > 0, 'Render actual syntax highlighting');
            assert.ok(await page.locator('.social-link svg').count() >= 18, 'Render all social icon fixtures');
            assert.equal(await page.locator('.octicon-repo').count(), 1, 'Render the repository card');
          }
          let fonts;
          let textColors;
          for (const theme of ['light', 'dark']) {
            await choose(page, theme);
            await appearance(page, theme);
            const currentFonts = await page.locator('body, h1, h2, p, .theme-toggle').evaluateAll(elements => elements.map(element => {
              const style = getComputedStyle(element);
              return [style.fontFamily, style.fontSize, style.fontWeight];
            }));
            if (fonts) assert.deepEqual(currentFonts, fonts, 'Switching themes must preserve typography');
            fonts = currentFonts;
            const currentColors = await page.locator('body, h1, h2, p, a, .theme-toggle, .highlight span').evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
            if (textColors) currentColors.forEach((color, index) => assert.notEqual(color, textColors[index], `Text/link color must update in ${layout}${route}, element ${index}`));
            textColors = currentColors;
            const icons = await inspectColors(page);
            assert.ok(icons.length > 0);
            for (const icon of icons) {
              assert.ok(icon.ratio >= 3, `Icon contrast: ${JSON.stringify(icon)}`);
              if (!icon.cutout) assert.equal(icon.fill, icon.expected, `${icon.icon} must inherit its text color`);
            }
            await page.evaluate(axe.source);
            const accessibility = await page.evaluate(async () => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
            assert.deepEqual(accessibility.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), [], 'Accessibility violations');
            const mainLandmark = await page.evaluate(async () => axe.run(document, { runOnly: { type: 'rule', values: ['landmark-one-main'] } }));
            assert.deepEqual(mainLandmark.violations.map(({ id }) => id), [], `landmark-one-main ${layout}${route}`);
            await page.screenshot({ path: join(artifacts, `${browserName}-${layout}-${route.replaceAll('/', '') || 'home'}-${theme}.png`), fullPage: true });
            reports.push({ browserName, layout, route, theme, textColorsChecked: currentColors.length, icons: icons.length, minimumIconContrast: Math.min(...icons.map(i => i.ratio)), accessibilityViolations: accessibility.violations.length });
          }
        }
        // Stored overrides survive navigation and reload; System responds live.
        await page.reload(); await appearance(page, 'dark');
        const other = await context.newPage();
        await other.goto(`${origin}/${layout}/`); await appearance(other, 'dark');
        await choose(page, 'light'); await appearance(other, 'light');
        await page.emulateMedia({ colorScheme: 'dark' }); await appearance(page, 'light');
        await choose(page, 'system'); await appearance(page, 'dark');
        assert.equal(await page.locator('#theme-toggle').getAttribute('data-effective-theme'), 'dark');
        assert.equal(await page.locator('.theme-icon-dark:visible').count(), 1);
        assert.equal(await page.evaluate(() => localStorage.getItem('dayanruben-theme')), null);
        await page.emulateMedia({ colorScheme: 'light' }); await appearance(page, 'light');
        assert.equal(await page.locator('.theme-icon-light:visible').count(), 1);
        await page.evaluate(() => localStorage.setItem('dayanruben-theme', 'invalid'));
        await page.reload(); await appearance(page, 'light');
        assert.equal(await page.locator('#theme-label').textContent(), 'System theme');
        // Keyboard activation follows the same compact icon cycle as a pointer click.
        await page.locator('#theme-toggle').focus(); await page.keyboard.press('Enter');
        await appearance(page, 'dark');
        assert.equal(await page.locator('#theme-toggle').getAttribute('aria-label'), 'Switch to light theme');
        await page.keyboard.press('Space'); await appearance(page, 'light');
        assert.equal(await page.locator('#theme-toggle').getAttribute('aria-label'), 'Follow system theme');
        await page.keyboard.press('Enter'); await appearance(page, 'light');
        assert.equal(await page.locator('#theme-toggle').evaluate(el => el === document.activeElement), true);
        assert.notEqual(await page.locator('#theme-toggle').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        // Mobile wrapping, touch targets, and icon contrast in both themes.
        await page.setViewportSize({ width: 320, height: 740 });
        await page.evaluate(axe.source);
        for (const theme of ['light', 'dark']) {
          await choose(page, theme);
          const button = await page.locator('#theme-toggle').boundingBox();
          assert.ok(Math.round(button.width) >= 44 && Math.round(button.height) >= 44, `Theme control target: ${JSON.stringify(button)}`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
          const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations);
          assert.deepEqual(violations, [], 'Mobile control accessibility');
          const mobileLandmark = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'rule', values: ['landmark-one-main'] } })).violations.map(({ id }) => id));
          assert.deepEqual(mobileLandmark, [], 'Mobile landmark-one-main');
          await page.screenshot({ path: join(artifacts, `${browserName}-${layout}-mobile-${theme}.png`), fullPage: true });
          await page.keyboard.press('Escape');
        }
        assert.deepEqual(errors, [], 'No browser or CSP errors');
        await context.close();
        console.log(`PASS ${browserName}: ${layout}, both themes, typography, SVG colors, contrast, persistence, keyboard, mobile`);
      }
      // Restore the preference before content, then verify the first rendering frame.
      for (const saved of ['light', 'dark']) {
        const context = await browser.newContext({ ignoreHTTPSErrors: true, colorScheme: saved === 'light' ? 'dark' : 'light' });
        await context.addInitScript(saved => {
          localStorage.setItem('dayanruben-theme', saved);
          document.addEventListener('DOMContentLoaded', () => {
            window.themeAtContentLoad = document.documentElement.getAttribute('data-theme');
            requestAnimationFrame(() => { window.themeAtFirstFrame = getComputedStyle(document.body).backgroundColor; });
          });
        }, saved);
        const page = await context.newPage();
        await page.goto(`${origin}/stacked/`);
        assert.equal(await page.evaluate(() => window.themeAtContentLoad), saved);
        await page.waitForFunction(() => window.themeAtFirstFrame);
        assert.equal(await page.evaluate(() => window.themeAtFirstFrame), expected[saved]);
        await context.close();
      }
      // Fresh visits, CSS-only fallback, denied storage, and existing config defaults.
      for (const theme of ['light', 'dark']) {
        for (const javaScriptEnabled of [true, false]) {
          const context = await browser.newContext({ ignoreHTTPSErrors: true, colorScheme: theme, javaScriptEnabled });
          const page = await context.newPage();
          await page.goto(`${origin}/stacked/`); await appearance(page, theme);
          assert.equal(await page.locator('.theme-switcher').isVisible(), javaScriptEnabled);
          await context.close();
        }
        const context = await browser.newContext({ ignoreHTTPSErrors: true, colorScheme: theme === 'light' ? 'dark' : 'light' });
        const page = await context.newPage();
        await page.goto(`${origin}/${theme}/`); await appearance(page, theme);
        await choose(page, 'system'); await page.reload();
        await appearance(page, theme === 'light' ? 'dark' : 'light');
        await context.close();
      }
      const context = await browser.newContext({ ignoreHTTPSErrors: true, colorScheme: 'dark' });
      await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } }));
      const page = await context.newPage();
      await page.goto(`${origin}/stacked/`); await appearance(page, 'dark');
      await choose(page, 'light'); await appearance(page, 'light');
      await context.close();
      console.log(`PASS ${browserName}: fresh visits, no JavaScript, storage denied, light/dark config defaults`);
    } finally { await browser.close(); }
  }
  writeFileSync(join(artifacts, 'results.json'), JSON.stringify(reports, null, 2));
  console.log(`PASS all theme checks; screenshots and color evidence: ${artifacts}`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
