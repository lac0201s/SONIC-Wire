import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Link2,
  ShieldQuestion,
  UploadCloud,
} from 'lucide-react';
import { ApiError, uploadFile } from '../lib/api';
import { useCollections, useIngestUrl } from '../lib/queries';
import {
  Badge,
  Button,
  Field,
  Input,
  Label,
  Panel,
  ProgressBar,
  Select,
  Tabs,
  cn,
  useToast,
} from '../design-system/ui';
import { formatBytes } from '../lib/format';

type TabId = 'upload' | 'url';

interface QueueItem {
  name: string;
  size: number;
  status: 'waiting' | 'uploading' | 'done' | 'error' | 'duplicate';
  progress: number;
  message?: string;
  assetId?: string;
}

export function ImportPanel({
  defaultTab = 'upload',
  onImported,
}: {
  defaultTab?: TabId;
  onImported?: (assetId: string) => void;
}) {
  const [tab, setTab] = useState<TabId>(defaultTab);
  const collections = useCollections();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  // ---- upload state
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState('');
  const [collectionId, setCollectionId] = useState('');

  // ---- url state
  const ingestUrl = useIngestUrl();
  const [url, setUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ jobId: string; note: string | null } | null>(null);

  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files)
      .filter((file) => file.size > 0)
      .map<QueueItem>((file) => ({ name: file.name, size: file.size, status: 'waiting', progress: 0 }));
    setQueue((current) => [...current, ...next]);
    return Array.from(files).filter((file) => file.size > 0);
  };

  const startUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    for (const file of files) {
      setQueue((current) =>
        current.map((item) =>
          item.name === file.name && item.status === 'waiting'
            ? { ...item, status: 'uploading' }
            : item,
        ),
      );
      try {
        const fields: Record<string, string> = {};
        if (tags) fields.tags = tags;
        if (collectionId) fields.collectionId = collectionId;
        const result = await uploadFile(file, fields, {
          onProgress: (progress) => {
            setQueue((current) =>
              current.map((item) =>
                item.name === file.name && item.status === 'uploading'
                  ? { ...item, progress: progress.total ? progress.loaded / progress.total : 0.5 }
                  : item,
              ),
            );
          },
        });
        setQueue((current) =>
          current.map((item) =>
            item.name === file.name && item.status === 'uploading'
              ? {
                  ...item,
                  status: result.duplicate ? 'duplicate' : 'done',
                  progress: 1,
                  assetId: result.assetId,
                  message: result.duplicate ? 'Identical content already in the library' : 'Probing queued',
                }
              : item,
          ),
        );
        onImported?.(result.assetId);
        void queryClient.invalidateQueries({ queryKey: ['assets'] });
        void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      } catch (error) {
        setQueue((current) =>
          current.map((item) =>
            item.name === file.name && item.status === 'uploading'
              ? {
                  ...item,
                  status: 'error',
                  progress: 0,
                  message: error instanceof ApiError ? error.message : 'Upload failed',
                }
              : item,
          ),
        );
      }
    }
    setBusy(false);
    notify({
      tone: 'ok',
      title: 'Import finished',
      body: 'Probing runs in the background; assets appear as soon as metadata is verified.',
    });
  };

  const submitUrl = (event: React.FormEvent) => {
    event.preventDefault();
    setUrlError(null);
    setReceipt(null);
    ingestUrl.mutate(
      {
        url,
        title: urlTitle || undefined,
        collectionId: collectionId || undefined,
        tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
      },
      {
        onSuccess: (data) => {
          setReceipt({ jobId: data.jobId, note: data.note });
          setUrl('');
          setUrlTitle('');
          notify({
            tone: 'ok',
            title: 'Acquisition queued',
            body: 'The transfer is validated against the SSRF guard, then probed on completion.',
          });
        },
        onError: (error) => {
          setUrlError(
            error instanceof ApiError ? error.message : 'The acquisition could not be queued.',
          );
        },
      },
    );
  };


  return (
    <Panel raised className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Ingestion</Label>
          <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.03em]">Bring media in</h2>
        </div>
        <Badge tone="neutral">bounded · hashed · probed</Badge>
      </div>

      <Tabs
        className="mt-5 border-b border-hairline"
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: 'upload', label: 'Local upload' },
          { id: 'url', label: 'Direct URL' },
        ]}
      />

      <div className="mt-5 space-y-4">
        {tab === 'upload' ? (
          <>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const files = addFiles(event.dataTransfer.files);
                void startUpload(files);
              }}
              className={cn(
                'relative flex flex-col items-center justify-center gap-3 rounded-[7px] border border-dashed px-6 py-10 text-center transition-colors',
                dragging ? 'border-ember bg-ember/[0.06]' : 'border-hairline-strong bg-black/20',
              )}
            >
              <UploadCloud className={cn('size-6', dragging ? 'text-ember' : 'text-dim')} aria-hidden />
              <div>
                <p className="text-[13.5px] font-medium text-ink">Drop audio, video or images here</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-mute">
                  Streamed to local scratch storage, SHA-256 hashed while writing, then probed.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <FileUp className="size-3.5" aria-hidden />
                Choose files
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="video/*,audio/*,image/*"
                className="sr-only"
                onChange={(event) => {
                  if (!event.target.files) return;
                  const files = addFiles(event.target.files);
                  event.target.value = '';
                  void startUpload(files);
                }}
              />
            </div>


            {queue.length > 0 ? (
              <ul className="space-y-2">
                {queue.map((item, index) => (
                  <li
                    key={`${item.name}-${index}`}
                    className="rounded-[5px] border border-hairline bg-black/25 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] text-ink">{item.name}</div>
                        <div className="text-[11.5px] text-dim">
                          {formatBytes(item.size)} · {item.message ?? item.status}
                        </div>
                      </div>
                      {item.status === 'done' ? (
                        <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
                      ) : item.status === 'duplicate' ? (
                        <ShieldQuestion className="size-4 shrink-0 text-warn" aria-hidden />
                      ) : item.status === 'error' ? (
                        <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
                      ) : null}
                    </div>
                    {item.status === 'uploading' ? (
                      <ProgressBar value={item.progress} className="mt-2" />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <form onSubmit={submitUrl} className="space-y-4">
            <Field
              label="Media URL"
              htmlFor="ingest-url"
              hint="Only direct media URLs you are authorized to fetch. Provider pages are refused."
            >
              <div className="relative">
                <Link2 className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-dim" aria-hidden />
                <Input
                  id="ingest-url"
                  type="url"
                  required
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://archive.org/download/item/file.flac"
                  className="pl-9"
                />
              </div>
            </Field>
            <Field label="Display title (optional)" htmlFor="ingest-title">
              <Input
                id="ingest-title"
                value={urlTitle}
                onChange={(event) => setUrlTitle(event.target.value)}
                placeholder="Derived from the filename if empty"
              />
            </Field>

            {urlError ? (
              <div
                role="alert"
                className="rounded-[5px] border border-warn/30 bg-warn/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-warn"
              >
                {urlError}
              </div>
            ) : null}

            {receipt ? (
              <div className="rounded-[5px] border border-plasma/25 bg-plasma/[0.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-plasma">
                Queued job <span className="">{receipt.jobId.slice(0, 8)}</span>. DNS is
                re-validated on every redirect hop; the transfer is capped and discarded if it ends early.
                {receipt.note ? <span className="mt-1 block text-mute">{receipt.note}</span> : null}
              </div>
            ) : null}

            <Button type="submit" variant="primary" className="w-full" loading={ingestUrl.isPending}>
              Queue acquisition
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </form>
        )}

        <div className="sw-hairline" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tags" htmlFor="ingest-tags" hint="Comma separated, max 20">
            <Input
              id="ingest-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="interview, 2026"
            />
          </Field>
          <Field label="Collection" htmlFor="ingest-collection">
            <Select
              id="ingest-collection"
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
            >
              <option value="">No collection</option>
              {collections.data?.items.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-dim">
          Uploads are limited by the configured byte cap. Duplicate content is detected by hash and
          reuses the existing asset rather than storing a second copy.
        </p>
      </div>
    </Panel>
  );
}
