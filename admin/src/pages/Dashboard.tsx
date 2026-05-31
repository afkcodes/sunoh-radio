import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, Cell } from 'recharts';
import { Radio, CheckCircle2, ImageIcon, Globe2 } from 'lucide-react';
import { api } from '../api';
import type { Stats } from '../types';
import { Spinner } from '../components/ui';
import { cn, fmtNumber } from '../lib';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <span className="label mb-0">{label}</span>
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg',
            accent ? 'bg-signal-500/15 text-signal-500' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
          )}
        >
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

const BARS = ['#f97316', '#ea580c', '#fb923c', '#c2410c', '#fdba74'];

function FacetChart({ title, data }: { title: string; data: { value: string; count: number }[] }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-bold text-ink-700 dark:text-ink-200">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <XAxis
            dataKey="value"
            tick={{ fontSize: 11, fill: 'currentColor' }}
            className="text-ink-400"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <Tooltip
            cursor={{ fill: 'rgba(249,115,22,.08)' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[5, 5, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={BARS[i % BARS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<Stats>({ queryKey: ['stats'], queryFn: () => api.get('/stats') });
  if (isLoading || !data) return <Spinner />;

  const pct = data.total ? Math.round((data.hosted / data.total) * 100) : 0;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-sm text-ink-400">Catalog health at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Radio} label="Total stations" value={fmtNumber(data.total)} sub={`${fmtNumber(data.working)} working`} accent />
        <StatCard icon={CheckCircle2} label="Verified" value={fmtNumber(data.verified)} sub="protected from auto-broken" />
        <StatCard icon={ImageIcon} label="Logos hosted" value={`${pct}%`} sub={`${fmtNumber(data.hosted)} on Cloudinary`} />
        <StatCard icon={Globe2} label="Coverage" value={fmtNumber(data.countries)} sub={`${data.genres} genres`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FacetChart title="Top countries (working)" data={data.top_countries} />
        <FacetChart title="Top genres (working)" data={data.top_genres} />
      </div>

      <div className="card p-5">
        <h3 className="mb-4 text-sm font-bold text-ink-700 dark:text-ink-200">Image hosting status</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(data.images).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-ink-50 px-4 py-3 dark:bg-ink-850">
              <div className="text-xl font-bold">{fmtNumber(v)}</div>
              <div className="mono text-xs capitalize text-ink-400">{k.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
