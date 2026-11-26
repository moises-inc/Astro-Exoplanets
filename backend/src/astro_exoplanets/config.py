"""Configuration and path resolution for Astro-Exoplanets backend."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import certifi

logger = logging.getLogger(__name__)

PACKAGE_DIR = Path(__file__).resolve().parent
SRC_DIR = PACKAGE_DIR.parent
BACKEND_ROOT = SRC_DIR.parent


def get_data_dir() -> Path:
    """Resolve the data directory from ASTRO_DATA_DIR or existing default locations."""
    override = os.getenv("ASTRO_DATA_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    candidates = [
        BACKEND_ROOT / "data",
        Path.cwd() / "data",
        Path.cwd() / "backend" / "data",
    ]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return BACKEND_ROOT / "data"


def get_csv_backup_path() -> Path:
    """Resolve the fallback NASA catalog CSV path."""
    return get_data_dir() / "exoplanetas_nasa.csv"


def get_lightcurve_cache_dir() -> Path:
    """Resolve the light curve cache directory from ASTRO_CACHE_DIR or default."""
    override = os.getenv("ASTRO_CACHE_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return get_data_dir() / "lightcurves_cache"


def is_force_offline() -> bool:
    """Return True when EXO_FORCE_OFFLINE=1 is set."""
    return os.getenv("EXO_FORCE_OFFLINE", "").strip() == "1"


def get_ca_bundle_path() -> str:
    """Resolve a custom CA bundle from env vars or fall back to certifi."""
    candidate = (
        os.getenv("ASTRO_CA_BUNDLE", "").strip()
        or os.getenv("REQUESTS_CA_BUNDLE", "").strip()
    )
    if candidate:
        resolved = Path(candidate).expanduser().resolve()
        if resolved.exists():
            return str(resolved)
        logger.warning(
            "Configured CA bundle path does not exist (%s); falling back to certifi.",
            resolved,
        )
    return certifi.where()


DATA_DIR = get_data_dir()
CSV_BACKUP_PATH = get_csv_backup_path()
LIGHTCURVE_CACHE_DIR = get_lightcurve_cache_dir()
