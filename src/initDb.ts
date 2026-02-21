import { query } from './db';

const createTableQuery = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS radio_stations (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE,                    -- URL-friendly identifier
  name VARCHAR(255) NOT NULL,
  image_url TEXT,                      -- Source image
  image_hosted TEXT,                   -- Hosted image (ImageKit)
  stream_url TEXT NOT NULL,           -- Latest playable URL
  normalized_url TEXT UNIQUE NOT NULL, -- Deduplication anchor (no tokens)
  providers JSONB DEFAULT '{}',       -- { "orb": "id1", "mytuner": "id2" }
  countries TEXT[] DEFAULT '{}',      -- [ "US", "GB" ]
  genres TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'untested',
  codec VARCHAR(50),
  bitrate INTEGER,
  sample_rate INTEGER,
  failure_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,  -- Protective flag for major stations
  last_tested_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fast Array Filtering
CREATE INDEX IF NOT EXISTS idx_radio_genres_gin ON radio_stations USING GIN (genres);
CREATE INDEX IF NOT EXISTS idx_radio_countries_gin ON radio_stations USING GIN (countries);
CREATE INDEX IF NOT EXISTS idx_radio_languages_gin ON radio_stations USING GIN (languages);

-- Fast Fuzzy Search
CREATE INDEX IF NOT EXISTS idx_radio_name_trgm ON radio_stations USING GIN (name gin_trgm_ops);

-- Operational Indexes
CREATE INDEX IF NOT EXISTS idx_radio_status ON radio_stations(status);
CREATE INDEX IF NOT EXISTS idx_radio_normalized_url ON radio_stations(normalized_url);
`;

export async function initDatabase() {
  try {
    console.log('Initializing database...');
    // Drop existing table to ensure clean schema update (safe since no stations tested yet)
    await query(`DROP TABLE IF EXISTS radio_stations CASCADE;`);
    await query(createTableQuery);
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0));
}
