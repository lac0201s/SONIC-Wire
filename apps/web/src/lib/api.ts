import type {
  AnalysisEnvelope,
  ApiError as ApiErrorPayload,
  AssetDetail,
  AssetQuery,
  AssetSummary,
  AuditEvent,
  Collection,
  CreateCollectionInput,
  CreateWorkflowInput,
  IngestUrlInput,
  Job,
  ObservatorySummary,
  PaginatedAssets,
  Provider,
  SessionInfo,
  Tag,
  TransformRequest,
  UrlIngestReceipt,
  Workflow,
  WorkflowRun,
} from '@sonicwire/contracts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, error: ApiErrorPayload['error']) {
    super(error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

const unauthorizedEvent = new EventTarget();
export const onUnauthorized = (listener: () => void): (() => void) => {
  const handler = () => listener();
  unauthorizedEvent.addEventListener('unauthorized', handler);
  return () => unauthorizedEvent.removeEventListener('unauthorized', handler);
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (csrfToken && options.method && options.method !== 'GET') {
    headers['x-sonicwire-csrf'] = csrfToken;
  }
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 401) {
    unauthorizedEvent.dispatchEvent(new Event('unauthorized'));
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as ApiErrorPayload;
      throw new ApiError(response.status, payload.error);
    }
    throw new ApiError(response.status, {
      code: 'internal',
      message: `Request failed with HTTP ${response.status}`,
    });
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface UploadProgress {
  loaded: number;
  total: number | null;
}

/** XHR upload so byte progress is observable and cancelable. */
export function uploadFile(
  file: File,
  fields: Record<string, string>,
  options: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal } = {},
): Promise<{ assetId: string; duplicate: boolean; jobId: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/acquisition/upload');
    xhr.withCredentials = true;
    if (csrfToken) xhr.setRequestHeader('x-sonicwire-csrf', csrfToken);
    xhr.upload.onprogress = (event) => {
      options.onProgress?.({ loaded: event.loaded, total: event.lengthComputable ? event.total : null });
    };
    xhr.onerror = () => reject(new ApiError(0, { code: 'internal', message: 'Upload failed' }));
    xhr.onabort = () => reject(new ApiError(0, { code: 'conflict', message: 'Upload cancelled' }));
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText) as
          | { assetId: string; duplicate: boolean; jobId: string; bytes: number }
          | ApiErrorPayload;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload as { assetId: string; duplicate: boolean; jobId: string; bytes: number });
        } else {
          reject(new ApiError(xhr.status, (payload as ApiErrorPayload).error));
        }
      } catch {
        reject(new ApiError(xhr.status, { code: 'internal', message: 'Unreadable upload response' }));
      }
    };
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

function queryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export const api = {
  session: () => request<SessionInfo>('/api/auth/session'),
  setup: (input: { displayName: string; workspaceName: string; email: string; password: string }) =>
    request<SessionInfo>('/api/auth/setup', { method: 'POST', body: input }),
  login: (input: { email: string; password: string }) =>
    request<SessionInfo>('/api/auth/login', { method: 'POST', body: input }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/password', { method: 'POST', body: input }),

  assets: (query: Partial<AssetQuery>) => request<PaginatedAssets>(`/api/assets${queryString(query)}`),
  asset: (id: string, signal?: AbortSignal) =>
    request<AssetDetail>(`/api/assets/${id}`, { signal }),
  updateAsset: (id: string, body: { title?: string; tags?: string[]; collectionIds?: string[] }) =>
    request<AssetDetail>(`/api/assets/${id}`, { method: 'PATCH', body }),
  deleteAsset: (id: string) => request<{ ok: boolean }>(`/api/assets/${id}`, { method: 'DELETE' }),
  reprobe: (id: string) => request<{ jobId: string }>(`/api/assets/${id}/reprobe`, { method: 'POST' }),
  analyzeAsset: (id: string, body: { includePeaks: boolean }) =>
    request<{ jobId: string }>(`/api/assets/${id}/analyze`, { method: 'POST', body }),
  analysis: (id: string, signal?: AbortSignal) =>
    request<AnalysisEnvelope>(`/api/assets/${id}/analysis`, { signal }),
  transform: (id: string, body: TransformRequest) =>
    request<{ jobId: string }>(`/api/assets/${id}/transform`, { method: 'POST', body }),
  derivatives: (id: string) => request<{ items: AssetDetail[] }>(`/api/assets/${id}/derivatives`),
  waveform: (id: string, signal?: AbortSignal) =>
    request<{ peaks: number[]; sampleRate: number; durationMs: number }>(
      `/api/assets/${id}/waveform`,
      { signal },
    ),

  collections: () => request<{ items: Collection[] }>('/api/collections'),
  createCollection: (body: CreateCollectionInput) =>
    request<Collection>('/api/collections', { method: 'POST', body }),
  deleteCollection: (id: string) =>
    request<{ ok: boolean }>(`/api/collections/${id}`, { method: 'DELETE' }),
  addToCollection: (id: string, assetIds: string[]) =>
    request<{ added: number }>(`/api/collections/${id}/assets`, { method: 'POST', body: { assetIds } }),
  tags: () => request<{ items: Tag[] }>('/api/tags'),

  jobs: (query: { status?: string; kind?: string; limit?: number } = {}) =>
    request<{ items: Job[] }>(`/api/jobs${queryString(query)}`),
  job: (id: string) => request<Job>(`/api/jobs/${id}`),
  cancelJob: (id: string) => request<{ ok: boolean; status: string }>(`/api/jobs/${id}/cancel`, { method: 'POST' }),

  ingestUrl: (body: IngestUrlInput) =>
    request<UrlIngestReceipt>('/api/acquisition/url', { method: 'POST', body }),

  exportAssets: (assetIds: string[]) =>
    request<{ jobId: string }>('/api/exports', { method: 'POST', body: { assetIds } }),

  workflows: () => request<{ items: Workflow[] }>('/api/workflows'),
  createWorkflow: (body: CreateWorkflowInput) =>
    request<Workflow>('/api/workflows', { method: 'POST', body }),
  deleteWorkflow: (id: string) => request<{ ok: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
  runWorkflow: (id: string, assetId: string) =>
    request<{ runId: string; jobId: string }>(`/api/workflows/${id}/run`, {
      method: 'POST',
      body: { assetId },
    }),
  workflowRuns: (id: string) => request<{ items: WorkflowRun[] }>(`/api/workflows/${id}/runs`),
  workflowRun: (runId: string) => request<WorkflowRun>(`/api/workflow-runs/${runId}`),

  providers: () => request<{ items: Provider[] }>('/api/providers'),
  connectProvider: (id: string) =>
    request<{ ok: boolean }>(`/api/providers/${id}/connect`, { method: 'POST' }),
  disconnectProvider: (id: string) =>
    request<{ ok: boolean }>(`/api/providers/${id}/connection`, { method: 'DELETE' }),

  observatory: () => request<ObservatorySummary>('/api/observatory/summary'),
  audit: () => request<{ items: AuditEvent[] }>('/api/observatory/audit'),

  capabilities: () =>
    request<{
      apiVersion: string;
      appVersion: string;
      environment: string;
      initialized: boolean;
      ffmpeg: {
        available: boolean;
        version: string | null;
        ffprobeVersion: string | null;
        source: string;
        encoders: string[];
        error: string | null;
      };
      limits: {
        maxUploadBytes: number;
        maxDownloadBytes: number;
        maxDownloadSeconds: number;
        jobWorkers: number;
        jobTimeoutSeconds: number;
        sessionTtlHours: number;
      };
      transforms: Array<{
        id: string;
        label: string;
        description: string;
        outputExtension: string;
        outputKind: string;
        accepts: string[];
        approx: string;
      }>;
      realtimeSubscribers: number;
      privateNetworkAllowed: boolean;
    }>('/api/system/capabilities'),
  diagnostics: () => request<Record<string, unknown>>('/api/system/diagnostics', { method: 'POST' }),

  settings: () =>
    request<{
      workspace: { id: string; name: string; role: string };
      user: { id: string; email: string; displayName: string };
      counts: { assets: number; jobs: number; collections: number };
      storage: { dataDir: string; mediaRoot: string; diskFreeBytes: number | null };
      limits: {
        maxUploadBytes: number;
        maxDownloadBytes: number;
        jobWorkers: number;
        sessionTtlHours: number;
      };
      privacy: { localFirst: boolean; telemetry: string; outboundRequests: string };
    }>('/api/settings'),
  renameWorkspace: (name: string) =>
    request<{ ok: boolean }>('/api/settings/workspace', { method: 'PATCH', body: { name } }),
  purgeWorkspace: (confirmName: string) =>
    request<{ ok: boolean; removedAssets: number }>('/api/settings/purge', {
      method: 'POST',
      body: { confirmName },
    }),
  health: () =>
    request<{
      status: string;
      version: string;
      uptimeSeconds: number;
      checks: Record<string, { ok: boolean; detail: string | null }>;
    }>('/api/health'),
};

export type { AssetSummary };
