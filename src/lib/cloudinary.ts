import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary';
import { config } from '../config';

// Configure the Cloudinary SDK once. Prefer the three discrete values; else
// fall back to CLOUDINARY_URL which the SDK reads from the environment itself.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
  } else if (config.cloudinary.url) {
    cloudinary.config({ secure: true });
  }
  configured = true;
}

export function hasCloudinaryCreds(): boolean {
  return Boolean(
    (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) ||
      config.cloudinary.url,
  );
}

/** The folder-qualified public_id we host station logos under (stable per slug). */
export function publicIdForSlug(slug: string): string {
  return `${config.cloudinary.folder}/${slug}`;
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Upload an image buffer to Cloudinary at a deterministic public_id. No
 * transformations (serve originals → ~0 transformation credits). `overwrite`
 * replaces an existing asset at the same id in place.
 */
export async function uploadImage(buffer: Buffer, publicId: string): Promise<UploadedImage> {
  ensureConfigured();
  const options: UploadApiOptions = {
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    resource_type: 'image',
  };
  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (error, res) => {
        if (error || !res) return reject(error ?? new Error('No upload response'));
        resolve(res as { secure_url: string; public_id: string });
      })
      .end(buffer);
  });
  return { url: result.secure_url, publicId: result.public_id };
}

/** Delete an asset by its (folder-qualified) public_id. Idempotent/best-effort. */
export async function destroyImage(publicId: string): Promise<void> {
  if (!publicId) return;
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
  } catch (err) {
    // Don't fail the whole operation if the asset is already gone.
    console.error(`Cloudinary destroy failed for ${publicId}:`, err);
  }
}

export { cloudinary };
