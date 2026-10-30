import type { MediaAnalysis } from '@sonicwire/contracts';
import { Waveform } from '../design-system/SignalCanvas';
import StatusMark from '../vendor/react-bits/StatusMark.jsx';
import { Button, Metric, Skeleton, useToast } from '../design-system/ui';
import { ApiError } from '../lib/api';
import { useAnalysis, useAnalyzeAsset } from '../lib/queries';
import { formatDateTime } from '../lib/format';

/**
 * The measurements panel.
 *
 * Rules this panel follows:
 * - A missing service is stated as missing, with the command that fixes it.
 * - A file that has not been measured says so; it never shows zeros.
 * - Every figure is labelled with its unit and its method, because "−21.8" is
 *   meaningless without "LUFS".
 */

const lufs = (value: number | null | undefined) =>
  value === null || value === undefined ? null : `${value.toFixed(1)} LUFS`;
const db = (value: number | null | undefined) =>
  value === null || value === undefined ? null : `${value.toFixed(1)} dB`;

function measurementTone(report: MediaAnalysis): {
  loudness: 'ok' | 'warn' | 'neutral';
  truePeak: 'ok' | 'warn' | 'neutral';
  decode: 'ok' | 'warn' | 'danger' | 'neutral';
  silence: 'ok' | 'warn' | 'neutral';
} {
  const integrated = report.loudness?.integratedLufs ?? null;
  const truePeak = report.loudness?.truePeakDb ?? null;
  return {
    loudness:
      integrated === null
        ? 'neutral'
        : integrated < -24 || integrated > -14
          ? 'warn'
          : 'ok',
    truePeak: truePeak === null ? 'neutral' : truePeak > -1 ? 'warn' : 'ok',
    decode: report.decode === null ? 'neutral' : report.decode.clean ? 'ok' : 'danger',
    silence:
      report.silence?.ratio === null || report.silence?.ratio === undefined
        ? 'neutral'
        : report.silence.ratio > 0.4
          ? 'warn'
          : 'ok',
  };
}

export function Measurements({
  assetId,
  canMeasure,
  poll = false,
}: {
  assetId: string;
  canMeasure: boolean;
  /** True while an analysis job for this asset is queued or running. */
  poll?: boolean;
}) {
  const analysis = useAnalysis(assetId, { poll });
  const measure = useAnalyzeAsset();
  const { notify } = useToast();

  const start = () => {
    measure.mutate(
      { id: assetId, includePeaks: true },
      {
        onSuccess: () =>
          notify({
            tone: 'ok',
            title: 'Measurement queued',
            body: 'media-core is reading the file now; the numbers appear here when it finishes.',
          }),
        onError: (error) =>
          notify({
            tone: 'danger',
            title: 'Could not queue the measurement',
            body: error instanceof ApiError ? error.message : 'The request failed.',
          }),
      },
    );
  };

  if (analysis.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (analysis.isError) {
    return (
      <p className="text-[13px] text-danger">
        Measurements could not be read: {analysis.error instanceof ApiError ? analysis.error.message : 'request failed'}.
      </p>
    );
  }

  const core = analysis.data.core;
  const report = analysis.data.analysis;
  const tones = report ? measurementTone(report) : null;

  return (
    <section className="space-y-5" aria-labelledby="measurements-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 id="measurements-heading" className="text-[15px] font-medium text-ink">
            Measurements
          </h3>
          <p className="mt-1 text-[12.5px] text-dim">
            {report
              ? `Measured ${formatDateTime(report.measuredAt)} by ${report.engine}.`
              : core.configured
                ? 'Nothing measured yet for this file.'
                : 'The analysis service is not part of this deployment.'}
          </p>
        </div>
        {canMeasure && core.configured ? (
          <Button
            size="sm"
            variant={report ? 'outline' : 'primary'}
            onClick={start}
            loading={measure.isPending}
          >
            {report ? 'Measure again' : 'Measure this file'}
          </Button>
        ) : null}
      </div>

      {!core.configured ? (
        <div className="max-w-xl text-[13px] leading-relaxed text-mute">
          <p>{core.detail}.</p>
          <p className="mt-2">
            Start it with <code className="text-ink">npm run dev:core</code> and point the API at it with{' '}
            <code className="text-ink">MEDIA_CORE_URL</code>. Until then, probe data above is everything this
            install knows about the file.
          </p>
        </div>
      ) : null}

      {core.configured && !report ? (
        <p className="max-w-xl text-[13px] leading-relaxed text-mute">
          Loudness, silence, black frames, scene cuts and decode health are not estimated here. Run a
          measurement and the panel fills in with what the file actually contains.
        </p>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Integrated loudness"
              value={lufs(report.loudness?.integratedLufs) ?? '—'}
              detail={`EBU R128 · target −16 LUFS`}
              tone={tones?.loudness}
            />
            <Metric
              label="True peak"
              value={db(report.loudness?.truePeakDb) ?? '—'}
              detail="Ceiling −1.0 dBTP"
              tone={tones?.truePeak}
            />
            <Metric
              label="Loudness range"
              value={report.loudness?.rangeLu !== null && report.loudness ? `${report.loudness.rangeLu.toFixed(1)} LU` : '—'}
              detail="Short-term spread"
            />
            <Metric
              label="Silence"
              value={report.silence ? `${(report.silence.ratio === null ? 0 : report.silence.ratio * 100).toFixed(1)}%` : '—'}
              detail={report.silence ? `${report.silence.segments} spans below ${report.silence.thresholdDb} dB` : 'Not measured'}
              tone={tones?.silence}
            />
            <Metric
              label="Black frames"
              value={report.blackFrames ? report.blackFrames.count : '—'}
              detail={report.blackFrames ? `${report.blackFrames.totalSeconds.toFixed(1)}s total, longest ${report.blackFrames.longestSeconds.toFixed(1)}s` : 'Not measured'}
            />
            <Metric
              label="Scene cuts"
              value={report.sceneCuts ? report.sceneCuts.count : '—'}
              detail="Score above 0.3"
            />
            <Metric
              label="Decode errors"
              value={report.decode ? report.decode.errors : '—'}
              detail={report.decode ? (report.decode.clean ? 'Full decode passed' : (report.decode.firstError ?? 'Errors reported')) : 'Not measured'}
              tone={tones?.decode}
            />
            <Metric
              label="Mean luma"
              value={report.signal ? report.signal.meanLuma.toFixed(1) : '—'}
              detail={report.signal ? `Over ${report.signal.sampledFrames} sampled frames` : 'Not measured'}
            />
          </div>

          {report.peaks.length > 0 ? (
            <div className="pt-1">
              <Waveform peaks={report.peaks} height={44} label="Measured peak envelope" />
              <p className="mt-2 text-[12px] text-dim">
                Peak envelope, {report.peakCount} buckets derived from an 8 kHz mono decode.
              </p>
            </div>
          ) : null}

          {report.notes.length > 0 ? (
            <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-mute">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {core.configured && !core.reachable ? (
        <p className="flex items-start gap-2 text-[12.5px] text-warn">
          <StatusMark status="failed" size={14} />
          <span>{core.detail}. Measurements stored earlier are still shown above.</span>
        </p>
      ) : null}
    </section>
  );
}
