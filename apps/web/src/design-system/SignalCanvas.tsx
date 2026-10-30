import { useEffect, useRef } from 'react';

interface SignalCanvasProps {
  className?: string;
  density?: number;
  intensity?: number;
}

/**
 * Procedural hero artwork: a field of molten signal filaments rendered on a 2D
 * canvas. Chosen over a static image or WebGL because it stays under a
 * millisecond of frame work on integrated GPUs, scales to any viewport, needs
 * no downloaded asset, and degrades to a single static frame under
 * `prefers-reduced-motion`.
 */
export function SignalCanvas({ className, density = 1, intensity = 1 }: SignalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let width = 0;
    let height = 0;
    let dpr = 1;
    let visible = true;
    let start = performance.now();
    let lastPaint = 0;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      start = performance.now();
      if (reduceMotion) paint(0);
    };

    const filaments = Array.from({ length: Math.round(7 * density) }, (_, index) => ({
      offset: index / Math.max(1, Math.round(7 * density) - 1),
      frequency: 1.1 + Math.random() * 1.8,
      amplitude: 0.06 + Math.random() * 0.16,
      speed: 0.00006 + Math.random() * 0.00016,
      phase: Math.random() * Math.PI * 2,
      warmth: Math.random(),
      width: 0.7 + Math.random() * 1.5,
    }));

    const particles = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      drift: Math.random() * 0.00004 + 0.000012,
      alpha: Math.random() * 0.5 + 0.12,
    }));

    const paint = (time: number): void => {
      context.clearRect(0, 0, width, height);

      // Ember bloom, anchored to the pointer for subtle parallax.
      const glowX = width * (0.72 + (pointer.x - 0.5) * 0.06);
      const glowY = height * (0.46 + (pointer.y - 0.5) * 0.08);
      const bloom = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(width, height) * 0.62);
      bloom.addColorStop(0, `rgba(255, 122, 47, ${0.16 * intensity})`);
      bloom.addColorStop(0.32, `rgba(255, 92, 26, ${0.05 * intensity})`);
      bloom.addColorStop(0.7, 'rgba(24, 30, 40, 0.04)');
      bloom.addColorStop(1, 'rgba(6, 7, 9, 0)');
      context.fillStyle = bloom;
      context.fillRect(0, 0, width, height);

      // Cold counter-light on the left keeps the palette from turning monochrome.
      const counter = context.createLinearGradient(0, 0, width * 0.55, height);
      counter.addColorStop(0, 'rgba(120, 160, 200, 0.07)');
      counter.addColorStop(1, 'rgba(6, 7, 9, 0)');
      context.fillStyle = counter;
      context.fillRect(0, 0, width, height);

      const t = time * 0.0002;

      for (const particle of particles) {
        const px = (particle.x + Math.sin(t * 3 + particle.y * 9) * 0.02) * width;
        const py = ((particle.y + t * particle.drift * 60) % 1) * height;
        context.beginPath();
        context.arc(px, py, particle.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 180, 130, ${particle.alpha})`;
        context.fill();
      }

      for (const filament of filaments) {
        const baseY = height * (0.2 + filament.offset * 0.62);
        const gradient = context.createLinearGradient(0, baseY, width, baseY);
        const warm = filament.warmth > 0.45;
        gradient.addColorStop(0, 'rgba(255, 122, 47, 0)');
        gradient.addColorStop(0.18, warm ? 'rgba(255, 138, 66, 0.5)' : 'rgba(147, 174, 203, 0.34)');
        gradient.addColorStop(0.62, warm ? 'rgba(255, 178, 118, 0.85)' : 'rgba(127, 217, 205, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 122, 47, 0)');

        context.beginPath();
        context.lineWidth = filament.width;
        context.strokeStyle = gradient;
        context.shadowBlur = warm ? 22 * intensity : 10;
        context.shadowColor = warm ? 'rgba(255, 122, 47, 0.55)' : 'rgba(127, 217, 205, 0.3)';

        const steps = Math.max(60, Math.floor(width / 8));
        for (let step = 0; step <= steps; step += 1) {
          const progress = step / steps;
          const x = progress * width;
          const wave =
            Math.sin(progress * Math.PI * 2 * filament.frequency + time * filament.speed * 1000 + filament.phase) *
            filament.amplitude;
          const harmonic =
            Math.sin(progress * Math.PI * 5.5 + time * filament.speed * 620 + filament.phase * 1.7) *
            filament.amplitude *
            0.28;
          const parallax = (pointer.x - 0.5) * (12 + filament.offset * 26);
          const y = baseY + (wave + harmonic) * height * 0.5 + parallax;
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }
      context.shadowBlur = 0;

      // Machined measurement ticks along the lower edge.
      context.strokeStyle = 'rgba(255, 255, 255, 0.055)';
      context.lineWidth = 1;
      const tickSpacing = 42;
      for (let x = (width % tickSpacing) / 2; x < width; x += tickSpacing) {
        context.beginPath();
        context.moveTo(x, height);
        context.lineTo(x, height - (Math.round(x / tickSpacing) % 5 === 0 ? 14 : 6));
        context.stroke();
      }
    };

    const loop = (time: number): void => {
      frameRef.current = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (time - lastPaint < 22) return; // ~45fps cap
      lastPaint = time;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      paint(time - start);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (event.clientX - rect.left) / rect.width;
      pointer.ty = (event.clientY - rect.top) / rect.height;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 },
    );
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    resize();
    if (reduceMotion) {
      paint(2600);
    } else {
      frameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [density, intensity]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

/** Static, dependency-free waveform rendering used across cards and players. */
export function Waveform({
  peaks,
  progress = 0,
  className,
  height = 56,
  tone = 'ember',
  onSeek,
  label,
}: {
  peaks: number[];
  progress?: number;
  className?: string;
  height?: number;
  tone?: 'ember' | 'plasma';
  onSeek?: (ratio: number) => void;
  label?: string;
}) {
  const width = 1000;
  const max = Math.max(0.001, ...peaks);
  const step = peaks.length > 0 ? width / peaks.length : width;
  const bars = peaks.map((peak, index) => {
    const barHeight = Math.max(1.4, (peak / max) * height);
    return {
      x: index * step,
      y: (height - barHeight) / 2,
      height: barHeight,
      ratio: index / Math.max(1, peaks.length),
    };
  });

  const color = tone === 'ember' ? '#ff7a2f' : '#7fd9cd';
  const content = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
      role="img"
      aria-label={label ?? 'Audio waveform'}
    >
      {bars.map((bar, index) => (
        <rect
          key={index}
          x={bar.x}
          y={bar.y}
          width={Math.max(1, step * 0.62)}
          height={bar.height}
          rx={0.6}
          fill={bar.ratio <= progress ? color : 'rgba(255,255,255,0.16)'}
        />
      ))}
    </svg>
  );

  if (!onSeek) return content;
  return (
    <button
      type="button"
      className="relative block w-full cursor-pointer rounded-[3px] focus-visible:outline-2 focus-visible:outline-ember"
      aria-label={label ?? 'Seek within audio'}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
      }}
    >
      {content}
    </button>
  );
}
