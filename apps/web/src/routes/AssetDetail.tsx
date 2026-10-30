import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  GitBranch,
  RefreshCcw,
  Tags,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  useAsset,
  useCollections,
  useDeleteAsset,
  useDerivatives,
  useExportAssets,
  useJobs,
  useReprobe,
  useUpdateAsset,
} from '../lib/queries';
import { ApiError } from '../lib/api';
import { Measurements } from '../components/Measurements';
import { MediaPlayer } from '../components/MediaPlayer';
import { TransformPanel } from '../components/TransformPanel';
import { JobList, jobLabel } from '../components/JobList';
import {
  Badge,
  Button,
  DataRow,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  Modal,
  Panel,
  SectionHeading,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  cn,
  useToast,
} from '../design-system/ui';
import {
  formatBitrate,
  formatBytes,
  formatDateTime,
  formatDuration,
  formatRelative,
  resolutionLabel,
} from '../lib/format';

export default function AssetDetail() {
  const { assetId = '' } = useParams();
  const navigate = useNavigate();
  const asset = useAsset(assetId);
  const derivatives = useDerivatives(assetId);
  const collections = useCollections();
  const jobs = useJobs({ limit: 50 });
  const update = useUpdateAsset();
  const reprobe = useReprobe();
  const exportAssets = useExportAssets();
  const remove = useDeleteAsset();
  const { notify } = useToast();

  const [tab, setTab] = useState('inspect');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (asset.data) {
      setTitleDraft(asset.data.title);
      setTagDraft(asset.data.tags.join(', '));
    }
  }, [asset.data?.id]);

  if (asset.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (asset.isError || !asset.data) {
    return (
      <EmptyState
        title="Asset unavailable"
        description={
          asset.error instanceof ApiError ? asset.error.message : 'This asset could not be loaded.'
        }
        action={
          <Button variant="outline" onClick={() => navigate('/app/library')}>
            <ArrowLeft className="size-3.5" aria-hidden /> Back to the universe
          </Button>
        }
      />
    );
  }

  const data = asset.data;
  const relatedJobs = (jobs.data?.items ?? []).filter(
    (job) => job.payload.assetId === data.id || job.id === data.id,
  );
  const quality = data.quality;

  const saveTitle = (): void => {
    if (!titleDraft.trim() || titleDraft === data.title) {
      setEditingTitle(false);
      return;
    }
    update.mutate(
      { id: data.id, body: { title: titleDraft.trim() } },
      {
        onSuccess: () => {
          setEditingTitle(false);
          notify({ tone: 'ok', title: 'Title updated' });
        },
        onError: (error) =>
          notify({
            tone: 'danger',
            title: 'Rename failed',
            body: error instanceof ApiError ? error.message : 'Unknown error',
          }),
      },
    );
  };

  const saveTags = (): void => {
    const tags = tagDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
    update.mutate(
      { id: data.id, body: { tags } },
      {
        onSuccess: () => notify({ tone: 'ok', title: 'Tags saved' }),
        onError: (error) =>
          notify({
            tone: 'danger',
            title: 'Tag update failed',
            body: error instanceof ApiError ? error.message : 'Unknown error',
          }),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/app/library"
            className="inline-flex items-center gap-1.5 text-[11.5px] text-dim transition-colors hover:text-ember"
          >
            <ArrowLeft className="size-3" aria-hidden /> Universe / asset
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            {editingTitle ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveTitle();
                  if (event.key === 'Escape') {
                    setTitleDraft(data.title);
                    setEditingTitle(false);
                  }
                }}
                aria-label="Asset title"
                className="h-9 max-w-md text-[16px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="text-left text-[clamp(1.35rem,2.6vw,1.9rem)] leading-tight font-semibold tracking-[-0.035em] text-ink hover:text-ember-soft"
                title="Rename asset"
              >
                {data.title}
              </button>
            )}
            <StatusBadge status={data.status} />
            {data.parentAssetId ? <Badge tone="plasma">derivative</Badge> : null}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-dim">
            <span>{data.kind}</span>
            <span>·</span>
            <span>{data.container ?? 'unknown container'}</span>
            <span>·</span>
            <span>{formatBytes(data.sizeBytes)}</span>
            <span>·</span>
            <span>acquired {formatRelative(data.acquiredAt)}</span>
            {data.sourceUrl ? (
              <>
                <span>·</span>
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-signal hover:text-plasma"
                >
                  source <ExternalLink className="size-2.5" aria-hidden />
                </a>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => reprobe.mutate(data.id)} loading={reprobe.isPending}>
            <RefreshCcw className="size-3.5" aria-hidden /> Re-probe
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={exportAssets.isPending}
            onClick={() =>
              exportAssets.mutate([data.id], {
                onSuccess: () =>
                  notify({
                    tone: 'ok',
                    title: 'Bundle queued',
                    body: 'The download appears in the observatory once packaging finishes.',
                  }),
              })
            }
          >
            <Download className="size-3.5" aria-hidden /> Export
          </Button>
          <IconButton label="Delete asset" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <MediaPlayer asset={data} />

          <Panel>
            <div className="border-b border-hairline px-4">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'inspect', label: 'Inspection' },
                  { id: 'streams', label: 'Streams', count: data.streams.length },
                  { id: 'lineage', label: 'Lineage', count: data.derivedCount },
                  { id: 'jobs', label: 'Job history', count: relatedJobs.length },
                ]}
              />
            </div>

            <div className="p-4">
              {tab === 'inspect' ? (
                <div className="space-y-5">
                  {data.probe ? (
                    <div className="grid gap-x-8 sm:grid-cols-2">
                      <dl className="divide-y divide-white/[0.05]">
                        <DataRow label="Container" value={data.probe.formatLongName ?? data.container ?? '—'} />
                        <DataRow label="Duration" value={formatDuration(data.probe.durationMs)} />
                        <DataRow label="Bit rate" value={formatBitrate(data.probe.bitRate)} />
                        <DataRow label="Streams" value={data.probe.streamCount} />
                        <DataRow label="Colour primaries" value={data.probe.colorPrimaries ?? '—'} />
                        <DataRow label="Probed" value={formatRelative(data.probe.probedAt)} />
                      </dl>
                      <dl className="divide-y divide-white/[0.05]">
                        <DataRow label="Resolution" value={resolutionLabel(data.width, data.height)} />
                        <DataRow label="Video codec" value={data.videoCodec ?? '—'} />
                        <DataRow label="Audio codec" value={data.audioCodec ?? '—'} />
                        <DataRow label="Sample rate" value={quality?.sampleRate ? `${quality.sampleRate} Hz` : '—'} />
                        <DataRow label="Channels" value={quality?.channels ?? '—'} />
                        <DataRow label="SHA-256" value={<span className="text-[10.5px]">{data.sha256.slice(0, 24)}…</span>} />
                      </dl>
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-mute">Probe data is not available for this asset yet.</p>
                  )}

                  {quality ? (
                    <div className="rounded-[5px] border border-hairline bg-black/25 p-3.5">
                      <Label>Quality facts</Label>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Badge tone={quality.hdr ? 'plasma' : 'neutral'}>{quality.hdr ? 'HDR transfer' : 'SDR transfer'}</Badge>
                        <Badge tone={quality.variableFrameRate ? 'warn' : 'neutral'}>
                          {quality.variableFrameRate ? 'variable frame rate' : 'constant frame rate'}
                        </Badge>
                        <Badge tone={quality.lossyAudio ? 'warn' : 'ok'}>
                          {quality.lossyAudio ? 'lossy audio source' : 'lossless audio source'}
                        </Badge>
                      </div>
                      {quality.notes.length > 0 ? (
                        <ul className="mt-3 space-y-1.5">
                          {quality.notes.map((note) => (
                            <li key={note} className="flex gap-2 text-[11.5px] leading-relaxed text-mute">
                              <TriangleAlert className="mt-0.5 size-3 shrink-0 text-warn" aria-hidden />
                              {note}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {data.probe?.warnings.length ? (
                    <div>
                      <Label>Probe warnings</Label>
                      <ul className="mt-2 space-y-1.5">
                        {data.probe.warnings.map((warning) => (
                          <li
                            key={warning}
                            className="flex items-start gap-2 rounded-[4px] bg-warn/[0.06] px-2.5 py-1.5 text-[11.5px] leading-relaxed text-warn"
                          >
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="sw-hairline" />

                  <Measurements
                    assetId={data.id}
                    canMeasure
                    poll={relatedJobs.some(
                      (job) =>
                        job.kind === 'media.analyze' &&
                        (job.status === 'running' || job.status === 'queued'),
                    )}
                  />

                  {Object.keys(data.metadata).length > 0 ? (
                    <div>
                      <Label>Container metadata</Label>
                      <dl className="mt-2">
                        {Object.entries(data.metadata)
                          .slice(0, 12)
                          .map(([key, value]) => (
                            <DataRow key={key} label={key} value={value} numeric={false} />
                          ))}
                      </dl>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'streams' ? (
                <div className="overflow-x-auto">
                  {data.streams.length === 0 ? (
                    <p className="py-6 text-center text-[12.5px] text-mute">No stream inventory recorded.</p>
                  ) : (
                    <table className="w-full min-w-[640px] text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-hairline">
                          {['#', 'Type', 'Codec', 'Detail', 'Bit rate', 'Lang'].map((heading) => (
                            <th key={heading} className="sw-label py-2 pr-4 font-normal">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.streams.map((stream) => (
                          <tr key={stream.index} className="border-b border-white/[0.04] last:border-0">
                            <td className="sw-num py-2 pr-4 text-dim">{stream.index}</td>
                            <td className="py-2 pr-4 text-ink">{stream.type}</td>
                            <td className="py-2 pr-4 text-[11.5px] text-mute">
                              {stream.codec ?? '—'}
                              {stream.profile ? <span className="text-dim"> · {stream.profile}</span> : null}
                            </td>
                            <td className="py-2 pr-4 text-mute">
                              {stream.type === 'video'
                                ? `${stream.width ?? '?'}×${stream.height ?? '?'} · ${stream.frameRate ?? '?'} fps${stream.hdr ? ' · HDR' : ''}`
                                : stream.type === 'audio'
                                  ? `${stream.sampleRate ?? '?'} Hz · ${stream.channels ?? '?'} ch${stream.channelLayout ? ` · ${stream.channelLayout}` : ''}`
                                  : (stream.title ?? stream.language ?? '—')}
                            </td>
                            <td className="sw-num py-2 pr-4 text-mute">{formatBitrate(stream.bitRate)}</td>
                            <td className="py-2 text-[11.5px] text-dim">
                              {stream.language ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}

              {tab === 'lineage' ? (
                <div className="space-y-4">
                  {data.parentAssetId ? (
                    <Link
                      to={`/app/assets/${data.parentAssetId}`}
                      className="flex items-center gap-2 rounded-[5px] border border-hairline bg-black/25 px-3 py-2 text-[12.5px] text-mute hover:border-hairline-strong hover:text-ink"
                    >
                      <GitBranch className="size-3.5 text-plasma" aria-hidden /> Parent source asset
                    </Link>
                  ) : (
                    <p className="text-[12px] text-dim">This is an original source asset.</p>
                  )}
                  {derivatives.isPending ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (derivatives.data?.items.length ?? 0) === 0 ? (
                    <p className="text-[12.5px] text-mute">
                      No derivatives yet. Use the transformation panel to create one — the source is
                      never modified.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {derivatives.data?.items.map((derivative) => (
                        <li key={derivative.id}>
                          <Link
                            to={`/app/assets/${derivative.id}`}
                            className="flex items-center gap-3 rounded-[5px] border border-hairline bg-black/25 px-3 py-2 transition-colors hover:border-hairline-strong"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12.5px] text-ink">{derivative.title}</div>
                              <div className="text-[11.5px] text-dim">
                                {derivative.container} · {formatBytes(derivative.sizeBytes)} ·{' '}
                                {formatRelative(derivative.createdAt)}
                              </div>
                            </div>
                            <StatusBadge status={derivative.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {tab === 'jobs' ? (
                relatedJobs.length > 0 ? (
                  <JobList jobs={relatedJobs} compact />
                ) : (
                  <p className="text-[12.5px] text-mute">No jobs recorded for this asset.</p>
                )
              ) : null}{/* end tabs */}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <TransformPanel asset={data} />

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <Label>Tags</Label>
              <Tags className="size-3.5 text-dim" aria-hidden />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.tags.length === 0 ? (
                <span className="text-[12px] text-dim">No tags yet</span>
              ) : (
                data.tags.map((tag) => (
                  <Link key={tag} to={`/app/library?tag=${encodeURIComponent(tag)}`}>
                    <Badge tone="neutral">#{tag}</Badge>
                  </Link>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="ambient, interview"
                aria-label="Tags, comma separated"
                className="h-9 text-[12px]"
              />
              <Button size="sm" variant="quiet" onClick={saveTags} loading={update.isPending}>
                <Check className="size-3.5" aria-hidden />
              </Button>
            </div>
          </Panel>

          <Panel className="p-5">
            <Label>Collections</Label>
            <div className="mt-3 space-y-2">
              <Select
                aria-label="Add to collection"
                value=""
                onChange={(event) => {
                  const collectionId = event.target.value;
                  if (!collectionId) return;
                  update.mutate(
                    {
                      id: data.id,
                      body: {
                        collectionIds: [...new Set([...data.collectionIds, collectionId])],
                      },
                    },
                    {
                      onSuccess: () => notify({ tone: 'ok', title: 'Added to collection' }),
                    },
                  );
                }}
              >
                <option value="">Add to a collection…</option>
                {collections.data?.items
                  .filter((collection) => !data.collectionIds.includes(collection.id))
                  .map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {data.collectionIds.length === 0 ? (
                  <span className="text-[12px] text-dim">Not in any collection</span>
                ) : (
                  data.collectionIds.map((id) => {
                    const collection = collections.data?.items.find((item) => item.id === id);
                    return (
                      <Link key={id} to={`/app/library?collection=${id}`}>
                        <Badge tone="plasma">{collection?.name ?? 'collection'}</Badge>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <Label>Provenance</Label>
            <dl className="mt-2">
              <DataRow label="Source" value={data.sourceKind} />
              <DataRow label="Acquired" value={formatDateTime(data.acquiredAt)} />
              <DataRow label="Created" value={formatDateTime(data.createdAt)} />
              <DataRow label="Updated" value={formatDateTime(data.updatedAt)} />
              <DataRow label="Storage" value={formatBytes(data.storageBytes)} />
              <DataRow label="Version" value={data.version} />
            </dl>
            <p className="mt-3 text-[11.5px] leading-relaxed break-all text-dim">{data.sha256}</p>
          </Panel>

          {relatedJobs.length > 0 ? (
            <Panel className="p-5">
              <Label>Latest job</Label>
              <div className="mt-2">
                <JobList jobs={relatedJobs.slice(0, 2)} compact />
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Remove “${data.title}”?`}
        description="The asset leaves the library immediately. Stored files are purged by the retention worker; derivatives remain unless removed individually."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep asset
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(data.id, {
                  onSuccess: () => {
                    notify({ tone: 'ok', title: 'Asset removed from library' });
                    navigate('/app/library');
                  },
                  onError: (error) =>
                    notify({
                      tone: 'danger',
                      title: 'Removal failed',
                      body: error instanceof ApiError ? error.message : 'Unknown error',
                    }),
                })
              }
            >
              Remove asset
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-mute">
          This operation is recorded in the audit trail with your account id.
        </p>
      </Modal>
    </div>
  );
}
