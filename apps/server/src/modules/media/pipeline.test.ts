import fsp from 'node:fs/promises';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../config.js';
import { execute, nowIso, openDatabase, type Database } from '../../db/index.js';
import { createAsset, getAssetDetail, getAssetRow } from '../library/repository.js';
import { Storage } from '../storage/storage.js';
import { generateWaveform } from './artifacts.js';
import { ffmpeg, toolchain } from './ffmpeg.js';
import { probeAsset, transformAsset } from './pipeline.js';
import { presetById } from './presets.js';
import { probeFile } from './probe.js';

let db: Database;
let storage: Storage;
let dir: string;
let workspaceId: string;
let available = false;

async function makeTone(): Promise<string> {
  const target = path.join(dir, 'fixture-tone.wav');
  const result = await ffmpeg([
    '-hide_banner',
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=3',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-c:a',
    'pcm_s16le',
    target,
  ]);
  if (result.code !== 0) throw new Error(result.stderr);
  return target;
}

async function makeVideo(): Promise<string> {
  const target = path.join(dir, 'fixture-clip.mp4');
  const result = await ffmpeg([
    '-hide_banner',
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x360:rate=25:duration=2',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=220:duration=2',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-shortest',
    target,
  ]);
  if (result.code !== 0) throw new Error(result.stderr);
  return target;
}

beforeAll(async () => {
  const tools = await toolchain();
  available = tools.available;
  dir = mkdtempSync(path.join(tmpdir(), 'sonicwire-media-'));
  storage = new Storage(path.join(dir, 'data'));
  await storage.init();
  db = openDatabase(path.join(dir, 'media.db'));
  workspaceId = crypto.randomUUID();
  db.prepare('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)').run(
    workspaceId,
    'Media',
    nowIso(),
  );
});

afterAll(() => {
  db?.close();
});

