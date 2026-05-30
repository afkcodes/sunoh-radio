#!/usr/bin/env python3
"""Single source of truth for runtime configuration on the Python side.

Loads the project `.env` once and exposes typed-ish settings + canonical paths
so the pipeline scripts don't each hand-parse the environment.
"""
import os

# Project root is the parent of this `scripts/` directory.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_dotenv(path=None):
    """Minimal .env loader (no external dependency).

    Only sets variables that are not already present in the environment, so
    real environment variables always win over the file.
    """
    path = path or os.path.join(PROJECT_ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                key, value = line.split("=", 1)
            except ValueError:
                continue
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip()


load_dotenv()


def _int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


# Canonical paths
METADATA_DIR = os.path.join(PROJECT_ROOT, "metadata")
CORE_DIR = os.path.join(PROJECT_ROOT, "core")
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs")
PROVIDERS_DIR = os.path.join(PROJECT_ROOT, "providers")
COUNTRIES_FILE = os.path.join(CORE_DIR, "countries.txt")
ISO_MAP_FILE = os.path.join(CORE_DIR, "countries_iso_map.json")

# Scraping / validation
MAX_WORKERS = _int("MAX_WORKERS", 5)
PROBE_TIMEOUT = _int("PROBE_TIMEOUT", 15)
USER_AGENT = os.environ.get(
    "PROBE_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
)
REFERER = os.environ.get("PROBE_REFERER", "https://onlineradiobox.com/")

# Optional: extra directory to prepend to PATH so `node`/`npx` resolve when the
# orchestrator shells out (e.g. an nvm/n install). Configurable instead of a
# hardcoded user-specific path.
NODE_BIN_PATH = os.environ.get("NODE_BIN_PATH", "")

# Database (mirrors the TS side; used by any Python DB tooling)
DB = {
    "user": os.environ.get("DB_USER", "sunoh"),
    "host": os.environ.get("DB_HOST", "localhost"),
    "name": os.environ.get("DB_NAME", "sunoh_radio_db"),
    "password": os.environ.get("DB_PASSWORD", "change_me"),
    "port": _int("DB_PORT", 5433),
}
