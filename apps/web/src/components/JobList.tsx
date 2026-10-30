import { X } from 'lucide-react';
import type { Job } from '@sonicwire/contracts';
import { Badge, Button, EmptyState, ProgressBar, StatusBadge, cn } from '../design-system/ui';
import { formatRelative } from '../lib/format';
import { useCancelJob } from '../lib/queries';

const KIND_LABEL: Record<string, string> = {
  'acquisition.download': 'Acquire',
  'media.probe': 'Probe',
  'media.thumbnail': 'Thumbnail',
  'media.waveform': 'Waveform',
  'media.transform': 'Transform',
  'media.export': 'Export',
  'workflow.run': 'Workflow',
};

export function jobLabel(job: Job): string {
  const base = KIND_LABEL[job.kind] ?? job.kind;
  const preset = job.payload.presetId;
  if (typeof preset === 'string') return `${base} · ${preset}`;
  const url = job.payload.url;
  if (typeof url === 'string') {
    try {
      return `${base} · ${new URL(url).hostname}`;
    } catch {
      return base;
    }
  }
  return base;
}

export function JobList({
  jobs,
  compact = false,
  emptyHint,
}: {
  jobs: Job[];
  compact?: boolean;
  emptyHint?: string;
}) {
  const cancel = useCancelJob();

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No jobs in flight"
        description={emptyHint ?? 'Imports, probes, transforms and workflow runs appear here the moment they are queued.'}
      />
    );
  }

  return (
    <ul className="divide-y divide-white/[0.06]">
      {jobs.map((job) => {
        const active = job.status === 'running' || job.status === 'queued';
        return (
          <li key={job.id} className="px-1 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-medium text-ink">{jobLabel(job)}</span>
                  <StatusBadge status={job.status} />
                  {job.attempts > 1 ? (
                    <Badge tone="warn">attempt {job.attempts}</Badge>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-dim">
                  <span>{formatRelative(job.startedAt ?? job.createdAt)}</span>
                  <span>{job.kind}</span>
                  {job.parentJobId ? <span>child job</span> : null}
                </div>
                {job.errorMessage ? (
                  <p
                    className={cn(
                      'mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed',
                      job.status === 'failed' ? 'text-danger' : 'text-mute',
                    )}
                  >
                    {job.errorMessage}
                  </p>
                ) : null}
              </div>
              {active ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancel.mutate(job.id)}
                  aria-label={`Cancel ${jobLabel(job)}`}
                  loading={cancel.isPending && cancel.variables === job.id}
                >
                  <X className="size-3.5" aria-hidden />
                  Cancel
                </Button>
              ) : null}
            </div>
            {active && !compact ? (
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar value={job.progress} className="flex-1" />
                <span className="sw-num w-10 text-right text-[10px] text-mute">
                  {Math.round(job.progress * 100)}%
                </span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
