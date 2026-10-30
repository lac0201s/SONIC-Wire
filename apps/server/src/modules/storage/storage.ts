import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

/**
 * Filesystem layout for one installation:
 *
 *   <dataDir>/sonicwire.db
 *   <dataDir>/media/<workspaceId>/<assetId>/source.<ext>
 *   <dataDir>/media/<workspaceId>/<assetId>/derived/<assetId>.<ext>
 *   <dataDir>/media/<workspaceId>/<assetId>/derived/thumbs/<assetId>.jpg
 *   <dataDir>/media/<workspaceId>/<assetId>/derived/waveforms/<assetId>.json
 *   <dataDir>/tmp/<random>
 *
 * Asset directories are created once per asset and never shared, so a
 * generated path can never escape the workspace root.
 */
export class Storage {
  readonly dataDir: string;
  readonly mediaRoot: string;
  readonly tmpRoot: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.mediaRoot = path.join(dataDir, 'media');
    this.tmpRoot = path.join(dataDir, 'tmp');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.mediaRoot, { recursive: true });
    await fs.mkdir(this.tmpRoot, { recursive: true });
  }

  assetDir(workspaceId: string, assetId: string): string {
    assertSafeSegment(workspaceId);
    assertSafeSegment(assetId);
    return path.join(this.mediaRoot, workspaceId, assetId);
  }

  sourcePath(workspaceId: string, assetId: string, extension: string): string {
    return path.join(this.assetDir(workspaceId, assetId), `source${normalizeExtension(extension)}`);
  }

  derivedPath(workspaceId: string, assetId: string, extension: string): string {
    return path.join(this.assetDir(workspaceId, assetId), 'derived', `${assetId}${normalizeExtension(extension)}`);
  }

  thumbnailPath(workspaceId: string, assetId: string): string {
    return path.join(this.assetDir(workspaceId, assetId), 'derived', 'thumbs', `${assetId}.jpg`);
  }

  waveformPath(workspaceId: string, assetId: string): string {
    return path.join(this.assetDir(workspaceId, assetId), 'derived', 'waveforms', `${assetId}.json`);
  }

  async ensureDirFor(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  async prepareAssetDir(workspaceId: string, assetId: string): Promise<void> {
    await fs.mkdir(path.join(this.assetDir(workspaceId, assetId), 'derived'), { recursive: true });
  }

  tmpPath(extension = '.bin'): string {
    return path.join(this.tmpRoot, `${randomUUID()}${normalizeExtension(extension)}`);
  }

  async removeAssetDir(workspaceId: string, assetId: string): Promise<void> {
    await fs.rm(this.assetDir(workspaceId, assetId), { recursive: true, force: true });
  }

  async removeIfExists(filePath: string): Promise<void> {
    await fs.rm(filePath, { force: true });
  }

  async sizeOf(filePath: string): Promise<number> {
    try {
      const stat = await fs.stat(filePath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async directoryBytes(directory: string, depth = 0): Promise<number> {
    if (depth > 6) return 0;
    let total = 0;
    const entries = await fs.readdir(directory).catch(() => [] as string[]);
    for (const entry of entries) {
      const full = path.join(directory, entry);
      try {
        const stat = await fs.lstat(full);
        if (stat.isDirectory()) total += await this.directoryBytes(full, depth + 1);
        else if (stat.isFile()) total += stat.size;
      } catch {
        /* entry vanished while walking */
      }
    }
    return total;
  }

  async diskFreeBytes(): Promise<number | null> {
    try {
      const stats = await fs.statfs(this.dataDir);
      return Number(stats.bavail) * Number(stats.bsize);
    } catch {
      return null;
    }
  }

  async cleanupTmp(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
    let removed = 0;
    const entries = await fs.readdir(this.tmpRoot).catch(() => [] as string[]);
    const cutoff = Date.now() - olderThanMs;
    for (const entry of entries) {
      const full = path.join(this.tmpRoot, entry);
      try {
        const stat = await fs.lstat(full);
        if (stat.mtimeMs < cutoff) {
          await fs.rm(full, { recursive: true, force: true });
          removed += 1;
        }
      } catch {
        /* ignore */
      }
    }
    return removed;
  }
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

export function assertSafeSegment(segment: string): void {
  if (!SAFE_SEGMENT.test(segment)) {
    throw new Error(`Unsafe path segment rejected: ${segment.slice(0, 40)}`);
  }
}

const DEFAULT_EXTENSION = '.bin';

/** Only alphanumeric extensions survive; anything else becomes `.bin`. */
export function normalizeExtension(extension: string | null | undefined): string {
  if (!extension) return DEFAULT_EXTENSION;
  const cleaned = extension.startsWith('.') ? extension : `.${extension}`;
  return /^\.[A-Za-z0-9]{1,8}$/.test(cleaned) ? cleaned.toLowerCase() : DEFAULT_EXTENSION;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/flac': '.flac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

export function extensionForMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  return EXTENSION_BY_MIME[mime.split(';')[0]?.trim().toLowerCase() ?? ''] ?? null;
}

export function extensionFromPathOrUrl(value: string): string {
  try {
    const pathname = value.startsWith('http') ? new URL(value).pathname : value;
    const ext = path.extname(pathname);
    return normalizeExtension(ext);
  } catch {
    return DEFAULT_EXTENSION;
  }
}

export interface CopyResult {
  bytes: number;
  sha256: string;
}

/**
 * Writes a web/Node stream to disk while hashing, enforcing a hard byte cap.
 * The write goes to a temp path first so a failed transfer never produces a
 * valid-looking but truncated asset.
 */
export async function writeStreamWithLimits(
  source: AsyncIterable<Uint8Array>,
  destination: string,
  options: { maxBytes: number; signal?: AbortSignal },
): Promise<CopyResult> {
  const hash = createHash('sha256');
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > options.maxBytes) {
        callback(new Error(`Transfer exceeded the ${options.maxBytes} byte limit`));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  const temp = `${destination}.part`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await pipeline(
      source as AsyncIterable<Buffer>,
      limiter,
      createWriteStream(temp, { flags: 'w' }),
      options.signal ? { signal: options.signal } : {},
    );
    await fs.rename(temp, destination);
    return { bytes, sha256: hash.digest('hex') };
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve());
  });
  return hash.digest('hex');
}
