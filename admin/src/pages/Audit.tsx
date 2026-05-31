import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import type { AuditEntry, Page } from '../types';
import { Button, Spinner } from '../components/ui';
import { cn, fmtNumber, timeAgo } from '../lib';

const PAGE = 50;

const actionColor = (a: string) =>
  a.includes('delete')
    ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'
    : a.includes('create') || a.includes('import')
      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
      : a.includes('image')
        ? 'bg-signal-100 text-signal-700 dark:bg-signal-500/15 dark:text-signal-300'
        : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300';

export default function Audit() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useQuery<Page<AuditEntry>>({
    queryKey: ['audit', offset],
    queryFn: () => api.get(`/audit?limit=${PAGE}&offset=${offset}`),
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Audit log</h1>
        <p className="text-sm text-ink-400">{fmtNumber(total)} recorded actions.</p>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-400">No activity yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800 dark:bg-ink-900">
              <tr>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-2 py-2.5">Station</th>
                <th className="px-2 py-2.5">Details</th>
                <th className="px-4 py-2.5 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800/70">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <span className={cn('mono rounded px-1.5 py-0.5 text-[11px] font-medium', actionColor(r.action))}>{r.action}</span>
                  </td>
                  <td className="mono px-2 py-2.5 text-xs text-ink-400">{r.station_id ?? '—'}</td>
                  <td className="mono max-w-[420px] truncate px-2 py-2.5 text-xs text-ink-500">{JSON.stringify(r.details)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-400">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
          <ChevronLeft size={16} /> Prev
        </Button>
        <Button variant="outline" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
