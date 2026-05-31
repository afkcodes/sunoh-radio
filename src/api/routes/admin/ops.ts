import type { FastifyInstance } from 'fastify';
import { query } from '../../../db';
import { writeAudit } from '../../../lib/audit';

const AUDIO_HINTS = ['audio/', 'mpegurl', 'ogg', 'octet-stream', 'video/mp2t'];

/**
 * Lightweight HTTP reachability check for a stream (no ffmpeg in this image).
 * Fetches a couple of bytes and judges working/broken by status + content-type.
 * Codec/bitrate stay the Python pipeline's job (ffprobe).
 */
async function probe(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1', 'User-Agent': 'Mozilla/5.0 (compatible; SunohRadioBot/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    // Cancel the body so we don't download the whole stream.
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    if (!res.ok && res.status !== 206) return { ok: false, detail: `HTTP ${res.status}` };
    const audioish = AUDIO_HINTS.some((h) => ct.includes(h)) || ct === '';
    return { ok: audioish, detail: `HTTP ${res.status} ${ct || '(no content-type)'}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export default async function adminOpsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/stations/:id/test', async (req, reply) => {
    const cur = await query(
      'SELECT id, stream_url, is_verified, failure_count FROM radio_stations WHERE id = $1',
      [req.params.id],
    );
    if (!cur.rows.length) return reply.code(404).send({ error: 'Station not found' });
    const s = cur.rows[0];

    const result = await probe(s.stream_url);
    const status = result.ok ? 'working' : 'broken';
    // Respect the is_verified protection (don't flip a protected station to broken).
    const applyStatus = s.is_verified ? s.status ?? status : status;
    const failureCount = result.ok ? 0 : (s.failure_count ?? 0) + 1;

    const res = await query(
      `UPDATE radio_stations
          SET status = $1, failure_count = $2, last_tested_at = now(), updated_at = now()
        WHERE id = $3
        RETURNING id, status, failure_count, last_tested_at`,
      [applyStatus, failureCount, s.id],
    );
    await writeAudit('station.test', s.id, { result: status, detail: result.detail });
    return { ...res.rows[0], probe: result };
  });
}
