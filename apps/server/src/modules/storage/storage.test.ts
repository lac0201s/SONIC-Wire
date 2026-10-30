import { Readable } from 'node:stream';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  Storage,
  extensionForMime,
  normalizeExtension,
  sha256File,
  writeStreamWithLimits,
} from './storage.js';

let storage: Storage;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'sonicwire-storage-'));
  storage = new Storage(dir);
  await storage.init();
});

describe('path construction', () => {
  it('rejects unsafe path segments', () => {
    expect(() => storage.assetDir('../../etc', 'asset')).toThrowError();
    expect(() => storage.assetDir('workspace', '../escape')).toThrowError();
    expect(storage.assetDir('ws-1', 'asset-2')).toContain('ws-1');
  });

  it('normalises extensions defensively', () => {
    expect(normalizeExtension('.MP3')).toBe('.mp3');
    expect(normalizeExtension('wav')).toBe('.wav');
    expect(normalizeExtension('../../etc/passwd')).toBe('.bin');
    expect(normalizeExtension('')).toBe('.bin');
    expect(extensionForMime('video/mp4')).toBe('.mp4');
    expect(extensionForMime('audio/ogg; codecs=opus')).toBe('.ogg');
    expect(extensionForMime('application/pdf')).toBeNull();
  });
});

describe('bounded streaming writes', () => {
  it('hashes and writes the stream atomically', async () => {
    const destination = storage.tmpPath('.bin');
    const payload = Buffer.from('sonicwire-payload');
    const result = await writeStreamWithLimits(Readable.from([payload]) as never, destination, {
      maxBytes: 1024,
    });
    expect(result.bytes).toBe(payload.length);
    expect(result.sha256).toHaveLength(64);
    expect((await fsp.readFile(destination)).toString()).toBe('sonicwire-payload');
    expect(await fsp.readdir(path.dirname(destination))).not.toContain(`${path.basename(destination)}.part`);
  });

  it('rejects streams larger than the cap and removes partial output', async () => {
    const destination = storage.tmpPath('.bin');
    const chunks = Array.from({ length: 8 }, () => Buffer.alloc(1024, 1));
    await expect(
      writeStreamWithLimits(Readable.from(chunks) as never, destination, { maxBytes: 2048 }),
    ).rejects.toThrowError(/exceeded/);
    await expect(fsp.stat(destination)).rejects.toThrow();
    await expect(fsp.stat(`${destination}.part`)).rejects.toThrow();
  });

  it('matches an independent hash implementation', async () => {
    const file = storage.tmpPath('.txt');
    await fsp.writeFile(file, 'abc');
    expect(await sha256File(file)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('artifacts and housekeeping', () => {
  it('computes directory size and cleans stale scratch files', async () => {
    const nested = path.join(dir, 'media', 'ws', 'asset', 'derived');
    await fsp.mkdir(nested, { recursive: true });
    await fsp.writeFile(path.join(nested, 'a.bin'), Buffer.alloc(100));
    expect(await storage.directoryBytes(path.join(dir, 'media'))).toBe(100);

    const stale = storage.tmpPath('.bin');
    await fsp.writeFile(stale, 'x');
    const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await fsp.utimes(stale, past, past);
    const removed = await storage.cleanupTmp();
    expect(removed).toBeGreaterThanOrEqual(1);
    await expect(fsp.stat(stale)).rejects.toThrow();
  });
});
