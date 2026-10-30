import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  Activity,
  CornerDownLeft,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  Import,
  LayoutDashboard,
  LibraryBig,
  Search,
  Settings2,
  SlidersHorizontal,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, Kbd } from '../design-system/ui';
import { formatDuration } from '../lib/format';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Assets' | 'Actions';
  icon: typeof Search;
  run: () => void;
}

const STATIC_NAV = [
  { label: 'Command deck', path: '/app', icon: LayoutDashboard, hint: 'g c' },
  { label: 'Media Universe', path: '/app/library', icon: LibraryBig, hint: 'g l' },
  { label: 'Acquisition', path: '/app/acquire', icon: Import, hint: 'g a' },
  { label: 'Transformation Studio', path: '/app/studio', icon: SlidersHorizontal, hint: 'g s' },
  { label: 'Workflow Intelligence', path: '/app/workflows', icon: WorkflowIcon, hint: 'g w' },
  { label: 'Observatory', path: '/app/observatory', icon: Activity, hint: 'g o' },
  { label: 'Settings', path: '/app/settings', icon: Settings2, hint: 'g g' },
];

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query.trim(), 180);

  const assetQuery = useQuery({
    queryKey: ['palette-assets', debounced],
    queryFn: () => api.assets({ q: debounced || undefined, limit: 6, sort: 'recent' }),
    enabled: open && debounced.length > 0,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const needle = query.trim().toLowerCase();
    const nav: Command[] = STATIC_NAV.filter(
      (item) => !needle || item.label.toLowerCase().includes(needle),
    ).map((item) => ({
      id: `nav-${item.path}`,
      label: item.label,
      hint: item.hint,
      group: 'Navigate' as const,
      icon: item.icon,
      run: () => navigate(item.path),
    }));

    const actions: Command[] = [
      {
        id: 'action-import',
        label: 'Import media files',
        hint: 'Upload to this machine',
        group: 'Actions' as const,
        icon: Import,
        run: () => navigate('/app/acquire?tab=upload'),
      },
      {
        id: 'action-url',
        label: 'Acquire from a URL',
        hint: 'Authorized direct media only',
        group: 'Actions' as const,
        icon: Import,
        run: () => navigate('/app/acquire?tab=url'),
      },
    ].filter((item) => !needle || item.label.toLowerCase().includes(needle));

    const assets: Command[] = (assetQuery.data?.items ?? []).map((asset) => ({
      id: `asset-${asset.id}`,
      label: asset.title,
      hint: `${asset.kind} · ${formatDuration(asset.durationMs)}`,
      group: 'Assets' as const,
      icon: asset.kind === 'video' ? FileVideo : asset.kind === 'image' ? ImageIcon : FileAudio,
      run: () => navigate(`/app/assets/${asset.id}`),
    }));

    return [...nav, ...actions, ...assets];
  }, [assetQuery.data, navigate, query]);

  useEffect(() => {
    setActive(0);
  }, [commands.length]);

  if (!open) return null;

  const run = (command: Command | undefined): void => {
    if (!command) return;
    command.run();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="sw-panel-raised relative z-10 w-full max-w-xl overflow-hidden"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((current) => (current + 1) % Math.max(1, commands.length));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((current) => (current - 1 + commands.length) % Math.max(1, commands.length));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            run(commands[active]);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          <Search className="size-4 shrink-0 text-dim" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a surface, find an asset, run an action…"
            aria-label="Command palette query"
            className="w-full bg-transparent text-[14px] text-ink placeholder:text-dim focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {commands.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-dim">
              No matches. Try a different term.
            </p>
          ) : (
            commands.map((command, index) => {
              const previous = commands[index - 1];
              const showGroup = !previous || previous.group !== command.group;
              return (
                <div key={command.id}>
                  {showGroup ? (
                    <div className="sw-label px-4 pt-3 pb-1.5">{command.group}</div>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run(command)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                      index === active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    <command.icon
                      className={cn('size-4 shrink-0', index === active ? 'text-ember' : 'text-dim')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{command.label}</span>
                    {command.hint ? (
                      <span className="shrink-0 text-[11.5px] text-dim">{command.hint}</span>
                    ) : null}
                    {index === active ? (
                      <CornerDownLeft className="size-3 shrink-0 text-dim" aria-hidden />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-hairline bg-black/25 px-4 py-2 text-[10.5px] text-dim">
          <span className="">SonicWire command palette</span>
          <span className="flex items-center gap-2">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <Kbd>↵</Kbd>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
