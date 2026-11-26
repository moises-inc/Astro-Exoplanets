# ARCHITECTURE.md — System Architecture (ByteByteGo 101)

Architectural design for **Astro-Exoplanets** following **ByteByteGo System Design 101** trade-offs across communication protocols, astrophysical compute isolation, caching, and resilience.

---

## 1. System Scale & Requirements

- **Functional Scope:**
  1. Ingest the confirmed exoplanet catalog (`pscomppars`, 16 projected columns) from the **NASA Exoplanet Archive TAP API**, with deterministic offline fallback (`Plan B` CSV).
  2. Audit raw data quality (nulls, duplicates, physically impossible `<= 0` records such as `46` rows with `pl_insol <= 0`) and compute astrophysical indicators (**ESI**, **TSM** per Kempton et al. 2018, Conservative/Optimistic **Habitable Zone**, **Fulton radius gap**, Paranal culmination airmass).
  3. Compute real observatory visibility across **5 Chilean astronomical sites** (*Paranal*, *La Silla*, *Las Campanas*, *CTIO*, *ALMA*) using `astropy.coordinates` (`EarthLocation`, `AltAz`, `SkyCoord`, `get_sun`).
  4. Fetch, clean, normalize, and phase-fold **NASA TESS / Kepler / K2 satellite light curves** via `lightkurve` (Mikulski Archive for Space Telescopes — MAST), with disk caching for instant inspection.
  5. Expose a bilingual (`ES` default + `EN`) **React 19 + TypeScript + Apache ECharts 6** interactive telemetry dashboard decoupled from the Python scientific backend.
- **Non-Functional Profile:**
  - **Dataset Footprint:** `6,473` raw rows -> `5,767` clean analytical rows (~600 KB JSON bootstrap payload).
  - **Traffic Pattern:** Read-heavy (`100:1`). Catalog bootstrap is cached in memory with TTL; satellite light curves are cached on disk as compact JSON (`<= 600` points raw & phase-folded + 40-bin median profile).
  - **Availability vs. Consistency (CAP):** Prioritizes **AP** (Availability + Partition Tolerance). Catalog snapshots and pre-cached MAST light curves guarantee sub-50 ms UI responsiveness even when external NASA/MAST endpoints experience latency or network outages.

---

## 2. Protocol & API Design

- **REST over HTTP/JSON (FastAPI + Pydantic v2):** Selected over GraphQL or gRPC because TAP ADQL already eliminates over-fetching upstream, and browser clients natively cache and consume JSON REST endpoints cleanly:
  - `GET /api/v1/health` — Liveness, active data source (`API` vs `archivo`), and catalog counts.
  - `GET /api/v1/catalog/bootstrap?force_offline=false` — Cleaned catalog (`5,767` rows), raw audit summary, Chilean observatory metadata, and sensitivity matrices.
  - `GET /api/v1/planets/{pl_name}/observability` — Astropy 12-month night-window airmass & elevation profile across 5 Chilean observatories.
  - `GET /api/v1/planets/{pl_name}/lightcurve` — Cached or live NASA MAST TESS/Kepler/K2 photometry and phase-folded transit curve.
  - `GET /api/v1/catalog/export.csv` — Filtered CSV export stream.

---

## 3. Data Flow & Caching Topology

```text
+-----------------------------------+      +------------------------------------+
|  NASA Exoplanet Archive TAP API   |      |  NASA MAST (TESS / Kepler / K2)    |
|  GET /TAP/sync (ADQL, JSON)       |      |  lightkurve.search_lightcurve()    |
+-----------------+-----------------+      +-----------------+------------------+
                  |                                          |
        [Strict TLS certifi + 30s]                 [Cache-Aside JSON on disk]
         /                  \                                |
       HTTP 200            Failure / SSLError                v
       |                      |            +------------------------------------+
       v                      v            |  backend/data/lightcurves_cache/   |
  Save CSV snapshot    Read Plan B CSV     +-----------------+------------------+
       \                      /                              |
        v                    v                               |
+-----------------------------------+                        |
| FastAPI + Astropy + Pandas/NumPy  | <----------------------+
| (/api/v1/catalog, observability,  |
|  lightcurve, export.csv)          |
+-----------------+-----------------+
                  |  JSON over HTTP (/api proxy in Vite dev; Vercel Services in prod)
                  v
+-----------------------------------+
| React 19 + TypeScript + ECharts 6 |
| Dark Romer UI + ES/EN + <dialog>  |
+-----------------------------------+
```

---

## 4. Resilience & Security Decisions

| Decision | Trade-off Chosen | Rationale |
| --- | --- | --- |
| **Strict TLS (`certifi` + optional `ASTRO_CA_BUNDLE`)** | Fail over directly to Plan B CSV on `SSLError` (also honors `REQUESTS_CA_BUNDLE`; never uses `verify=False`) | Eliminates silent or opt-in TLS verification bypasses while supporting institutional proxies via explicit trusted CA bundles |
| **CSV Formula Injection & Security Headers** | Sanitize spreadsheet formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) on `/api/v1/catalog/export.csv`; restrict CORS origins/methods and emit strict security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) + HTML-escaped ECharts 6 tooltips | Prevents spreadsheet command execution on exported catalogs, cross-origin abuse, and DOM/tooltip XSS |
| **Client-side filtering on 5,767-row bootstrap** | Fetch 600 KB once, filter in React `useMemo` | Zero network round-trip latency when dragging sliders (`< 10 ms` ECharts 6 re-render), while keeping heavy `astropy`/`lightkurve` calls on-demand per selected planet |
| **Disk cache for MAST `lightkurve`** | Pre-seed key benchmarks (`TRAPPIST-1 e`, `LHS 1140 b`, `TOI-700 d`) + cache live hits | Avoids 5–15 s FITS downloads per modal open and prevents MAST rate-limiting |
| **Graceful unavailability for RV/Imaging planets** | Return `available: false` with `reason_es` / `reason_en` | Never fabricate synthetic light curves when a planet lacks space-based transit photometry |

---

## 5. Production Deployment Topology (`vercel.json` — Vercel Services)

- **`vercel.json`** uses the **Vercel Services (Beta)** multi-service schema to unify both runtimes under one origin (eliminating cross-origin latency and simplifying CSP/CORS):
  - **`frontend` service (`root: "frontend"`, `framework: "vite"`):** Builds the static React 19 + Apache ECharts 6 bundle and routes non-API paths to `/index.html`.
  - **`backend` service (`root: "backend"`, `framework: "fastapi"`, `entrypoint: "main:app"`):** Serves `/api/(.*)` endpoints via FastAPI while excluding test suites and cache directories (`tests/**`, `.pytest_cache/**`, `.ruff_cache/**`, `**/__pycache__/**`) from the serverless function bundle.
