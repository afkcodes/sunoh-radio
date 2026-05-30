/**
 * Canonical stream-URL normalization (TypeScript side).
 *
 * Kept byte-for-byte compatible with the canonical Python implementation in
 * `scripts/lib/normalize_url.py`. Both are pinned by the shared golden fixture
 * `tests/fixtures/url_normalization.json`.
 *
 * NOTE: production dedup uses the `normalized_url` produced by the Python
 * pipeline (see src/sync_to_db.ts) — this function exists for parity tests and
 * ad-hoc/API use. It deliberately avoids the WHATWG `URL` class, which would
 * lower-case hosts, strip default ports and re-encode paths, diverging from
 * Python's `urlparse`.
 */

// Query parameters that vary per request/session and must not affect identity.
export const STRIP_PARAMS = new Set([
  'token', 'session_id', 'sid', 'uid', 'uuid', 'auth', 'expires',
  'timestamp', 'time', 'key', 'hash', 'signature', 'sign',
  'tracker', 'client_id', 'user_id', 'h', 't', 'session', 'player',
]);

const SAFE = /[A-Za-z0-9_.\-~]/;
const encoder = new TextEncoder();

/** Mirror of Python's `urllib.parse.quote_plus`. */
function quotePlus(value: string): string {
  let out = '';
  for (const byte of encoder.encode(value)) {
    const ch = String.fromCharCode(byte);
    if (SAFE.test(ch)) {
      out += ch;
    } else if (byte === 0x20) {
      out += '+';
    } else {
      out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}

/** Mirror of Python's `urllib.parse.unquote_plus` (lenient). */
function unquotePlus(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

/**
 * Mirror of `parse_qsl(query)` with the defaults used by the pipeline
 * (keep_blank_values=False): pairs with an empty value are dropped.
 */
function parseQsl(query: string): [string, string][] {
  if (!query) return [];
  const pairs: [string, string][] = [];
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawVal = eq === -1 ? '' : part.slice(eq + 1);
    const key = unquotePlus(rawKey);
    const val = unquotePlus(rawVal);
    if (val === '') continue; // keep_blank_values=False
    pairs.push([key, val]);
  }
  return pairs;
}

/** Tuple comparison matching Python's list.sort() on (key, value). */
function compareTuple(a: [string, string], b: [string, string]): number {
  if (a[0] < b[0]) return -1;
  if (a[0] > b[0]) return 1;
  if (a[1] < b[1]) return -1;
  if (a[1] > b[1]) return 1;
  return 0;
}

/** Split a URL into urlparse-style components without WHATWG normalization. */
function splitUrl(url: string): {
  scheme: string;
  netloc: string;
  path: string;
  query: string;
} {
  let rest = url;
  let scheme = '';
  let netloc = '';

  const schemeMatch = rest.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase(); // urlparse lower-cases the scheme
    rest = rest.slice(schemeMatch[0].length);
  }
  if (rest.startsWith('//')) {
    rest = rest.slice(2);
    const slash = rest.search(/[/?#]/);
    if (slash === -1) {
      netloc = rest;
      rest = '';
    } else {
      netloc = rest.slice(0, slash);
      rest = rest.slice(slash);
    }
  }

  // Drop the fragment.
  const hash = rest.indexOf('#');
  if (hash !== -1) rest = rest.slice(0, hash);

  let query = '';
  const q = rest.indexOf('?');
  if (q !== -1) {
    query = rest.slice(q + 1);
    rest = rest.slice(0, q);
  }
  return { scheme, netloc, path: rest, query };
}

/**
 * Normalize a stream URL into its deduplication anchor.
 * Equivalent to `scripts/lib/normalize_url.py:normalize_url`.
 */
export function normalizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  try {
    const { scheme, netloc, path, query } = splitUrl(trimmed);

    const filtered = parseQsl(query)
      .filter(([k]) => !STRIP_PARAMS.has(k.toLowerCase()))
      .sort(compareTuple);
    const newQuery = filtered.map(([k, v]) => `${quotePlus(k)}=${quotePlus(v)}`).join('&');

    // Reassemble urlunparse-style.
    let result = '';
    if (scheme) result += `${scheme}:`;
    if (netloc || (scheme && trimmed.includes('://'))) result += `//${netloc}`;
    result += path;
    if (newQuery) result += `?${newQuery}`;

    return result.replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

export default normalizeUrl;
