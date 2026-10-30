import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Info, Wand2 } from 'lucide-react';
import type { AssetDetail, AssetSummary } from '@sonicwire/contracts';
import {
  Badge,
  Button,
  Field,
  Input,
  Label,
  Panel,
  Select,
  cn,
  useToast,
} from '../design-system/ui';
import { useCapabilities, useTransform } from '../lib/queries';
import { ApiError } from '../lib/api';
import { formatDuration } from '../lib/format';

type TransformTarget = Pick<AssetSummary, 'id' | 'kind' | 'title' | 'durationMs' | 'status'> | AssetDetail;

export function TransformPanel({
  asset,
  onStarted,
}: {
  asset: TransformTarget;
  onStarted?: (jobId: string) => void;
}) {
  const capabilities = useCapabilities();
  const transform = useTransform();
  const { notify } = useToast();
  const presets = capabilities.data?.transforms ?? [];
  const available = useMemo(
    () => presets.filter((preset) => preset.accepts.includes(asset.kind)),
    [presets, asset.kind],
  );
  const [presetId, setPresetId] = useState<string>('');
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState(() => ((asset.durationMs ?? 0) / 1000).toFixed(1));

  const selected = available.find((preset) => preset.id === presetId) ?? available[0];

  const submit = (): void => {
    if (!selected) return;
    const trim = trimEnabled
      ? {
          startMs: Math.round(Number(start) * 1000),
          endMs: Math.round(Number(end) * 1000),
        }
      : undefined;
    if (trim && trim.endMs <= trim.startMs) {
      notify({ tone: 'danger', title: 'Trim range is empty', body: 'The end time must be after the start time.' });
      return;
    }
    transform.mutate(
      { id: asset.id, body: { presetId: selected.id as never, trim } },
      {
        onSuccess: (data) => {
          notify({
            tone: 'ok',
            title: 'Transform queued',
            body: `${selected.label} is running as a background job. Progress appears in the queue.`,
          });
          onStarted?.(data.jobId);
        },
        onError: (error) => {
          notify({
            tone: 'danger',
            title: 'Transform refused',
            body: error instanceof ApiError ? error.message : 'The transform could not be queued.',
          });
        },
      },
    );
  };

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="size-3.5 text-ember" aria-hidden />
          <Label>Transformation</Label>
        </div>
        {asset.status !== 'ready' ? <Badge tone="warn">asset not ready</Badge> : null}
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Preset" htmlFor="preset">
          <Select
            id="preset"
            value={selected?.id ?? ''}
            onChange={(event) => setPresetId(event.target.value)}
            disabled={asset.status !== 'ready' || available.length === 0}
          >
            {available.length === 0 ? <option value="">No presets accept this media type</option> : null}
            {available.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </Select>
        </Field>

        {presets.length > available.length ? (
          <p className="text-[11px] leading-relaxed text-dim">
            Showing {available.length} of {presets.length} presets — the rest change the media
            kind and would not accept {asset.kind}.
          </p>
        ) : null}

        {selected ? (
          <div className="space-y-2 rounded-[5px] border border-hairline bg-black/25 p-3">
            <p className="text-[12px] leading-relaxed text-mute">{selected.description}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-dim">
              <span>{selected.outputExtension.toUpperCase().replace('.', '')}</span>
              <span>·</span>
              <span>{selected.approx}</span>
              <span>·</span>
              <span>source preserved</span>
            </div>
          </div>
        ) : null}

        <div>
          <label className="flex items-center gap-2 text-[12.5px] text-mute">
            <input
              type="checkbox"
              checked={trimEnabled}
              onChange={(event) => setTrimEnabled(event.target.checked)}
              disabled={asset.status !== 'ready'}
              className="size-3.5 accent-ember"
            />
            Trim before encoding
          </label>
          {trimEnabled ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Start (s)" htmlFor="trim-start">
                <Input
                  id="trim-start"
                  type="number"
                  min="0"
                  step="0.1"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </Field>
              <Field
                label="End (s)"
                htmlFor="trim-end"
                hint={asset.durationMs ? `Source ${formatDuration(asset.durationMs)}` : undefined}
              >
                <Input
                  id="trim-end"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </div>

        <Button
          variant="primary"
          className="w-full"
          onClick={submit}
          loading={transform.isPending}
          disabled={!selected || asset.status !== 'ready'}
        >
          {transform.isPending ? 'Queueing transform' : 'Run transform'}
        </Button>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-dim">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          The source file is never overwritten. A new derivative asset is created with its own
          verified metadata and lineage.
        </p>

        {transform.data ? (
          <div className="rounded-[5px] border border-plasma/25 bg-plasma/[0.06] px-3 py-2 text-[11.5px] text-plasma">
            Queued as job <span className="">{transform.data.jobId.slice(0, 8)}</span>.{' '}
            <Link to="/app/observatory" className="underline decoration-plasma/40 underline-offset-2">
              Watch it live
            </Link>
            <ArrowUpRight className="ml-0.5 inline size-3" aria-hidden />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

export function PresetGrid({ kind }: { kind: string }) {
  const capabilities = useCapabilities();
  const presets = (capabilities.data?.transforms ?? []).filter((preset) => preset.accepts.includes(kind));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {presets.map((preset) => (
        <div
          key={preset.id}
          className={cn('rounded-[6px] border border-hairline bg-black/20 p-3.5 transition-colors hover:border-hairline-strong')}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-ink">{preset.label}</span>
            <span className="text-[11.5px] text-dim">
              {preset.outputExtension.replace('.', '')}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-mute">{preset.description}</p>
          <p className="mt-2 text-[11.5px] text-dim">{preset.approx}</p>
        </div>
      ))}
    </div>
  );
}
