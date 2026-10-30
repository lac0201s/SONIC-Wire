import { execute, newId, nowIso, queryAll, type Database } from '../../db/index.js';
import type { AuditEvent } from '@sonicwire/contracts';

export interface AuditInput {
  workspaceId: string | null;
  actorId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function recordAudit(db: Database, input: AuditInput): void {
  execute(
    db,
    `INSERT INTO audit_events (id, workspace_id, actor_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    input.workspaceId,
    input.actorId,
    input.action,
    input.targetType ?? null,
    input.targetId ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    nowIso(),
  );
}

interface AuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: string | null;
  created_at: string;
}

export function listAudit(db: Database, workspaceId: string, limit = 50): AuditEvent[] {
  const rows = queryAll<AuditRow>(
    db,
    `SELECT id, action, target_type, target_id, metadata, created_at
     FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
    workspaceId,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  }));
}
