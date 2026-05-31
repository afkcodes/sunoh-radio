import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Upload } from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui';
import { useToast } from '../components/Toast';
import { fmtNumber } from '../lib';

type Row = Record<string, unknown>;
interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
  dryRun: boolean;
}

export default function ImportExport() {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const parse = (file: File) => {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      try {
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          setRows(Array.isArray(json) ? json : json.rows || []);
        } else {
          const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
          setRows(parsed.data);
        }
      } catch {
        toast('error', 'Could not parse file');
      }
    };
    reader.readAsText(file);
  };

  const run = async (dryRun: boolean) => {
    if (!rows) return;
    setBusy(true);
    try {
      const r = await api.post<ImportResult>('/import', { rows, dryRun });
      setResult(r);
      if (!dryRun) {
        toast('success', `Imported: ${r.inserted} new, ${r.updated} updated`);
        qc.invalidateQueries({ queryKey: ['stations'] });
        qc.invalidateQueries({ queryKey: ['stats'] });
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Import / Export</h1>
        <p className="text-sm text-ink-400">Back up or bulk-load the catalog. Arrays use <code className="mono">|</code> separators in CSV.</p>
      </div>

      <div className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Download size={16} /> Export</h3>
        <p className="mt-1 text-sm text-ink-400">Download the entire catalog as CSV.</p>
        <a href={api.rawUrl('/export.csv')} download>
          <Button variant="outline" className="mt-3"><Download size={15} /> Download sunoh-stations.csv</Button>
        </a>
      </div>

      <div className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Upload size={16} /> Import</h3>
        <p className="mt-1 text-sm text-ink-400">
          Upload a CSV or JSON file. Rows are upserted by stream URL (existing stations are merged).
          Requires <code className="mono">name</code> and <code className="mono">stream_url</code> columns.
        </p>

        <div
          className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 py-8 text-center text-ink-400 transition hover:border-signal-300 dark:border-ink-700"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); e.dataTransfer.files?.[0] && parse(e.dataTransfer.files[0]); }}
        >
          <FileUp size={22} className="mb-2" />
          <span className="text-sm font-medium">{fileName || 'Drop or click to choose a .csv / .json file'}</span>
          {rows && <span className="mono mt-1 text-xs text-signal-600">{fmtNumber(rows.length)} rows parsed</span>}
        </div>
        <input ref={inputRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} />

        {rows && (
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => run(true)} loading={busy}>Dry run</Button>
            <Button onClick={() => run(false)} loading={busy}>Import {fmtNumber(rows.length)} rows</Button>
          </div>
        )}

        {result && (
          <div className="mono mt-4 grid grid-cols-4 gap-2 text-center text-sm">
            {(['inserted', 'updated', 'skipped', 'total'] as const).map((k) => (
              <div key={k} className="rounded-lg bg-ink-50 py-2.5 dark:bg-ink-850">
                <div className="text-lg font-bold">{fmtNumber(result[k])}</div>
                <div className="text-[11px] uppercase text-ink-400">{k}</div>
              </div>
            ))}
            {result.dryRun && <p className="col-span-4 text-xs text-signal-600">Dry run — nothing was written.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
