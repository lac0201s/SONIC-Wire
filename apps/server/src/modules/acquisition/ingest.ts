import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AssetKind, SourceKind } from '@sonicwire/contracts';
import type { Database } from '../../db/index.js';
import { notFound } from '../../http/errors.js';
import {
  createAsset,
  findAssetByHash,
  getAssetRow,
  setAssetCollections,
  setAssetTags,
  toSummary,
} from '../library/repository.js';
import { normalizeExtension, sha256File, type Storage } from '../storage/storage.js';

export interface IngestLocalFileInput {
  workspaceId: string;
  tmpPath: string;
  title: string;
  mimeType: string | null;
  sourceKind: SourceKind;
  sourceUrl: string | null;
  extension: string;
  createdBy: string | null;
  knownSha256?: string;
  collectionId?: string | null;
  tags?: string[];
}

export interface IngestResult {
  assetId: string;
  duplicate: boolean;
  title: string;
}

/**
 * Registers a file that already exists in temporary storage as a library asset.
 *
 * Content-addressed dedupe: if the same bytes are already in the workspace the
 * existing asset is returned and the new copy is discarded. Identity never
 * depends on filename or path.
 */
export async function ingestLocalFile(
  deps: { db: Database; storage: Storage },
  input: IngestLocalFileInput,
): Promise<IngestResult> {
  const sha = input.knownSha256 ?? (await sha256File(input.tmpPath));
  const existing = findAssetByHash(deps.db, input.workspaceId, sha);
  if (existing) {
    await deps.storage.removeIfExists(input.tmpPath);
    if (input.collectionId) {
      setAssetCollections(deps.db, input.workspaceId, existing.id, [input.collectionId]);
    }
    if (input.tags?.length) {
      setAssetTags(deps.db, input.workspaceId, existing.id, input.tags);
    }
    return { assetId: existing.id, duplicate: true, title: existing.title };
  }

  const assetId = crypto.randomUUID();
  const extension = normalizeExtension(input.extension);
  const destination = deps.storage.sourcePath(input.workspaceId, assetId, extension);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.rename(input.tmpPath, destination);
  const stat = await fsp.stat(destination);

  const kindGuess: AssetKind = input.mimeType?.startsWith('audio/')
    ? 'audio'
    : input.mimeType?.startsWith('image/')
      ? 'image'
      : input.mimeType?.startsWith('video/')
        ? 'video'
        : 'unknown';

  const assetIdResult = createAsset(deps.db, {
    workspaceId: input.workspaceId,
    title: input.title.slice(0, 200),
    kind: kindGuess,
    status: 'probing',
    mimeType: input.mimeType,
    sizeBytes: stat.size,
    sha256: sha,
    storagePath: destination,
    sourceKind: input.sourceKind,
    sourceUrl: input.sourceUrl,
    createdBy: input.createdBy,
  });

  if (input.collectionId) {
    setAssetCollections(deps.db, input.workspaceId, assetIdResult, [input.collectionId]);
  }
  if (input.tags?.length) {
    setAssetTags(deps.db, input.workspaceId, assetIdResult, input.tags);
  }

  return { assetId: assetIdResult, duplicate: false, title: input.title };
}

export function requireAsset(deps: { db: Database }, workspaceId: string, assetId: string) {
  const row = getAssetRow(deps.db, workspaceId, assetId);
  if (!row) throw notFound('Asset not found');
  return row;
}

export function summaryFor(deps: { db: Database }, workspaceId: string, assetId: string) {
  const row = requireAsset(deps, workspaceId, assetId);
  return toSummary(row);
}
