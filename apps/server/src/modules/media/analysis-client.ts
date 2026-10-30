import { MediaAnalysisSchema, type MediaAnalysis } from '@sonicwire/contracts';
import { config } from '../../config.js';

/**
 * Client for the Python `media-core` service.
 *
 * The service is optional: a single-binary install still probes, thumbnails and
 * transforms without it. But its absence is always reported as absence — these
 * helpers never substitute zeros or estimates for measurements that did not run.
 */

export type MediaCoreState =
  | { configured: false; detail: string }
  | { configured: true; reachable: true; detail: string; engine: string | null }
  | { configured: true; reachable: false; detail: string };

export class MediaCoreError extends Error {
  constructor(
    readonly code: 'core_unavailable' | 'core_rejected' | 'core_timeout',
    message: string,
  ) {
    super(message);
    this.name = 'MediaCoreError';
  }
}

const base = (): string | undefined => config.MEDIA_CORE_URL?.replace(/\/+$/, '');

export async function mediaCoreState(): Promise<MediaCoreState> {
  const url = base();
  if (!url) {
    return {
      configured: false,
      detail: 'media-core is not configured in this deployment (set MEDIA_CORE_URL to enable deep analysis)',
    };
  }
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      return { configured: true, reachable: false, detail: `media-core health returned ${response.status}` };
    }
    const body = (await response.json()) as { status?: string; engine?: string };
    return {
      configured: true,
      reachable: body.status === 'ok',
      detail: body.status === 'ok' ? 'media-core responding' : `media-core status: ${body.status ?? 'unknown'}`,
      engine: body.engine ?? null,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      detail: `media-core unreachable: ${(error as Error).message}`,
    };
  }
}

export async function analyzeWithCore(
  filePath: string,
  options: { includePeaks: boolean; signal?: AbortSignal; timeoutMs?: number },
): Promise<MediaAnalysis> {
  const url = base();
  if (!url) {
    throw new MediaCoreError(
      'core_unavailable',
      'Analysis needs the media-core service; set MEDIA_CORE_URL and start it with `npm run dev:core`',
    );
  }
  const timeout = AbortSignal.timeout(options.timeoutMs ?? config.MEDIA_CORE_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${url}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: filePath, include_peaks: options.includePeaks }),
      signal,
    });
  } catch (error) {
    const reason = (error as Error).name === 'TimeoutError' ? 'core_timeout' : 'core_unavailable';
    throw new MediaCoreError(reason, `media-core request failed: ${(error as Error).message}`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new MediaCoreError(
      'core_rejected',
      `media-core rejected the file (${response.status}): ${body.slice(0, 300)}`,
    );
  }
  const parsed = MediaAnalysisSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new MediaCoreError('core_rejected', `media-core returned an unexpected payload: ${parsed.error.message.slice(0, 300)}`);
  }
  return parsed.data;
}
