import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mark } from '../design-system/Brand';

export function AuthLayout({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="relative hidden bg-graphite p-10 lg:flex lg:flex-col">
        <div className="flex h-full flex-col justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark className="text-ember" />
            <span className="font-display text-[17px] font-semibold tracking-[-0.04em]">
              Sonic<span className="text-ember">Wire</span>
            </span>
          </Link>
          <div className="max-w-md">
            <p className="font-display text-[26px] leading-[1.15] font-medium tracking-[-0.03em] text-ink">
              The instrument panel for media you are allowed to keep.
            </p>
            <p className="mt-4 text-[13px] leading-relaxed text-mute">
              Facts are measured. Derivatives are traced. Nothing leaves this machine unless you
              point SonicWire at an external URL yourself.
            </p>
            {aside}
          </div>
          <div className="flex items-center gap-6 text-[11.5px] text-dim">
            <span>local-first</span>
            <span>no telemetry</span>
            <span>build 0.1.0</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Mark className="text-ember" />
            <span className="font-display text-[16px] font-semibold tracking-[-0.04em]">
              Sonic<span className="text-ember">Wire</span>
            </span>
          </Link>
          <h1 className="text-[30px] leading-[1.05] font-semibold tracking-[-0.04em] text-ink">
            {title}
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-mute">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
