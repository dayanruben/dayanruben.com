import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  lighthouseInvocation,
  parseArgs,
  planRuns,
  readCategories,
  resolveChrome,
  verdict,
} from './lighthouse-plan.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function startStaticServer(rootDir) {
  const root = resolve(rootDir);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 400);
      res.end();
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((closePromise) => server.close(() => closePromise())),
      });
    });
  });
}

export function spawnAndWait(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, options);
    child.on('error', reject);
    child.on('close', (status) => resolvePromise({ status }));
  });
}

export async function runAudit(options, dependencies) {
  const spawnAudit = dependencies.spawn ?? spawnAndWait;
  let server;
  let url = options.url;
  if (options.serve) {
    server = await startStaticServer(options.serve);
    url = `${server.url}/`;
  }
  const planned = planRuns({ runs: options.runs, outputDir: options.outputDir });
  mkdirSync(options.outputDir, { recursive: true });
  const packageJson = JSON.parse(readFileSync(join(dependencies.root, 'node_modules/lighthouse/package.json'), 'utf8'));
  const reports = [];
  try {
    for (const entry of planned) {
      const invocation = lighthouseInvocation(entry, url, packageJson);
      const result = await Promise.resolve(spawnAudit(
        process.execPath,
        [join(dependencies.root, invocation.script), ...invocation.args],
        { env: { ...process.env, CHROME_PATH: dependencies.chromePath }, stdio: 'inherit' },
      ));
      if (result.status !== 0) {
        throw new Error(`Lighthouse ${entry.preset} run ${entry.run} exited ${result.status}`);
      }
      reports.push({ ...entry, scores: readCategories(JSON.parse(readFileSync(entry.path, 'utf8'))) });
    }
  } finally {
    if (server) await server.close();
  }
  const outcome = verdict({ strict: options.strict, planned, reports });
  for (const line of outcome.lines) console.log(line);
  return outcome;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { chromium } = await import('playwright');
    const root = resolve(import.meta.dirname, '..');
    const outcome = await runAudit(options, {
      root,
      chromePath: resolveChrome(process.env, chromium.executablePath()),
    });
    process.exit(outcome.ok ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
