#!/usr/bin/env node
/**
 * Production entry point for a single-machine SonicWire instance.
 *
 * It starts the compiled API and, when the web bundle exists, points the API at
 * it so one process serves both the marketing site and the console. Paths are
 * resolved from this file rather than the shell so the command works the same
 * way from any directory and on any OS.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(root, 'apps', 'server', 'dist', 'index.js');
const webDist = path.join(root, 'apps', 'web', 'dist');

if (!existsSync(serverEntry)) {
  console.error(
    `Missing ${path.relative(root, serverEntry)}. Run \`npm run build\` before \`npm start\`.`,
  );
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'production',
  DATA_DIR: process.env.DATA_DIR ?? path.join(root, 'apps', 'server', 'var'),
};

if (!process.env.WEB_DIST_DIR && existsSync(path.join(webDist, 'index.html'))) {
  env.WEB_DIST_DIR = webDist;
}

const child = spawn(process.execPath, ['--experimental-sqlite', serverEntry], {
  cwd: path.join(root, 'apps', 'server'),
  env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
