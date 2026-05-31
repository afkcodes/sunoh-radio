import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Pause, Play, Plus, Search, ShieldCheck, Trash2, XCircle,
} from 'lucide-react';
import { api } from '../api';
import type { Page, Station } from '../types';
import { Button, Input, Select, StatusBadge, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';
import { usePlayer } from '../player';
import { cn, fmtBitrate, fmtNumber, timeAgo } from '../lib';
import StationEditor from './StationEditor';

const PAGE = 50;

export default function Stations() {
  const qc = useQueryClient();
  const toast = useToast();
  const player = usePlayer();

  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [genre, setGenre] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editorId, setEditorId] = useState<number | 'new' | null>(null);

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (q) params.set('q', q);
  if (country) params.set('country', country);
  if (genre) params.set('genre', genre);
  if (status) params.set('status', status);

  const { data, isLoading, isFetching } = useQuery<Page<Station>>({
    queryKey: ['stations', q, country, genre, status, offset],
    queryFn: () => api.get(`/stations?${params.toString()}`),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  const toggleOne = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const resetTo = (o: number) => {
    setOffset(o);
    setSelected(new Set());
  };
  const onFilter = () => resetTo(0);

  const bulk = useMutation({
    mutationFn: (body: { action: string; value?: string | boolean }) =>
      api.post<{ affected: number }>('/stations/bulk', {
        action: body.action,
        ids: [...selected],
        value: body.value,
      }),
    onSuccess: (r: { affected: number }) => {
      toast('success', `${r.affected} station(s) updated`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['stations'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Bulk action failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Stations</h1>
          <p className="text-sm text-ink-400">{fmtNumber(total)} matching · {fmtNumber(selected.size)} selected</p>
        </div>
        <Button onClick={() => setEditorId('new')}>
          <Plus size={16} /> New station
        </Button>
      </div>

      {/* filters */}
      <div className="card flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            placeholder="Search name or genre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onFilter()}
            className="pl-9"
          />
        </div>
        <Input placeholder="Country (US)" value={country} onChange={(e) => setCountry(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onFilter()} className="w-32" />
        <Input placeholder="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onFilter()} className="w-32" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); resetTo(0); }} className="w-36">
          <option value="">All statuses</option>
          <option value="working">working</option>
          <option value="broken">broken</option>
          <option value="untested">untested</option>
        </Select>
        <Button variant="outline" onClick={onFilter}>Apply</Button>
      </div>

      {/* bulk bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-signal-300 bg-signal-50 px-3 py-2 shadow-soft animate-scale-in dark:border-signal-500/40 dark:bg-signal-500/10">
          <span className="text-sm font-semibold text-signal-700 dark:text-signal-300">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button variant="subtle" onClick={() => bulk.mutate({ action: 'set_verified', value: true })}><ShieldCheck size={14} /> Verify</Button>
            <Button variant="subtle" onClick={() => bulk.mutate({ action: 'set_status', value: 'working' })}><CheckCircle2 size={14} /> Working</Button>
            <Button variant="subtle" onClick={() => bulk.mutate({ action: 'set_status', value: 'broken' })}><XCircle size={14} /> Broken</Button>
            <Button variant="danger" onClick={() => { if (confirm(`Delete ${selected.size} stations (and their images)?`)) bulk.mutate({ action: 'delete' }); }}><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
      )}

      {/* table */}
      <div className={cn('card overflow-hidden transition-opacity', isFetching && 'opacity-70')}>
        {isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-400">No stations match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400 dark:border-ink-800 dark:bg-ink-900">
              <tr>
                <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-signal-500" /></th>
                <th className="px-2 py-2.5">Station</th>
                <th className="hidden px-2 py-2.5 md:table-cell">Country</th>
                <th className="hidden px-2 py-2.5 lg:table-cell">Genres</th>
                <th className="px-2 py-2.5">Status</th>
                <th className="hidden px-2 py-2.5 lg:table-cell">Tested</th>
                <th className="w-10 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800/70">
              {rows.map((s) => {
                const isPlaying = player.current?.id === s.id && player.state === 'playing';
                return (
                  <tr
                    key={s.id}
                    className="group cursor-pointer hover:bg-ink-50/70 dark:hover:bg-ink-850/60"
                    onClick={() => setEditorId(s.id)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} className="accent-signal-500" />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-ink-100 dark:bg-ink-800">
                          {s.image && <img src={s.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold">{s.name}</span>
                            {s.is_verified && <ShieldCheck size={13} className="shrink-0 text-signal-500" />}
                          </div>
                          <div className="mono truncate text-[11px] text-ink-400">{s.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono hidden px-2 py-2.5 text-xs text-ink-500 md:table-cell">{s.countries.join(', ') || '—'}</td>
                    <td className="hidden px-2 py-2.5 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {s.genres.slice(0, 3).map((g) => (
                          <span key={g} className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500 dark:bg-ink-800">{g}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="mono hidden px-2 py-2.5 text-xs text-ink-400 lg:table-cell">{timeAgo(s.last_tested_at)}</td>
                    <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => (isPlaying ? player.toggle() : player.play(s))}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-400 opacity-0 transition hover:bg-signal-500 hover:text-white group-hover:opacity-100"
                        title="Preview stream"
                      >
                        {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between text-sm text-ink-500">
        <span>{offset + 1}–{Math.min(offset + PAGE, total)} of {fmtNumber(total)}</span>
        <div className="flex gap-1.5">
          <Button variant="outline" disabled={offset === 0} onClick={() => resetTo(Math.max(0, offset - PAGE))}>
            <ChevronLeft size={16} /> Prev
          </Button>
          <Button variant="outline" disabled={offset + PAGE >= total} onClick={() => resetTo(offset + PAGE)}>
            Next <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {editorId !== null && <StationEditor id={editorId} onClose={() => setEditorId(null)} />}
    </div>
  );
}
