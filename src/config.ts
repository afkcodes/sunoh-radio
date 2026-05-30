import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function int(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Single source of truth for runtime configuration on the TypeScript side.
 * Reads the environment once, here, so individual modules never call
 * `dotenv.config()` or read `process.env` directly.
 */
export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,

  db: {
    user: process.env.DB_USER || 'sunoh',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sunoh_radio_db',
    password: process.env.DB_PASSWORD || 'change_me',
    port: int(process.env.DB_PORT, 5433),
    // Pool tuning — sized for a single API instance. Raise `max` (and front
    // with PgBouncer) when running multiple replicas.
    max: int(process.env.DB_POOL_MAX, 15),
    idleTimeoutMillis: int(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: int(process.env.DB_CONNECT_TIMEOUT_MS, 10_000),
  },

  api: {
    port: int(process.env.PORT, 4000),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    // CORS allow-list. Default '*' in dev; require an explicit list in prod.
    corsOrigins: list(process.env.CORS_ORIGINS, ['*']),
    rateLimit: {
      max: int(process.env.RATE_LIMIT_MAX, 100),
      timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    },
    // Pagination caps for list endpoints.
    maxLimit: int(process.env.API_MAX_LIMIT, 100),
    defaultLimit: int(process.env.API_DEFAULT_LIMIT, 50),
    maxOffset: int(process.env.API_MAX_OFFSET, 50_000),
    // Cache TTL (seconds) for slow-changing aggregate endpoints.
    aggregateCacheTtl: int(process.env.AGGREGATE_CACHE_TTL, 600),
  },

  cloudinary: {
    // Either provide the three discrete values, or a single CLOUDINARY_URL
    // (cloudinary://<key>:<secret>@<cloud_name>), which the SDK reads natively.
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    url: process.env.CLOUDINARY_URL || '',
    folder: process.env.CLOUDINARY_FOLDER || 'radio-stations',
  },

  // Image-hosting worker tuning.
  images: {
    // Cap total uploads in a single run (0 = no cap). Set a small value for a
    // first test run, then check your Cloudinary dashboard before going full.
    limit: int(process.env.HOST_IMAGE_LIMIT, 0),
    batchSize: int(process.env.HOST_IMAGE_BATCH, 50),
    maxAttempts: int(process.env.HOST_IMAGE_MAX_ATTEMPTS, 5),
    // Only host images for working stations by default (saves credits/time).
    workingOnly: (process.env.HOST_IMAGE_WORKING_ONLY ?? 'true') !== 'false',
  },
} as const;

/**
 * Fail fast if required configuration is missing in production. Called by
 * long-running entrypoints (the API server); pipeline scripts that don't need
 * every credential can skip it.
 */
export function assertConfig(): void {
  if (!isProduction) return;
  const missing: string[] = [];
  if (!process.env.DB_PASSWORD) missing.push('DB_PASSWORD');
  if (!process.env.DB_HOST) missing.push('DB_HOST');
  if (config.api.corsOrigins.includes('*')) {
    console.warn('[config] CORS_ORIGINS is "*" in production — consider an explicit allow-list.');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