describe.runIf(true)('media pipeline', () => {
  it('probes a generated WAV fixture and reports measured facts', async () => {
    if (!available) return;
    const source = await makeTone();
    const probe = await probeFile(source);
    expect(probe.kind).toBe('audio');
    expect(probe.durationMs).toBeGreaterThan(2900);
    expect(probe.durationMs).toBeLessThan(3200);
    expect(probe.container).toBe('WAV');
    expect(probe.audioCodec).toBe('pcm_s16le');
    const audio = probe.streams.find((stream) => stream.type === 'audio');
    expect(audio?.sampleRate).toBe(48000);
    expect(audio?.channels).toBe(2);
    expect(probe.quality.lossyAudio).toBe(false);
  });

  it('registers an asset, probes it, and produces thumbnail/waveform artifacts', async () => {
    if (!available) return;
    const source = await makeVideo();
    const assetId = crypto.randomUUID();
    const destination = storage.sourcePath(workspaceId, assetId, '.mp4');
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.copyFile(source, destination);
    const stat = await fsp.stat(destination);

    createAsset(db, {
      workspaceId,
      title: 'Fixture clip',
      kind: 'unknown',
      status: 'probing',
      mimeType: 'video/mp4',
      sizeBytes: stat.size,
      sha256: 'a'.repeat(64),
      storagePath: destination,
      sourceKind: 'upload',
      sourceUrl: null,
      createdBy: null,
    });
    // createAsset generates its own id; fetch the row for the real id.
    const row = db
      .prepare('SELECT id FROM assets WHERE workspace_id = ? AND storage_path = ?')
      .get(workspaceId, destination) as { id: string } | undefined;
    const realId = row!.id;

    const deps = { db, storage, config };
    const result = await probeAsset(deps, realId, { workspaceId });
    expect(result.status).toBe('ready');

    const detail = getAssetDetail(db, workspaceId, realId);
    expect(detail?.kind).toBe('video');
    expect(detail?.videoCodec).toBe('h264');
    expect(detail?.width).toBe(640);
    expect(detail?.height).toBe(360);
    expect(detail?.hasThumbnail).toBe(true);
    expect(detail?.hasWaveform).toBe(true);
    expect(detail?.streams.length).toBeGreaterThanOrEqual(2);
    expect(detail?.probe?.toolVersion).toBeTruthy();
    void assetId;
  });

  it('derives an MP3 from video and validates the output', async () => {
    if (!available) return;
    const row = getAssetRow(
      db,
      workspaceId,
      (db.prepare("SELECT id FROM assets WHERE workspace_id = ? AND kind = 'video' LIMIT 1").get(workspaceId) as { id: string }).id,
    );
    const deps = { db, storage, config };
    const result = await transformAsset(
      deps,
      row!.id,
      { presetId: 'audio.mp3.192', trim: { startMs: 0, endMs: 1000 } },
      { workspaceId },
    );
    const derivative = getAssetDetail(db, workspaceId, result.assetId);
    expect(derivative?.kind).toBe('audio');
    expect(derivative?.audioCodec).toBe('mp3');
    expect(derivative?.parentAssetId).toBe(row!.id);
    expect(derivative?.durationMs).toBeGreaterThan(500);
    expect(derivative?.durationMs).toBeLessThan(1600);
    expect(derivative?.sizeBytes).toBeGreaterThan(0);
  });

  it('refuses an incompatible preset instead of producing garbage', async () => {
    if (!available) return;
    const video = db
      .prepare("SELECT id FROM assets WHERE workspace_id = ? AND kind = 'video' LIMIT 1")
      .get(workspaceId) as { id: string };
    const deps = { db, storage, config };
    await expect(
      transformAsset(deps, video.id, { presetId: 'audio.flac' }, { workspaceId: workspaceId }),
    ).resolves.toBeDefined();
    await expect(
      transformAsset(deps, video.id, { presetId: 'image.jpeg.2048' }, { workspaceId }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('describes presets truthfully and validates ids', () => {
    expect(presetById('audio.mp3.192').requiredEncoders).toContain('libmp3lame');
    expect(() => presetById('nope' as never)).toThrowError();
  });

  it('computes bounded waveform peaks', async () => {
    if (!available) return;
    const source = await makeTone();
    const output = path.join(dir, 'wave.json');
    const waveform = await generateWaveform(source, output, 3000);
    expect(waveform).not.toBeNull();
    expect(waveform!.peaks.length).toBeGreaterThan(10);
    expect(waveform!.peaks.length).toBeLessThanOrEqual(900);
    expect(Math.max(...waveform!.peaks)).toBeGreaterThan(0.03);
    expect(Math.max(...waveform!.peaks)).toBeLessThanOrEqual(1);
  });

  it('rejects non-media files with an actionable error', async () => {
    if (!available) return;
    const fake = path.join(dir, 'not-media.mp4');
    await fsp.writeFile(fake, 'this is definitely not a video');
    await expect(probeFile(fake)).rejects.toMatchObject({ code: 'unsupported_media' });
  });

  it('marks a missing file as an error state on reprobe', async () => {
    if (!available) return;
    const assetId = crypto.randomUUID();
    const missingPath = storage.sourcePath(workspaceId, assetId, '.wav');
    createAsset(db, {
      workspaceId,
      title: 'Missing',
      kind: 'audio',
      status: 'ready',
      mimeType: 'audio/wav',
      sizeBytes: 10,
      sha256: 'b'.repeat(64),
      storagePath: missingPath,
      sourceKind: 'upload',
      sourceUrl: null,
      createdBy: null,
    });
    const row = db
      .prepare('SELECT id FROM assets WHERE storage_path = ?')
      .get(missingPath) as { id: string };
    await expect(
      probeAsset({ db, storage, config }, row.id, { workspaceId }),
    ).rejects.toMatchObject({ code: 'not_found' });
    const status = db.prepare('SELECT status FROM assets WHERE id = ?').get(row.id) as { status: string };
    expect(status.status).toBe('missing');
    void execute;
  });
});
