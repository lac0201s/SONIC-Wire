import type {
  AssetDetail,
  AssetKind,
  AssetStatus,
  AssetSummary,
  Collection,
  PaginatedAssets,
  ProbeSummary,
  QualityFacts,
  SourceKind,
  StreamInfo,
  Tag,
} from '@sonicwire/contracts';
import {
  execute,
  newId,
  nowIso,
  parseJson,
  queryAll,
  queryOne,
  type Database,
  type SqlValue,
} from '../../db/index.js';

export interface AssetRow {
  id: string;
  workspace_id: string;
  title: string;
  kind: AssetKind;
  status: AssetStatus;
  mime_type: string | null;
  size_bytes: number;
  sha256: string;
  storage_path: string;
  source_kind: SourceKind;
  source_url: string | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  video_codec: string | null;
  audio_codec: string | null;
  container: string | null;
  bit_rate: number | null;
  probe_json: string | null;
  quality_json: string | null;
  thumbnail_path: string | null;
  waveform_path: string | null;
  parent_asset_id: string | null;
  version: number;
  error_message: string | null;
  created_by: string | null;
  acquired_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateAssetInput {
  workspaceId: string;
  title: string;
  kind: AssetKind;
  status: AssetStatus;
  mimeType: string | null;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  sourceKind: SourceKind;
  sourceUrl: string | null;
  parentAssetId?: string | null;
  createdBy: string | null;
  acquiredAt?: string;
}

export function createAsset(db: Database, input: CreateAssetInput): string {
  const id = newId();
  const now = nowIso();
  execute(
    db,
    `INSERT INTO assets (
      id, workspace_id, title, kind, status, mime_type, size_bytes, sha256, storage_path,
      source_kind, source_url, parent_asset_id, created_by, acquired_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.workspaceId,
    input.title,
    input.kind,
    input.status,
    input.mimeType,
    input.sizeBytes,
    input.sha256,
    input.storagePath,
    input.sourceKind,
    input.sourceUrl,
    input.parentAssetId ?? null,
    input.createdBy,
    input.acquiredAt ?? now,
    now,
    now,
  );
  return id;
}

export function getAssetRow(db: Database, workspaceId: string, assetId: string): AssetRow | null {
  return queryOne<AssetRow>(
    db,
    'SELECT * FROM assets WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    assetId,
    workspaceId,
  );
}

export function findAssetByHash(db: Database, workspaceId: string, sha256: string): AssetRow | null {
  return queryOne<AssetRow>(
    db,
    `SELECT * FROM assets WHERE workspace_id = ? AND sha256 = ? AND deleted_at IS NULL
     ORDER BY created_at ASC LIMIT 1`,
    workspaceId,
    sha256,
  );
}

interface TagJoinRow {
  asset_id: string;
  name: string;
}

interface CollectionJoinRow {
  asset_id: string;
  collection_id: string;
}

function tagsForAssets(db: Database, ids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = queryAll<TagJoinRow>(
    db,
    `SELECT at.asset_id, t.name FROM asset_tags at JOIN tags t ON t.id = at.tag_id
      WHERE at.asset_id IN (${placeholders}) ORDER BY t.name ASC`,
    ...ids,
  );
  for (const row of rows) {
    const list = map.get(row.asset_id) ?? [];
    list.push(row.name);
    map.set(row.asset_id, list);
  }
  return map;
}

function collectionsForAssets(db: Database, ids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = queryAll<CollectionJoinRow>(
    db,
    `SELECT asset_id, collection_id FROM collection_items WHERE asset_id IN (${placeholders})`,
    ...ids,
  );
  for (const row of rows) {
    const list = map.get(row.asset_id) ?? [];
    list.push(row.collection_id);
    map.set(row.asset_id, list);
  }
  return map;
}

export function toSummary(
  row: AssetRow,
  tags: string[] = [],
  collectionIds: string[] = [],
): AssetSummary {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    width: row.width,
    height: row.height,
    videoCodec: row.video_codec,
    audioCodec: row.audio_codec,
    container: row.container,
    bitRate: row.bit_rate,
    sha256: row.sha256,
    sourceKind: row.source_kind,
    sourceUrl: row.source_url,
    acquiredAt: row.acquired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasThumbnail: Boolean(row.thumbnail_path),
    hasWaveform: Boolean(row.waveform_path),
    parentAssetId: row.parent_asset_id,
    version: row.version,
    tags,
    collectionIds,
    errorMessage: row.error_message,
  };
}

export function getAssetDetail(db: Database, workspaceId: string, assetId: string): AssetDetail | null {
  const row = getAssetRow(db, workspaceId, assetId);
  if (!row) return null;
  const streams = queryAll<{
    stream_index: number;
    type: StreamInfo['type'];
    codec: string | null;
    profile: string | null;
    width: number | null;
    height: number | null;
    frame_rate: number | null;
    frame_rate_mode: StreamInfo['frameRateMode'];
    bit_rate: number | null;
    sample_rate: number | null;
    channels: number | null;
    channel_layout: string | null;
    bit_depth: number | null;
    pixel_format: string | null;
    color_space: string | null;
    color_transfer: string | null;
    hdr: number;
    language: string | null;
    title: string | null;
  }>(db, 'SELECT * FROM asset_streams WHERE asset_id = ? ORDER BY stream_index ASC', assetId);

  const derived = queryOne<{ n: number }>(
    db,
    'SELECT COUNT(*) AS n FROM assets WHERE parent_asset_id = ? AND deleted_at IS NULL',
    assetId,
  );

  const probe = parseJson<ProbeSummary | null>(row.probe_json, null);
  const quality = parseJson<QualityFacts | null>(row.quality_json, null);
  const tags = tagsForAssets(db, [assetId]).get(assetId) ?? [];
  const collectionIds = collectionsForAssets(db, [assetId]).get(assetId) ?? [];

  return {
    ...toSummary(row, tags, collectionIds),
    probe,
    streams: streams.map((stream) => ({
      index: stream.stream_index,
      type: stream.type,
      codec: stream.codec,
      profile: stream.profile,
      width: stream.width,
      height: stream.height,
      frameRate: stream.frame_rate,
      frameRateMode: stream.frame_rate_mode,
      bitRate: stream.bit_rate,
      sampleRate: stream.sample_rate,
      channels: stream.channels,
      channelLayout: stream.channel_layout,
      bitDepth: stream.bit_depth,
      pixelFormat: stream.pixel_format,
      colorSpace: stream.color_space,
      colorTransfer: stream.color_transfer,
      hdr: stream.hdr === 1,
      language: stream.language,
      title: stream.title,
    })),
    quality,
    derivedCount: derived?.n ?? 0,
    metadata: {},
    storageBytes: row.size_bytes,
  };
}

export interface ListAssetsParams {
  workspaceId: string;
  limit: number;
  cursor?: string;
  q?: string;
  kind?: AssetKind;
  status?: AssetStatus;
  sourceKind?: SourceKind;
  collectionId?: string;
  tag?: string;
  sort: 'recent' | 'oldest' | 'title' | 'size' | 'duration';
}

interface CursorPayload {
  k: string | number;
  id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (parsed && typeof parsed.id === 'string' && (typeof parsed.k === 'string' || typeof parsed.k === 'number')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

const SORTS = {
  recent: { column: 'created_at', direction: 'DESC' as const },
  oldest: { column: 'created_at', direction: 'ASC' as const },
  title: { column: 'title', direction: 'ASC' as const },
  size: { column: 'size_bytes', direction: 'DESC' as const },
  duration: { column: 'duration_ms', direction: 'DESC' as const },
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function listAssets(db: Database, params: ListAssetsParams): PaginatedAssets {
  const where: string[] = ['a.workspace_id = ?', 'a.deleted_at IS NULL'];
  const args: SqlValue[] = [params.workspaceId];

  if (params.q) {
    where.push(`a.title LIKE ? ESCAPE '\\'`);
    args.push(`%${escapeLike(params.q)}%`);
  }
  if (params.kind) {
    where.push('a.kind = ?');
    args.push(params.kind);
  }
  if (params.status) {
    where.push('a.status = ?');
    args.push(params.status);
  }
  if (params.sourceKind) {
    where.push('a.source_kind = ?');
    args.push(params.sourceKind);
  }
  if (params.collectionId) {
    where.push('EXISTS (SELECT 1 FROM collection_items ci WHERE ci.asset_id = a.id AND ci.collection_id = ?)');
    args.push(params.collectionId);
  }
  if (params.tag) {
    where.push('EXISTS (SELECT 1 FROM asset_tags at2 JOIN tags t2 ON t2.id = at2.tag_id WHERE at2.asset_id = a.id AND t2.name = ?)');
    args.push(params.tag);
  }

  const total = queryOne<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM assets a WHERE ${where.join(' AND ')}`,
    ...args,
  );

  const sort = SORTS[params.sort];
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  if (cursor) {
    const comparator = sort.direction === 'DESC' ? '<' : '>';
    where.push(`(a.${sort.column}, a.id) ${comparator} (?, ?)`);
    args.push(cursor.k, cursor.id);
  }

  const rows = queryAll<AssetRow>(
    db,
    `SELECT a.* FROM assets a WHERE ${where.join(' AND ')}
     ORDER BY a.${sort.column} ${sort.direction}, a.id ${sort.direction}
     LIMIT ?`,
    ...args,
    params.limit + 1,
  );

  const hasMore = rows.length > params.limit;
  const page = hasMore ? rows.slice(0, params.limit) : rows;
  const ids = page.map((row) => row.id);
  const tagMap = tagsForAssets(db, ids);
  const collectionMap = collectionsForAssets(db, ids);

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ k: last[sort.column as keyof AssetRow] as string | number, id: last.id })
      : null;

  return {
    items: page.map((row) => toSummary(row, tagMap.get(row.id) ?? [], collectionMap.get(row.id) ?? [])),
    nextCursor,
    total: total?.n ?? 0,
  };
}

