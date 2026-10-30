import { Link } from 'react-router-dom';
import { AudioLines, FileQuestion, Film, Image as ImageIcon, Play } from 'lucide-react';
import type { AssetSummary } from '@sonicwire/contracts';
import { Badge, StatusBadge, cn } from '../design-system/ui';
import { formatBytes, formatDuration, resolutionLabel } from '../lib/format';

const KIND_ICON = {
  audio: AudioLines,
  video: Film,
  image: ImageIcon,
  unknown: FileQuestion,
} as const;

export function AssetCard({
  asset,
  selectable = false,
  selected = false,
  onToggle,
  onOpen,
}: {
  asset: AssetSummary;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
  onOpen?: () => void;
}) {
  const Icon = KIND_ICON[asset.kind];
  const playable = asset.status === 'ready';

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[7px] border bg-steel transition-colors',
        selected ? 'border-ember/70' : 'border-hairline hover:border-hairline-strong',
      )}
    >
      <Link
        to={`/app/assets/${asset.id}`}
        onClick={onOpen}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-graphite"
        aria-label={`Inspect ${asset.title}`}
      >
        {asset.hasThumbnail ? (
          <img
            src={`/api/assets/${asset.id}/thumbnail`}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-graphite">
            <Icon className="size-6 text-dim" aria-hidden />
          </div>
        )}
        <div className="absolute inset-x-2.5 bottom-2 flex items-end justify-between gap-2">
          <span className="sw-num rounded-[3px] bg-black/70 px-1.5 py-0.5 text-[11.5px] text-ink">
            {formatDuration(asset.durationMs)}
          </span>
          <span className="flex items-center gap-1">
            {asset.kind === 'video' && asset.width ? (
              <span className="rounded-[3px] bg-black/70 px-1.5 py-0.5 text-[11.5px] text-mute">
                {asset.height ? `${asset.height}p` : resolutionLabel(asset.width, asset.height)}
              </span>
            ) : null}
            {playable ? (
              <span className="flex size-6 items-center justify-center rounded-[3px] bg-ember/90 text-black opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="size-3" aria-hidden fill="currentColor" />
              </span>
            ) : null}
          </span>
        </div>
        {selectable ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggle?.(asset.id);
            }}
            aria-pressed={selected}
            aria-label={`Select ${asset.title}`}
            className={cn(
              'absolute top-2 left-2 flex size-5 items-center justify-center rounded-[3px] border transition-colors',
              selected
                ? 'border-ember bg-ember text-black'
                : 'border-white/40 bg-black/50 text-transparent hover:border-white',
            )}
          >
            <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
              <path d="M2 6.2 4.6 8.8 10 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/app/assets/${asset.id}`}
            className="line-clamp-1 text-[12.5px] font-medium text-ink transition-colors hover:text-ember"
            title={asset.title}
          >
            {asset.title}
          </Link>
          {asset.status !== 'ready' ? <StatusBadge status={asset.status} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{asset.container ?? asset.kind}</Badge>
          {asset.videoCodec ? <Badge tone="neutral">{asset.videoCodec}</Badge> : null}
          {asset.audioCodec ? <Badge tone="neutral">{asset.audioCodec}</Badge> : null}
          {asset.parentAssetId ? <Badge tone="plasma">derived</Badge> : null}
        </div>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11.5px] text-dim">
          <span>{formatBytes(asset.sizeBytes)}</span>
          <span className="truncate">{asset.tags.slice(0, 2).join(' · ') || asset.sourceKind}</span>
        </div>
      </div>
    </article>
  );
}

export function AssetRow({ asset }: { asset: AssetSummary }) {
  return (
    <Link
      to={`/app/assets/${asset.id}`}
      className="grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,110px))] items-center gap-3 border-b border-hairline px-3 py-2.5 text-[12.5px] transition-colors last:border-b-0 hover:bg-white/[0.025]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {asset.hasThumbnail ? (
          <img
            src={`/api/assets/${asset.id}/thumbnail`}
            alt=""
            loading="lazy"
            className="size-9 shrink-0 rounded-[3px] object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-iron">
            <AudioLines className="size-3.5 text-dim" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-ink">{asset.title}</div>
          <div className="text-[11.5px] text-dim">
            {asset.kind} · {asset.sourceKind}
          </div>
        </div>
      </div>
      <div className="sw-num text-mute">{formatDuration(asset.durationMs)}</div>
      <div className="sw-num text-mute">{formatBytes(asset.sizeBytes)}</div>
      <div className="truncate text-[11.5px] text-mute">
        {asset.videoCodec ?? asset.audioCodec ?? '—'}
      </div>
      <div className="flex justify-end">
        <StatusBadge status={asset.status} />
      </div>
    </Link>
  );
}
