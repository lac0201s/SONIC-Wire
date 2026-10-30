import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { AssetSummary } from '@sonicwire/contracts';
import { api } from '../lib/api';
import { Input, Modal, Skeleton, StatusBadge, cn } from '../design-system/ui';
import { formatDuration } from '../lib/format';

export function AssetPicker({
  open,
  onClose,
  onSelect,
  title = 'Select an asset',
  description = 'Only assets that finished probing can be used.',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: AssetSummary) => void;
  title?: string;
  description?: string;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const assets = useQuery({
    queryKey: ['asset-picker', debounced],
    queryFn: () => api.assets({ q: debounced || undefined, limit: 30, sort: 'recent' }),
    enabled: open,
    staleTime: 5_000,
  });

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} width="lg">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-dim" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the library"
            aria-label="Search assets"
            className="pl-9"
          />
        </div>

        {assets.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : (assets.data?.items.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-[13px] text-dim">
            Nothing matches. Import media first.
          </p>
        ) : (
          <ul className="max-h-[46vh] divide-y divide-white/[0.06] overflow-y-auto">
            {assets.data?.items.map((asset) => {
              const disabled = asset.status !== 'ready';
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSelect(asset);
                      onClose();
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors',
                      disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    {asset.hasThumbnail ? (
                      <img
                        src={`/api/assets/${asset.id}/thumbnail`}
                        alt=""
                        loading="lazy"
                        className="size-10 shrink-0 rounded-[3px] object-cover"
                      />
                    ) : (
                      <div className="size-10 shrink-0 rounded-[3px] bg-iron" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-ink">{asset.title}</div>
                      <div className="text-[11.5px] text-dim">
                        {asset.kind} · {formatDuration(asset.durationMs)} · {asset.container ?? '—'}
                      </div>
                    </div>
                    <StatusBadge status={asset.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
