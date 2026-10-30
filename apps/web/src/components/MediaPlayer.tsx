import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Pause, Play, Volume2 } from 'lucide-react';
import type { AssetDetail } from '@sonicwire/contracts';
import { useWaveform } from '../lib/queries';
import { Badge, Panel, Skeleton, cn } from '../design-system/ui';
import { Waveform } from '../design-system/SignalCanvas';
import { formatClock } from '../lib/format';

export function MediaPlayer({ asset }: { asset: AssetDetail }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState((asset.durationMs ?? 0) / 1000);
  const [failed, setFailed] = useState(false);
  const waveform = useWaveform(asset.id, asset.hasWaveform);
  const streamUrl = `/api/assets/${asset.id}/stream`;

  useEffect(() => {
    setFailed(false);
    setTime(0);
    setPlaying(false);
    setDuration((asset.durationMs ?? 0) / 1000);
  }, [asset.id, asset.durationMs]);

  if (asset.status === 'error' || asset.status === 'missing') {
    return (
      <Panel className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-5 text-danger" aria-hidden />
        <div>
          <p className="text-[13px] font-medium text-ink">This asset cannot be played</p>
          <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-mute">
            {asset.errorMessage ?? 'The stored file is unavailable.'}
          </p>
        </div>
      </Panel>
    );
  }

  if (asset.kind === 'video') {
    return (
      <Panel className="overflow-hidden">
        <div className="relative bg-black">
          <video
            key={asset.id}
            className="aspect-video w-full bg-black"
            controls
            playsInline
            preload="metadata"
            poster={asset.hasThumbnail ? `/api/assets/${asset.id}/thumbnail` : undefined}
            onError={() => setFailed(true)}
            src={streamUrl}
          >
            Your browser cannot play this media element.
          </video>
          {failed ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-obsidian/92 p-6 text-center">
              <AlertTriangle className="size-5 text-warn" aria-hidden />
              <p className="text-[13px] font-medium">This container is not decodable in the browser</p>
              <p className="max-w-sm text-[11.5px] leading-relaxed text-mute">
                The file is intact — the browser simply lacks a decoder for {asset.videoCodec ?? 'this codec'}.
                Derive an MP4 H.264 rendition to preview it here.
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 py-2.5">
          <div className="flex items-center gap-2 text-[11.5px] text-dim">
            <span>{asset.container}</span>
            <span>·</span>
            <span>{asset.videoCodec ?? 'no video'}</span>
            <span>·</span>
            <span>{asset.audioCodec ?? 'no audio'}</span>
          </div>
          <Badge tone="plasma">range streaming</Badge>
        </div>
      </Panel>
    );
  }

  if (asset.kind === 'image') {
    return (
      <Panel className="overflow-hidden">
        <img
          src={streamUrl}
          alt={asset.title}
          className="max-h-[520px] w-full bg-black object-contain"
          onError={() => setFailed(true)}
        />
        {failed ? (
          <p className="px-4 py-3 text-[12px] text-warn">
            The browser could not render this image format directly.
          </p>
        ) : null}
      </Panel>
    );
  }

  const total = duration || (asset.durationMs ?? 0) / 1000;
  const progress = total > 0 ? Math.min(1, time / total) : 0;

  return (
    <Panel raised className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Volume2 className="size-3.5 text-ember" aria-hidden />
          <span className="sw-label">Audio monitor</span>
        </div>
        <span className="sw-num text-[11px] text-mute">
          {formatClock(time)} / {formatClock(total)}
        </span>
      </div>

      <div className="px-4 pt-6 pb-4">
        {waveform.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : waveform.data && waveform.data.peaks.length > 0 ? (
          <Waveform
            peaks={waveform.data.peaks}
            progress={progress}
            height={88}
            label={`Seek ${asset.title}`}
            onSeek={(ratio) => {
              if (!audioRef.current) return;
              audioRef.current.currentTime = ratio * total;
              setTime(ratio * total);
            }}
          />
        ) : (
          <div className="flex h-20 items-center justify-center rounded-[4px] border border-dashed border-hairline">
            <span className="sw-label">no waveform available</span>
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              if (audio.paused) {
                void audio.play().then(() => setPlaying(true)).catch(() => setFailed(true));
              } else {
                audio.pause();
                setPlaying(false);
              }
            }}
            aria-label={playing ? 'Pause audio' : 'Play audio'}
            className={cn(
              'flex size-11 items-center justify-center rounded-full border transition-colors',
              playing
                ? 'border-ember bg-ember text-black'
                : 'border-hairline-strong bg-white/[0.03] text-ink hover:border-ember/60 hover:text-ember',
            )}
          >
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="ml-0.5 size-4" aria-hidden />}
          </button>
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={total || 0}
              step={0.1}
              value={time}
              aria-label="Seek"
              onChange={(event) => {
                const next = Number(event.target.value);
                setTime(next);
                if (audioRef.current) audioRef.current.currentTime = next;
              }}
              className="w-full accent-ember"
            />
          </div>
          <Badge tone="neutral">{asset.audioCodec ?? 'audio'}</Badge>
        </div>

        {failed ? (
          <p className="mt-3 text-[11.5px] text-warn">
            This audio stream could not be decoded by the browser. The file itself probed successfully.
          </p>
        ) : null}

        <audio
          ref={audioRef}
          src={streamUrl}
          preload="metadata"
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value)) setDuration(value);
          }}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onError={() => setFailed(true)}
          className="hidden"
        />
      </div>
    </Panel>
  );
}