export function updateAssetRow(
  db: Database,
  assetId: string,
  workspaceId: string,
  fields: Partial<
    Pick<
      AssetRow,
      | 'title'
      | 'kind'
      | 'status'
      | 'mime_type'
      | 'size_bytes'
      | 'sha256'
      | 'duration_ms'
      | 'width'
      | 'height'
      | 'video_codec'
      | 'audio_codec'
      | 'container'
      | 'bit_rate'
      | 'probe_json'
      | 'quality_json'
      | 'thumbnail_path'
      | 'waveform_path'
      | 'error_message'
      | 'storage_path'
    >
  >,
): void {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  execute(
    db,
    `UPDATE assets SET ${assignments}, updated_at = ? WHERE id = ? AND workspace_id = ?`,
    ...entries.map(([, value]) => value as SqlValue),
    nowIso(),
    assetId,
    workspaceId,
  );
}

export function replaceStreams(db: Database, assetId: string, streams: StreamInfo[]): void {
  execute(db, 'DELETE FROM asset_streams WHERE asset_id = ?', assetId);
  for (const stream of streams) {
    execute(
      db,
      `INSERT INTO asset_streams (
        asset_id, stream_index, type, codec, profile, width, height, frame_rate, frame_rate_mode,
        bit_rate, sample_rate, channels, channel_layout, bit_depth, pixel_format, color_space,
        color_transfer, hdr, language, title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      assetId,
      stream.index,
      stream.type,
      stream.codec,
      stream.profile,
      stream.width,
      stream.height,
      stream.frameRate,
      stream.frameRateMode,
      stream.bitRate,
      stream.sampleRate,
      stream.channels,
      stream.channelLayout,
      stream.bitDepth,
      stream.pixelFormat,
      stream.colorSpace,
      stream.colorTransfer,
      stream.hdr ? 1 : 0,
      stream.language,
      stream.title,
    );
  }
}

export function softDeleteAsset(db: Database, workspaceId: string, assetId: string): void {
  execute(
    db,
    'UPDATE assets SET deleted_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
    nowIso(),
    nowIso(),
    assetId,
    workspaceId,
  );
}

/* ------------------------------------------------------------------- tags */

export function setAssetTags(db: Database, workspaceId: string, assetId: string, names: string[]): string[] {
  const unique = [...new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  execute(db, 'DELETE FROM asset_tags WHERE asset_id = ?', assetId);
  for (const name of unique) {
    let tag = queryOne<{ id: string }>(
      db,
      'SELECT id FROM tags WHERE workspace_id = ? AND name = ?',
      workspaceId,
      name,
    );
    if (!tag) {
      const id = newId();
      execute(
        db,
        'INSERT INTO tags (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)',
        id,
        workspaceId,
        name,
        nowIso(),
      );
      tag = { id };
    }
    execute(
      db,
      'INSERT INTO asset_tags (asset_id, tag_id, added_at) VALUES (?, ?, ?)',
      assetId,
      tag.id,
      nowIso(),
    );
  }
  return unique;
}

export function listTags(db: Database, workspaceId: string): Tag[] {
  return queryAll<{ id: string; name: string; n: number }>(
    db,
    `SELECT t.id, t.name, COUNT(at.asset_id) AS n
       FROM tags t
       LEFT JOIN asset_tags at ON at.tag_id = t.id
       LEFT JOIN assets a ON a.id = at.asset_id AND a.deleted_at IS NULL
      WHERE t.workspace_id = ?
      GROUP BY t.id, t.name
      ORDER BY t.name ASC`,
    workspaceId,
  ).map((row) => ({ id: row.id, name: row.name, assetCount: row.n }));
}

/* ------------------------------------------------------------- collections */

export function createCollection(
  db: Database,
  workspaceId: string,
  name: string,
  description: string | null,
): Collection {
  const id = newId();
  const now = nowIso();
  execute(
    db,
    'INSERT INTO collections (id, workspace_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    workspaceId,
    name,
    description,
    now,
    now,
  );
  return { id, name, description, itemCount: 0, createdAt: now, updatedAt: now };
}

export function listCollections(db: Database, workspaceId: string): Collection[] {
  return queryAll<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    n: number;
  }>(
    db,
    `SELECT c.id, c.name, c.description, c.created_at, c.updated_at, COUNT(a.id) AS n
       FROM collections c
       LEFT JOIN collection_items ci ON ci.collection_id = c.id
       LEFT JOIN assets a ON a.id = ci.asset_id AND a.deleted_at IS NULL
      WHERE c.workspace_id = ?
      GROUP BY c.id
      ORDER BY c.name ASC`,
    workspaceId,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.n,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function setAssetCollections(
  db: Database,
  workspaceId: string,
  assetId: string,
  collectionIds: string[],
): string[] {
  execute(db, 'DELETE FROM collection_items WHERE asset_id = ?', assetId);
  const applied: string[] = [];
  for (const collectionId of [...new Set(collectionIds)]) {
    const owned = queryOne<{ id: string }>(
      db,
      'SELECT id FROM collections WHERE id = ? AND workspace_id = ?',
      collectionId,
      workspaceId,
    );
    if (!owned) continue;
    execute(
      db,
      'INSERT INTO collection_items (collection_id, asset_id, position, added_at) VALUES (?, ?, ?, ?)',
      collectionId,
      assetId,
      Date.now(),
      nowIso(),
    );
    applied.push(collectionId);
    execute(db, 'UPDATE collections SET updated_at = ? WHERE id = ?', nowIso(), collectionId);
  }
  return applied;
}

export function addAssetToCollection(
  db: Database,
  workspaceId: string,
  assetId: string,
  collectionId: string,
): boolean {
  const owned = queryOne<{ id: string }>(
    db,
    'SELECT id FROM collections WHERE id = ? AND workspace_id = ?',
    collectionId,
    workspaceId,
  );
  if (!owned) return false;
  execute(
    db,
    'INSERT OR IGNORE INTO collection_items (collection_id, asset_id, position, added_at) VALUES (?, ?, ?, ?)',
    collectionId,
    assetId,
    Date.now(),
    nowIso(),
  );
  execute(db, 'UPDATE collections SET updated_at = ? WHERE id = ?', nowIso(), collectionId);
  return true;
}

export function deleteCollection(db: Database, workspaceId: string, collectionId: string): boolean {
  return execute(
    db,
    'DELETE FROM collections WHERE id = ? AND workspace_id = ?',
    collectionId,
    workspaceId,
  ) > 0;
}
