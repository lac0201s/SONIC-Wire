import type { MediaAnalysis, StoredAnalysis } from '@sonicwire/contracts';
import { execute, nowIso, parseJson, queryOne, type Database } from '../../db/index.js';

interface AnalysisRow {
  asset_id: string;
  engine: string;
  report_json: string;
  measured_at: string;
  created_at: string;
}

/**
 * One analysis per asset. Re-running replaces the row rather than appending, so
 * the UI always reads a single current truth and history lives in the audit log
 * and job events.
 */
export function saveAnalysis(
  db: Database,
  workspaceId: string,
  assetId: string,
  report: MediaAnalysis,
): StoredAnalysis {
  const createdAt = nowIso();
  execute(
    db,
    `INSERT INTO asset_analysis (asset_id, workspace_id, engine, report_json, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET
       engine = excluded.engine,
       report_json = excluded.report_json,
       measured_at = excluded.measured_at,
       created_at = excluded.created_at`,
    assetId,
    workspaceId,
    report.engine,
    JSON.stringify(report),
    report.measuredAt,
    createdAt,
  );
  return { ...report, assetId, createdAt };
}

export function getAnalysis(db: Database, workspaceId: string, assetId: string): StoredAnalysis | null {
  const row = queryOne<AnalysisRow>(
    db,
    `SELECT asset_id, engine, report_json, measured_at, created_at
     FROM asset_analysis WHERE asset_id = ? AND workspace_id = ?`,
    assetId,
    workspaceId,
  );
  if (!row) return null;
  const report = parseJson<MediaAnalysis | null>(row.report_json, null);
  if (!report) return null;
  return { ...report, assetId: row.asset_id, engine: row.engine, createdAt: row.created_at };
}
