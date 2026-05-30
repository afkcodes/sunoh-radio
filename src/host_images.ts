import axios from 'axios';
import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary';
import { closePool, query } from './db';
import { config } from './config';

// Configure the Cloudinary SDK. Prefer discrete values; otherwise fall back to
// the CLOUDINARY_URL env var, which the SDK reads automatically.
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
} else if (config.cloudinary.url) {
  cloudinary.config({ secure: true }); // picks up CLOUDINARY_URL
}

const { batchSize: BATCH_SIZE, maxAttempts: MAX_ATTEMPTS, limit: LIMIT, workingOnly: WORKING_ONLY } =
  config.images;

type UploadResult = { ok: true; url: string } | { ok: false; permanent: boolean };

/**
 * Download a source logo and mirror it to Cloudinary as-is (NO transformation,
 * to avoid consuming transformation credits — we store and serve the original).
 * Distinguishes permanent failures (dead image, e.g. 404/410) from transient
 * ones (timeouts, 5xx, network) so the caller can decide whether to retry.
 */
async function uploadToCloudinary(url: string, publicId: string): Promise<UploadResult> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      // A browser-ish UA helps past trivial hotlink/bot blocks.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SunohRadioBot/1.0)' },
    });
    const buffer = Buffer.from(response.data);

    const options: UploadApiOptions = {
      public_id: publicId,
      folder: config.cloudinary.folder,
      overwrite: false, // idempotent: don't re-upload if it already exists
      resource_type: 'image',
      // Deliberately no eager/incoming transformations -> 0 transformation credits.
    };

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(options, (error, res) => {
          if (error || !res) return reject(error ?? new Error('No upload response'));
          resolve(res as { secure_url: string });
        })
        .end(buffer);
    });

    return { ok: true, url: result.secure_url };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status) {
      console.error(`Failed to download ${url}: HTTP ${status}`);
    } else {
      // Cloudinary rejects with a plain object ({ message, http_code }), not an
      // Error — dig out a readable message instead of logging "[object Object]".
      const e = error as { message?: string; error?: { message?: string } };
      const message = e?.message ?? e?.error?.message ?? JSON.stringify(error);
      console.error(`Error hosting ${publicId}: ${message}`);
    }
    // 4xx (except 408/429) means the source is genuinely gone — don't retry.
    const permanent =
      status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
    return { ok: false, permanent };
  }
}

async function hostImages() {
  const hasCreds =
    (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) ||
    config.cloudinary.url;
  if (!hasCreds) {
    console.error(
      'Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / ' +
        'CLOUDINARY_API_SECRET (or CLOUDINARY_URL) in your environment.',
    );
    process.exit(1);
  }

  console.log('>>> Starting Image Hosting Task (Cloudinary)...');
  if (LIMIT > 0) console.log(`    Capped at ${LIMIT} upload(s) this run (HOST_IMAGE_LIMIT).`);
  if (WORKING_ONLY) console.log('    Hosting working stations only (HOST_IMAGE_WORKING_ONLY).');

  let processed = 0;
  let successful = 0;

  while (LIMIT === 0 || processed < LIMIT) {
    const remaining = LIMIT === 0 ? BATCH_SIZE : Math.min(BATCH_SIZE, LIMIT - processed);

    // Rows still needing a hosted image. Skip permanently-failed ones, cap
    // attempts, and back off via last_image_attempt_at (wait `attempts` hours
    // between tries). Working stations first.
    const res = await query(
      `
      SELECT id, slug, image_url
      FROM radio_stations
      WHERE image_hosted IS NULL
        AND image_url IS NOT NULL
        AND image_url != ''
        AND image_url LIKE 'http%'
        AND image_status <> 'permanent_fail'
        AND image_attempts < $2
        AND (${WORKING_ONLY ? "status = 'working'" : 'TRUE'})
        AND (
          last_image_attempt_at IS NULL
          OR last_image_attempt_at < now() - (image_attempts * interval '1 hour')
        )
      ORDER BY status = 'working' DESC, id ASC
      LIMIT $1
      `,
      [remaining, MAX_ATTEMPTS],
    );

    if (res.rows.length === 0) {
      console.log('No more images to process.');
      break;
    }

    console.log(`Processing batch of ${res.rows.length} images...`);

    const results = await Promise.all(
      res.rows.map(async (station) => {
        // Use slug as the Cloudinary public_id (deterministic, no extension).
        const publicId = String(station.slug || station.id);
        const result = await uploadToCloudinary(station.image_url, publicId);

        if (result.ok) {
          await query(
            `UPDATE radio_stations
                SET image_hosted = $1,
                    image_status = 'hosted',
                    last_image_attempt_at = now(),
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = $2`,
            [result.url, station.id],
          );
          return true;
        }

        // Failure: never write a sentinel string into image_hosted. Record the
        // attempt; mark permanent if the source is gone, otherwise leave it
        // retryable (bounded by MAX_ATTEMPTS + backoff above).
        await query(
          `UPDATE radio_stations
              SET image_status = $1,
                  image_attempts = image_attempts + 1,
                  last_image_attempt_at = now(),
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $2`,
          [result.permanent ? 'permanent_fail' : 'failed', station.id],
        );
        return false;
      }),
    );

    successful += results.filter(Boolean).length;
    processed += res.rows.length;
    console.log(`Progress: ${processed} processed, ${successful} successful...`);
  }

  console.log(`\nTask Complete! Successfully hosted ${successful} image(s) this run.`);
}

hostImages()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error in image hosting task:', err);
    closePool().finally(() => process.exit(1));
  });
