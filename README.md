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
2.  **Initialize Schema**:
    ```bash
    npm run docker:worker npm run init-db
    ```

### The Professional Workflow (Automated VPN)
To run the full global ingestion with automatic VPN country switching (requires Proton VPN installed on host):
1.  **Login**: `protonvpn signin`
2.  **Launch**: `python3 scripts/validate_all.py --provider onlineradiobox`

## 📂 Project Anatomy
- `scripts/`: The "Brain" - Python orchestration and stream validation.
- `src/`: The "Engine" - TypeScript API and high-speed database sync.
- `providers/`: Raw scraped data organized by provider.
- `metadata/`: The "Clean Cache" - Validated, deduplicated production output.
- `core/`: Global standards - ISO maps and country definitions.

## 🤝 Contributing
We woud love help expanding our providers list and refining metadata! If you're interested in building the future of open radio, please open an issue or submit a PR.

## 📜 License
MIT - Created and maintained by Ashish Kumar.
