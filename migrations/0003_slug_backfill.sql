-- 0003_slug_backfill: replace the old random slug suffixes with deterministic,
-- stable ones derived from the unique normalized_url, matching the TypeScript
-- `makeSlug()` in src/sync_to_db.ts: `slugify(name)-<first 10 hex of sha1(normalized_url)>`.
--
-- One-time data fix for rows synced before slugs became deterministic. Safe to
-- re-run (recomputes the same value) and a no-op on a fresh/empty database.
-- ⚠️ This rewrites every existing slug — run before any slug URLs are published.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH computed AS (
  SELECT
    id,
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim(name)), '\s+', '-', 'g'),
        '[^a-z0-9_-]+', '', 'g'
      ),
      '-{2,}', '-', 'g'
    ) AS base,
    substr(encode(digest(normalized_url, 'sha1'), 'hex'), 1, 10) AS suffix
  FROM radio_stations
)
UPDATE radio_stations r
   SET slug = (CASE WHEN computed.base = '' THEN 'station' ELSE computed.base END)
              || '-' || computed.suffix
  FROM computed
 WHERE r.id = computed.id;

-- Defense-in-depth: fail loudly (and roll back the whole migration) if the
-- 10-hex truncation ever produced a collision, instead of relying solely on a
-- generic UNIQUE-violation error. With 40 bits of hash + the name prefix this
-- should never fire, but a clear message beats a cryptic one on 10^4+ rows.
DO $$
DECLARE
  dup integer;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT slug FROM radio_stations GROUP BY slug HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'slug backfill produced % duplicate slug group(s); aborting and rolling back', dup;
  END IF;
END $$;
