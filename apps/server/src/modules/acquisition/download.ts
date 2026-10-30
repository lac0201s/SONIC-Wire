import http from 'node:http';
import https from 'node:https';
import { Transform } from 'node:stream';
import { AppError } from '../../http/errors.js';
import { extensionForMime, normalizeExtension, writeStreamWithLimits, type Storage } from '../storage/storage.js';
import { resolveSafeUrl } from './url-guard.js';

const MAX_REDIRECTS = 5;
const USER_AGENT = 'SonicWire/0.1 (+https://sonicwire.local; media acquisition)';

const ALLOWED_MIME_PREFIXES = ['video/', 'audio/', 'image/', 'application/octet-stream', 'binary/octet-stream'];

export interface DownloadOptions {
  url: string;
  storage: Storage;
  maxBytes: number;
  maxSeconds: number;
  signal?: AbortSignal;
  rateLimitBytesPerSecond?: number;
  onProgress?: (bytes: number, totalBytes: number | null) => void;
}

export interface DownloadResult {
  filePath: string;
  bytes: number;
  sha256: string;
  contentType: string | null;
  finalUrl: string;
  extension: string;
}

interface HopResult {
  status: number;
  location: string | null;
  contentType: string | null;
  contentLength: number | null;
  stream: http.IncomingMessage | null;
  finalUrl: string;
}

function requestHop(target: { url: URL; address: string; family: 4 | 6 }, signal: AbortSignal): Promise<HopResult> {
  const transport = target.url.protocol === 'https:' ? https : http;
  return new Promise<HopResult>((resolve, reject) => {
    const request = transport.request(
      {
        protocol: target.url.protocol,
        hostname: target.url.hostname.replace(/^\[|\]$/g, ''),
        port: target.url.port || undefined,
        path: `${target.url.pathname}${target.url.search}`,
        method: 'GET',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'video/*,audio/*,image/*,application/octet-stream;q=0.9,*/*;q=0.5',
          'accept-encoding': 'identity',
          host: target.url.host,
        },
        // Pin the validated IP: this closes the DNS-rebinding TOCTOU window.
        // Node asks for an array when `all` is set (autoSelectFamily), so both
        // callback shapes must be honoured.
        lookup: ((_hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
          if (options && typeof options === 'object' && 'all' in options && options.all) {
            callback(null, [{ address: target.address, family: target.family }]);
            return;
          }
          callback(null, target.address, target.family);
        }) as unknown as import('node:net').LookupFunction,
        signal,
      },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          location: (response.headers.location as string | undefined) ?? null,
          contentType: (response.headers['content-type'] as string | undefined) ?? null,
          contentLength: response.headers['content-length']
            ? Number(response.headers['content-length'])
            : null,
          stream: response,
          finalUrl: target.url.toString(),
        });
      },
    );
    request.on('error', (error) => {
      reject(new AppError('upstream_failed', `Could not reach the source: ${error.message}`));
    });
    request.setTimeout(30_000, () => {
      request.destroy(new Error('Connection timed out'));
    });
    request.end();
  });
}

function throttle(bytesPerSecond: number): Transform {
  let allowance = bytesPerSecond;
  let windowStart = Date.now();
  return new Transform({
    async transform(chunk: Buffer, _encoding, callback) {
      const now = Date.now();
      const elapsed = (now - windowStart) / 1000;
      allowance = Math.min(bytesPerSecond, allowance + elapsed * bytesPerSecond);
      windowStart = now;
      let remaining = chunk.length;
      while (remaining > 0) {
        if (allowance <= 0) {
          const waitMs = Math.min(250, (1 / bytesPerSecond) * 1000 * Math.max(1, remaining / bytesPerSecond));
          await new Promise((resolve) => setTimeout(resolve, Math.max(10, waitMs)));
          const refreshed = Date.now();
          allowance += ((refreshed - windowStart) / 1000) * bytesPerSecond;
          windowStart = refreshed;
          allowance = Math.min(bytesPerSecond, allowance);
          continue;
        }
        const take = Math.min(remaining, allowance);
        allowance -= take;
        remaining -= take;
      }
      callback(null, chunk);
    },
  });
}

