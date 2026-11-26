"""Vercel and ASGI entrypoint for Astro-Exoplanets FastAPI backend."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
SRC_DIR = BACKEND_DIR / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

if os.getenv("VERCEL") == "1":
    tmp_root = Path(tempfile.gettempdir()) / "astro_exoplanets"
    os.environ.setdefault("XDG_CACHE_HOME", str(tmp_root / "xdg_cache"))
    os.environ.setdefault("ASTROPY_CACHE_DIR", str(tmp_root / "astropy_cache"))
    os.environ.setdefault("MPLCONFIGDIR", str(tmp_root / "mpl_cache"))
    bundled_data = BACKEND_DIR / "data"
    if bundled_data.is_dir():
        os.environ.setdefault("ASTRO_DATA_DIR", str(bundled_data))

from astro_exoplanets.web.app import app  # noqa: E402

__all__ = ["app"]
