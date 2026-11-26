"""NASA MAST photometry client via Lightkurve with disk JSON cache."""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
from pathlib import Path
from typing import Any

import astropy.units as u
import lightkurve as lk
import numpy as np
import requests

from astro_exoplanets.config import get_lightcurve_cache_dir, is_force_offline

logger = logging.getLogger(__name__)

MAX_SERIES_POINTS = 600
NUM_FOLDED_BINS = 40
MAX_DOWNLOAD_CANDIDATES = 3
PREFERRED_AUTHORS = ("SPOC", "Kepler", "K2SFF", "K2", "TESS-SPOC", "QLP")


def slugify_planet_name(pl_name: str) -> str:
    """Convert an exoplanet name into a safe filesystem cache slug."""
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", pl_name.strip()).strip("._").lower()
    if not cleaned or cleaned in {".", ".."}:
        return "unknown_planet"
    return cleaned


def _downsample_indices(length: int, max_points: int = MAX_SERIES_POINTS) -> np.ndarray:
    if length <= max_points:
        return np.arange(length, dtype=int)
    return np.linspace(0, length - 1, max_points, dtype=int)


def _select_candidate_indices(search_result: Any) -> list[int]:
    """Order SearchResult row indices by preferred photometry pipeline author and cadence."""
    total = len(search_result)
    if total == 0:
        return []

    authors: list[str] = [""] * total
    exptimes: list[float] = [0.0] * total
    if hasattr(search_result, "table"):
        tbl = search_result.table
        if "author" in tbl.colnames:
            authors = [str(a) for a in tbl["author"]]
        if "exptime" in tbl.colnames:
            for i, val in enumerate(tbl["exptime"]):
                try:
                    exptimes[i] = float(getattr(val, "value", val))
                except (TypeError, ValueError) as exc:
                    logger.debug("Skipping non-numeric exptime at row %s: %s", i, exc)
                    exptimes[i] = 0.0

    # Prefer standard cadence (>= 100s) before 20s fast cadence for quick download
    ordered: list[int] = []
    seen: set[int] = set()
    for prefer_standard_cadence in (True, False):
        for preferred in PREFERRED_AUTHORS:
            for idx, author in enumerate(authors):
                if idx in seen:
                    continue
                is_std = exptimes[idx] >= 100.0
                if prefer_standard_cadence and not is_std:
                    continue
                if author.strip().lower() == preferred.lower():
                    ordered.append(idx)
                    seen.add(idx)

    for idx in range(total):
        if idx not in seen:
            ordered.append(idx)
            seen.add(idx)

    return ordered


def _extract_phase_days(folded_lc: Any) -> np.ndarray:
    phase = folded_lc.phase
    if hasattr(phase, "to_value"):
        try:
            return np.asarray(phase.to_value(u.day), dtype=float)
        except (u.UnitConversionError, TypeError, ValueError, AttributeError) as exc:
            logger.debug("Could not convert folded phase to days: %s", exc)
    if hasattr(phase, "value"):
        return np.asarray(phase.value, dtype=float)
    return np.asarray(phase, dtype=float)


def _bin_folded_lightcurve(
    phase_days: np.ndarray,
    flux: np.ndarray,
    period_days: float,
    num_bins: int = NUM_FOLDED_BINS,
) -> list[dict[str, Any]]:
    """Compute uniform phase bins across [-period/2, period/2] with median flux."""
    half_p = period_days / 2.0
    edges = np.linspace(-half_p, half_p, num_bins + 1)
    binned: list[dict[str, Any]] = []

    for i in range(num_bins):
        if i < num_bins - 1:
            mask = (phase_days >= edges[i]) & (phase_days < edges[i + 1])
        else:
            mask = (phase_days >= edges[i]) & (phase_days <= edges[i + 1])
        if mask.any():
            center = float(0.5 * (edges[i] + edges[i + 1]))
            binned.append(
                {
                    "phase_days": round(center, 6),
                    "flux": float(np.median(flux[mask])),
                    "count": int(np.sum(mask)),
                }
            )
    return binned


