import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import StatusMark, { type StatusMarkStatus } from '../vendor/react-bits/StatusMark.jsx';
import Counter from '../vendor/react-bits/Counter.jsx';

export const cn = clsx;

/* ------------------------------------------------------------------ button */

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-[5px] font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-40 active:translate-y-[0.5px]';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ember text-[#170a02] hover:bg-ember-soft',
  outline:
    'border border-hairline-strong bg-white/[0.02] text-ink hover:border-ember/60 hover:bg-white/[0.05] hover:text-ember-soft',
  ghost: 'text-mute hover:bg-white/[0.05] hover:text-ink',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
  quiet: 'bg-white/[0.045] text-ink hover:bg-white/[0.08]',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px] tracking-[-0.01em]',
  md: 'h-10 px-4 text-[13.5px]',
  lg: 'h-12 px-6 text-[14.5px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'outline',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    >
      {loading ? <Spinner className="size-3.5" /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-[5px] border border-transparent text-mute transition-colors hover:border-hairline-strong hover:bg-white/[0.04] hover:text-ink disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-80',
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------- typography */

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('sw-label', className)}>{children}</div>;
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[22px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink sm:text-[26px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-mute">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-hairline-strong bg-white/[0.04] px-1.5 py-0.5 text-[11.5px] text-mute">
      {children}
    </kbd>
  );
}

/* -------------------------------------------------------------- surfaces */

export function Panel({
  children,
  className,
  raised = false,
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return <As className={cn(raised ? 'sw-panel-raised' : 'sw-panel', className)}>{children}</As>;
}

export function Divider({ className }: { className?: string }) {
  return <div role="separator" className={cn('sw-hairline my-6', className)} />;
}

/* ----------------------------------------------------------------- badges */

type Tone = 'neutral' | 'ember' | 'plasma' | 'ok' | 'warn' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'text-mute',
  ember: 'text-ember-soft',
  plasma: 'text-plasma',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-signal',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  ready: 'ok',
  succeeded: 'ok',
  running: 'ember',
  probing: 'ember',
  queued: 'info',
  pending: 'neutral',
  waiting_approval: 'warn',
  failed: 'danger',
  error: 'danger',
  cancelled: 'neutral',
  skipped: 'neutral',
  missing: 'warn',
};

/**
 * Status vocabulary mapping. `StatusMark` (React Bits, vendored) draws the glyph;
 * the label stays in SonicWire's own words so the queue and the asset list agree.
 */
