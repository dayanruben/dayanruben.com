import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

let plan = {};
try {
  plan = await import('./lighthouse-plan.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

assert.equal(typeof plan.planRuns, 'function', 'planRuns schedules serial mobile and desktop audits');

const planned = plan.planRuns({ runs: 3, outputDir: 'lighthouse-reports' });
assert.deepEqual(
  planned.map((item) => `${item.preset}-${item.run}:${item.path}`),
  [
    'mobile-1:lighthouse-reports/mobile-1.json',
    'mobile-2:lighthouse-reports/mobile-2.json',
    'mobile-3:lighthouse-reports/mobile-3.json',
    'desktop-1:lighthouse-reports/desktop-1.json',
    'desktop-2:lighthouse-reports/desktop-2.json',
    'desktop-3:lighthouse-reports/desktop-3.json',
  ],
);
assert.throws(() => plan.planRuns({ runs: 3, outputDir: '_site/reports' }), /outside site output/);

const hundred = { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 };
const reports = planned.map((item) => ({ ...item, scores: { ...hundred } }));
const keptLow = reports.map((item) => ({ ...item, scores: { ...item.scores } }));
keptLow[5] = { ...keptLow[5], scores: { ...hundred, seo: 99 } };
const failed = plan.verdict({ strict: true, planned, reports: keptLow });
assert.equal(failed.ok, false);
assert.equal(failed.pageSpeedAcceptance, false);
assert.equal(
  failed.lines.find((line) => line.startsWith('desktop run 3:')),
  'desktop run 3: performance=100 accessibility=100 best-practices=100 seo=99',
);

const one = plan.planRuns({ runs: 1, outputDir: 'lighthouse-reports' });
const diagnostic = plan.verdict({
  strict: false,
  planned: one,
  reports: one.map((item) => ({ ...item, scores: { ...hundred, performance: 90 } })),
});
assert.equal(diagnostic.ok, true, 'One finished audit is diagnostic even when a category is below 100');
assert.equal(diagnostic.pageSpeedAcceptance, false);
assert.ok(
  diagnostic.lines.some((line) => line === 'A Lighthouse run is not the PageSpeed acceptance of three consecutive 100s per device.'),
  'Diagnostic output must not be readable as the user 100 target',
);

const shortStrict = plan.verdict({
  strict: true,
  planned: one,
  reports: one.map((item) => ({ ...item, scores: { ...hundred } })),
});
assert.equal(shortStrict.ok, false, 'Strict 100 needs three retained runs per preset');
assert.equal(shortStrict.pageSpeedAcceptance, false);

const strictPass = plan.verdict({ strict: true, planned, reports });
assert.equal(strictPass.ok, true);
assert.equal(strictPass.pageSpeedAcceptance, false);
assert.ok(strictPass.lines.some((line) => line === 'All retained local runs scored 100. This is not live PageSpeed acceptance.'));

const dropped = plan.verdict({ strict: false, planned, reports: reports.slice(0, 5) });
assert.equal(dropped.ok, false, 'A missing report fails even when strict scoring is off');

assert.deepEqual(
  plan.readCategories({
    categories: {
      performance: { score: 0.99 },
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      seo: { score: 1 },
    },
  }),
  { performance: 99, accessibility: 100, 'best-practices': 100, seo: 100 },
);
assert.throws(() => plan.readCategories({
  categories: {
    performance: { score: 1 },
    accessibility: { score: 1 },
    seo: { score: 1 },
  },
}), /best-practices/);

assert.deepEqual(
  plan.lighthouseInvocation(
    { preset: 'mobile', run: 1, path: 'lighthouse-reports/mobile-1.json' },
    'http://127.0.0.1:9/',
    { bin: { lighthouse: './cli/index.js' } },
  ),
  {
    script: 'node_modules/lighthouse/cli/index.js',
    args: [
      'http://127.0.0.1:9/',
      '--output=json',
      '--output-path=lighthouse-reports/mobile-1.json',
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox',
      '--only-categories=performance,accessibility,best-practices,seo',
    ],
  },
);
assert.ok(
  plan.lighthouseInvocation(
    { preset: 'desktop', run: 1, path: 'lighthouse-reports/desktop-1.json' },
    'http://127.0.0.1:9/',
    { bin: { lighthouse: './cli/index.js' } },
  ).args.includes('--preset=desktop'),
);
assert.equal(plan.resolveChrome({ CHROME_PATH: '/custom/chrome' }, '/playwright/chrome'), '/custom/chrome');
assert.equal(plan.resolveChrome({}, '/playwright/chrome'), '/playwright/chrome');
assert.throws(() => plan.parseArgs(['--strict', '--runs', '1', '--url', 'http://127.0.0.1/']), /three runs/);
assert.throws(() => plan.parseArgs(['--output', '_site', '--url', 'http://127.0.0.1/']), /outside site output/);
assert.throws(() => plan.parseArgs(['--url', 'http://127.0.0.1/', '--serve', '/tmp/site']), /exactly one/);
assert.throws(() => plan.parseArgs(['--min-score', '90', '--url', 'http://127.0.0.1/']), /Unknown argument --min-score/);

const ignored = spawnSync('git', ['check-ignore', '-q', 'lighthouse-reports/mobile-1.json'], { cwd: root });
assert.equal(ignored.status, 0, 'Default Lighthouse reports stay uncommitted');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.test, 'node tests/themes.mjs', 'Browser checks stay independent of Lighthouse');
assert.equal(pkg.scripts.audit, 'node tests/lighthouse-audit.mjs');
let installed = null;
try {
  installed = JSON.parse(readFileSync(join(root, 'node_modules/lighthouse/package.json'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
assert.ok(installed, 'lighthouse is installed from the lockfile');
assert.equal(installed.version, '13.6.0');
assert.equal(pkg.devDependencies.lighthouse, '13.6.0');

const workflow = readFileSync(join(root, '.github/workflows/checks.yml'), 'utf8');
const checksSection = workflow.slice(workflow.indexOf('\n  checks:'), workflow.indexOf('\n  lighthouse:'));
assert.match(checksSection, /\n\s+- run: npm test\n/);
assert.doesNotMatch(checksSection, /npm run audit|lighthouse-audit/);
const runLines = [...workflow.matchAll(/^\s*(?:- )?run:\s*(.+)$/gm)].map((match) => match[1].trim());
const auditRuns = runLines.filter((line) => line.startsWith('npm run audit'));
assert.deepEqual(auditRuns, ['npm run audit -- --serve "$RUNNER_TEMP/site"']);
assert.match(workflow, /node tests\/lighthouse-contract\.mjs/);
assert.match(
  workflow,
  /eslint assets\/theme\.js tests\/themes\.mjs tests\/lighthouse-contract\.mjs tests\/lighthouse-plan\.mjs tests\/lighthouse-audit\.mjs/,
);
assert.match(workflow, /path: lighthouse-reports\n/);
assert.match(workflow, /JEKYLL_GITHUB_TOKEN/);

let audit = {};
try {
  audit = await import('./lighthouse-audit.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
assert.equal(typeof audit.runAudit, 'function', 'runAudit writes both presets and reads their reports');
assert.equal(typeof audit.startStaticServer, 'function', 'startStaticServer hosts a built site for the audit');

const outputDir = mkdtempSync(join(tmpdir(), 'lh-reports-'));
const calls = [];
let active = 0;
let maxActive = 0;
const diagnosticRun = await audit.runAudit(
  { url: 'http://127.0.0.1:9/', runs: 1, strict: false, outputDir },
  {
    root,
    chromePath: '/custom/chrome',
    spawn: async (_executable, args, options) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      active -= 1;
      calls.push(args);
      assert.equal(options.env.CHROME_PATH, '/custom/chrome');
      const outputPath = args.find((arg) => arg.startsWith('--output-path=')).slice('--output-path='.length);
      const preset = outputPath.includes('desktop') ? 'desktop' : 'mobile';
      writeFileSync(
        outputPath,
        JSON.stringify({
          categories: {
            performance: { score: preset === 'mobile' ? 0.9 : 1 },
            accessibility: { score: 1 },
            'best-practices': { score: 1 },
            seo: { score: 1 },
          },
        }),
      );
      return { status: 0 };
    },
  },
);
assert.equal(maxActive, 1, 'Presets run one at a time');
assert.equal(diagnosticRun.ok, true);
assert.equal(diagnosticRun.pageSpeedAcceptance, false);
assert.equal(calls[0].includes('--preset=desktop'), false);
assert.equal(calls[1].includes('--preset=desktop'), true);
assert.equal(existsSync(join(outputDir, 'mobile-1.json')), true);
assert.equal(existsSync(join(outputDir, 'desktop-1.json')), true);
assert.ok(diagnosticRun.lines.some((line) => line.includes('performance=90')));

const missingCategory = mkdtempSync(join(tmpdir(), 'lh-missing-'));
await assert.rejects(
  () => audit.runAudit(
    { url: 'http://127.0.0.1:9/', runs: 1, strict: false, outputDir: missingCategory },
    {
      root,
      chromePath: '/custom/chrome',
      spawn: (_executable, args) => {
        const outputPath = args.find((arg) => arg.startsWith('--output-path=')).slice('--output-path='.length);
        writeFileSync(outputPath, JSON.stringify({
          categories: {
            performance: { score: 1 },
            accessibility: { score: 1 },
            seo: { score: 1 },
          },
        }));
        return { status: 0 };
      },
    },
  ),
  /best-practices/,
);

const rootDir = mkdtempSync(join(tmpdir(), 'lh-root-'));
const outside = join(tmpdir(), `lh-secret-${process.pid}.txt`);
writeFileSync(outside, 'secret');
writeFileSync(join(rootDir, 'index.html'), 'home');
writeFileSync(join(rootDir, 'photo.jpg'), 'jpeg-bytes');
const server = await audit.startStaticServer(rootDir);
try {
  const home = await fetch(`${server.url}/`);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(await home.text(), 'home');
  const photo = await fetch(`${server.url}/photo.jpg`);
  assert.equal(photo.headers.get('content-type'), 'image/jpeg');
  const escaped = await new Promise((resolvePromise, reject) => {
    const target = new URL(server.url);
    const req = httpRequest({ hostname: target.hostname, port: target.port, path: `/../${outside.split('/').pop()}` }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolvePromise({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
  assert.notEqual(escaped.status, 200);
  assert.notEqual(escaped.body, 'secret');
} finally {
  await server.close();
  rmSync(rootDir, { recursive: true, force: true });
  rmSync(outside, { force: true });
}

const cli = spawnSync(process.execPath, [join(root, 'tests/lighthouse-audit.mjs'), '--min-score', '90', '--url', 'http://127.0.0.1/'], { encoding: 'utf8' });
assert.notEqual(cli.status, 0);
assert.match(`${cli.stdout}${cli.stderr}`, /Unknown argument --min-score/);
const strictCli = spawnSync(process.execPath, [join(root, 'tests/lighthouse-audit.mjs'), '--strict', '--runs', '1', '--url', 'http://127.0.0.1/'], { encoding: 'utf8' });
assert.notEqual(strictCli.status, 0);
assert.match(`${strictCli.stdout}${strictCli.stderr}`, /three runs/);

assert.equal(typeof audit.spawnAndWait, 'function', 'Lighthouse runs without blocking the static server');
const served = mkdtempSync(join(tmpdir(), 'lh-serve-'));
writeFileSync(join(served, 'index.html'), 'home');
const live = await audit.startStaticServer(served);
try {
  const child = await audit.spawnAndWait(process.execPath, ['--input-type=module', '-e', `
    const response = await fetch(${JSON.stringify(`${live.url}/`)}, { signal: AbortSignal.timeout(1000) });
    if ((await response.text()) !== 'home') process.exit(2);
  `], { stdio: 'ignore' });
  assert.equal(child.status, 0, 'The static server answers while the audit process is running');
} finally {
  await live.close();
  rmSync(served, { recursive: true, force: true });
}

console.log('PASS lighthouse audit contract');
