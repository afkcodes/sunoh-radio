-- 0006_image_public_id: track the exact Cloudinary public_id per station so the
-- admin can delete/replace the right asset reliably (instead of re-deriving).

ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS image_public_id TEXT;

-- Backfill for the ~48k already-hosted rows. host_images.ts uploaded them as
-- '<folder>/<slug>' (folder defaults to 'radio-stations'), so derive the same.
UPDATE radio_stations
   SET image_public_id = 'radio-stations/' || slug
 WHERE image_hosted IS NOT NULL
   AND image_public_id IS NULL;
