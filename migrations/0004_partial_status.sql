-- migrate:no-transaction
-- 0004_partial_status: index for the dominant API access pattern
-- (status='working' ORDER BY name). A partial index keeps it small and serves
-- both the filter and the ordering.
--
-- CONCURRENTLY avoids locking the (large, live) table during the build, but it
-- cannot run inside a transaction — hence the no-transaction marker above.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_radio_working_name
  ON radio_stations(name)
  WHERE status = 'working';
