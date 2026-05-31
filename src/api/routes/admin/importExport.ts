import type { FastifyInstance } from 'fastify';
import { query } from '../../../db';
import { normalizeUrl } from '../../../lib/normalizeUrl';
import { makeSlug } from '../../../sync_to_db';
import { writeAudit } from '../../../lib/audit';

const EXPORT_COLS = [
  'id',
  'slug',
  'name',
  'stream_url',
  'image_url',
  'image_hosted',
  'countries',
  'genres',
  'languages',
  'status',
  'codec',
  'bitrate',
  'sample_rate',
  'is_verified',
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === 'string') return v.split('|').map((s) => s.trim()).filter(Boolean);
  return [];
}

interface ImportRow {
  name?: string;
  stream_url?: string;
  image_url?: string;
  countries?: string[] | string;
  genres?: string[] | string;
  languages?: string[] | string;
  status?: string;
}

export default async function adminImportExportRoutes(app: FastifyInstance) {
  // GET /export.csv — whole catalog as CSV.
  app.get('/export.csv', async (_req, reply) => {
    const rows = (await query(`SELECT ${EXPORT_COLS.join(', ')} FROM radio_stations ORDER BY id`)).rows;
    const lines = [EXPORT_COLS.join(',')];
    for (const r of rows) lines.push(EXPORT_COLS.map((c) => csvCell(r[c])).join(','));
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="sunoh-stations.csv"`)
      .send(lines.join('\n'));
  });

  // POST /import { rows: [...] } — upsert by normalized_url. The client (admin
  // SPA) parses CSV/JSON and posts a rows array. Reports inserted/updated/skipped.
  app.post<{ Body: { rows?: ImportRow[]; dryRun?: boolean } }>('/import', async (req, reply) => {
    const rows = req.body?.rows;
    const dryRun = req.body?.dryRun === true;
    if (!Array.isArray(rows) || rows.length === 0) {
      return reply.code(400).send({ error: 'rows[] is required' });
    }
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = String(row.name ?? '').trim();
      const streamUrl = String(row.stream_url ?? '').trim();
      if (!name || !streamUrl) {
        skipped++;
        continue;
      }
      if (dryRun) continue;
      const normalizedUrl = normalizeUrl(streamUrl);
      const slug = makeSlug(name, normalizedUrl);
      const res = await query(
        `INSERT INTO radio_stations
           (name, slug, image_url, stream_url, normalized_url, countries, genres, languages, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (normalized_url) DO UPDATE SET
           name = EXCLUDED.name,
           image_url = COALESCE(EXCLUDED.image_url, radio_stations.image_url),
           countries = ARRAY(SELECT DISTINCT e FROM unnest(radio_stations.countries || EXCLUDED.countries) e),
           genres = ARRAY(SELECT DISTINCT e FROM unnest(radio_stations.genres || EXCLUDED.genres) e),
           languages = ARRAY(SELECT DISTINCT e FROM unnest(radio_stations.languages || EXCLUDED.languages) e),
           updated_at = now()
         RETURNING (xmax = 0) AS is_new`,
        [
          name,
          slug,
          row.image_url ?? null,
          streamUrl,
          normalizedUrl,
          toArray(row.countries),
          toArray(row.genres),
          toArray(row.languages),
          row.status ?? 'untested',
        ],
      );
      if (res.rows[0]?.is_new) inserted++;
      else updated++;
    }

    if (!dryRun) await writeAudit('import', null, { inserted, updated, skipped, total: rows.length });
    return { ok: true, dryRun, inserted, updated, skipped, total: rows.length };
  });
}
