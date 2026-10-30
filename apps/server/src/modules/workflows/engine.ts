import path from 'node:path';
import type { WorkflowStep } from '@sonicwire/contracts';
import { TransformRequestSchema } from '@sonicwire/contracts';
import { execute, newId, nowIso, parseJson, queryOne, type Database } from '../../db/index.js';
import { notFound } from '../../http/errors.js';
import { addAssetToCollection, getAssetRow, setAssetTags } from '../library/repository.js';
import { generateThumbnail, generateWaveform } from '../media/artifacts.js';
import {
  buildExportBundle,
  probeAsset,
  transformAsset,
  type PipelineDeps,
} from '../media/pipeline.js';
import { updateAssetRow } from '../library/repository.js';
import type { Storage } from '../storage/storage.js';

export interface WorkflowRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  version: number;
  steps: string;
  created_at: string;
  updated_at: string;
}

export interface StepResult {
  stepId: string;
  label: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  message: string | null;
  durationMs: number | null;
}

export interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  asset_id: string;
  job_id: string;
  status: string;
  step_results: string;
  created_at: string;
  updated_at: string;
}

export function getWorkflow(db: Database, workspaceId: string, workflowId: string): WorkflowRow | null {
  return queryOne<WorkflowRow>(
    db,
    'SELECT * FROM workflows WHERE id = ? AND workspace_id = ?',
    workflowId,
    workspaceId,
  );
}

export function parseSteps(row: WorkflowRow): WorkflowStep[] {
  return parseJson<WorkflowStep[]>(row.steps, []);
}

export interface WorkflowRunDeps extends PipelineDeps {
  storage: Storage;
}

/**
 * Executes a workflow as a linear, typed pipeline. Each step receives the
 * "current asset" — transform steps replace it with the derivative so later
 * steps operate on the newest artifact. Step state is persisted after every
 * transition so a crash leaves an inspectable partial run rather than silence.
 */
