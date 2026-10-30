/**
 * SonicWire shared contracts.
 *
 * Single source of truth for the HTTP surface shared by the API server and the
 * web application. Runtime validation lives next to the static types so the
 * server can reject malformed input at the boundary and the client can trust
 * what it renders.
 */
import { z } from 'zod';

export const API_VERSION = 'v1';

/* ------------------------------------------------------------------ errors */

export const ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'payload_too_large',
  'rate_limited',
  'unsupported_media',
  'provider_unavailable',
  'provider_not_configured',
  'upstream_failed',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/* ---------------------------------------------------------------- identity */

export const RoleSchema = z.enum(['owner', 'editor', 'viewer']);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: RoleSchema,
  createdAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const SessionSchema = z.object({
  needsSetup: z.boolean(),
  user: UserSchema.nullable(),
  workspace: WorkspaceSchema.nullable(),
  csrfToken: z.string().nullable(),
  capabilities: z.array(z.string()),
});
export type SessionInfo = z.infer<typeof SessionSchema>;

/** Password policy is enforced server-side; the client mirrors it for UX. */
export const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
});
export type Credentials = z.infer<typeof CredentialsSchema>;

export const SetupSchema = CredentialsSchema.extend({
  displayName: z.string().trim().min(1).max(80),
  workspaceName: z.string().trim().min(1).max(80).default('My Workspace'),
});
export type SetupInput = z.infer<typeof SetupSchema>;

/* ------------------------------------------------------------------- media */

export const AssetKindSchema = z.enum(['audio', 'video', 'image', 'unknown']);
export type AssetKind = z.infer<typeof AssetKindSchema>;

export const AssetStatusSchema = z.enum(['queued', 'probing', 'ready', 'error', 'missing']);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

export const SourceKindSchema = z.enum(['upload', 'url', 'derived']);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const StreamInfoSchema = z.object({
  index: z.number().int(),
  type: z.enum(['video', 'audio', 'subtitle', 'data', 'attachment']),
  codec: z.string().nullable(),
  profile: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  frameRate: z.number().nullable(),
  frameRateMode: z.enum(['constant', 'variable', 'unknown']),
  bitRate: z.number().int().nullable(),
  sampleRate: z.number().int().nullable(),
  channels: z.number().int().nullable(),
  channelLayout: z.string().nullable(),
  bitDepth: z.number().int().nullable(),
  pixelFormat: z.string().nullable(),
  colorSpace: z.string().nullable(),
  colorTransfer: z.string().nullable(),
  hdr: z.boolean(),
  language: z.string().nullable(),
  title: z.string().nullable(),
});
export type StreamInfo = z.infer<typeof StreamInfoSchema>;

export const ProbeSummarySchema = z.object({
  formatName: z.string().nullable(),
  formatLongName: z.string().nullable(),
  container: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  sizeBytes: z.number().int().nullable(),
  bitRate: z.number().int().nullable(),
  streamCount: z.number().int(),
  probeScore: z.number().int().nullable(),
  colorPrimaries: z.string().nullable(),
  hasCoverArt: z.boolean(),
  warnings: z.array(z.string()),
  probedAt: z.string(),
  toolVersion: z.string().nullable(),
});
export type ProbeSummary = z.infer<typeof ProbeSummarySchema>;

export const QualityFactsSchema = z.object({
  /** Measured/parsed facts only — never an estimate presented as source truth. */
  videoResolution: z.string().nullable(),
  videoBitrate: z.number().int().nullable(),
  audioBitrate: z.number().int().nullable(),
  sampleRate: z.number().int().nullable(),
  channels: z.number().int().nullable(),
  hdr: z.boolean(),
  variableFrameRate: z.boolean(),
  lossyAudio: z.boolean(),
  notes: z.array(z.string()),
});
export type QualityFacts = z.infer<typeof QualityFactsSchema>;

