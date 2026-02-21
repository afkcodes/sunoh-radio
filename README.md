# Sunoh Radio Scrapers

A professional, high-scale radio station scraping and ingestion pipeline designed for the Sunoh project but fully standalone and open-source.

## Features
- **Global Reach**: Supports 230+ countries/territories.
- **VPN Automation**: Seamless integration with **Proton VPN** CLI to bypass regional geo-blocking.
- **Smart Deduplication**: URL normalization engine ensures unique stations across multiple providers.
- **High Performance**: 
    - Parallel stream validation using **FFprobe**.
    - Batch database ingestion (upserts) for speed and data integrity.
- **Resilience**: "Death Timer" logic protects verified stations from transient network errors.
- **Premium Search Support**: Optimized for PostgreSQL **GIN** and **Trigram** indexing for lighting-fast fuzzy search.

## Prerequisites
- **Node.js** (v18+)
- **Python 3**
- **FFmpeg** (specifically `ffprobe`)
- **PostgreSQL**
- **Proton VPN CLI** (Optional, for geo-blocked streams)

## Installation

1. Clone the repository.
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Initialize the database schema:
   ```bash
   cp .env.example .env
   # Update .env with your DB credentials
   npm run init-db
   ```

## Usage

### The Automated Flow (Recommended)
This script handles VPN switching, country-by-country ingestion, and database syncing automatically.
```bash
protonvpn signin
python3 scripts/validate_all.py --provider onlineradiobox
```

### Manual Ingestion
1. **Ingest & Validate**:
   ```bash
   python3 scripts/ingest.py --provider onlineradiobox --iso US
   ```
2. **Sync to Database**:
   ```bash
   npm run sync onlineradiobox "United States"
   ```

## Project Structure
- `scripts/`: Python orchestration and validation scripts.
- `src/`: TypeScript database logic and sync engines.
- `core/`: ISO maps and country definitions.
- `providers/`: Raw scraped JSON data organized by provider.
- `metadata/`: Cleaned and validated station data.

## License
MIT
