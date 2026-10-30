import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import { crc32 } from 'node:zlib';

/**
 * Minimal streaming ZIP writer (store method, no compression).
 *
 * Written in-house because:
 *  - media is already compressed; DEFLATE costs CPU for ~0% gain,
 *  - the standard libraries either buffer whole archives in memory or hide
 *    backpressure, and unbounded buffering of media is not acceptable,
 *  - a 120-line writer with an explicit spec mapping is easier to audit than a
 *    dependency wrapping the same format.
 *
 * Every write is awaited, so a slow disk applies backpressure to the caller.
 */

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const VERSION = 20;
const FLAG_UTF8 = 0x0800;

interface CentralEntry {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, date: dosDate };
}

export class ZipWriter {
  private constructor(
    private readonly handle: fsp.FileHandle,
    private readonly path: string,
  ) {}

  private offset = 0;
  private readonly entries: CentralEntry[] = [];

  static async create(path: string): Promise<ZipWriter> {
    const handle = await fsp.open(path, 'w');
    return new ZipWriter(handle, path);
  }

  private async write(buffer: Buffer): Promise<void> {
    await this.handle.write(buffer);
    this.offset += buffer.length;
  }

  /** Adds a file from disk. `onBytes` receives cumulative uncompressed bytes. */
  async addFile(
    name: string,
    filePath: string,
    options: {
      onBytes?: (bytes: number) => void;
      signal?: AbortSignal;
      maxBytes?: number;
    } = {},
  ): Promise<void> {
    const nameBuffer = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const { time, date } = dosDateTime(new Date());
    const offset = this.offset;

    const header = Buffer.alloc(30);
    header.writeUInt32LE(SIG_LOCAL, 0);
    header.writeUInt16LE(VERSION, 4);
    header.writeUInt16LE(FLAG_UTF8, 6);
    header.writeUInt16LE(0, 8); // store
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(0, 14); // crc, patched later
    header.writeUInt32LE(0, 18); // compressed size, patched later
    header.writeUInt32LE(0, 22); // uncompressed size, patched later
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt16LE(0, 28);
    await this.write(header);
    await this.write(nameBuffer);

    const dataOffset = this.offset;
    let crc = 0;
    let size = 0;
    for await (const chunk of createReadStream(filePath)) {
      if (options.signal?.aborted) throw new Error('cancelled');
      const buffer = chunk as Buffer;
      crc = crc32(buffer, crc);
      size += buffer.length;
      if (options.maxBytes !== undefined && size > options.maxBytes) {
        throw new Error('bundle size limit exceeded');
      }
      await this.write(buffer);
      options.onBytes?.(size);
    }

    // Patch the local header now that CRC and sizes are known.
    const patch = Buffer.alloc(12);
    patch.writeUInt32LE(crc >>> 0, 0);
    patch.writeUInt32LE(size, 4);
    patch.writeUInt32LE(size, 8);
    await this.handle.write(patch, 0, patch.length, offset + 14);

    this.entries.push({ name: nameBuffer, crc: crc >>> 0, size, offset, time, date });
    void dataOffset;
  }

  /** Adds an in-memory entry (manifests, small text files). */
  async addBuffer(name: string, content: Buffer): Promise<void> {
    const nameBuffer = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const { time, date } = dosDateTime(new Date());
    const offset = this.offset;
    const crc = crc32(content) >>> 0;

    const header = Buffer.alloc(30);
    header.writeUInt32LE(SIG_LOCAL, 0);
    header.writeUInt16LE(VERSION, 4);
    header.writeUInt16LE(FLAG_UTF8, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(content.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt16LE(0, 28);

    await this.write(header);
    await this.write(nameBuffer);
    await this.write(content);
    this.entries.push({ name: nameBuffer, crc, size: content.length, offset, time, date });
  }

  async close(): Promise<{ bytes: number; entries: number }> {
    const centralStart = this.offset;
    for (const entry of this.entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(SIG_CENTRAL, 0);
      header.writeUInt16LE(VERSION, 4);
      header.writeUInt16LE(VERSION, 6);
      header.writeUInt16LE(FLAG_UTF8, 8);
      header.writeUInt16LE(0, 10);
      header.writeUInt16LE(entry.time, 12);
      header.writeUInt16LE(entry.date, 14);
      header.writeUInt32LE(entry.crc, 16);
      header.writeUInt32LE(entry.size, 20);
      header.writeUInt32LE(entry.size, 24);
      header.writeUInt16LE(entry.name.length, 28);
      header.writeUInt16LE(0, 30);
      header.writeUInt16LE(0, 32);
      header.writeUInt16LE(0, 34);
      header.writeUInt16LE(0, 36);
      header.writeUInt32LE(0, 38);
      header.writeUInt32LE(entry.offset, 42);
      await this.write(header);
      await this.write(entry.name);
    }
    const centralSize = this.offset - centralStart;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(SIG_EOCD, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralStart, 16);
    eocd.writeUInt16LE(0, 20);
    await this.write(eocd);

    await this.handle.sync();
    await this.handle.close();
    const stat = await fsp.stat(this.path);
    return { bytes: stat.size, entries: this.entries.length };
  }

  async abort(): Promise<void> {
    try {
      await this.handle.close();
    } catch {
      /* already closed */
    }
    await fsp.rm(this.path, { force: true });
  }
}
