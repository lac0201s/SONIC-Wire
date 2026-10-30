import { createHash } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { downloadToStorage } from './download.js';
import { createTestContext, closeTestContext, type TestContext } from '../../test/helpers.js';

const WAV_BYTES = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(2044, 7)]);
const WAV_SHA = createHash('sha256').update(WAV_BYTES).digest('hex');

interface Route {
  status?: number;
  headers?: Record<string, string>;
  body?: Buffer | string;
  hang?: boolean;
}

let server: http.Server;
let base = '';
let routes: Record<string, Route> = {};
let context: TestContext;
const previousAllowPrivate = config.ALLOW_PRIVATE_NETWORK;

beforeAll(async () => {
  // The fixture server lives on loopback, which the guard blocks by policy.
  // The opt-in flag is the same one operators use for a trusted LAN mirror.
  config.ALLOW_PRIVATE_NETWORK = true;

  server = http.createServer((request, response) => {
    const route = routes[request.url ?? '/'] ?? { status: 404, body: 'missing' };
    if (route.hang) {
      response.writeHead(200, { 'content-type': 'audio/wav' });
      response.write(WAV_BYTES.subarray(0, 8));
      return; // never ends: exercises the abort path
    }
    response.writeHead(route.status ?? 200, {
      'content-type': 'audio/wav',
      'content-length': String(route.body ? Buffer.byteLength(route.body) : 0),
      ...route.headers,
    });
    response.end(route.body ?? WAV_BYTES);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  context = await createTestContext();
});

afterAll(async () => {
  await closeTestContext(context);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  config.ALLOW_PRIVATE_NETWORK = previousAllowPrivate;
});

afterEach(() => {
  routes = {};
});

const download = (path: string, overrides: { maxBytes?: number; signal?: AbortSignal } = {}) =>
  downloadToStorage({
    url: `${base}${path}`,
    storage: context.storage,
    maxBytes: overrides.maxBytes ?? 1024 * 1024,
    maxSeconds: 10,
    signal: overrides.signal,
  });

describe('downloadToStorage', () => {
  it('streams a media file to quarantine and hashes it', async () => {
    routes['/clip.wav'] = { body: WAV_BYTES };
    const result = await download('/clip.wav');
    expect(result.bytes).toBe(WAV_BYTES.length);
    expect(result.sha256).toBe(WAV_SHA);
    expect(result.contentType).toBe('audio/wav');
    expect(result.extension).toBe('.wav');
    expect(result.finalUrl).toBe(`${base}/clip.wav`);
  });

  it('follows redirects and re-validates the new target', async () => {
    routes['/go'] = { status: 302, headers: { location: '/clip.wav' }, body: '' };
    routes['/clip.wav'] = { body: WAV_BYTES };
    const result = await download('/go');
    expect(result.sha256).toBe(WAV_SHA);
  });

  it('refuses a redirect loop instead of spinning', async () => {
    routes['/loop'] = { status: 302, headers: { location: '/loop' }, body: '' };
    await expect(download('/loop')).rejects.toThrow(/redirect/i);
  });

  it('rejects non-media payloads', async () => {
    routes['/page.html'] = {
      body: '<html>watch here</html>',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    };
    await expect(download('/page.html')).rejects.toMatchObject({ code: 'unsupported_media' });
  });

  it('rejects files above the configured cap before streaming', async () => {
    routes['/big.wav'] = { body: Buffer.alloc(4096, 1) };
    await expect(download('/big.wav', { maxBytes: 1024 })).rejects.toMatchObject({
      code: 'payload_too_large',
    });
  });

  it('surfaces upstream 4xx as an explicit error', async () => {
    routes['/gone.wav'] = { status: 410, body: 'gone' };
    await expect(download('/gone.wav')).rejects.toMatchObject({ code: 'upstream_failed' });
    routes['/private.wav'] = { status: 403, body: 'no' };
    await expect(download('/private.wav')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('cancels a stalled transfer when the signal aborts', async () => {
    routes['/hang.wav'] = { hang: true };
    const controller = new AbortController();
    const pending = download('/hang.wav', { signal: controller.signal });
    setTimeout(() => controller.abort(), 120);
    await expect(pending).rejects.toMatchObject({ code: 'conflict' });
  });

  it('refuses loopback once the private-network opt-in is off', async () => {
    config.ALLOW_PRIVATE_NETWORK = false;
    try {
      routes['/clip.wav'] = { body: WAV_BYTES };
      await expect(download('/clip.wav')).rejects.toMatchObject({ code: 'forbidden' });
    } finally {
      config.ALLOW_PRIVATE_NETWORK = true;
    }
  });
});
