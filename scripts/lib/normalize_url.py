#!/usr/bin/env python3
"""Canonical stream-URL normalization.

This is the SINGLE SOURCE OF TRUTH for how a stream URL is reduced to its
deduplication anchor (`normalized_url`). The TypeScript implementation in
`src/lib/normalizeUrl.ts` is kept byte-for-byte compatible and both are pinned
by the shared golden fixture in `tests/fixtures/url_normalization.json`.

Behavior:
  - strip session/token/tracking query params,
  - sort the remaining params for a stable ordering,
  - drop the fragment,
  - strip trailing slashes.
"""
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# Query parameters that vary per request/session and must not affect identity.
STRIP_PARAMS = {
    "token", "session_id", "sid", "uid", "uuid", "auth", "expires",
    "timestamp", "time", "key", "hash", "signature", "sign",
    "tracker", "client_id", "user_id", "h", "t", "session", "player",
}


def normalize_url(url):
    """Normalize a stream URL into its deduplication anchor."""
    if not url:
        return ""
    url = url.strip()
    try:
        u = urlparse(url)
        params = parse_qsl(u.query)
        filtered_params = [(k, v) for k, v in params if k.lower() not in STRIP_PARAMS]
        filtered_params.sort()
        new_query = urlencode(filtered_params)
        return urlunparse(u._replace(query=new_query, fragment="")).rstrip("/")
    except Exception:
        return url
