# Astro-Exoplanets

[Español](README.md) · [English](README.en.md)

**Astrophysical Exoplanet Prioritization, Chilean Observatory Airmass Visibility (`Astropy`), and NASA TESS/Kepler Satellite Light Curve Analysis (`Lightkurve` + FastAPI + React 19 / Apache ECharts 6).**

Part of **Proyecto Tennessee** (*Scientific Computing & Astroinformatics Portfolio*) by **Moisés Amundarain** (Universidad San Sebastián).

---

## Central Scientific Question

> **Which confirmed exoplanets simultaneously maximize Earth physical similarity (ESI), atmospheric transmission spectroscopy feasibility (TSM), and real astronomical observability from observatories in Chile (`airmass <= 2.0` across Paranal, La Silla, Las Campanas, CTIO, and ALMA), while accounting for instrumental discovery biases?**

---

## Key Capabilities

1. **Live NASA Exoplanet Archive Ingestion + Resilient Plan B (Strict TLS):**
   - Queries `pscomppars` via the public NASA TAP API (`ADQL`, no API key required) using **strict `certifi` TLS verification** (with optional custom CA support via `ASTRO_CA_BUNDLE` or `REQUESTS_CA_BUNDLE`, never using `verify=False`).
   - On `SSLError` or network failures, automatically falls back to the verified local snapshot (`backend/data/exoplanetas_nasa.csv`, **6,473 confirmed exoplanets**) or deterministic offline mode (`EXO_FORCE_OFFLINE=1`).
2. **Physical Quality Audit & Astrophysical Metrics:**
   - Audits raw nulls (`2,580` cells) and physically impossible entries (`46` direct-imaging/unheated records with `pl_insol <= 0`), yielding **5,767 clean analytical planets** (`89.09%`) and **4,184** with computable **TSM** (Kempton et al., 2018).
   - Computes **ESI**, **TSM** by radius regime, Conservative (`0.36–1.11 S_earth`) and Optimistic (`0.25–1.50 S_earth`) **Habitable Zones**, **Fulton radius gap** categories, NumPy sample statistics (`ddof=1`), log-log correlations, and sensitivity matrices.
3. **Real Chilean Observatory Visibility (`astropy.coordinates`):**
   - Computes true culmination altitude, minimum airmass, and 12-month dark-sky (`sun alt < -18 deg`) observable hours (`airmass <= 2.0`) for **Paranal (VLT/ELT)**, **La Silla**, **Las Campanas (Magellan)**, **CTIO**, and **ALMA**.
4. **Satellite Light Curves & Phase-Folded Transits (`lightkurve` / NASA MAST):**
   - Inspects real TESS, Kepler, and K2 photometry from NASA MAST, cleans outliers, normalizes flux, phase-folds by orbital period `pl_orbper`, and pre-caches benchmark habitable targets (`TRAPPIST-1 e`, `LHS 1140 b`, `TOI-700 d`).
5. **Bilingual Dark Romer Telemetry UI (`ES` default + `EN`):**
   - Decoupled **FastAPI** backend (`uv`) + **React 19 / TypeScript / Vite / Apache ECharts 6** frontend with instant Spanish (`ES`, default) and English (`EN`) switching synced to URL query parameters, `<dialog>` planet inspector, and formula-injection-safe CSV export.

---

## Repository Layout

```text
Astro-Exoplanets/
├── backend/                     # uv-managed Python 3.12 + FastAPI + Astropy + Lightkurve
│   ├── data/
│   │   ├── exoplanetas_nasa.csv # Verified NASA pscomppars snapshot (6,473 rows)
│   │   └── lightcurves_cache/   # Real MAST cached light curves (JSON)
│   ├── src/astro_exoplanets/
│   │   ├── api_client/          # NASA TAP (strict TLS) & MAST Lightkurve clients
│   │   ├── astrophysics/        # ESI/TSM/HZ physics & Astropy Chilean observability
│   │   ├── statistics/          # NumPy descriptive stats & sensitivity matrices
│   │   └── web/                 # FastAPI REST API (/api/v1/*) & Pydantic schemas
│   └── tests/                   # Comprehensive pytest suite
├── frontend/                    # React 19 + TypeScript + Vite + Apache ECharts 6
│   ├── public/assets/           # Conceptual astrophysical illustrations
│   └── src/                     # Dark Romer components, 5 tabs, Planet Inspector <dialog>, i18n
├── vercel.json                  # Vercel Services Beta topology (Vite frontend + FastAPI backend)
├── ARCHITECTURE.md              # ByteByteGo 101 system design documentation
├── DESIGN.md                    # 9-section Dark Romer UI/UX constitution
├── AUTHORS.md                   # Authorship & acknowledgments
├── README.md                    # Primary Spanish documentation
└── .github/workflows/ci.yml     # Automated ruff, bandit, pytest, npm audit & Vite build CI
```

---

## Quick Start

### 1. Backend (`uv`, Python >= 3.11 / 3.12)

```bash
cd backend
uv sync
EXO_FORCE_OFFLINE=1 uv run uvicorn astro_exoplanets.web.app:app --host 127.0.0.1 --port 8000
```
*(Omit `EXO_FORCE_OFFLINE=1` to query live NASA TAP and live MAST endpoints. If running behind an institutional proxy with a custom root CA, set `ASTRO_CA_BUNDLE=/path/to/custom-ca.pem` or `REQUESTS_CA_BUNDLE` in `.env`; TLS verification is never disabled).*

### 2. Frontend (`Node >= 22`)

```bash
cd frontend
npm install
npm run dev
```
Open `http://127.0.0.1:5173` in your browser (Vite proxies `/api` to `http://127.0.0.1:8000`).

### 3. Run Tests, Security Checks & Linters

```bash
cd backend
uv run ruff check src tests
uvx bandit -r src
EXO_FORCE_OFFLINE=1 uv run pytest -v

cd ../frontend
npm audit
npm run build
```

---

## Vercel Deployment (`Vercel Services`)

[`vercel.json`](vercel.json) configures **Vercel Services (Beta)** to deploy both services under a single domain:

- **`frontend`** (`root: "frontend"`, `framework: "vite"`): serves the React 19 + Apache ECharts 6 static bundle with SPA fallback rewrites to `/index.html`.
- **`backend`** (`root: "backend"`, `framework: "fastapi"`, `entrypoint: "main:app"`): handles `/api/(.*)` routes while excluding test suites and Python cache artifacts from the serverless bundle.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full system topology, security decisions, and caching trade-offs, or read the primary Spanish documentation in [`README.md`](README.md).

---

## License

Licensed under the [Apache License 2.0](LICENSE).
