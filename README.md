# Sunoh Radio: The Global Radio Open Directory 🌍📻

Sunoh Radio Scrapers is an ambitious, community-driven project dedicated to building the world's most comprehensive and accurate open-source directory of global radio stations. 

What started as a component for the Sunoh App is now a powerful, standalone service designed to scale, bypass geo-restrictions, and provide developers with a production-ready API for internet radio.

## ✨ Our Vision
We believe that internet radio should be accessible to everyone, everywhere. Our mission is to solve the three biggest problems in digital radio:
1.  **Geo-Blocking**: Using automated VPN switching (Proton VPN) to validate streams from any country.
2.  **Data Fragmentation**: Using a sophisticated URL-Normalization engine to merge station data from multiple providers into a single source of truth.
3.  **Link Rot**: A resilient "Death Timer" validation system that differentiates between temporary outages and permanently broken streams.

## 🚀 Key Features
- **🌍 Global by Design**: Metadata and validation logic for over 230 countries and territories.
- **🛡️ Secure Geo-Unblocking**: Fully automated integration with **Proton VPN** for authentic local validation.
- **⚡ High-Performance Architecture**: 
    - Parallel validation using **FFprobe** for technical codec/bitrate audit.
    - Optimized PostgreSQL backend with **GIN** & **Trigram** indexing for instant fuzzy search.
- **🐳 Scalable Docker Stack**: Ready for cloud deployment with Node 22, Postgres 17, and Python 3.
- **🔌 API-First**: Comes with a built-in Fastify server to serve radio data to your frontend or mobile app instantly.
- **🤝 Open Source**: Licensed under MIT, built for the community.

## 🛠️ Tech Stack
- **Engine**: Node.js 22 (LTS), Python 3.12
- **Validation**: FFmpeg/FFprobe
- **Database**: PostgreSQL 17
- **API**: Fastify
- **Containerization**: Docker & Docker Compose

## 📦 Installation

### The Quick Start (Docker)
The recommended way to run Sunoh Radio is using Docker, which sets up the database, the API, and the worker environment in one go.

1.  **Build & Launch**:
    ```bash
    cp .env.example .env
    npm run docker:up
    ```
2.  **Initialize / Migrate Schema** (safe to run repeatedly — never drops data):
    ```bash
    npm run docker:worker npm run migrate
    ```

### The Professional Workflow (Automated VPN)
To run the full global ingestion with automatic VPN country switching (requires Proton VPN installed on host):
1.  **Login**: `protonvpn signin`
2.  **Launch**: `python3 scripts/validate_all.py --provider onlineradiobox`

## 🌐 API Reference

Start the API with `npm run dev` (watch mode) or `npm start` (against a build). It
listens on `PORT` (default **4000**). All responses are JSON with `Cache-Control`
headers so a CDN can absorb read traffic. Base URL in examples: `http://localhost:4000`.

Built-in middleware: JSON-schema validation (→ `400` on bad input), rate limiting
(`X-RateLimit-*` headers), CORS allow-list, security headers (helmet), in-memory
caching, and graceful shutdown. Tuning knobs are in `.env.example`.

### Endpoints at a glance
| Method & Path | Description |
| :--- | :--- |
| `GET /health` | Liveness probe. |
| `GET /ready` | Readiness probe (verifies the DB; `503` if unreachable). |
| `GET /stations` | Paginated, filterable, searchable list of stations. |
| `GET /stations/recent` | Newest stations first. Query: `country`, `status` (default `working`), `days` (optional recency window), `limit` (≤100, default 20), `offset`. Same `{ data, pagination }` shape. |
| `GET /stations/:slug` | A single station by its slug (`404` if missing). |
| `GET /countries` | Country facet counts (working stations), cached. |
| `GET /genres` | Genre facet counts (working stations), cached. |
| `GET /languages` | Language facet counts (working stations), cached. |
| `GET /stats` | Totals by status + distinct country/genre counts, cached. |

### The station object
Every station returned by `/stations` and `/stations/:slug` has this shape. Use the
resolved **`image`** field directly — it is `COALESCE(image_hosted, image_url)` (prefers
the Cloudinary-hosted logo, falls back to the original source).

```json
{
  "id": 61913,
  "slug": "1-country-99-645066fcef",
  "name": "#1 Country 99",
  "image_url": "https://cdn.onlineradiobox.com/img/l/8/40128.v4.png",
  "image_hosted": "https://res.cloudinary.com/<cloud>/.../radio-stations/1-country-99-645066fcef.png",
  "image": "https://res.cloudinary.com/<cloud>/.../radio-stations/1-country-99-645066fcef.png",
  "stream_url": "https://playerservices.streamtheworld.com/.../WDENFMAAC.aac",
  "countries": ["US"],
  "genres": ["country"],
  "languages": [],
  "status": "working",
  "codec": "aac",
  "bitrate": 49509,
  "sample_rate": 44100
}
```

### `GET /stations`
Paginated list. Returns `{ data: Station[], pagination: { limit, offset, total } }`.

