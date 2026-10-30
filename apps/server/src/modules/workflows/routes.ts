import type { FastifyInstance } from 'fastify';
import { CreateWorkflowSchema, type Workflow, type WorkflowRun } from '@sonicwire/contracts';
import { z } from 'zod';
import type { AppDeps } from '../../http/app.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { badRequest, notFound } from '../../http/errors.js';
import { execute, newId, nowIso, parseJson, queryAll, queryOne } from '../../db/index.js';
import { recordAudit } from '../audit/service.js';
import { getAssetRow } from '../library/repository.js';
import { createWorkflowRun, getWorkflow, parseSteps, type StepResult, type WorkflowRow } from './engine.js';

function toWorkflow(db: AppDeps['db'], row: WorkflowRow): Workflow {
  const runs = queryOne<{ n: number }>(
    db,
    'SELECT COUNT(*) AS n FROM workflow_runs WHERE workflow_id = ?',
    row.id,
  );
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    steps: parseSteps(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    runCount: runs?.n ?? 0,
  };
}

interface RunRow {
  id: string;
  workflow_id: string;
  asset_id: string;
  job_id: string;
  status: WorkflowRun['status'];
  step_results: string;
  created_at: string;
}

function toRun(row: RunRow): WorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    assetId: row.asset_id,
    jobId: row.job_id,
    status: row.status,
    stepResults: parseJson<StepResult[]>(row.step_results, []),
    createdAt: row.created_at,
  };
}

export async function registerWorkflowRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/api/workflows', async (request) => {
    const auth = requireAuth(request);
    const rows = queryAll<WorkflowRow>(
      deps.db,
      'SELECT * FROM workflows WHERE workspace_id = ? ORDER BY created_at DESC',
      auth.workspace.id,
    );
    return { items: rows.map((row) => toWorkflow(deps.db, row)) };
  });

  app.post('/api/workflows', async (request, reply) => {
    const auth = requireAuth(request);
    const body = CreateWorkflowSchema.parse(request.body);
    const id = newId();
    const now = nowIso();
    const steps = body.steps.map((step) => ({ ...step, id: newId() }));
    execute(
      deps.db,
      `INSERT INTO workflows (id, workspace_id, name, description, version, steps, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      id,
      auth.workspace.id,
      body.name,
      body.description ?? null,
      JSON.stringify(steps),
      now,
      now,
    );
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'workflow.created',
      targetType: 'workflow',
      targetId: id,
      metadata: { steps: steps.length },
    });
    const row = getWorkflow(deps.db, auth.workspace.id, id);
    if (!row) throw notFound('Workflow could not be created');
    return reply.code(201).send(toWorkflow(deps.db, row));
  });

  app.delete('/api/workflows/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const removed = execute(
      deps.db,
      'DELETE FROM workflows WHERE id = ? AND workspace_id = ?',
      id,
      auth.workspace.id,
    );
    if (removed === 0) throw notFound('Workflow not found');
    return { ok: true };
  });

  app.get('/api/workflows/:id/runs', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const workflow = getWorkflow(deps.db, auth.workspace.id, id);
    if (!workflow) throw notFound('Workflow not found');
    const rows = queryAll<RunRow>(
      deps.db,
      `SELECT r.* FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
        WHERE r.workflow_id = ? AND w.workspace_id = ? ORDER BY r.created_at DESC LIMIT 30`,
      id,
      auth.workspace.id,
    );
    return { items: rows.map(toRun) };
  });

  app.post('/api/workflows/:id/run', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const body = z.object({ assetId: z.string().min(1) }).parse(request.body);
    const workflow = getWorkflow(deps.db, auth.workspace.id, id);
    if (!workflow) throw notFound('Workflow not found');
    const asset = getAssetRow(deps.db, auth.workspace.id, body.assetId);
    if (!asset) throw notFound('Asset not found');
    if (asset.status !== 'ready') throw badRequest('The asset must be ready before running a workflow');

    const jobId = deps.queue.enqueue({
      workspaceId: auth.workspace.id,
      kind: 'workflow.run',
      payload: { runId: '', workflowId: id, assetId: body.assetId },
      createdBy: auth.user.id,
      priority: 80,
    });
    // The job id must exist before the run row references it; patch both.
    const runId = createWorkflowRun(deps.db, { workflowId: id, assetId: body.assetId, jobId });
    execute(
      deps.db,
      'UPDATE jobs SET payload = ? WHERE id = ?',
      JSON.stringify({ runId, workflowId: id, assetId: body.assetId }),
      jobId,
    );
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'workflow.run_started',
      targetType: 'workflow',
      targetId: id,
      metadata: { runId, assetId: body.assetId },
    });
    return reply.code(202).send({ runId, jobId });
  });

  app.get('/api/workflow-runs/:runId', async (request) => {
    const auth = requireAuth(request);
    const { runId } = request.params as { runId: string };
    const row = queryOne<RunRow & { workspace_id: string }>(
      deps.db,
      `SELECT r.*, w.workspace_id FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
        WHERE r.id = ? AND w.workspace_id = ?`,
      runId,
      auth.workspace.id,
    );
    if (!row) throw notFound('Workflow run not found');
    return toRun(row);
  });
}
