import { cn } from './ui';

/**
 * SonicWire mark: three signal arcs cut by a straight wire. Geometric,
 * monochrome, and legible down to 16px. No glow: the mark holds up on its own.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-7', className)}
      aria-hidden
      fill="none"
    >
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7" stroke="currentColor" strokeOpacity="0.22" />
      <path d="M5 21.5C9.2 21.5 9.8 10.5 14 10.5s4.8 11 9 11 4-5.5 4-5.5" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M5 16h22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 16c5.5 0 5.5-6.5 11-6.5S21.5 16 27 16" stroke="#ff7a2f" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="27" cy="16" r="2" fill="#ff7a2f" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="font-display text-[17px] font-semibold tracking-[-0.04em] text-ink">
        Sonic<span className="text-ember">Wire</span>
      </span>
      <span className="text-[11.5px] text-dim">v0.1</span>
    </span>
  );
}
