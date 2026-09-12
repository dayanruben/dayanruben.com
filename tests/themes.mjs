import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { createServer } from 'node:https';
import { spawnSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';
import axe from 'axe-core';

const root = resolve(import.meta.dirname, '..');
const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'website-themes-')));
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
let server;
try {
  for (const path of ['_config.yml', '_data', '_includes', '_layouts', '_sass', 'assets', 'index.html', 'favicon.ico', 'package.json']) {
    cpSync(join(root, path), join(source, path), { recursive: true });
  }
  cpSync(join(root, 'tests/fixtures/preview.html'), join(source, 'preview.html'));
  mkdirSync(join(source, 'tests'));
  writeFileSync(join(source, 'tests/private.txt'), 'Validation fixtures must not be published.');
  mkdirSync(join(source, '_posts'));
  writeFileSync(join(source, '_posts/2026-01-01-example.md'), '---\nlayout: post\ntitle: Example article\npermalink: /article/\n---\nA paragraph with [a link](#example), **bold text**, and `inline code`.\n\n> A readable quotation.\n\n## Example\n\n```ruby\n# A comment\nputs "Hello"\n```\n');
  const fixture = readFileSync(join(root, 'tests/fixtures/config.yml'), 'utf8');
  const metadataConfig = join(temporary, 'metadata-values.yml');
  writeFileSync(metadataConfig, JSON.stringify({ github: { owner: metadataOwner, public_repositories: [metadataRepository] } }));
  const variants = { stacked: ['stacked', 'system'], sidebar: ['sidebar', 'system'], light: ['stacked', 'light'], dark: ['stacked', 'dark'], metadata: ['sidebar', 'system'] };
  for (const [name, [layout, theme]] of Object.entries(variants)) {
    const config = join(temporary, `${name}.yml`);
    writeFileSync(config, `${fixture}\nlayout: ${layout}\nstyle: ${theme}\nbaseurl: /${name}\n`);
    const configs = `${join(source, '_config.yml')},${config}${name === 'metadata' ? `,${metadataConfig}` : ''}`;
    const result = spawnSync('bundle', ['exec', 'jekyll', 'build', '--source', source, '--destination', join(output, name), '--config', configs], { timeout: 60000, cwd: source, env: { ...process.env, BUNDLE_GEMFILE: join(root, 'Gemfile'), JEKYLL_NO_BUNDLER_REQUIRE: 'true' }, encoding: 'utf8' });
    assert.equal(result.status, 0, `Jekyll ${name}: ${result.stderr}\n${result.stdout}`);
    assert.ok(!existsSync(join(output, name, 'tests')), 'Validation tools must not be published');
    assert.ok(!existsSync(join(output, name, 'package.json')), 'Node tooling must not be published');
    const rendered = readFileSync(join(output, name, 'index.html'), 'utf8');
    assert.ok(rendered.includes('theme-toggle'), `Rendered theme control: ${result.stdout} ${result.stderr}`);
    assert.ok(!rendered.includes('theme-options'), 'The compact control must not render a theme menu');
    assert.match(rendered, /href="[^"]*\/assets\/styles\.css\?v=\d+"/, 'Theme stylesheet URL must change on each build to refresh cached styling');
    console.log(`PASS Jekyll build: ${name}`);
  }
  const types = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.ico': 'image/x-icon' };
  // Use HTTPS so WebKit can enforce the production upgrade-insecure-requests CSP.
  const key = join(temporary, 'localhost.key');
  const certificate = join(temporary, 'localhost.crt');
  const tls = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-subj', '/CN=localhost', '-days', '1'], { encoding: 'utf8' });
  assert.equal(tls.status, 0, 'Generate a temporary local HTTPS certificate');
  server = createServer({ key: readFileSync(key), cert: readFileSync(certificate) }, (request, response) => {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/favicon.ico') path = '/stacked/favicon.ico';
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(output, `.${path}`);
    if (!file.startsWith(`${output}/`) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${server.address().port}`;
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
          assert.equal(await page.locator('#theme-toggle').count(), 1, `Theme control missing: ${layout}${route}: ${(await page.locator('body').innerText()).slice(0, 300)}`);
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
