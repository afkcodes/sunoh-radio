#!/usr/bin/env bash
# Back up the production Postgres to a timestamped custom-format dump.
# Usage: ./scripts/backup_db.sh [output_dir]   (default: ./backups)
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

DB_CONTAINER="sunoh-radio-db"
OUT_DIR="${1:-./backups}"
DB_USER="$(grep -E '^DB_USER=' .env 2>/dev/null | cut -d= -f2- || true)"; DB_USER="${DB_USER:-sunoh}"
DB_NAME="$(grep -E '^DB_NAME=' .env 2>/dev/null | cut -d= -f2- || true)"; DB_NAME="${DB_NAME:-sunoh_radio_db}"

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$OUT_DIR/sunoh-$STAMP.dump"

echo "Backing up $DB_NAME -> $OUT"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$OUT"
echo "Done ($(du -h "$OUT" | cut -f1)). Restore with: ./deploy.sh --restore $OUT"

# Keep only the 7 most recent backups.
ls -1t "$OUT_DIR"/sunoh-*.dump 2>/dev/null | tail -n +8 | xargs -r rm -f
