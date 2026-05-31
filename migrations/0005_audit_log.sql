-- 0005_audit_log: record admin mutations (create/update/delete/image/bulk/import).

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,            -- e.g. 'station.create', 'station.delete', 'image.replace'
  station_id INTEGER,             -- nullable (bulk/import may not target one row)
  actor TEXT DEFAULT 'admin',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_station ON audit_log(station_id);
