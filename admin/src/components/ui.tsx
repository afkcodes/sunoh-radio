import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle';
const variants: Record<Variant, string> = {
  primary:
    'bg-signal-600 text-white hover:bg-signal-500 active:bg-signal-700 shadow-soft disabled:bg-ink-300',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
  outline:
    'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-100 dark:hover:bg-ink-800',
  ghost: 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
  subtle: 'bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
};

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('input pr-8', props.className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

const statusStyles: Record<string, string> = {
  working: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  broken: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  untested: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
        statusStyles[status] || statusStyles.untested,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition',
          checked ? 'bg-signal-500' : 'bg-ink-300 dark:bg-ink-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-4' : 'left-0.5',
          )}
        />
      </span>
      {label && <span className="font-medium text-ink-700 dark:text-ink-200">{label}</span>}
    </button>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-ink-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-lg bg-signal-500 text-ink-950"
        style={{ width: size, height: size }}
      >
        <span className="eq flex items-end" style={{ height: size * 0.42 }} aria-hidden>
          <span /><span /><span /><span />
        </span>
      </span>
      <span className="text-[15px] font-extrabold tracking-tight">
        Sunoh<span className="text-signal-500">.</span>
        <span className="font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
          console
        </span>
      </span>
    </div>
  );
}
