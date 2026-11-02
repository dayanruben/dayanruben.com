import { join } from 'node:path';

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

export function assertReportDir(dir) {
  const parts = String(dir).replaceAll('\\', '/').split('/');
  if (parts.includes('_site')) {
    throw new Error('Lighthouse reports must stay outside site output');
  }
}

export function planRuns({ runs = 1, outputDir = 'lighthouse-reports' } = {}) {
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error('runs must be a positive integer');
  }
  assertReportDir(outputDir);
  const planned = [];
  for (const preset of ['mobile', 'desktop']) {
    for (let run = 1; run <= runs; run += 1) {
      planned.push({ preset, run, path: join(outputDir, `${preset}-${run}.json`) });
    }
  }
  return planned;
}

export function readCategories(report) {
  const categories = report?.categories ?? {};
  const scores = {};
  for (const id of CATEGORIES) {
    const score = categories[id]?.score;
    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new Error(`Lighthouse report has a missing or invalid ${id} score`);
    }
    scores[id] = Math.round(score * 100);
  }
  return scores;
}

function scoreLine(report) {
  const scores = CATEGORIES.map((id) => `${id}=${report.scores[id]}`).join(' ');
  return `${report.preset} run ${report.run}: ${scores}`;
}

export function verdict({ strict, planned, reports }) {
  const lines = reports.map(scoreLine);
  const retained = reports.length === planned.length && planned.every((item, index) => {
    const report = reports[index];
    return report?.preset === item.preset && report?.run === item.run && report?.path === item.path;
  });
  if (!retained) {
    lines.push('A planned Lighthouse report is missing. Every run is retained.');
    return { ok: false, pageSpeedAcceptance: false, lines };
  }
  if (!strict) {
    lines.push('A Lighthouse run is not the PageSpeed acceptance of three consecutive 100s per device.');
    return { ok: true, pageSpeedAcceptance: false, lines };
  }
  const counts = { mobile: 0, desktop: 0 };
  let allHundred = true;
  for (const report of reports) {
    counts[report.preset] += 1;
    for (const id of CATEGORIES) {
      if (report.scores[id] !== 100) allHundred = false;
    }
  }
  if (counts.mobile < 3 || counts.desktop < 3 || !allHundred) {
    lines.push('Strict check failed. Every retained run on both presets must score 100 in all four categories, with at least three runs per preset.');
    return { ok: false, pageSpeedAcceptance: false, lines };
  }
  lines.push('All retained local runs scored 100. This is not live PageSpeed acceptance.');
  return { ok: true, pageSpeedAcceptance: false, lines };
}

export function lighthouseInvocation(entry, url, packageJson) {
  const binField = packageJson.bin;
  const relative = typeof binField === 'string' ? binField : binField?.lighthouse;
  if (typeof relative !== 'string') {
    throw new Error('Pinned Lighthouse did not expose a JavaScript CLI');
  }
  const args = [
    url,
    '--output=json',
    `--output-path=${entry.path}`,
    '--quiet',
    '--chrome-flags=--headless=new --no-sandbox',
    '--only-categories=performance,accessibility,best-practices,seo',
  ];
  if (entry.preset === 'desktop') args.push('--preset=desktop');
  return { script: join('node_modules/lighthouse', relative.replace(/^\.\//, '')), args };
}

export function resolveChrome(env, executablePath) {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  if (!executablePath) throw new Error('Chrome is required for Lighthouse');
  return executablePath;
}

export function parseArgs(argv) {
  const options = { runs: 1, strict: false, outputDir: 'lighthouse-reports' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--strict') options.strict = true;
    else if (arg === '--runs') options.runs = Number(argv[++index]);
    else if (arg === '--url') options.url = argv[++index];
    else if (arg === '--serve') options.serve = argv[++index];
    else if (arg === '--output') options.outputDir = argv[++index];
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (Boolean(options.url) === Boolean(options.serve)) {
    throw new Error('Pass exactly one of --url or --serve');
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error('runs must be a positive integer');
  }
  if (options.strict && options.runs < 3) {
    throw new Error('Strict 100 checks need at least three runs per preset');
  }
  assertReportDir(options.outputDir);
  return options;
}
