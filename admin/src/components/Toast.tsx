import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '../lib';

type Kind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: Kind;
  msg: string;
}

const Ctx = createContext<(kind: Kind, msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

let seq = 0;
const icons = { success: CheckCircle2, error: XCircle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, msg: string) => {
    const id = ++seq;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-24 right-5 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icons[t.kind];
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-sm shadow-pop animate-scale-in dark:bg-ink-900',
                t.kind === 'success' && 'border-emerald-200 dark:border-emerald-500/30',
                t.kind === 'error' && 'border-red-200 dark:border-red-500/30',
                t.kind === 'info' && 'border-ink-200 dark:border-ink-700',
              )}
            >
              <Icon
                size={17}
                className={cn(
                  'mt-0.5 shrink-0',
                  t.kind === 'success' && 'text-emerald-500',
                  t.kind === 'error' && 'text-red-500',
                  t.kind === 'info' && 'text-signal-500',
                )}
              />
              <span className="text-ink-700 dark:text-ink-200">{t.msg}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