export const AssetSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: AssetKindSchema,
  status: AssetStatusSchema,
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int(),
  durationMs: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  container: z.string().nullable(),
  bitRate: z.number().int().nullable(),
  sha256: z.string(),
  sourceKind: SourceKindSchema,
  sourceUrl: z.string().nullable(),
  acquiredAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  hasThumbnail: z.boolean(),
  hasWaveform: z.boolean(),
  parentAssetId: z.string().nullable(),
  version: z.number().int(),
  tags: z.array(z.string()),
  collectionIds: z.array(z.string()),
  errorMessage: z.string().nullable(),
});
export type AssetSummary = z.infer<typeof AssetSummarySchema>;

export const AssetDetailSchema = AssetSummarySchema.extend({
  probe: ProbeSummarySchema.nullable(),
  streams: z.array(StreamInfoSchema),
  quality: QualityFactsSchema.nullable(),
  derivedCount: z.number().int(),
  metadata: z.record(z.string(), z.string()),
  storageBytes: z.number().int(),
});
export type AssetDetail = z.infer<typeof AssetDetailSchema>;

export const WaveformSchema = z.object({
  peaks: z.array(z.number()),
  sampleRate: z.number(),
  durationMs: z.number().int(),
});
export type Waveform = z.infer<typeof WaveformSchema>;

/* ---------------------------------------------------------------- library */

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  assetCount: z.number().int(),
});
export type Tag = z.infer<typeof TagSchema>;

export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const CreateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).nullable().optional(),
});
export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>;

export const AssetQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  q: z.string().trim().max(200).optional(),
  kind: AssetKindSchema.optional(),
  status: AssetStatusSchema.optional(),
  collectionId: z.string().optional(),
  tag: z.string().optional(),
  sourceKind: SourceKindSchema.optional(),
  sort: z.enum(['recent', 'oldest', 'title', 'size', 'duration']).default('recent'),
});
export type AssetQuery = z.infer<typeof AssetQuerySchema>;

export const PaginatedAssetsSchema = z.object({
  items: z.array(AssetSummarySchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
});
export type PaginatedAssets = z.infer<typeof PaginatedAssetsSchema>;

export const UpdateAssetSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  collectionIds: z.array(z.string()).max(20).optional(),
});
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;

/* -------------------------------------------------------------------- jobs */

