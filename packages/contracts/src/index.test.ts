import { describe, expect, it } from 'vitest';
import {
  API_VERSION,
  AssetKindSchema,
  AssetQuerySchema,
  ERROR_CODES,
  IngestUrlSchema,
  JobKindSchema,
  PaginatedAssetsSchema,
  ProviderSchema,
  TransformPresetIdSchema,
  TransformRequestSchema,
  UrlIngestReceiptSchema,
  WorkflowStepSchema,
  ApiErrorSchema,
} from './index';

describe('api envelope', () => {
  it('versions the surface', () => {
    expect(API_VERSION).toBe('v1');
  });

  it('rejects an error payload without a known code', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'nope', message: 'x' } }).success).toBe(false);
    expect(ApiErrorSchema.safeParse({ error: { code: ERROR_CODES[0], message: 'x' } }).success).toBe(
      true,
    );
  });
});

describe('asset query', () => {
  it('applies defaults and coerces numeric limits from query strings', () => {
    const parsed = AssetQuerySchema.parse({});
    expect(parsed.limit).toBe(40);
    expect(parsed.sort).toBe('recent');
    expect(AssetQuerySchema.parse({ limit: '12' }).limit).toBe(12);
  });

  it('clamps limits outside 1..100 and rejects unknown kinds', () => {
    expect(AssetQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(AssetQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(AssetQuerySchema.safeParse({ kind: 'hologram' }).success).toBe(false);
    expect(AssetKindSchema.options).toEqual(['audio', 'video', 'image', 'unknown']);
  });

  it('keeps pagination contract typed', () => {
    const shape = PaginatedAssetsSchema.parse({ items: [], nextCursor: null, total: 0 });
    expect(shape.total).toBe(0);
    expect(shape.nextCursor).toBeNull();
  });
});

describe('transform requests', () => {
  it('only allows registered presets', () => {
    expect(TransformPresetIdSchema.safeParse('audio.mp3.192').success).toBe(true);
    expect(TransformPresetIdSchema.safeParse('audio.mp3.999').success).toBe(false);
  });

  it('requires trim bounds to be ordered and positive', () => {
    expect(TransformRequestSchema.safeParse({ presetId: 'audio.mp3.192' }).success).toBe(true);
    expect(
      TransformRequestSchema.safeParse({
        presetId: 'audio.mp3.192',
        trim: { startMs: 0, endMs: 1 },
      }).success,
    ).toBe(true);
    expect(
      TransformRequestSchema.safeParse({
        presetId: 'audio.mp3.192',
        trim: { startMs: -1, endMs: 10 },
      }).success,
    ).toBe(false);
  });
});

describe('url ingest', () => {
  it('accepts http(s) and refuses other schemes', () => {
    expect(IngestUrlSchema.safeParse({ url: 'https://example.org/clip.mp3' }).success).toBe(true);
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,<b>x</b>', 'not a url']) {
      expect(IngestUrlSchema.safeParse({ url }).success, url).toBe(false);
    }
  });

  it('receipts carry the provider decision', () => {
    expect(
      UrlIngestReceiptSchema.parse({
        jobId: 'job_1',
        acceptedUrl: 'https://example.org/a.mp3',
        providerId: null,
        note: null,
      }).providerId,
    ).toBeNull();
  });
});

describe('jobs and workflows', () => {
  it('exposes the job vocabulary used by the queue', () => {
    expect(JobKindSchema.options).toContain('media.probe');
    expect(JobKindSchema.options).toContain('media.export');
  });

  it('rejects unknown workflow step types', () => {
    const step = { id: 's1', type: 'transform', label: 'MP3', config: { presetId: 'audio.mp3.192' } };
    expect(WorkflowStepSchema.safeParse(step).success).toBe(true);
    expect(WorkflowStepSchema.safeParse({ ...step, type: 'teleport' }).success).toBe(false);
    expect(WorkflowStepSchema.parse({ id: 's2', type: 'probe', label: 'p' }).config).toEqual({});
  });
});

describe('provider catalogue', () => {
  it('declares capability and restriction fields for every entry', () => {
    const provider = {
      id: 'internet-archive',
      name: 'Internet Archive',
      category: 'archive',
      auth: 'none',
      capabilities: {
        metadata: 'official-api',
        search: 'official-api',
        publish: 'none',
        analytics: 'none',
        scheduling: 'none',
      },
      ingestion: 'direct-media',
      restrictions: [],
      connectionStatus: 'available',
      docsUrl: 'https://archive.org/developers/',
      lastChecked: new Date().toISOString(),
    };
    expect(ProviderSchema.safeParse(provider).success).toBe(true);
    expect(
      ProviderSchema.safeParse({ ...provider, capabilities: { ...provider.capabilities, search: 'scrape' } })
        .success,
    ).toBe(false);
  });
});