const STATUS_MARK: Record<string, StatusMarkStatus> = {
  ready: 'done',
  succeeded: 'done',
  running: 'running',
  probing: 'running',
  queued: 'pending',
  pending: 'pending',
  waiting_approval: 'pending',
  failed: 'failed',
  error: 'failed',
  cancelled: 'cancelled',
  skipped: 'cancelled',
  missing: 'failed',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? 'neutral';
  return (
    <Badge tone={tone} className={className}>
      <span aria-hidden className="inline-flex">
        <StatusMark
          status={STATUS_MARK[status] ?? 'pending'}
          size={11}
          strokeWidth={2.4}
          dashes={6}
          color="currentColor"
          doneColor="currentColor"
          errorColor="currentColor"
          fillOpacity={0}
          strike={false}
          fontSize={10}
        />
      </span>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

/* ----------------------------------------------------------------- metrics */

/**
 * A KPI is type, not a tile with an icon. The number is set large, the label is a
 * plain sentence, and the detail line carries the context. `Counter` (React Bits,
 * vendored) animates the number only when it is genuinely numeric.
 */
export function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: number | string;
  detail?: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
  className?: string;
}) {
  const toneClass = {
    neutral: 'text-ink',
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
  }[tone];
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[13px] leading-none text-dim">{label}</div>
      <div className={cn('mt-2.5 leading-none', toneClass)}>
        {typeof value === 'number' ? (
          <Counter
            value={value}
            fontSize={30}
            fontWeight={500}
            textColor="currentColor"
            duration={0.55}
            tabular
            style={{ lineHeight: 1 }}
          />
        ) : (
          <span className="text-[26px] font-medium tracking-[-0.02em]">{value}</span>
        )}
      </div>
      {detail ? <div className="mt-2 text-[12.5px] leading-relaxed text-mute">{detail}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ meters */

export function Meter({
  value,
  tone = 'ember',
  segments = 28,
  label,
  className,
}: {
  value: number;
  tone?: 'ember' | 'plasma' | 'ok' | 'danger';
  segments?: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const active = Math.round(clamped * segments);
  const toneClass = {
    ember: 'bg-ember',
    plasma: 'bg-plasma',
    ok: 'bg-ok',
    danger: 'bg-danger',
  }[tone];
  return (
    <div
      className={cn('flex items-center gap-[3px]', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label ?? 'Progress'}
    >
      {Array.from({ length: segments }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'h-2 flex-1 rounded-[1px] transition-colors duration-300',
            index < active ? toneClass : 'bg-white/[0.07]',
          )}
        />
      ))}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}>
      <div
        className="h-full rounded-full bg-ember transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="sw-label block">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-relaxed text-dim">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'w-full rounded-[5px] border border-hairline-strong bg-black/35 px-3 text-[13.5px] text-ink placeholder:text-dim transition-colors hover:border-white/20 focus:border-ember/70 focus:outline-none focus-visible:outline-none disabled:opacity-50';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(CONTROL, 'h-10', className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(CONTROL, 'min-h-[92px] py-2.5 leading-relaxed', className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(CONTROL, 'h-10 appearance-none pr-8', className)}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ dialog */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = (): HTMLElement[] =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[width];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'sw-panel-raised relative z-10 w-full overflow-hidden rounded-t-[14px] sm:rounded-[12px]',
          widths,
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-hairline px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[17px] font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[12.5px] leading-relaxed text-mute">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-hairline bg-black/20 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ toasts */

interface Toast {
  id: number;
  tone: 'ok' | 'danger' | 'info';
  title: string;
  body?: string;
}

const ToastContext = createContext<{
  notify: (toast: Omit<Toast, 'id'>) => void;
}>({ notify: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 6000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-5 sm:translate-x-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'sw-panel-raised pointer-events-auto flex items-start gap-3 px-4 py-3',
              toast.tone === 'danger' && 'border-danger/40',
              toast.tone === 'ok' && 'border-ok/30',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-1.5 shrink-0 rounded-full',
                toast.tone === 'ok' ? 'bg-ok' : toast.tone === 'danger' ? 'bg-danger' : 'bg-ember',
              )}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{toast.title}</p>
              {toast.body ? (
                <p className="mt-0.5 text-[12px] leading-relaxed text-mute">{toast.body}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ------------------------------------------------------------------- tabs */

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const baseId = useId();
  return (
    <div role="tablist" aria-label="Sections" className={cn('flex gap-1 overflow-x-auto', className)}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            id={`${baseId}-${tab.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              const index = tabs.findIndex((item) => item.id === tab.id);
              if (event.key === 'ArrowRight') {
                onChange(tabs[(index + 1) % tabs.length]!.id);
              } else if (event.key === 'ArrowLeft') {
                onChange(tabs[(index - 1 + tabs.length) % tabs.length]!.id);
              }
            }}
            className={cn(
              'relative shrink-0 px-3 py-2 text-[12.5px] transition-colors',
              selected ? 'text-ink' : 'text-dim hover:text-mute',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span className="ml-1.5 text-[9.5px] text-dim">{tab.count}</span>
            ) : null}
            {selected ? <span className="absolute inset-x-2 -bottom-px h-px bg-ember" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sw-panel flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="text-dim">{icon}</div> : null}
      <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      {description ? (
        <p className="max-w-md text-[13px] leading-relaxed text-mute">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-[4px] bg-white/[0.055]', className)}
    />
  );
}

export function DataRow({
  label,
  value,
  numeric = true,
  className,
}: {
  label: string;
  value: ReactNode;
  /** Tabular figures for values that are numbers; set false for prose. */
  numeric?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-6 py-2', className)}>
      <dt className="text-[12.5px] text-dim">{label}</dt>
      <dd className={cn('text-right text-[13px] text-ink', numeric && 'sw-num')}>{value}</dd>
    </div>
  );
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="sw-num group inline-flex items-center gap-1.5 text-[12px] text-mute transition-colors hover:text-ink"
      aria-label={`Copy ${label}`}
    >
      <span className="max-w-[180px] truncate">{value}</span>
      <span className="text-[11.5px] text-dim group-hover:text-ember">
        {copied ? 'copied' : 'copy'}
      </span>
    </button>
  );
}
