# Astro-Exoplanets Backend

FastAPI + Astropy + Lightkurve astrophysical backend for **Astro-Exoplanets**.

## Requirements

- Python `3.12` (`.python-version`)
- [`uv`](https://docs.astral.sh/uv/)

## Setup & Execution

```bash
uv sync
uv run uvicorn astro_exoplanets.web.app:app --reload --port 8000
```

## Verification

```bash
uv run pytest -v
uv run ruff check src tests main.py
bandit -r src main.py
```

## Environment Variables

- `EXO_FORCE_OFFLINE=1`: Force Plan B local CSV fallback (`data/exoplanetas_nasa.csv`).
- `ASTRO_CA_BUNDLE` / `REQUESTS_CA_BUNDLE`: Optional path to a custom PEM CA bundle for TLS verification (falls back to `certifi` if unset or missing).
- `ASTRO_DATA_DIR`: Override default `data/` directory.
- `ASTRO_CACHE_DIR`: Override default `data/lightcurves_cache/` directory.
