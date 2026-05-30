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
Start the API (`npm run dev` for watch mode, or `npm start` against a build). All
responses are JSON and send `Cache-Control` headers so a CDN can absorb read traffic.

| Method & Path | Description |
| :--- | :--- |
| `GET /health` | Liveness probe. |
| `GET /ready` | Readiness probe (checks the database). |
| `GET /stations` | Paginated list. Query: `country`, `genre`, `language`, `status` (default `working`), `q` (name search), `limit` (≤100), `offset`. Returns `{ data, pagination }`. |
| `GET /stations/:slug` | Single station by slug (404 if missing). |

Each station includes a resolved `image` field (`COALESCE(image_hosted, image_url)`) — use it
directly; it prefers the Cloudinary-hosted logo and falls back to the original source URL.
| `GET /countries` · `GET /genres` · `GET /languages` | Facet counts over working stations (cached). |
| `GET /stats` | Totals by status plus distinct country/genre counts (cached). |

Built-in middleware: JSON-schema validation (400 on bad input), rate limiting,
CORS allow-list, security headers (helmet), in-memory caching, and graceful
shutdown. See `.env.example` for all tuning knobs. At multi-replica scale, move
the cache + rate-limit store to Redis and front Postgres with PgBouncer.

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
