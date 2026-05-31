import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Play, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { Station } from '../types';
import { useToast } from '../components/Toast';
import { usePlayer } from '../player';
import { Button, Field, Input, Select, StatusBadge, Toggle } from '../components/ui';
import ImageUploader from '../components/ImageUploader';
import { fmtBitrate, timeAgo } from '../lib';

interface Form {
  name: string;
  stream_url: string;
  image_url: string;
  countries: string;
  genres: string;
  languages: string;
  status: string;
  codec: string;
  bitrate: string;
  sample_rate: string;
  is_verified: boolean;
}

const empty: Form = {
  name: '',
  stream_url: '',
  image_url: '',
  countries: '',
  genres: '',
  languages: '',
  status: 'untested',
  codec: '',
  bitrate: '',
  sample_rate: '',
  is_verified: false,
};

function toForm(s: Station): Form {
  return {
    name: s.name,
    stream_url: s.stream_url,
    image_url: s.image_url || '',
    countries: s.countries.join(', '),
    genres: s.genres.join(', '),
    languages: s.languages.join(', '),
    status: s.status,
    codec: s.codec || '',
    bitrate: s.bitrate ? String(s.bitrate) : '',
    sample_rate: s.sample_rate ? String(s.sample_rate) : '',
    is_verified: s.is_verified,
  };
}

const arr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function StationEditor({
  id,
  onClose,
}: {
  id: number | 'new';
  onClose: () => void;
}) {
  const isNew = id === 'new';
  const qc = useQueryClient();
  const toast = useToast();
  const player = usePlayer();
  const [form, setForm] = useState<Form>(empty);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: station } = useQuery<Station>({
    queryKey: ['station', id],
    queryFn: () => api.get(`/stations/${id}`),
    enabled: !isNew,
  });

  useEffect(() => {
    if (station) setForm(toForm(station));
  }, [station]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const refreshLists = () => {
    qc.invalidateQueries({ queryKey: ['stations'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    if (!isNew) qc.invalidateQueries({ queryKey: ['station', id] });
  };

  const payload = () => ({
    name: form.name,
    stream_url: form.stream_url,
    image_url: form.image_url || null,
    countries: arr(form.countries),
    genres: arr(form.genres),
    languages: arr(form.languages),
    status: form.status,
    codec: form.codec || null,
    bitrate: Number(form.bitrate) || 0,
    sample_rate: Number(form.sample_rate) || 0,
    is_verified: form.is_verified,
  });

  const save = useMutation({
    mutationFn: () =>
      isNew ? api.post('/stations', payload()) : api.patch(`/stations/${id}`, payload()),
    onSuccess: () => {
      toast('success', isNew ? 'Station created' : 'Saved');
      refreshLists();
      onClose();
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Save failed'),
  });

  const del = useMutation({
    mutationFn: () => api.del(`/stations/${id}`),
    onSuccess: () => {
      toast('success', 'Station deleted');
      refreshLists();
      onClose();
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Delete failed'),
  });

  const test = useMutation({
    mutationFn: () => api.post<{ status: string; probe: { detail: string } }>(`/stations/${id}/test`),
    onSuccess: (r) => {
      setTestResult(`${r.status.toUpperCase()} — ${r.probe.detail}`);
      toast(r.status === 'working' ? 'success' : 'error', `Stream is ${r.status}`);
      refreshLists();
      qc.invalidateQueries({ queryKey: ['station', id] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Test failed'),
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-ink-50 shadow-pop animate-slide-in dark:bg-ink-950">
        {/* header */}
        <div className="flex items-center justify-between border-b border-ink-200 bg-white px-5 py-4 dark:border-ink-800 dark:bg-ink-900">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{isNew ? 'New station' : form.name || '…'}</h2>
            {!isNew && station && (
              <div className="mono mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                <StatusBadge status={station.status} />
                <span>#{station.id}</span>
                <span>· tested {timeAgo(station.last_tested_at)}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800">
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {!isNew && station && (
            <div className="card p-4">
              <span className="label">Logo</span>
              <ImageUploader station={station} onChange={() => qc.invalidateQueries({ queryKey: ['station', id] })} />
            </div>
          )}

          <Field label="Name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Station name" />
          </Field>
          <Field label="Stream URL">
            <Input value={form.stream_url} onChange={(e) => set('stream_url', e.target.value)} placeholder="https://…" className="font-mono text-xs" />
          </Field>
          {isNew && (
            <Field label="Image URL (source)">
              <Input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://… (host to Cloudinary after saving)" className="font-mono text-xs" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Countries (comma-sep)">
              <Input value={form.countries} onChange={(e) => set('countries', e.target.value)} placeholder="US, GB" />
            </Field>
            <Field label="Genres (comma-sep)">
              <Input value={form.genres} onChange={(e) => set('genres', e.target.value)} placeholder="jazz, news" />
            </Field>
          </div>
          <Field label="Languages (comma-sep)">
            <Input value={form.languages} onChange={(e) => set('languages', e.target.value)} placeholder="English" />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="working">working</option>
                <option value="broken">broken</option>
                <option value="untested">untested</option>
              </Select>
            </Field>
            <Field label="Codec">
              <Input value={form.codec} onChange={(e) => set('codec', e.target.value)} placeholder="aac" />
            </Field>
            <Field label="Bitrate">
              <Input value={form.bitrate} onChange={(e) => set('bitrate', e.target.value)} placeholder="128000" inputMode="numeric" />
            </Field>
          </div>

          <div className="card flex items-center justify-between p-4">
            <div>
              <div className="text-sm font-semibold">Verified</div>
              <div className="text-xs text-ink-400">Protect from the auto-broken death timer.</div>
            </div>
            <Toggle checked={form.is_verified} onChange={(v) => set('is_verified', v)} />
          </div>

          {!isNew && (
            <div className="card p-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => station && player.play(station)}>
                  <Play size={14} /> Preview
                </Button>
                <Button variant="outline" onClick={() => test.mutate()} loading={test.isPending}>
                  <Activity size={14} /> Test stream
                </Button>
                {form.codec && (
                  <span className="mono ml-auto self-center text-xs text-ink-400">
                    {form.codec} · {fmtBitrate(Number(form.bitrate))}
                  </span>
                )}
              </div>
              {testResult && <p className="mono mt-2 text-xs text-ink-500">{testResult}</p>}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center gap-2 border-t border-ink-200 bg-white px-5 py-4 dark:border-ink-800 dark:bg-ink-900">
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {isNew ? 'Create station' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!isNew && (
            <Button
              variant="ghost"
              className="ml-auto text-red-500"
              onClick={() => {
                if (confirm('Delete this station and its hosted image?')) del.mutate();
              }}
              loading={del.isPending}
            >
              <Trash2 size={15} /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