| Query param | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `country` | string (ISO-2) | — | exact match against `countries[]`, e.g. `US` |
| `genre` | string | — | exact match against `genres[]`, e.g. `jazz` |
| `language` | string | — | exact match against `languages[]` |
| `status` | enum | `working` | `working` \| `broken` \| `untested` |
| `q` | string | — | **search** — matches name **or any genre tag**, relevance-ranked (closest name matches first via `pg_trgm`) |
| `limit` | int 1–100 | `50` | values > 100 → `400` |
| `offset` | int ≥ 0 | `0` | |

```bash
# page of working US jazz stations
curl -s "http://localhost:4000/stations?country=US&genre=jazz&limit=20"

# relevance-ranked search (name + genre), page 2
curl -s "http://localhost:4000/stations?q=jazz&limit=20&offset=20"
```
```json
{
  "data": [ { "id": 61913, "slug": "1-country-99-645066fcef", "name": "#1 Country 99", "...": "..." } ],
  "pagination": { "limit": 20, "offset": 0, "total": 47939 }
}
```

### `GET /stations/:slug`
```bash
curl -s "http://localhost:4000/stations/1-country-99-645066fcef"
```
Returns a single station object, or `404 { "error": "Station not found" }`.

### `GET /countries` · `GET /genres` · `GET /languages`
Facet counts over **working** stations, sorted by count desc (cached ~10 min).
```bash
curl -s "http://localhost:4000/countries"
```
```json
[ { "value": "US", "count": 7473 }, { "value": "BR", "count": 6812 }, { "value": "DE", "count": 2987 } ]
```

### `GET /stats`
```bash
curl -s "http://localhost:4000/stats"
```
```json
{
  "total": 66530,
  "by_status": { "broken": 18591, "working": 47939 },
  "working": 47939,
  "countries": 229,
  "genres": 247
}
```

### `GET /health` · `GET /ready`
```bash
curl -s "http://localhost:4000/health"   # { "status": "ok", "service": "sunoh-radio-api" }
curl -s "http://localhost:4000/ready"    # { "status": "ready" }  (503 if the DB is down)
```

### Errors
Validation failures return `400` with Fastify's error shape:
```json
{ "statusCode": 400, "code": "FST_ERR_VALIDATION", "error": "Bad Request", "message": "querystring/limit must be <= 100" }
```

> At multi-replica scale, move the cache + rate-limit store to Redis and front
> Postgres with PgBouncer; put a CDN in front of the API (the `Cache-Control`
> headers make `/countries`, `/genres`, `/stats` essentially free at the edge).

## 🛠️ Admin Console (`/admin`)
A modern React SPA for full CRUD on stations, served by the API at **`/admin`**
(single admin password — set `ADMIN_PASSWORD` + `SESSION_SECRET`). Features:

- **Dashboard** — totals, status split, image-hosting progress, top countries/genres.
- **Stations** — search (name + genre), filters, pagination, multi-select **bulk
  actions** (delete / set status / verify), inline **stream preview** (via the
  `audio_x` player), and a station editor.
- **Image management** — upload/replace a logo (the old Cloudinary asset is
  **deleted** and the new one uploaded), or remove it.
- **Stream test** — on-demand HTTP reachability check that updates status.
- **Audit log** — every mutation recorded. **CSV/JSON import + export**.

```bash
# dev: API on :4000 + Vite dev server (proxies /admin/api -> :4000)
npm run dev
npm run admin:dev          # http://localhost:5173/admin

# prod: the SPA is built into the Docker image and served at /admin automatically
npm run admin:build
```
Auth is a signed httpOnly-cookie session; the admin API lives under `/admin/api`
and is rate-limit-exempt (same-origin). Endpoints write an `audit_log` row.

## 🗄️ Database Migrations
Schema lives in `migrations/*.sql` and is applied by a small forward-only runner:
```bash
npm run migrate   # applies pending migrations; idempotent, never drops data
```
Add a change by creating the next numbered file (e.g. `migrations/0005_*.sql`).
Use `-- migrate:no-transaction` as the first line for statements that can't run
in a transaction (e.g. `CREATE INDEX CONCURRENTLY`).

## 🧪 Development
```bash
npm run lint && npx tsc --noEmit && npm test   # TypeScript: eslint, types, vitest
ruff check scripts && pytest -q                # Python: lint + normalization parity
```
URL normalization is shared between Python (`scripts/lib/normalize_url.py`) and
TypeScript (`src/lib/normalizeUrl.ts`) and pinned to identical output by the
golden fixture in `tests/fixtures/url_normalization.json`. CI runs all of the
above on every push/PR (`.github/workflows/ci.yml`).

## 📂 Project Anatomy
- `scripts/`: The "Brain" - Python orchestration and stream validation.
- `src/`: The "Engine" - TypeScript API and high-speed database sync.
- `providers/`: Raw scraped data organized by provider.
- `metadata/`: The "Clean Cache" - Validated, deduplicated production output.
- `core/`: Global standards - ISO maps and country definitions.
- `migrations/`: Versioned, forward-only SQL schema migrations.
- `tests/`: TypeScript tests + the shared URL-normalization golden fixture.

## 🤝 Contributing
We woud love help expanding our providers list and refining metadata! If you're interested in building the future of open radio, please open an issue or submit a PR.

## 📜 License
MIT - Created and maintained by Ashish Kumar.