export async function executeWorkflow(
  deps: WorkflowRunDeps,
  runId: string,
  ctx: {
    workspaceId: string;
    signal?: AbortSignal;
    progress?: (value: number, message?: string) => void;
    log?: (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => void;
    failFast?: () => void;
  },
): Promise<{ assetId: string; exportPath: string | null }> {
  const run = queryOne<WorkflowRunRow>(deps.db, 'SELECT * FROM workflow_runs WHERE id = ?', runId);
  if (!run) throw notFound('Workflow run not found');
  const workflow = getWorkflow(deps.db, ctx.workspaceId, run.workflow_id);
  if (!workflow) throw notFound('Workflow not found');
  const steps = parseSteps(workflow);
  if (steps.length === 0) throw new Error('Workflow has no steps');

  let currentAssetId = run.asset_id;
  const results: StepResult[] = steps.map((step) => ({
    stepId: step.id,
    label: step.label,
    status: 'pending',
    message: null,
    durationMs: null,
  }));
  let exportPath: string | null = null;

  const persist = (status: string): void => {
    execute(
      deps.db,
      'UPDATE workflow_runs SET status = ?, step_results = ?, updated_at = ? WHERE id = ?',
      status,
      JSON.stringify(results),
      nowIso(),
      runId,
    );
  };

  persist('running');

  for (const [index, step] of steps.entries()) {
    if (ctx.signal?.aborted) {
      results[index]!.status = 'skipped';
      results[index]!.message = 'Run cancelled';
      persist('cancelled');
      throw new Error('cancelled');
    }
    const started = Date.now();
    results[index]!.status = 'running';
    persist('running');
    ctx.progress?.((index / steps.length) * 0.9, `${step.label}`);

    try {
      const asset = getAssetRow(deps.db, ctx.workspaceId, currentAssetId);
      if (!asset) throw notFound('Asset disappeared during the workflow');

      switch (step.type) {
        case 'probe': {
          await probeAsset(deps, currentAssetId, ctx);
          results[index]!.message = 'Metadata refreshed';
          break;
        }
        case 'thumbnail': {
          const output = deps.storage.thumbnailPath(ctx.workspaceId, currentAssetId);
          const ok = await generateThumbnail(
            asset.storage_path,
            output,
            { durationMs: asset.duration_ms, kind: asset.kind, hasCoverArt: false },
            ctx.signal,
          );
          updateAssetRow(deps.db, currentAssetId, ctx.workspaceId, {
            thumbnail_path: ok ? output : null,
          });
          results[index]!.message = ok ? 'Thumbnail regenerated' : 'No visual frame available';
          results[index]!.status = ok ? 'succeeded' : 'skipped';
          break;
        }
        case 'waveform': {
          const output = deps.storage.waveformPath(ctx.workspaceId, currentAssetId);
          const wave = await generateWaveform(
            asset.storage_path,
            output,
            asset.duration_ms ?? 0,
            ctx.signal,
          );
          updateAssetRow(deps.db, currentAssetId, ctx.workspaceId, {
            waveform_path: wave ? output : null,
          });
          results[index]!.message = wave ? 'Waveform regenerated' : 'No audio stream';
          results[index]!.status = wave ? 'succeeded' : 'skipped';
          break;
        }
        case 'transform': {
          const request = TransformRequestSchema.parse(step.config);
          const derivative = await transformAsset(deps, currentAssetId, request, ctx);
          currentAssetId = derivative.assetId;
          results[index]!.message = `Created ${path.basename(derivative.assetId)}`;
          break;
        }
        case 'tag': {
          const tags = Array.isArray(step.config.tags) ? (step.config.tags as string[]) : [];
          const applied = setAssetTags(deps.db, ctx.workspaceId, currentAssetId, tags);
          results[index]!.message = applied.length ? `Tagged ${applied.join(', ')}` : 'No tags configured';
          break;
        }
        case 'collect': {
          const collectionId = typeof step.config.collectionId === 'string' ? step.config.collectionId : null;
          if (!collectionId) {
            results[index]!.status = 'skipped';
            results[index]!.message = 'No collection selected';
            break;
          }
          const added = addAssetToCollection(deps.db, ctx.workspaceId, currentAssetId, collectionId);
          results[index]!.message = added ? 'Added to collection' : 'Collection not found';
          if (!added) results[index]!.status = 'skipped';
          break;
        }
        case 'export': {
          const bundle = await buildExportBundle(deps, [currentAssetId], {
            workspaceId: ctx.workspaceId,
            signal: ctx.signal,
            progress: ctx.progress,
          });
          exportPath = bundle.filePath;
          results[index]!.message = `${bundle.fileName} · ${Math.round(bundle.bytes / 1024)} KB`;
          break;
        }
        default: {
          results[index]!.status = 'skipped';
          results[index]!.message = 'Unsupported step type';
        }
      }
      if (results[index]!.status === 'running') results[index]!.status = 'succeeded';
    } catch (error) {
      results[index]!.status = 'failed';
      results[index]!.message = error instanceof Error ? error.message.slice(0, 300) : 'Failed';
      results[index]!.durationMs = Date.now() - started;
      persist('failed');
      // Transform failures are usually content-specific: retrying wastes work.
      ctx.failFast?.();
      throw error;
    } finally {
      results[index]!.durationMs = results[index]!.durationMs ?? Date.now() - started;
      persist('running');
    }
  }

  persist('succeeded');
  ctx.progress?.(1, 'Workflow complete');
  ctx.log?.('info', 'Workflow run finished', { workflowId: workflow.id, steps: steps.length });
  return { assetId: currentAssetId, exportPath };
}

export function createWorkflowRun(
  db: Database,
  input: { workflowId: string; assetId: string; jobId: string },
): string {
  const id = newId();
  const now = nowIso();
  execute(
    db,
    `INSERT INTO workflow_runs (id, workflow_id, asset_id, job_id, status, step_results, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'queued', '[]', ?, ?)`,
    id,
    input.workflowId,
    input.assetId,
    input.jobId,
    now,
    now,
  );
  return id;
}
