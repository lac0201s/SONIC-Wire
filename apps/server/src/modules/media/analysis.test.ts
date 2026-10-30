import { afterEach, describe, expect, it } from 'vitest';
import { queryOne } from '../../db/index.js';
import { analyzeWithCore, MediaCoreError, mediaCoreState } from './analysis-client.js';
import { createAsset } from '../library/repository.js';
import {
  authHeaders,
  bootstrapOwner,
  closeTestContext,
  createTestContext,
  type TestContext,
} from '../../test/helpers.js';

let context: TestContext | null = null;

afterEach(async () => {
  if (context) await closeTestContext(context);
  context = null;
});

async function setup() {
  context = await createTestContext();
  const auth = await bootstrapOwner(context);
  const workspace = queryOne<{ id: string }>(context.db, 'SELECT id FROM workspaces LIMIT 1');
  const assetId = createAsset(context.db, {
    workspaceId: workspace!.id,
    title: 'Analysis fixture',
    kind: 'audio',
    status: 'ready',
    mimeType: 'audio/wav',
    sizeBytes: 1024,
    sha256: 'a'.repeat(64),
    storagePath: `${context.dir}/fixture.wav`,
    sourceKind: 'upload',
    sourceUrl: null,
    createdBy: null,
  });
  return { auth, assetId, workspaceId: workspace!.id };
}

describe('media-core client', () => {
  it('reports itself as unconfigured when MEDIA_CORE_URL is unset', async () => {
    const state = await mediaCoreState();
    expect(state.configured).toBe(false);
    expect(state.detail).toContain('MEDIA_CORE_URL');
  });

  it('refuses to fabricate a report when the service is absent', async () => {
    await expect(analyzeWithCore('/tmp/anything.wav', { includePeaks: false })).rejects.toBeInstanceOf(
      MediaCoreError,
    );
    await expect(analyzeWithCore('/tmp/anything.wav', { includePeaks: false })).rejects.toMatchObject({
      code: 'core_unavailable',
    });
  });
});

describe('analysis routes', () => {
  it('requires authentication', async () => {
    context = await createTestContext();
    const response = await context.app.inject({ method: 'GET', url: '/api/assets/x/analysis' });
    expect(response.statusCode).toBe(401);
  });

  it('returns the stored state plus the service state, not a fake report', async () => {
    const { auth, assetId } = await setup();
    const response = await context!.app.inject({
      method: 'GET',
      url: `/api/assets/${assetId}/analysis`,
      headers: authHeaders(auth),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { analysis: unknown; core: { configured: boolean } };
    expect(body.analysis).toBeNull();
    expect(body.core.configured).toBe(false);
  });

  it('answers 503 with a reason instead of queueing work that cannot run', async () => {
    const { auth, assetId } = await setup();
    const response = await context!.app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/analyze`,
      headers: authHeaders(auth),
      payload: { includePeaks: true },
    });
    expect(response.statusCode).toBe(503);
    const body = response.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('provider_unavailable');
    expect(body.error.message).toMatch(/media-core/i);
  });

  it('reports analysis as unavailable in capabilities rather than omitting it', async () => {
    const { auth } = await setup();
    const response = await context!.app.inject({
      method: 'GET',
      url: '/api/system/capabilities',
      headers: authHeaders(auth),
    });
    const body = response.json() as { analysis: { available: boolean; detail: string } };
    expect(body.analysis.available).toBe(false);
    expect(body.analysis.detail.length).toBeGreaterThan(0);
  });

  it('lists media-core in the health checks', async () => {
    context = await createTestContext();
    const response = await context.app.inject({ method: 'GET', url: '/api/health' });
    const body = response.json() as { checks: Record<string, { ok: boolean; detail: string }> };
    expect(body.checks.mediaCore).toBeDefined();
    expect(body.checks.mediaCore!.ok).toBe(false);
  });
});
