import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cpu,
  Database,
  HardDrive,
  Import,
  Layers,
  Link2,
  Plus,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { useAssets, useCapabilities, useJobs, useObservatory, useRealtime, useSession } from '../lib/queries';
import { AssetCard } from '../components/AssetCard';
import { JobList } from '../components/JobList';
import { ImportPanel } from '../components/ImportPanel';
import {
  Badge,
  Button,
  EmptyState,
  Metric,
  Label,
  Meter,
  Panel,
  SectionHeading,
  Skeleton,
  cn,
} from '../design-system/ui';
import { formatBytes, formatUptime } from '../lib/format';

function StatTile({
  label,
  value,
  detail,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: number | string;
  detail?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
  href?: string;
}) {
  const content = <Metric label={label} value={value} detail={detail} tone={tone} />;
  return (
    <Panel className={cn('p-4', href && 'transition-colors hover:border-hairline-strong')}>
      {href ? (
        <Link to={href} className="block h-full">
          {content}
        </Link>
      ) : (
        content
      )}
    </Panel>
  );
}

export default function Command() {
  const session = useSession();
  const observatory = useObservatory();
  const jobs = useJobs({ limit: 7 });
  const assets = useAssets({ limit: 6, sort: 'recent' });
  const capabilities = useCapabilities();
  const { connected } = useRealtime(true);
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);

  const summary = observatory.data;
  const queueDepth = (summary?.queue.queued ?? 0) + (summary?.queue.running ?? 0);
  const storageRatio =
    summary?.storage.diskFreeBytes && summary.storage.mediaBytes
      ? Math.min(
          1,
          summary.storage.mediaBytes /
            (summary.storage.mediaBytes + summary.storage.diskFreeBytes),
        )
      : 0;

  const firstName = session.data?.user?.displayName.split(' ')[0] ?? 'Operator';
  const recentAssets = assets.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-[clamp(1.7rem,3.2vw,2.4rem)] leading-[1.03] font-semibold tracking-[-0.04em]">
            {firstName}, the core is {summary ? 'nominal' : 'waking up'}.
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-mute">
            {summary
              ? `${summary.assets.byKind.audio ?? 0} audio · ${summary.assets.byKind.video ?? 0} video · ${summary.assets.byKind.image ?? 0} image assets held locally. Engine ${summary.runtime.ffmpeg.available ? 'ready' : 'unavailable'}.`
              : 'Reading local telemetry from the observatory.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setImportOpen(true)}>
            <Import className="size-3.5" aria-hidden /> Import media
          </Button>
          <Button variant="outline" onClick={() => navigate('/app/acquire?tab=url')}>
            <Link2 className="size-3.5" aria-hidden /> Acquire URL
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Library"
          value={summary?.storage.assetCount ?? recentAssets.length}
          detail={`${formatBytes(summary?.storage.mediaBytes ?? 0)} on disk`}
          href="/app/library"
        />
        <StatTile
          label="Queue depth"
          value={queueDepth}
          detail={`${summary?.queue.succeeded24h ?? 0} succeeded in 24h`}
          tone={queueDepth > 4 ? 'warn' : 'neutral'}
          href="/app/observatory"
        />
        <StatTile
          label="Failures · 24h"
          value={summary?.queue.failed24h ?? 0}
          detail={summary?.queue.failed24h ? 'Inspect the observatory log' : 'No failed jobs'}
          tone={summary?.queue.failed24h ? 'danger' : 'ok'}
          href="/app/observatory"
        />
        <StatTile
          label="Engine"
          value={summary?.runtime.ffmpeg.available ? 'READY' : 'DOWN'}
          detail={
            summary?.runtime.ffmpeg.version
              ? `FFmpeg ${summary.runtime.ffmpeg.version}`
              : 'FFmpeg binary not detected'
          }
          tone={summary?.runtime.ffmpeg.available ? 'ok' : 'danger'}
          href="/app/settings"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionHeading title="Job stream" className="flex-1" />
              <Link to="/app/observatory" className="shrink-0">
                <Button size="sm" variant="ghost">
                  All activity <ArrowRight className="size-3" aria-hidden />
                </Button>
              </Link>
            </div>
            <div className="mt-4">
              {jobs.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <JobList
                  jobs={jobs.data?.items ?? []}
                  emptyHint="Import a file or queue an acquisition — every step of the pipeline will appear here."
                />
              )}
            </div>
          </Panel>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <SectionHeading title="Recently acquired" />
              <Link to="/app/library">
                <Button size="sm" variant="ghost">
                  Open universe <ArrowRight className="size-3" aria-hidden />
                </Button>
              </Link>
            </div>
            {assets.isPending ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-52 w-full" />
                ))}
              </div>
            ) : recentAssets.length === 0 ? (
              <EmptyState
                icon={<Layers className="size-5" />}
                title="The universe is empty"
                description="Import a local file or fetch an authorized direct URL to create the first asset."
                action={
                  <Button variant="primary" onClick={() => setImportOpen(true)}>
                    <Plus className="size-3.5" aria-hidden /> Import the first file
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentAssets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <Label>Storage</Label>
              <HardDrive className="size-3.5 text-dim" aria-hidden />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="sw-num text-[22px] text-ink">{formatBytes(summary?.storage.mediaBytes ?? 0)}</span>
              <span className="text-[11px] text-dim">media</span>
            </div>
            <Meter value={storageRatio} className="mt-3" tone={storageRatio > 0.85 ? 'danger' : 'ember'} />
            <div className="mt-3 grid grid-cols-2 gap-3 text-[11.5px] text-dim">
              <div>
                <div className="text-mute">free</div>
                <div className="mt-0.5 text-ink">{formatBytes(summary?.storage.diskFreeBytes ?? null)}</div>
              </div>
              <div>
                <div className="text-mute">derived</div>
                <div className="mt-0.5 text-ink">{formatBytes(summary?.storage.derivedBytes ?? 0)}</div>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <Label>Runtime</Label>
              <Badge tone={connected ? 'ok' : 'warn'} dot>
                {connected ? 'streaming' : 'reconnecting'}
              </Badge>
            </div>
            <dl className="mt-3 space-y-2 text-[11.5px]">
              {[
                ['Node', summary?.runtime.nodeVersion ?? '—'],
                ['Uptime', summary ? formatUptime(summary.runtime.uptimeSeconds) : '—'],
                ['Workers', String(summary?.runtime.workers ?? capabilities.data?.limits.jobWorkers ?? '—')],
                ['Heap', summary ? formatBytes(summary.runtime.heapUsedBytes) : '—'],
                ['RSS', summary ? formatBytes(summary.runtime.rssBytes) : '—'],
              ].map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="text-[11.5px] text-dim">{key}</dt>
                  <dd className="sw-num text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel className="p-5">
            <Label>Quick routes</Label>
            <div className="mt-3 space-y-1.5">
              {[
                { to: '/app/acquire', label: 'Acquisition & providers', icon: Import },
                { to: '/app/studio', label: 'Transformation studio', icon: Cpu },
                { to: '/app/workflows', label: 'Workflow intelligence', icon: WorkflowIcon },
                { to: '/app/observatory', label: 'Observatory & audit', icon: Database },
              ].map((route) => (
                <Link
                  key={route.to}
                  to={route.to}
                  className="flex items-center gap-2.5 rounded-[4px] px-2 py-2 text-[12.5px] text-mute transition-colors hover:bg-white/[0.04] hover:text-ink"
                >
                  <route.icon className="size-3.5 text-dim" aria-hidden />
                  {route.label}
                  <ArrowRight className="ml-auto size-3 text-dim" aria-hidden />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {importOpen ? (
        <div className="fixed inset-0 z-[75] overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="mx-auto max-w-2xl">
            <div className="mb-3 flex justify-end">
              <Button variant="quiet" size="sm" onClick={() => setImportOpen(false)}>
                Close
              </Button>
            </div>
            <ImportPanel onImported={() => setImportOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
