import { useMemo, useState } from 'react';
import { Cpu, Download, HardDrive, Radio } from 'lucide-react';
import { useAudit, useCapabilities, useJobs, useObservatory, useRealtime } from '../lib/queries';
import { api } from '../lib/api';
import { JobList } from '../components/JobList';
import {
  Badge,
  Button,
  DataRow,
  EmptyState,
  Label,
  Meter,
  Metric,
  Panel,
  SectionHeading,
  Skeleton,
  StatusBadge,
  cn,
  useToast,
} from '../design-system/ui';
import { formatBytes, formatRelative, formatUptime } from '../lib/format';

function Kpi({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  detail?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  return <Metric label={label} value={value} detail={detail} tone={tone} />;
}

export default function Observatory() {
  const observatory = useObservatory();
  const jobs = useJobs({ limit: 25 });
  const audit = useAudit();
  const capabilities = useCapabilities();
  const { connected, lastEventAt } = useRealtime(true);
  const { notify } = useToast();
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);

  const summary = observatory.data;
  const totalAssets = useMemo(
    () => Object.values(summary?.assets.byKind ?? {}).reduce((sum, value) => sum + value, 0),
    [summary],
  );

  const downloadDiagnostics = async (): Promise<void> => {
    setDiagnosticsBusy(true);
    try {
      const payload = await api.diagnostics();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sonicwire-diagnostics-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify({ tone: 'ok', title: 'Diagnostics exported', body: 'Secrets, cookies and media metadata are excluded by construction.' });
    } catch {
      notify({ tone: 'danger', title: 'Diagnostics failed', body: 'The core did not return a payload.' });
    } finally {
      setDiagnosticsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="What the machine is actually doing."
        description="Queue depth, measured job latency, storage and runtime facts from this installation. Nothing here is sampled from a third party."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={connected ? 'ok' : 'warn'} dot>
              {connected ? 'live stream' : 'reconnecting'}
            </Badge>
            <Button size="sm" variant="outline" onClick={downloadDiagnostics} loading={diagnosticsBusy}>
              <Download className="size-3.5" aria-hidden /> Diagnostics
            </Button>
          </div>
        }
      />

      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Queue"
          value={String((summary?.queue.queued ?? 0) + (summary?.queue.running ?? 0))}
          detail={`${summary?.queue.running ?? 0} running · ${summary?.queue.queued ?? 0} waiting`}
          tone={(summary?.queue.failed24h ?? 0) > 0 ? 'warn' : 'ok'}
        />
        <Kpi
          label="Probe latency"
          value={summary?.latency.probeP50Ms ? `${summary.latency.probeP50Ms} ms` : '—'}
          detail={
            summary?.latency.probeP95Ms
              ? `p95 ${summary.latency.probeP95Ms} ms over the last 500 jobs`
              : 'No successful probes in 24h'
          }
        />
        <Kpi
          label="Transform latency"
          value={summary?.latency.transformP50Ms ? `${(summary.latency.transformP50Ms / 1000).toFixed(1)} s` : '—'}
          detail={summary?.latency.transformP95Ms ? `p95 ${(summary.latency.transformP95Ms / 1000).toFixed(1)} s` : 'No transforms in 24h'}
        />
        <Kpi
          label="Failures · 24h"
          value={summary?.queue.failed24h ?? 0}
          detail={
            summary?.queue.cancelled24h
              ? `${summary.queue.cancelled24h} cancelled by operators`
              : 'No cancellations'
          }
          tone={(summary?.queue.failed24h ?? 0) > 0 ? 'danger' : 'ok'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section>
            <div className="flex items-center justify-between">
              <SectionHeading title="Live job ledger" />
              <span className="text-[11.5px] text-dim">
                {lastEventAt ? `event ${formatRelative(new Date(lastEventAt).toISOString())}` : 'awaiting events'}
              </span>
            </div>
            <div className="mt-3 max-h-[520px] overflow-y-auto pr-1">
              {jobs.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <JobList jobs={jobs.data?.items ?? []} />
              )}
            </div>
          </section>

          <section>
            <SectionHeading title="Recent state changes" />
            <div className="mt-3 overflow-x-auto">
              {audit.isPending ? (
                <Skeleton className="h-32 w-full" />
              ) : (audit.data?.items.length ?? 0) === 0 ? (
                <p className="py-4 text-[12.5px] text-mute">No audit events yet.</p>
              ) : (
                <table className="w-full min-w-[520px] text-left text-[11.5px]">
                  <thead>
                    <tr className="border-b border-hairline">
                      {['Action', 'Target', 'Metadata', 'When'].map((heading) => (
                        <th key={heading} className="sw-label py-2 pr-3 font-normal">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data?.items.slice(0, 20).map((event) => (
                      <tr key={event.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="py-2 pr-3 text-[11.5px] text-ink">{event.action}</td>
                        <td className="py-2 pr-3 text-mute">
                          {event.targetType ? `${event.targetType}:${event.targetId?.slice(0, 8) ?? ''}` : '—'}
                        </td>
                        <td className="max-w-[220px] truncate py-2 pr-3 text-[11.5px] text-dim">
                          {event.metadata ? JSON.stringify(event.metadata) : '—'}
                        </td>
                        <td className="py-2 text-dim">{formatRelative(event.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <Label>Library composition</Label>
            <div className="mt-3 space-y-3">
              {['audio', 'video', 'image', 'unknown']
                .filter((kind) => (summary?.assets.byKind[kind] ?? 0) > 0)
                .map((kind) => {
                  const count = summary?.assets.byKind[kind] ?? 0;
                  const ratio = totalAssets > 0 ? count / totalAssets : 0;
                  return (
                    <div key={kind}>
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="text-[11.5px] text-mute">{kind}</span>
                        <span className="sw-num text-ink">{count}</span>
                      </div>
                      <Meter
                        value={ratio}
                        className="mt-1.5"
                        segments={22}
                        tone={kind === 'video' ? 'ember' : kind === 'audio' ? 'plasma' : 'ok'}
                        label={`${kind} share`}
                      />
                    </div>
                  );
                })}
              {totalAssets === 0 ? <p className="text-[12px] text-dim">No assets yet.</p> : null}
            </div>
            <div className="sw-hairline my-4" />
            <dl className="divide-y divide-white/[0.05]">
              <DataRow label="Assets" value={summary?.storage.assetCount ?? 0} />
              <DataRow label="Media bytes" value={formatBytes(summary?.storage.mediaBytes ?? 0)} />
              <DataRow label="Derived bytes" value={formatBytes(summary?.storage.derivedBytes ?? 0)} />
              <DataRow label="Scratch" value={formatBytes(summary?.storage.cacheBytes ?? 0)} />
              <DataRow label="Disk free" value={formatBytes(summary?.storage.diskFreeBytes ?? null)} />
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <Label>Runtime</Label>
              <Cpu className="size-3.5 text-dim" aria-hidden />
            </div>
            <dl className="mt-2">
              <DataRow label="Node" value={summary?.runtime.nodeVersion ?? '—'} />
              <DataRow label="Uptime" value={summary ? formatUptime(summary.runtime.uptimeSeconds) : '—'} />
              <DataRow label="Workers" value={summary?.runtime.workers ?? '—'} />
              <DataRow label="Heap" value={formatBytes(summary?.runtime.heapUsedBytes ?? 0)} />
              <DataRow label="RSS" value={formatBytes(summary?.runtime.rssBytes ?? 0)} />
              <DataRow
                label="FFmpeg"
                value={
                  <span className="flex items-center justify-end gap-1.5">
                    <HardDrive className="size-3 text-dim" aria-hidden />
                    {summary?.runtime.ffmpeg.version ?? 'unavailable'}
                  </span>
                }
              />
              <DataRow label="FFprobe" value={summary?.runtime.ffmpeg.ffprobeVersion ?? '—'} />
              <DataRow label="Binary source" value={summary?.runtime.ffmpeg.source ?? '—'} />
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <Label>Encoders detected</Label>
              <Radio className="size-3.5 text-dim" aria-hidden />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(capabilities.data?.ffmpeg.encoders ?? []).map((encoder) => (
                <Badge key={encoder} tone="neutral">
                  {encoder}
                </Badge>
              ))}
              {(capabilities.data?.ffmpeg.encoders ?? []).length === 0 ? (
                <span className="text-[11.5px] text-dim">FFmpeg capabilities unavailable.</span>
              ) : null}
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-dim">
              Detection runs at boot against the local binary. A preset whose encoder is missing is
              refused before any job is queued.
            </p>
          </section>

          {(summary?.assets.failures.length ?? 0) > 0 ? (
            <section>
              <Label>Recent asset failures</Label>
              <ul className="mt-2 space-y-2">
                {summary?.assets.failures.map((failure) => (
                  <li key={failure.assetId} className="rounded-[4px] border border-danger/25 bg-danger/[0.05] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] text-ink">{failure.title}</span>
                      <StatusBadge status="error" />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-mute">{failure.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-[12.5px] text-mute">No failed assets recorded in this workspace.</p>
          )}

          {observatory.isError ? (
            <EmptyState
              title="Telemetry unavailable"
              description="The observatory query failed. The job queue may still be running."
              action={<Button onClick={() => void observatory.refetch()}>Retry</Button>}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