export const JobKindSchema = z.enum([
  'acquisition.download',
  'media.probe',
  'media.analyze',
  'media.thumbnail',
  'media.waveform',
  'media.transform',
  'media.export',
  'workflow.run',
]);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'waiting_approval',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobEventSchema = z.object({
  seq: z.number().int(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type JobEvent = z.infer<typeof JobEventSchema>;

export const JobSchema = z.object({
  id: z.string(),
  kind: JobKindSchema,
  status: JobStatusSchema,
  progress: z.number(),
  attempts: z.number().int(),
  maxAttempts: z.number().int(),
  priority: z.number().int(),
  payload: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  cancelRequested: z.boolean(),
  parentJobId: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  events: z.array(JobEventSchema).optional(),
});
export type Job = z.infer<typeof JobSchema>;

export const JobQuerySchema = z.object({
  status: JobStatusSchema.optional(),
  kind: JobKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type JobQuery = z.infer<typeof JobQuerySchema>;

/* ---------------------------------------------------------------- analysis */

/**
 * Measurements produced by the Python `media-core` service. Every block is
 * nullable because a given file may have no audio or no video stream; a null
 * block means "not measured for this file", never "zero".
 */
export const MediaAnalysisSchema = z.object({
  durationMs: z.number().int().nullable(),
  hasVideo: z.boolean(),
  hasAudio: z.boolean(),
  loudness: z
    .object({
      integratedLufs: z.number().nullable(),
      truePeakDb: z.number().nullable(),
      rangeLu: z.number().nullable(),
      thresholdLufs: z.number().nullable(),
    })
    .nullable(),
  silence: z
    .object({
      segments: z.number().int(),
      silenceSeconds: z.number(),
      ratio: z.number().nullable(),
      thresholdDb: z.number(),
      minSeconds: z.number(),
    })
    .nullable(),
  blackFrames: z
    .object({
      count: z.number().int(),
      totalSeconds: z.number(),
      longestSeconds: z.number(),
      scannedSeconds: z.number(),
    })
    .nullable(),
  sceneCuts: z
    .object({ count: z.number().int(), threshold: z.number(), scannedSeconds: z.number() })
    .nullable(),
  decode: z
    .object({
      errors: z.number().int(),
      returncode: z.number().int(),
      clean: z.boolean(),
      firstError: z.string().nullable(),
    })
    .nullable(),
  signal: z
    .object({
      meanLuma: z.number(),
      meanSaturation: z.number().nullable(),
      sampledFrames: z.number().int(),
    })
    .nullable(),
  peaks: z.array(z.number()).max(400),
  peakCount: z.number().int(),
  notes: z.array(z.string()),
  measuredAt: z.string(),
  engine: z.string(),
});
export type MediaAnalysis = z.infer<typeof MediaAnalysisSchema>;

/** Persisted together with the asset, so a failed service never erases history. */
export const StoredAnalysisSchema = MediaAnalysisSchema.extend({
  assetId: z.string(),
  engine: z.string(),
  createdAt: z.string(),
});
export type StoredAnalysis = z.infer<typeof StoredAnalysisSchema>;

/** Whether the optional analysis service is present, and what it says about itself. */
export const MediaCoreStateSchema = z.object({
  configured: z.boolean(),
  detail: z.string(),
  reachable: z.boolean().optional(),
  engine: z.string().nullable().optional(),
});
export type MediaCoreState = z.infer<typeof MediaCoreStateSchema>;

/** What `GET /api/assets/:id/analysis` returns: stored facts plus service state. */
export const AnalysisEnvelopeSchema = z.object({
  analysis: StoredAnalysisSchema.nullable(),
  core: MediaCoreStateSchema,
});
export type AnalysisEnvelope = z.infer<typeof AnalysisEnvelopeSchema>;

export const AnalyzeAssetSchema = z.object({
  includePeaks: z.boolean().default(false),
});
export type AnalyzeAssetInput = z.infer<typeof AnalyzeAssetSchema>;

/* ------------------------------------------------------------- acquisition */

export const IngestUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .url()
    // Only web schemes are ingestible; the server re-checks DNS and private
    // ranges before opening a socket, this is the first cheap gate.
    .refine((value) => /^https?:\/\//i.test(value), {
      message: 'Only http and https URLs can be ingested',
    }),
  title: z.string().trim().max(200).optional(),
  collectionId: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
export type IngestUrlInput = z.infer<typeof IngestUrlSchema>;

export const UrlIngestReceiptSchema = z.object({
  jobId: z.string(),
  acceptedUrl: z.string(),
  providerId: z.string().nullable(),
  note: z.string().nullable(),
});
export type UrlIngestReceipt = z.infer<typeof UrlIngestReceiptSchema>;

/* ------------------------------------------------------------ transforms */

export const TransformPresetIdSchema = z.enum([
  'audio.mp3.192',
  'audio.wav.16',
  'audio.flac',
  'audio.opus.128',
  'video.mp4.1080p',
  'video.mp4.720p',
  'video.remux.mp4',
  'video.audio-strip',
  'image.jpeg.2048',
]);
export type TransformPresetId = z.infer<typeof TransformPresetIdSchema>;

export const TransformRequestSchema = z.object({
  presetId: TransformPresetIdSchema,
  trim: z
    .object({
      startMs: z.number().int().min(0).max(86_400_000),
      endMs: z.number().int().min(1).max(86_400_000),
    })
    .optional(),
  titleSuffix: z.string().trim().max(40).optional(),
});
export type TransformRequest = z.infer<typeof TransformRequestSchema>;

export const PresetDescriptorSchema = z.object({
  id: TransformPresetIdSchema,
  label: z.string(),
  description: z.string(),
  outputExtension: z.string(),
  outputKind: AssetKindSchema,
  accepts: z.array(AssetKindSchema),
  approx: z.string(),
});
export type PresetDescriptor = z.infer<typeof PresetDescriptorSchema>;

/* -------------------------------------------------------------- workflows */

export const WorkflowStepSchema = z.object({
  id: z.string(),
  type: z.enum(['probe', 'thumbnail', 'waveform', 'transform', 'tag', 'collect', 'export']),
  label: z.string().max(60),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number().int(),
  steps: z.array(WorkflowStepSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  runCount: z.number().int(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

export const CreateWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).nullable().optional(),
  steps: z.array(WorkflowStepSchema.omit({ id: true })).min(1).max(12),
});
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;

export const WorkflowRunSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  assetId: z.string(),
  jobId: z.string(),
  status: JobStatusSchema,
  stepResults: z.array(
    z.object({
      stepId: z.string(),
      label: z.string(),
      status: z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']),
      message: z.string().nullable(),
      durationMs: z.number().int().nullable(),
    }),
  ),
  createdAt: z.string(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

/* -------------------------------------------------------------- providers */

export const ProviderCapabilitySchema = z.object({
  metadata: z.enum(['official-api', 'link-only', 'none']),
  search: z.enum(['official-api', 'none']),
  publish: z.enum(['official-api', 'none']),
  analytics: z.enum(['official-api', 'none']),
  scheduling: z.enum(['official-api', 'none']),
});
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['video', 'audio', 'social', 'archive']),
  auth: z.enum(['oauth2-pkce', 'oauth2', 'api-key', 'none']),
  capabilities: ProviderCapabilitySchema,
  /**
   * How SonicWire is allowed to obtain media. `link-only` means the provider
   * exposes no official byte-serving API, so SonicWire stores a reference and
   * never fetches the media. Surfaced in the payload so the UI can explain the
   * restriction up front instead of failing at ingest time.
   */
  ingestion: z.enum(['direct-media', 'link-only']),
  restrictions: z.array(z.string()),
  connectionStatus: z.enum(['not_configured', 'available', 'connected', 'error']),
  docsUrl: z.string(),
  lastChecked: z.string(),
});
export type Provider = z.infer<typeof ProviderSchema>;

/* ------------------------------------------------------------- observatory */

export const ObservatorySummarySchema = z.object({
  queue: z.object({
    queued: z.number().int(),
    running: z.number().int(),
    failed24h: z.number().int(),
    succeeded24h: z.number().int(),
    cancelled24h: z.number().int(),
  }),
  latency: z.object({
    probeP50Ms: z.number().int().nullable(),
    probeP95Ms: z.number().int().nullable(),
    transformP50Ms: z.number().int().nullable(),
    transformP95Ms: z.number().int().nullable(),
  }),
  storage: z.object({
    mediaBytes: z.number().int(),
    assetCount: z.number().int(),
    derivedBytes: z.number().int(),
    cacheBytes: z.number().int(),
    diskFreeBytes: z.number().int().nullable(),
  }),
  runtime: z.object({
    uptimeSeconds: z.number().int(),
    rssBytes: z.number().int(),
    heapUsedBytes: z.number().int(),
    nodeVersion: z.string(),
    workers: z.number().int(),
    ffmpeg: z.object({
      available: z.boolean(),
      version: z.string().nullable(),
      ffprobeVersion: z.string().nullable(),
      path: z.string().nullable(),
      source: z.enum(['bundled', 'environment']),
    }),
  }),
  assets: z.object({
    byKind: z.record(z.string(), z.number().int()),
    byStatus: z.record(z.string(), z.number().int()),
    failures: z.array(
      z.object({ assetId: z.string(), title: z.string(), message: z.string(), at: z.string() }),
    ),
  }),
});
export type ObservatorySummary = z.infer<typeof ObservatorySummarySchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

/* ---------------------------------------------------------- realtime (SSE) */

export const RealtimeEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('job.updated'),
    job: JobSchema.omit({ events: true }),
  }),
  z.object({ type: z.literal('job.event'), jobId: z.string(), event: JobEventSchema }),
  z.object({ type: z.literal('asset.updated'), assetId: z.string(), status: AssetStatusSchema }),
  z.object({ type: z.literal('heartbeat'), at: z.string() }),
]);
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;

/* ------------------------------------------------------------------- misc */

export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number(),
  checks: z.record(
    z.string(),
    z.object({ ok: z.boolean(), detail: z.string().nullable() }),
  ),
});
export type Health = z.infer<typeof HealthSchema>;
