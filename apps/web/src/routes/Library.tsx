import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  Grid2x2,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { AssetKind, AssetStatus } from '@sonicwire/contracts';
import {
  useAssets,
  useCollections,
  useCreateCollection,
  useDeleteAsset,
  useExportAssets,
  useTags,
} from '../lib/queries';
import { AssetCard, AssetRow } from '../components/AssetCard';
import { ImportPanel } from '../components/ImportPanel';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  Modal,
  Panel,
  Select,
  Skeleton,
  cn,
  useToast,
} from '../design-system/ui';
import { ApiError } from '../lib/api';

const SORTS = [
  { id: 'recent', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'size', label: 'Largest first' },
  { id: 'duration', label: 'Longest first' },
] as const;

export default function Library() {
  const [params, setParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selection, setSelection] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { notify } = useToast();

  const q = params.get('q') ?? '';
  const kind = (params.get('kind') ?? '') as AssetKind | '';
  const status = (params.get('status') ?? '') as AssetStatus | '';
  const collectionId = params.get('collection') ?? '';
  const tag = params.get('tag') ?? '';
  const sort = (params.get('sort') ?? 'recent') as (typeof SORTS)[number]['id'];

  const assets = useAssets({
    q: q || undefined,
    kind: kind || undefined,
    status: status || undefined,
    collectionId: collectionId || undefined,
    tag: tag || undefined,
    sort,
    limit: 36,
  });
  const collections = useCollections();
  const tags = useTags();
  const createCollection = useCreateCollection();
  const exportAssets = useExportAssets();
  const deleteAsset = useDeleteAsset();

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (searchDraft.trim()) next.set('q', searchDraft.trim());
      else next.delete('q');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const updateParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const items = useMemo(() => assets.data?.pages.flatMap((page) => page.items) ?? [], [assets.data]);
  const total = assets.data?.pages[0]?.total ?? 0;
  const filtersActive = Boolean(q || kind || status || collectionId || tag);

  const toggle = (id: string): void => {
    setSelection((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const runExport = (): void => {
    if (selection.length === 0) return;
    exportAssets.mutate(selection, {
      onSuccess: () => {
        notify({
          tone: 'ok',
          title: 'Bundle queued',
          body: `${selection.length} asset(s) are being packaged. The download link appears in the observatory when the job succeeds.`,
        });
        setSelection([]);
      },
      onError: (error) =>
        notify({
          tone: 'danger',
          title: 'Export refused',
          body: error instanceof ApiError ? error.message : 'Could not queue the export.',
        }),
    });
  };

  const confirmDelete = (): void => {
    const ids = [...selection];
    void Promise.all(ids.map((id) => deleteAsset.mutateAsync(id)))
      .then(() => {
        notify({ tone: 'ok', title: `${ids.length} asset(s) removed from the library` });
        setSelection([]);
        setDeleteOpen(false);
      })
      .catch((error: unknown) =>
        notify({
          tone: 'danger',
          title: 'Delete failed',
          body: error instanceof ApiError ? error.message : 'Unknown error',
        }),
      );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.04] font-semibold tracking-[-0.04em]">
            {total} {total === 1 ? 'asset' : 'assets'} under management
          </h1>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-mute">
            Stable identity by content hash. Collections and tags are metadata — files never move
            because you renamed something.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setCollectionOpen(true)}>
            <Plus className="size-3.5" aria-hidden /> Collection
          </Button>
          <Button size="sm" variant="primary" onClick={() => setImportOpen(true)}>
            Import media
          </Button>
        </div>
      </div>

      <Panel className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-dim" aria-hidden />
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search titles…"
              aria-label="Search assets"
              className="pl-9"
            />
            {searchDraft ? (
              <button
                type="button"
                onClick={() => setSearchDraft('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-dim hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
            <Select value={kind} onChange={(event) => updateParam('kind', event.target.value)} aria-label="Filter by media kind">
              <option value="">All media</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="image">Image</option>
            </Select>
            <Select value={status} onChange={(event) => updateParam('status', event.target.value)} aria-label="Filter by status">
              <option value="">Any status</option>
              <option value="ready">Ready</option>
              <option value="probing">Probing</option>
              <option value="queued">Queued</option>
              <option value="error">Error</option>
            </Select>
            <Select
              value={collectionId}
              onChange={(event) => updateParam('collection', event.target.value)}
              aria-label="Filter by collection"
            >
              <option value="">All collections</option>
              {collections.data?.items.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </Select>
            <Select value={tag} onChange={(event) => updateParam('tag', event.target.value)} aria-label="Filter by tag">
              <option value="">All tags</option>
              {tags.data?.items.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name} ({item.assetCount})
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Select
              value={sort}
              onChange={(event) => updateParam('sort', event.target.value)}
              aria-label="Sort assets"
              className="w-[150px]"
            >
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            <div className="flex rounded-[5px] border border-hairline p-0.5">
              <IconButton label="Grid view" onClick={() => setView('grid')} className={view === 'grid' ? 'text-ember' : ''}>
                <Grid2x2 className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton label="List view" onClick={() => setView('list')} className={view === 'list' ? 'text-ember' : ''}>
                <List className="size-3.5" aria-hidden />
              </IconButton>
            </div>
          </div>
        </div>

        {filtersActive ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
            <span className="sw-label">Filters</span>
            {q ? <Badge tone="ember">q: {q}</Badge> : null}
            {kind ? <Badge tone="ember">{kind}</Badge> : null}
            {status ? <Badge tone="ember">{status}</Badge> : null}
            {collectionId ? (
              <Badge tone="ember">
                {collections.data?.items.find((item) => item.id === collectionId)?.name ?? 'collection'}
              </Badge>
            ) : null}
            {tag ? <Badge tone="ember">#{tag}</Badge> : null}
            <button
              type="button"
              className="ml-1 text-[11.5px] text-dim hover:text-ink"
              onClick={() => {
                setSearchDraft('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              reset
            </button>
          </div>
        ) : null}
      </Panel>

      {selection.length > 0 ? (
        <div className="sticky top-[68px] z-30 flex flex-wrap items-center gap-2 rounded-[7px] bg-[#170f08] px-3 py-2">
          <span className="sw-num text-[12px] text-ember-soft">{selection.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={runExport} loading={exportAssets.isPending}>
              <Archive className="size-3.5" aria-hidden /> Export bundle
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelection([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {assets.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      ) : assets.isError ? (
        <EmptyState
          title="The library query failed"
          description="The API rejected the request. Check the server log, then retry."
          action={<Button onClick={() => void assets.refetch()}>Retry</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="size-5" />}
          title={filtersActive ? 'No assets match those filters' : 'Nothing in the universe yet'}
          description={
            filtersActive
              ? 'Widen the query or reset the filters. Filters combine, not replace.'
              : 'Import local media or acquire an authorized direct URL. Probing starts automatically.'
          }
          action={
            filtersActive ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchDraft('');
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                Reset filters
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setImportOpen(true)}>
                Import media
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              selectable
              selected={selection.includes(asset.id)}
              onToggle={toggle}
            />
          ))}
        </div>
      ) : (
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,110px))] gap-3 border-b border-hairline bg-black/25 px-3 py-2 lg:grid">
            {['Asset', 'Duration', 'Size', 'Codec', 'Status'].map((heading) => (
              <span key={heading} className={cn('sw-label', heading === 'Status' && 'text-right')}>
                {heading}
              </span>
            ))}
          </div>
          {items.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
        </Panel>
      )}

      {assets.hasNextPage ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => void assets.fetchNextPage()}
            loading={assets.isFetchingNextPage}
          >
            Load more ({total - items.length} remaining)
          </Button>
        </div>
      ) : null}

      {importOpen ? (
        <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import media" width="lg">
          <ImportPanel onImported={() => setImportOpen(false)} />
        </Modal>
      ) : null}

      <Modal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        title="New collection"
        description="Collections group assets without duplicating files."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCollectionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!newCollection.name.trim()}
              loading={createCollection.isPending}
              onClick={() =>
                createCollection.mutate(
                  {
                    name: newCollection.name.trim(),
                    description: newCollection.description.trim() || null,
                  },
                  {
                    onSuccess: () => {
                      setNewCollection({ name: '', description: '' });
                      setCollectionOpen(false);
                      notify({ tone: 'ok', title: 'Collection created' });
                    },
                    onError: (error) =>
                      notify({
                        tone: 'danger',
                        title: 'Could not create collection',
                        body: error instanceof ApiError ? error.message : 'Unknown error',
                      }),
                  },
                )
              }
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="collection-name">
            <Input
              id="collection-name"
              autoFocus
              maxLength={80}
              value={newCollection.name}
              onChange={(event) => setNewCollection({ ...newCollection, name: event.target.value })}
              placeholder="Field recordings"
            />
          </Field>
          <Field label="Description" htmlFor="collection-description">
            <Input
              id="collection-description"
              maxLength={400}
              value={newCollection.description}
              onChange={(event) =>
                setNewCollection({ ...newCollection, description: event.target.value })
              }
              placeholder="Optional context for collaborators"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Remove ${selection.length} asset${selection.length === 1 ? '' : 's'}?`}
        description="Assets are soft-deleted: records leave the library immediately, files are removed by the retention worker. This cannot be undone in the UI."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep them
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteAsset.isPending}>
              Remove from library
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-mute">
          Derivatives built from these assets are retained individually; review them first if they
          matter.
        </p>
      </Modal>
    </div>
  );
}
