-- 0007_play_count: per-station play counter.
ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;

-- Supports "most played" ordering.
CREATE INDEX IF NOT EXISTS idx_radio_play_count ON radio_stations(play_count DESC);
