import fs from 'fs';
import path from 'path';
import { query } from './db';

/**
 * Normalizes a URL by removing session/token parameters.
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url.trim());
    const stripParams = [
      'token', 'session_id', 'sid', 'uid', 'uuid', 'auth', 'expires',
      'timestamp', 'time', 'key', 'hash', 'signature', 'sign',
      'tracker', 'client_id', 'user_id', 'h', 't', 'session', 'player'
    ];

    stripParams.forEach(param => urlObj.searchParams.delete(param));
    urlObj.searchParams.sort();

    return urlObj.toString().replace(/\/$/, '');
  } catch (e) {
    return url.trim();
  }
}

/**
 * Creates a URL-friendly slug from a string.
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')  // Remove all non-word chars
    .replace(/--+/g, '-');    // Replace multiple - with single -
}

/**
 * Syncs a validated provider JSON file to the PostgreSQL database.
 * Handles merging of providers, countries, and genres.
 */
async function syncProviderToDb(providerName: string, countryName?: string) {
  const fileName = countryName
    ? `validated_${providerName}_${countryName.replace(/\s+/g, '_')}.json`
    : `validated_${providerName}.json`;

  const filePath = path.join(
    process.cwd(),
    'metadata',
    fileName,
  );

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`\n>>> Starting Database Sync for ${providerName.toUpperCase()}...`);

  const stations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Processing ${stations.length} stations...`);

  const BATCH_SIZE = 100; // Process 100 stations in parallel at a time
  let processed = 0;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < stations.length; i += BATCH_SIZE) {
    const batch = stations.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    const results = await Promise.all(
      batch.map(async (station: any) => {
        try {
          const normalizedUrl = normalizeUrl(station.stream_url);
          const slug = `${slugify(station.name)}-${Math.random().toString(36).substring(2, 7)}`;

          const upsertQuery = `
            INSERT INTO radio_stations (
              name, slug, image_url, stream_url, normalized_url, providers, countries, genres, languages, 
              status, codec, bitrate, sample_rate, last_tested_at
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (normalized_url) DO UPDATE SET
              stream_url = EXCLUDED.stream_url, -- Update playable URL
              providers = radio_stations.providers || EXCLUDED.providers,
              countries = ARRAY(
                SELECT DISTINCT e FROM UNNEST(radio_stations.countries || EXCLUDED.countries) AS e
              ),
              genres = ARRAY(
                SELECT DISTINCT e FROM UNNEST(radio_stations.genres || EXCLUDED.genres) AS e
              ),
              name = CASE WHEN LENGTH(EXCLUDED.name) > LENGTH(radio_stations.name) THEN EXCLUDED.name ELSE radio_stations.name END,
              image_url = CASE WHEN EXCLUDED.image_url LIKE 'https%' AND radio_stations.image_url NOT LIKE 'https%' THEN EXCLUDED.image_url ELSE radio_stations.image_url END,
              failure_count = CASE WHEN EXCLUDED.status = 'working' THEN 0 ELSE radio_stations.failure_count + 1 END,
              status = CASE 
                WHEN radio_stations.is_verified = TRUE THEN radio_stations.status 
                WHEN EXCLUDED.status = 'working' THEN 'working'
                WHEN (radio_stations.failure_count + 1) >= 3 THEN 'broken'
                ELSE radio_stations.status 
              END,
              codec = CASE WHEN radio_stations.is_verified = TRUE THEN radio_stations.codec ELSE COALESCE(EXCLUDED.codec, radio_stations.codec) END,
              last_tested_at = EXCLUDED.last_tested_at,
              updated_at = CURRENT_TIMESTAMP
            RETURNING (xmin = 0) as is_new;
          `;

          const providersJson = JSON.stringify({ [providerName]: station.id });
          const values = [
            station.name,
            slug,
            station.image,
            station.stream_url,
            normalizedUrl,
            providersJson,
            station.countries,
            station.genres,
            station.languages,
            station.status,
            station.codec !== 'unknown' ? station.codec : null,
            station.bitrate || 0,
            station.sample_rate || 0,
            station.last_tested_at,
          ];

          const res = await query(upsertQuery, values);
          return { success: true, isNew: res.rows[0]?.is_new };
        } catch (err) {
          console.error(`Error syncing station ${station.name}:`, err);
          return { success: false };
        }
      })
    );

    // Count results
    results.forEach(res => {
      if (res.success) {
        if (res.isNew) inserted++;
        else updated++;
      }
    });

    processed += batch.length;
    if (processed % 500 === 0 || processed === stations.length) {
      console.log(`Progress: ${processed}/${stations.length} processed... (New: ${inserted}, Merged: ${updated})`);
    }
  }

  console.log('\n' + '='.repeat(50));
  printSummary(providerName, stations.length, inserted, updated);
  console.log('='.repeat(50));
}

function printSummary(provider: string, total: number, inserted: number, updated: number) {
  console.log(`          SYNC COMPLETE: ${provider.toUpperCase()}`);
  console.log('-'.repeat(50));
  console.log(`Total stations in file: ${total}`);
  console.log(`New stations added:     ${inserted}`);
  console.log(`Existing stations merged: ${updated}`);
}

// CLI Support
if (require.main === module) {
  const provider = process.argv[2];
  const country = process.argv[3];
  if (!provider) {
    console.error('Usage: npx tsx sync_to_db.ts [provider_name] [optional_country]');
    process.exit(1);
  }

  syncProviderToDb(provider, country)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