def _extract_meta(
    lc: Any,
    search_result: Any,
    idx: int,
) -> tuple[str | None, str | None, str | None]:
    meta = getattr(lc, "meta", {}) or {}
    mission = meta.get("MISSION") or meta.get("TELESCOP")
    author = meta.get("AUTHOR") or meta.get("ORIGIN")

    sector_or_quarter: str | None = None
    if meta.get("SECTOR") is not None:
        sector_or_quarter = f"Sector {meta['SECTOR']}"
    elif meta.get("QUARTER") is not None:
        sector_or_quarter = f"Quarter {meta['QUARTER']}"
    elif meta.get("CAMPAIGN") is not None:
        sector_or_quarter = f"Campaign {meta['CAMPAIGN']}"

    if hasattr(search_result, "table"):
        tbl = search_result.table
        if not mission and "mission" in tbl.colnames:
            mission = str(tbl["mission"][idx])
        if not author and "author" in tbl.colnames:
            author = str(tbl["author"][idx])
        if not sector_or_quarter and "mission" in tbl.colnames:
            sector_or_quarter = str(tbl["mission"][idx])

    return (
        str(mission) if mission is not None else None,
        str(author) if author is not None else None,
        sector_or_quarter,
    )


def _unavailable_response(
    pl_name: str,
    hostname: str | None,
    reason_es: str,
    reason_en: str,
) -> dict[str, Any]:
    return {
        "pl_name": pl_name,
        "hostname": hostname,
        "available": False,
        "cached": False,
        "source": None,
        "mission": None,
        "author": None,
        "sector_or_quarter": None,
        "period_days": None,
        "raw_points_total": 0,
        "raw_series": [],
        "folded_points": [],
        "folded_binned": [],
        "reason_es": reason_es,
        "reason_en": reason_en,
    }


def _atomic_write_json(payload: dict[str, Any], cache_path: Path) -> None:
    """Atomically write JSON payload to disk using a temporary file and os.replace."""
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=cache_path.parent,
            prefix=".lc_tmp_",
            suffix=".json",
            delete=False,
        ) as tmp_file:
            tmp_path = Path(tmp_file.name)
            json.dump(payload, tmp_file, indent=2)
            tmp_file.flush()
            os.fsync(tmp_file.fileno())
        os.replace(tmp_path, cache_path)
    except Exception:
        if tmp_path is not None and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError as cleanup_exc:
                logger.debug(
                    "Failed to clean up temporary light curve JSON %s: %s",
                    tmp_path,
                    cleanup_exc,
                )
        raise


