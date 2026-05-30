-- 0002_image_status: structured image-hosting state.
-- Replaces the previous practice of writing the literal string 'FAILED' into
-- image_hosted (a poison value that also blocked retries) with proper status,
-- attempt-count and timestamp columns supporting retry-with-backoff.

ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS image_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS image_attempts INTEGER DEFAULT 0;
ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS last_image_attempt_at TIMESTAMPTZ;

-- One-time cleanup of the old poison value so those rows become retryable.
UPDATE radio_stations
   SET image_hosted = NULL,
       image_status = 'failed',
       image_attempts = 1
 WHERE image_hosted = 'FAILED';

-- Mark already-hosted rows so the worker doesn't reconsider them.
UPDATE radio_stations
   SET image_status = 'hosted'
 WHERE image_hosted IS NOT NULL
   AND image_status = 'pending';

-- Partial index for the worker's selection query (rows still needing hosting).
CREATE INDEX IF NOT EXISTS idx_radio_image_pending ON radio_stations(id)
  WHERE image_hosted IS NULL AND image_status IN ('pending', 'failed');
