import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, SlidersHorizontal, Wand2 } from 'lucide-react';
import type { AssetSummary } from '@sonicwire/contracts';
import { useAsset, useJobs } from '../lib/queries';
import { AssetPicker } from '../components/AssetPicker';
import { TransformPanel, PresetGrid } from '../components/TransformPanel';
import { JobList } from '../components/JobList';
import {
  Badge,
  Button,
  DataRow,
  EmptyState,
  Label,
  Panel,
  SectionHeading,
  Skeleton,
  StatusBadge,
} from '../design-system/ui';
import { formatBytes, formatDuration, resolutionLabel } from '../lib/format';

export default function Studio() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<AssetSummary | null>(null);
  const asset = useAsset(selected?.id ?? '');
  const jobs = useJobs({ limit: 12 });

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Derive exactly what you asked for."
        description="Every preset is built from explicit FFmpeg arguments — no shell interpolation, no silent quality changes. The source stays untouched and each derivative carries verified metadata."
        action={
          <Button variant="primary" onClick={() => setPickerOpen(true)}>
            {selected ? 'Change source asset' : 'Select source asset'}
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {!selected ? (
            <EmptyState
              icon={<SlidersHorizontal className="size-5" />}
              title="Pick an asset to work on"
              description="Choose any ready asset from the universe. Audio can be extracted from video, video can be transcoded, remuxed or trimmed."
              action={
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  Open library picker
                </Button>
              }
            />
          ) : asset.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : asset.data ? (
            <Panel raised className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  {asset.data.hasThumbnail ? (
                    <img
                      src={`/api/assets/${asset.data.id}/thumbnail`}
                      alt=""
                      className="size-20 rounded-[5px] object-cover"
                    />
                  ) : (
                    <div className="size-20 rounded-[5px] bg-iron" />
                  )}
                  <div className="min-w-0">
                    <Label>Source asset</Label>
                    <Link
                      to={`/app/assets/${asset.data.id}`}
                      className="mt-1 block truncate text-[15px] font-medium text-ink hover:text-ember"
                    >
                      {asset.data.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{asset.data.kind}</Badge>
                      <Badge tone="neutral">{asset.data.container ?? '—'}</Badge>
                      <StatusBadge status={asset.data.status} />
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
                  Replace
                </Button>
              </div>

              <dl className="mt-5 grid gap-x-8 sm:grid-cols-2">
                <div className="divide-y divide-white/[0.05]">
                  <DataRow label="Duration" value={formatDuration(asset.data.durationMs)} />
                  <DataRow label="Resolution" value={resolutionLabel(asset.data.width, asset.data.height)} />
                  <DataRow label="Video" value={asset.data.videoCodec ?? '—'} />
                </div>
                <div className="divide-y divide-white/[0.05]">
                  <DataRow label="Audio" value={asset.data.audioCodec ?? '—'} />
                  <DataRow label="Size" value={formatBytes(asset.data.sizeBytes)} />
                  <DataRow label="Frame mode" value={asset.data.quality?.variableFrameRate ? 'variable' : 'constant'} />
                </div>
              </dl>

              {asset.data.quality?.notes.length ? (
                <ul className="mt-4 space-y-1.5 rounded-[5px] border border-warn/20 bg-warn/[0.05] p-3">
                  {asset.data.quality.notes.map((note) => (
                    <li key={note} className="text-[11.5px] leading-relaxed text-warn">
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          ) : (
            <EmptyState title="That asset is no longer available" description="Select another asset." />
          )}

          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Boxes className="size-3.5 text-plasma" aria-hidden />
              <Label>Available presets {selected ? `for ${selected.kind}` : ''}</Label>
            </div>
            <div className="mt-3">
              <PresetGrid kind={selected?.kind ?? 'video'} />
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <Label>Recent transformation jobs</Label>
              <Link to="/app/observatory" className="text-[11.5px] text-dim hover:text-ember">
                observatory
              </Link>
            </div>
            <div className="mt-2">
              <JobList
                jobs={(jobs.data?.items ?? []).filter((job) => job.kind === 'media.transform')}
                emptyHint="No transforms have run yet. Choose a preset and run one."
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {asset.data ? (
            <TransformPanel asset={asset.data} />
          ) : (
            <Panel className="p-5">
              <div className="flex items-center gap-2">
                <Wand2 className="size-3.5 text-dim" aria-hidden />
                <Label>Transformation</Label>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
                Select a source asset to configure a preset, trim range and output.
              </p>
            </Panel>
          )}

          <Panel className="p-5">
            <Label>How derivatives are recorded</Label>
            <ol className="mt-3 space-y-2.5">
              {[
                'FFmpeg runs with an explicit argument array and a hard time budget.',
                'The output is probed before it is registered — never assumed valid.',
                'A new asset row links to its parent, with its own SHA-256 and size.',
                'Cancellation kills the process group and removes partial output.',
              ].map((item, index) => (
                <li key={item} className="flex gap-2.5 text-[11.5px] leading-relaxed text-mute">
                  <span className="text-[11.5px] text-ember">0{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <AssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(assetSummary) => setSelected(assetSummary)}
        title="Select a source asset"
      />
    </div>
  );
}
