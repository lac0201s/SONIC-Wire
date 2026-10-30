import fsp from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../config.js';
import { ffmpeg, toolchain } from '../modules/media/ffmpeg.js';
import { authHeaders, bootstrapOwner, closeTestContext, createTestContext, type AuthCookie, type TestContext } from '../test/helpers.js';

let context: TestContext;
let auth: AuthCookie;
let ffmpegAvailable = false;
let videoFixture: string;

function multipartBody(fileName: string, mime: string, content: Buffer, fields: Record<string, string> = {}) {
  const boundary = `----sonicwiretest${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function waitForAssetReady(assetId: string, timeoutMs = 30_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await context.app.inject({
      method: 'GET',
      url: `/api/assets/${assetId}`,
      headers: { cookie: auth.cookie },
    });
    if (response.statusCode === 200) {
      const asset = response.json() as { status: string };
      if (asset.status === 'ready' || asset.status === 'error' || asset.status === 'missing') return asset as Record<string, unknown>;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Asset never finished probing');
}

beforeAll(async () => {
  context = await createTestContext();
  context.queue.start();
  const tools = await toolchain();
  ffmpegAvailable = tools.available;
  const dir = context.dir;
  videoFixture = path.join(dir, 'fixture.mp4');
  if (ffmpegAvailable) {
    const result = await ffmpeg([
      '-hide_banner', '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=25:duration=1.5',
      '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1.5',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '96k', '-shortest', videoFixture,
    ]);
    if (result.code !== 0) ffmpegAvailable = false;
  }
});

afterAll(async () => {
  await closeTestContext(context);
});

describe('authentication and authorisation', () => {
  it('reports first-run state before initialisation', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/auth/session' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ needsSetup: true, user: null });
  });

  it('blocks unauthenticated API access', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/assets' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('unauthorized');
  });

  it('serves the public provider catalogue without a session', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/providers' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string; connectionStatus: string }> };
    expect(body.items.length).toBeGreaterThan(5);
    expect(body.items.every((item) => item.connectionStatus === 'not_configured' || item.connectionStatus === 'available')).toBe(true);
  });

  it('creates the owner and returns a session', async () => {
    auth = await bootstrapOwner(context);
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: auth.cookie },
    });
    const body = response.json();
    expect(body.needsSetup).toBe(false);
    expect(body.user.email).toBe('owner@test.local');
    expect(body.workspace.role).toBe('owner');
    expect(body.csrfToken).toBe(auth.csrf);
  });

  it('rejects a second bootstrap attempt', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: {
        email: 'other@test.local',
        password: 'another-long-password',
        displayName: 'Other',
        workspaceName: 'Other',
      },
    });
    expect(response.statusCode).toBe(409);
  });

  it('enforces CSRF tokens on mutations', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: auth.cookie },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toMatch(/csrf/i);
  });

  it('signs in with valid credentials and rejects bad ones', async () => {
    const login = await context.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@test.local', password: 'correct-horse-battery' },
    });
    expect(login.statusCode).toBe(200);
    const wrong = await context.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@test.local', password: 'definitely-wrong' },
    });
    expect(wrong.statusCode).toBe(401);
  });

  it('validates request payloads at the boundary', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/acquisition/url',
      headers: authHeaders(auth),
      payload: { url: 'not-a-url' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
  });
});

describe('acquisition policy', () => {
  it('refuses loopback and metadata addresses synchronously', async () => {
    for (const url of [
      'http://127.0.0.1:8787/api/health',
      'http://169.254.169.254/latest/meta-data',
      'http://localhost/secret.mp3',
    ]) {
      const response = await context.app.inject({
        method: 'POST',
        url: '/api/acquisition/url',
        headers: authHeaders(auth),
        payload: { url },
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it('refuses providers with no download API', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/acquisition/url',
      headers: authHeaders(auth),
      payload: { url: 'https://www.youtube.com/watch?v=abc123' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('provider_not_configured');
    expect(response.json().error.message).toMatch(/does not offer a public download API/i);
  });
});

describe('media pipeline over HTTP', () => {
  it('uploads, probes, streams and derives media end to end', async () => {
    if (!ffmpegAvailable) return;
    const content = await fsp.readFile(videoFixture);
    const { body, contentType } = multipartBody('fixture.mp4', 'video/mp4', content, {
      tags: 'fixture,integration',
    });
    const upload = await context.app.inject({
      method: 'POST',
      url: '/api/acquisition/upload',
      headers: { ...authHeaders(auth), 'content-type': contentType },
      payload: body,
    });
    expect(upload.statusCode).toBe(201);
    const uploaded = upload.json() as { assetId: string; jobId: string; bytes: number };
    expect(uploaded.bytes).toBe(content.length);

    const asset = await waitForAssetReady(uploaded.assetId);
    expect(asset.status).toBe('ready');
    expect(asset.kind).toBe('video');
    expect(asset.videoCodec).toBe('h264');
    expect(asset.hasThumbnail).toBe(true);
    expect(asset.hasWaveform).toBe(true);
    expect((asset.tags as string[]).sort()).toEqual(['fixture', 'integration']);

    const thumbnail = await context.app.inject({
      method: 'GET',
      url: `/api/assets/${uploaded.assetId}/thumbnail`,
      headers: { cookie: auth.cookie },
    });
    expect(thumbnail.statusCode).toBe(200);
    expect(thumbnail.headers['content-type']).toBe('image/jpeg');

    const stream = await context.app.inject({
      method: 'GET',
      url: `/api/assets/${uploaded.assetId}/stream`,
      headers: { cookie: auth.cookie, range: 'bytes=0-255' },
    });
    expect(stream.statusCode).toBe(206);
    expect(stream.headers['content-range']).toMatch(/^bytes 0-255\//);
    expect(stream.rawPayload.length).toBe(256);

    const invalidRange = await context.app.inject({
      method: 'GET',
      url: `/api/assets/${uploaded.assetId}/stream`,
      headers: { cookie: auth.cookie, range: 'bytes=999999999-' },
    });
    expect(invalidRange.statusCode).toBe(416);

    const transform = await context.app.inject({
      method: 'POST',
      url: `/api/assets/${uploaded.assetId}/transform`,
      headers: authHeaders(auth),
      payload: { presetId: 'audio.mp3.192' },
    });
    expect(transform.statusCode).toBe(202);
    const jobId = (transform.json() as { jobId: string }).jobId;

    const deadline = Date.now() + 40_000;
    let derivedReady = false;
    while (Date.now() < deadline && !derivedReady) {
      const derivatives = await context.app.inject({
        method: 'GET',
        url: `/api/assets/${uploaded.assetId}/derivatives`,
        headers: { cookie: auth.cookie },
      });
      const items = (derivatives.json() as { items: Array<{ status: string; kind: string }> }).items;
      derivedReady = items.some((item) => item.status === 'ready' && item.kind === 'audio');
      if (!derivedReady) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(derivedReady).toBe(true);

    const job = await context.app.inject({
      method: 'GET',
      url: `/api/jobs/${jobId}`,
      headers: { cookie: auth.cookie },
    });
    expect((job.json() as { status: string }).status).toBe('succeeded');
  });

  it('deduplicates identical uploads by content hash', async () => {
    if (!ffmpegAvailable) return;
    const content = await fsp.readFile(videoFixture);
    const { body, contentType } = multipartBody('copy.mp4', 'video/mp4', content);
    const upload = await context.app.inject({
      method: 'POST',
      url: '/api/acquisition/upload',
      headers: { ...authHeaders(auth), 'content-type': contentType },
      payload: body,
    });
    expect(upload.statusCode).toBe(200);
    expect((upload.json() as { duplicate: boolean }).duplicate).toBe(true);
  });

  it('rejects non-media uploads', async () => {
    const { body, contentType } = multipartBody('notes.txt', 'text/plain', Buffer.from('hello'));
    const upload = await context.app.inject({
      method: 'POST',
      url: '/api/acquisition/upload',
      headers: { ...authHeaders(auth), 'content-type': contentType },
      payload: body,
    });
    expect(upload.statusCode).toBe(415);
  });

  it('filters and paginates the library', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/assets?kind=video&limit=1',
      headers: { cookie: auth.cookie },
    });
    expect(response.statusCode).toBe(200);
    const page = response.json() as { items: unknown[]; total: number };
    expect(page.items.length).toBe(1);
    expect(page.total).toBeGreaterThanOrEqual(1);

    const tagged = await context.app.inject({
      method: 'GET',
      url: '/api/assets?tag=fixture',
      headers: { cookie: auth.cookie },
    });
    expect(tagged.statusCode).toBe(200);
    expect((tagged.json() as { items: unknown[] }).items.length).toBeGreaterThanOrEqual(1);

    const search = await context.app.inject({
      method: 'GET',
      url: '/api/assets?q=fixture',
      headers: { cookie: auth.cookie },
    });
    expect(search.statusCode).toBe(200);

    const injectionAttempt = await context.app.inject({
      method: 'GET',
      url: "/api/assets?q=' OR 1=1 --",
      headers: { cookie: auth.cookie },
    });
    expect(injectionAttempt.statusCode).toBe(200);
    expect((injectionAttempt.json() as { items: unknown[] }).items.length).toBe(0);
  });

  it('collects observatory telemetry with measured values', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/observatory/summary',
      headers: { cookie: auth.cookie },
    });
    expect(response.statusCode).toBe(200);
    const summary = response.json();
    expect(summary.runtime.nodeVersion).toContain('v');
    expect(summary.storage.assetCount).toBeGreaterThan(0);
    expect(summary.queue.succeeded24h).toBeGreaterThan(0);
    expect(summary.latency.probeP50Ms).not.toBeNull();
  });

  it('exports a bundle and serves the artifact from the export directory', async () => {
    const list = await context.app.inject({
      method: 'GET',
      url: '/api/assets?kind=audio&limit=5',
      headers: { cookie: auth.cookie },
    });
    const ids = (list.json() as { items: Array<{ id: string }> }).items.map((item) => item.id);
    expect(ids.length).toBeGreaterThan(0);

    const request = await context.app.inject({
      method: 'POST',
      url: '/api/exports',
      headers: authHeaders(auth),
      payload: { assetIds: ids },
    });
    expect(request.statusCode).toBe(202);
    const jobId = (request.json() as { jobId: string }).jobId;

    const deadline = Date.now() + 20_000;
    let succeeded = false;
    while (Date.now() < deadline && !succeeded) {
      const job = await context.app.inject({
        method: 'GET',
        url: `/api/jobs/${jobId}`,
        headers: { cookie: auth.cookie },
      });
      succeeded = (job.json() as { status: string }).status === 'succeeded';
      if (!succeeded) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(succeeded).toBe(true);

    const download = await context.app.inject({
      method: 'GET',
      url: `/api/exports/${jobId}/download`,
      headers: { cookie: auth.cookie },
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('application/zip');
    expect(download.rawPayload.subarray(0, 2).toString()).toBe('PK');
  });

  it('creates and runs a workflow with per-step results', async () => {
    const create = await context.app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: authHeaders(auth),
      payload: {
        name: 'Integration flow',
        description: 'probe then tag',
        steps: [
          { type: 'probe', label: 'Refresh metadata', config: {} },
          { type: 'tag', label: 'Tag it', config: { tags: ['workflow-ran'] } },
        ],
      },
    });
    expect(create.statusCode).toBe(201);
    const workflow = create.json() as { id: string };

    const assets = await context.app.inject({
      method: 'GET',
      url: '/api/assets?limit=1',
      headers: { cookie: auth.cookie },
    });
    const assetId = (assets.json() as { items: Array<{ id: string }> }).items[0]!.id;

    const run = await context.app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      headers: authHeaders(auth),
      payload: { assetId },
    });
    expect(run.statusCode).toBe(202);
    const { runId } = run.json() as { runId: string };

    const deadline = Date.now() + 30_000;
    let status = 'queued';
    while (Date.now() < deadline && status !== 'succeeded' && status !== 'failed') {
      const state = await context.app.inject({
        method: 'GET',
        url: `/api/workflow-runs/${runId}`,
        headers: { cookie: auth.cookie },
      });
      status = (state.json() as { status: string }).status;
      if (status === 'queued' || status === 'running') await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(status).toBe('succeeded');

    const runs = await context.app.inject({
      method: 'GET',
      url: `/api/workflows/${workflow.id}/runs`,
      headers: { cookie: auth.cookie },
    });
    const first = (runs.json() as { items: Array<{ stepResults: Array<{ status: string }> }> }).items[0]!;
    expect(first.stepResults.every((step) => step.status === 'succeeded')).toBe(true);
  });

  it('exposes system capabilities and refuses unconfigured providers', async () => {
    const capabilities = await context.app.inject({
      method: 'GET',
      url: '/api/system/capabilities',
      headers: { cookie: auth.cookie },
    });
    expect(capabilities.statusCode).toBe(200);
    const body = capabilities.json() as { transforms: unknown[]; limits: { maxUploadBytes: number } };
    expect(body.transforms.length).toBeGreaterThan(5);
    expect(body.limits.maxUploadBytes).toBeGreaterThan(0);

    const connect = await context.app.inject({
      method: 'POST',
      url: '/api/providers/youtube/connect',
      headers: authHeaders(auth),
    });
    expect(connect.statusCode).toBe(409);
    expect(connect.json().error.code).toBe('provider_not_configured');
  });

  it('keeps health public and reports subsystem state', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; checks: Record<string, { ok: boolean }> };
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.checks.database?.ok).toBe(true);
  });
});
