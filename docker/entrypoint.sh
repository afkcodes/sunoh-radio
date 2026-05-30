#!/bin/sh
# Apply pending migrations, then start the API. Migrations are idempotent and
# never drop data, so running them on every boot is safe for a single instance.
set -e

echo "[entrypoint] applying database migrations..."
node dist/migrate.js

echo "[entrypoint] starting API..."
exec node dist/index.js
