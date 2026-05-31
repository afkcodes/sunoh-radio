import { query } from '../db';

/** Best-effort audit log write — never throws into the request path. */
export async function writeAudit(
  action: string,
  stationId: number | null,
  details: unknown = {},
  actor = 'admin',
): Promise<void> {
  try {
    await query('INSERT INTO audit_log (action, station_id, actor, details) VALUES ($1, $2, $3, $4)', [
      action,
      stationId,
      actor,
      JSON.stringify(details ?? {}),
    ]);
  } catch (err) {
    console.error('audit write failed:', err);
  }
}
