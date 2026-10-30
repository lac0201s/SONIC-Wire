import type { WorkflowStep } from '@sonicwire/contracts';
import { execute, newId, nowIso, type Database } from '../../db/index.js';

export interface WorkflowTemplate {
  key: string;
  name: string;
  description: string;
  steps: Array<Omit<WorkflowStep, 'id'>>;
}

/**
 * Starter workflows shipped with a new workspace. They are real, runnable
 * definitions — not marketing samples.
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'publish-audio',
    name: 'Publish-ready audio',
    description:
      'Refreshes metadata, derives a 192 kbps MP3 deliverable, stamps it for review and packages it.',
    steps: [
      { type: 'probe', label: 'Refresh metadata', config: {} },
      { type: 'transform', label: 'Derive MP3 192', config: { presetId: 'audio.mp3.192' } },
      { type: 'tag', label: 'Tag for review', config: { tags: ['review', 'deliverable'] } },
      { type: 'export', label: 'Package deliverable', config: {} },
    ],
  },
  {
    key: 'archive-video',
    name: 'Archive video master',
    description:
      'Verifies the source, builds a review rendition and captures waveform + thumbnail artifacts.',
    steps: [
      { type: 'probe', label: 'Verify source', config: {} },
      { type: 'thumbnail', label: 'Rebuild thumbnail', config: {} },
      { type: 'waveform', label: 'Rebuild waveform', config: {} },
      { type: 'transform', label: 'Review rendition 720p', config: { presetId: 'video.mp4.720p' } },
    ],
  },
];

export function seedWorkflowTemplates(db: Database, workspaceId: string): void {
  const now = nowIso();
  for (const template of WORKFLOW_TEMPLATES) {
    execute(
      db,
      `INSERT INTO workflows (id, workspace_id, name, description, version, steps, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      newId(),
      workspaceId,
      template.name,
      template.description,
      JSON.stringify(template.steps.map((step) => ({ ...step, id: newId() }))),
      now,
      now,
    );
  }
}