/**
 * Downloads an authorized public media URL to bounded temporary storage.
 *
 * Safety properties: manual redirect handling with re-validation at every hop,
 * DNS pinned to the validated address, size and time caps, media content-type
 * enforcement, hash-while-writing and atomic rename on completion.
 */
export async function downloadToStorage(options: DownloadOptions): Promise<DownloadResult> {
  const controller = new AbortController();
  const deadline = setTimeout(
    () => controller.abort(new Error('download deadline exceeded')),
    options.maxSeconds * 1000,
  );
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onAbort, { once: true });

  let currentUrl = options.url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const target = await resolveSafeUrl(currentUrl);
      const response = await requestHop(target, controller.signal);

      if (response.status >= 300 && response.status < 400) {
        if (!response.location) throw new AppError('upstream_failed', 'Redirect without a destination');
        if (hop === MAX_REDIRECTS) throw new AppError('upstream_failed', 'Too many redirects');
        currentUrl = new URL(response.location, currentUrl).toString();
        continue;
      }

      if (response.status === 429) {
        throw new AppError('rate_limited', 'The source is rate limiting this client. Try again later.');
      }
      if (response.status >= 400) {
        throw new AppError(
          response.status === 401 || response.status === 403 ? 'forbidden' : 'upstream_failed',
          `The source responded with HTTP ${response.status}. Authorized, public URLs only.`,
        );
      }

      const contentType = response.contentType?.split(';')[0]?.trim().toLowerCase() ?? null;
      const acceptable = contentType
        ? ALLOWED_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix))
        : true;
      if (!acceptable) {
        throw new AppError(
          'unsupported_media',
          `The source returned ${contentType}, which is not media. Provider pages are not downloadable without an official API.`,
        );
      }
      if (response.contentLength !== null && response.contentLength > options.maxBytes) {
        throw new AppError(
          'payload_too_large',
          `The source is ${Math.round(response.contentLength / 1024 / 1024)} MB, above the configured acquisition limit.`,
        );
      }

      const extension =
        extensionForMime(contentType) ?? normalizeExtension(guessExtension(response.finalUrl));
      const destination = options.storage.tmpPath(extension);

      const stream = response.stream;
      if (!stream) throw new AppError('upstream_failed', 'No response body');

      // Progress is measured inside the pipeline. Attaching a 'data' listener
      // would flip the response into flowing mode and drain it before the write
      // stream is attached, yielding a silently truncated file.
      let received = 0;
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length;
          options.onProgress?.(received, response.contentLength);
          callback(null, chunk);
        },
      });

      let body: AsyncIterable<Uint8Array> = stream.pipe(meter);
      if (options.rateLimitBytesPerSecond) {
        body = (body as Transform).pipe(throttle(options.rateLimitBytesPerSecond));
      }

      const written = await writeStreamWithLimits(body, destination, {
        maxBytes: options.maxBytes,
        signal: controller.signal,
      });

      if (response.contentLength !== null && written.bytes !== response.contentLength) {
        await options.storage.removeIfExists(destination);
        throw new AppError('upstream_failed', 'The transfer ended early; the file was discarded');
      }

      return {
        filePath: destination,
        bytes: written.bytes,
        sha256: written.sha256,
        contentType,
        finalUrl: response.finalUrl,
        extension,
      };
    }
    throw new AppError('upstream_failed', 'Too many redirects');
  } catch (error) {
    if (controller.signal.aborted && options.signal?.aborted) {
      throw new AppError('conflict', 'Acquisition was cancelled');
    }
    if (controller.signal.aborted) {
      throw new AppError('upstream_failed', 'The acquisition exceeded its time budget');
    }
    throw error;
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

function guessExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = /\.[A-Za-z0-9]{1,8}$/.exec(pathname);
    return match ? match[0] : '.bin';
  } catch {
    return '.bin';
  }
}
