#!/usr/bin/env bash
#
# deploy.sh — one-shot deploy of the Sunoh Radio DB + API on a VPS.
#
# What it does (idempotent — safe to re-run):
#   1. Preflight: docker, docker compose, and a .env with DB_PASSWORD.
#   2. Start Postgres (docker-compose.prod.yml) and wait until healthy.
#   3. If the DB is empty and a dump is available, restore it (your 66k rows).
#   4. Build + start the API (auto-applies migrations on boot).
#   5. Wait for /health and print a summary (row counts).
#
# The API is published on 127.0.0.1:4000 only (private). Add a reverse proxy
# later (see deploy/Caddyfile or deploy/nginx.conf) when you go public.
#
# Usage:
#   ./deploy.sh                      # deploy; auto-restores ./sunoh.dump if DB is empty
#   ./deploy.sh --restore path.dump  # restore a specific dump into an empty DB
#   ./deploy.sh --no-build           # skip rebuilding the API image
#   ./deploy.sh --skip-restore       # never restore (start empty / keep existing data)
#
set -euo pipefail

# --- locate repo root (this script lives at the root) ---
cd "$(dirname "$(readlink -f "$0")")"

COMPOSE_FILE="docker-compose.prod.yml"
DB_CONTAINER="sunoh-radio-db"
API_URL="http://127.0.0.1:4000"
RESTORE_FILE=""
DO_BUILD=1
SKIP_RESTORE=0

# --- args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --restore) RESTORE_FILE="${2:?--restore needs a file path}"; shift 2 ;;
    --no-build) DO_BUILD=0; shift ;;
    --skip-restore) SKIP_RESTORE=1; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- pretty logging ---
c_g="\033[92m"; c_y="\033[93m"; c_r="\033[91m"; c_c="\033[96m"; c_x="\033[0m"
log()  { printf "${c_c}==> %s${c_x}\n" "$*"; }
ok()   { printf "${c_g}  ✓ %s${c_x}\n" "$*"; }
warn() { printf "${c_y}  ! %s${c_x}\n" "$*"; }
die()  { printf "${c_r}  ✗ %s${c_x}\n" "$*" >&2; exit 1; }

# docker compose v2 vs legacy
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
dc() { $DC -f "$COMPOSE_FILE" "$@"; }

# read a value from .env (without sourcing it)
envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2-; }

# ----------------------------------------------------------------------------
log "1/5 Preflight checks"
command -v docker >/dev/null 2>&1 || die "docker is not installed"
$DC version >/dev/null 2>&1 || die "docker compose is not available"
[ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE not found (run from the repo root)"
[ -f .env ] || die ".env not found — copy .env.example to .env and fill it in"
[ -n "$(envval DB_PASSWORD)" ] || die "DB_PASSWORD is not set in .env"
[ -n "$(envval DB_USER)" ] && DB_USER="$(envval DB_USER)" || DB_USER="sunoh"
[ -n "$(envval DB_NAME)" ] && DB_NAME="$(envval DB_NAME)" || DB_NAME="sunoh_radio_db"
[ -n "$(envval CLOUDINARY_CLOUD_NAME)$(envval CLOUDINARY_URL)" ] || \
  warn "No Cloudinary creds in .env — the API runs fine, but 'npm run host-images' won't."
ok "docker, compose, and .env look good"

# ----------------------------------------------------------------------------
log "2/5 Starting Postgres"
dc up -d db
printf "  waiting for db to be healthy"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  printf "."; sleep 2
done
printf "\n"
[ "$status" = "healthy" ] || die "Postgres did not become healthy"
ok "Postgres healthy"

# ----------------------------------------------------------------------------
log "3/5 Data restore (if needed)"
row_count() { docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA \
  -c "SELECT count(*) FROM radio_stations" 2>/dev/null | tr -d '[:space:]'; }

existing="$(row_count || true)"
if [ "$SKIP_RESTORE" = "1" ]; then
  warn "Skipping restore (--skip-restore)"
elif [ -n "${existing:-}" ] && [ "${existing:-0}" -gt 0 ] 2>/dev/null; then
  ok "DB already has $existing rows — leaving data as-is (no restore)"
else
  # pick a dump: explicit flag, else ./sunoh.dump if present
  dump="$RESTORE_FILE"
  [ -z "$dump" ] && [ -f ./sunoh.dump ] && dump="./sunoh.dump"
  if [ -n "$dump" ]; then
    [ -f "$dump" ] || die "Dump file not found: $dump"
    log "  restoring from $dump (this preserves your 66k rows)"
    docker exec -i "$DB_CONTAINER" pg_restore --no-owner --clean --if-exists \
      -U "$DB_USER" -d "$DB_NAME" < "$dump" || warn "pg_restore reported warnings (often harmless)"
    ok "restored — now has $(row_count) rows"
  else
    warn "No dump found (./sunoh.dump). Starting with an EMPTY schema."
    warn "To load data later: ./deploy.sh --restore <file.dump>"
  fi
fi

# ----------------------------------------------------------------------------
log "4/5 Building & starting the API (auto-migrates on boot)"
if [ "$DO_BUILD" = "1" ]; then dc build api; else warn "skipping build (--no-build)"; fi
dc up -d api
ok "API container started"

# ----------------------------------------------------------------------------
log "5/5 Verifying"
printf "  waiting for the API to answer"
for _ in $(seq 1 40); do
  curl -sf "$API_URL/health" >/dev/null 2>&1 && break
  printf "."; sleep 1
done
printf "\n"
if curl -sf "$API_URL/health" >/dev/null 2>&1; then
  ok "API is up at $API_URL"
  echo "    /health  -> $(curl -s "$API_URL/health")"
  echo "    /stats   -> $(curl -s "$API_URL/stats")"
else
  die "API did not respond. Check logs:  $DC -f $COMPOSE_FILE logs api"
fi

printf "\n${c_g}Deploy complete.${c_x}\n"
echo "  • API (private):  $API_URL   (127.0.0.1 only)"
echo "  • Logs:           $DC -f $COMPOSE_FILE logs -f api"
echo "  • Stop:           $DC -f $COMPOSE_FILE down       (data is kept in the volume)"
echo "  • Backup DB:      ./scripts/backup_db.sh"