def get_lightcurve(
    pl_name: str,
    hostname: str | None = None,
    pl_orbper: float | None = None,
    force_offline: bool = False,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """Retrieve pre-cached or live MAST light curve photometry for an exoplanet."""
    target_cache_dir = cache_dir or get_lightcurve_cache_dir()
    base_dir = target_cache_dir.resolve()
    slug = slugify_planet_name(pl_name)
    cache_path = (base_dir / f"{slug}.json").resolve()
    if not cache_path.is_relative_to(base_dir):
        raise ValueError("Invalid cache path outside cache directory")

    if cache_path.exists():
        try:
            payload = json.loads(cache_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                payload["cached"] = True
                payload["source"] = "cache"
                return payload
        except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
            logger.debug("Failed to read cached light curve %s: %s", cache_path, exc)

    if force_offline or is_force_offline():
        return _unavailable_response(
            pl_name=pl_name,
            hostname=hostname,
            reason_es=(
                "Modo sin conexión activo y la curva de luz no está en la caché local."
            ),
            reason_en=(
                "Offline mode is active and no cached light curve is available locally."
            ),
        )

    search_target = (hostname or pl_name).strip()
    try:
        search_result = lk.search_lightcurve(
            search_target,
            mission=("TESS", "Kepler", "K2"),
        )
    except (
        OSError,
        RuntimeError,
        ValueError,
        KeyError,
        AttributeError,
        TimeoutError,
        ConnectionError,
        requests.RequestException,
    ) as exc:
        logger.debug("MAST search_lightcurve failed for %s: %s", search_target, exc)
        return _unavailable_response(
            pl_name=pl_name,
            hostname=hostname,
            reason_es="No fue posible consultar el archivo fotométrico MAST de la NASA.",
            reason_en="Could not query the NASA MAST photometric archive.",
        )

    if search_result is None or len(search_result) == 0:
        return _unavailable_response(
            pl_name=pl_name,
            hostname=hostname,
            reason_es=(
                "No existe fotometría pública de TESS, Kepler o K2 "
                "para esta estrella anfitriona."
            ),
            reason_en="No public TESS, Kepler, or K2 photometry was found for this host star.",
        )

    lc_clean = None
    chosen_idx = 0
    for idx in _select_candidate_indices(search_result)[:MAX_DOWNLOAD_CANDIDATES]:
        try:
            downloaded = search_result[idx].download()
        except (
            OSError,
            RuntimeError,
            ValueError,
            KeyError,
            AttributeError,
            TimeoutError,
            ConnectionError,
            requests.RequestException,
        ) as exc:
            logger.debug("MAST product download failed at candidate %s: %s", idx, exc)
            continue
        if downloaded is None:
            continue
        if not hasattr(downloaded, "flux") and hasattr(downloaded, "__getitem__"):
            try:
                downloaded = downloaded[0]
            except (IndexError, KeyError, TypeError) as exc:
                logger.debug(
                    "Failed to select LightCurve item at candidate %s: %s", idx, exc
                )
                continue
        try:
            candidate = downloaded.remove_nans().normalize().remove_outliers(sigma=5)
            if len(candidate.time) > 0:
                lc_clean = candidate
                chosen_idx = idx
                break
        except (ValueError, TypeError, AttributeError, RuntimeError) as exc:
            logger.debug("Failed to clean light curve candidate %s: %s", idx, exc)
            continue

    if lc_clean is None:
        return _unavailable_response(
            pl_name=pl_name,
            hostname=hostname,
            reason_es="Los productos fotométricos encontrados en MAST no pudieron procesarse.",
            reason_en="Found MAST photometric products could not be downloaded or cleaned.",
        )

    time_arr = np.asarray(lc_clean.time.value, dtype=float)
    flux_arr = np.asarray(lc_clean.flux.value, dtype=float)
    finite = np.isfinite(time_arr) & np.isfinite(flux_arr)
    time_arr = time_arr[finite]
    flux_arr = flux_arr[finite]

    if len(time_arr) == 0:
        return _unavailable_response(
            pl_name=pl_name,
            hostname=hostname,
            reason_es="La curva de luz descargada no contiene mediciones finitas válidas.",
            reason_en="Downloaded light curve contains no finite photometric measurements.",
        )

    order = np.argsort(time_arr)
    time_arr = time_arr[order]
    flux_arr = flux_arr[order]
    raw_points_total = int(len(time_arr))

    raw_idx = _downsample_indices(raw_points_total, MAX_SERIES_POINTS)
    raw_series = [
        {"btjd": float(t), "flux": float(f)}
        for t, f in zip(time_arr[raw_idx], flux_arr[raw_idx], strict=True)
    ]

    period_valid = (
        pl_orbper is not None
        and np.isfinite(float(pl_orbper))
        and float(pl_orbper) > 0.0
    )
    period_days = float(pl_orbper) if period_valid else None

    folded_points: list[dict[str, float]] = []
    folded_binned: list[dict[str, Any]] = []

    if period_days is not None:
        folded_lc = lc_clean.fold(period=period_days)
        phase_arr = _extract_phase_days(folded_lc)
        f_flux = np.asarray(folded_lc.flux.value, dtype=float)
        f_finite = np.isfinite(phase_arr) & np.isfinite(f_flux)
        phase_arr = phase_arr[f_finite]
        f_flux = f_flux[f_finite]

        if len(phase_arr) > 0:
            f_order = np.argsort(phase_arr)
            phase_arr = phase_arr[f_order]
            f_flux = f_flux[f_order]
            f_idx = _downsample_indices(len(phase_arr), MAX_SERIES_POINTS)
            folded_points = [
                {"phase_days": float(p), "flux": float(f)}
                for p, f in zip(phase_arr[f_idx], f_flux[f_idx], strict=True)
            ]
            folded_binned = _bin_folded_lightcurve(
                phase_arr,
                f_flux,
                period_days=period_days,
                num_bins=NUM_FOLDED_BINS,
            )

    mission, author, sector_or_quarter = _extract_meta(lc_clean, search_result, chosen_idx)
    payload: dict[str, Any] = {
        "pl_name": pl_name,
        "hostname": hostname,
        "available": True,
        "cached": False,
        "source": "mast_live",
        "mission": mission,
        "author": author,
        "sector_or_quarter": sector_or_quarter,
        "period_days": period_days,
        "raw_points_total": raw_points_total,
        "raw_series": raw_series,
        "folded_points": folded_points,
        "folded_binned": folded_binned,
        "reason_es": None,
        "reason_en": None,
    }

    try:
        _atomic_write_json(payload, cache_path)
    except OSError as exc:
        logger.debug("Skipping light curve cache write (%s): %s", cache_path, exc)
    return payload
