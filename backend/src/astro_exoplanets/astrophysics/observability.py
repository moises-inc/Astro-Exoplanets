"""Chilean observatory seasonal observability calculations using Astropy."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import astropy.units as u
import numpy as np
from astropy.coordinates import AltAz, EarthLocation, SkyCoord, get_sun
from astropy.time import Time

ASTRONOMICAL_TWILIGHT_DEG = -18.0
AIRMASS_2_ALT_DEG = 30.0  # 1 / sin(30 deg) == 2.0
MIN_ALTITUDE_FOR_AIRMASS_DEG = 5.0
REFERENCE_YEAR = 2026


@dataclass(frozen=True)
class ObservatorySite:
    """Metadata and Astropy EarthLocation for a Chilean observatory."""

    key: str
    name: str
    lat_deg: float
    lon_deg: float
    height_m: float
    location: EarthLocation


CHILE_OBSERVATORIES: dict[str, ObservatorySite] = {
    "paranal": ObservatorySite(
        key="paranal",
        name="ESO Paranal Observatory (VLT)",
        lat_deg=-24.6272,
        lon_deg=-70.4042,
        height_m=2635.0,
        location=EarthLocation(lat=-24.6272 * u.deg, lon=-70.4042 * u.deg, height=2635.0 * u.m),
    ),
    "lasilla": ObservatorySite(
        key="lasilla",
        name="ESO La Silla Observatory",
        lat_deg=-29.2563,
        lon_deg=-70.7380,
        height_m=2400.0,
        location=EarthLocation(lat=-29.2563 * u.deg, lon=-70.7380 * u.deg, height=2400.0 * u.m),
    ),
    "lascampanas": ObservatorySite(
        key="lascampanas",
        name="Las Campanas Observatory",
        lat_deg=-29.0146,
        lon_deg=-70.6926,
        height_m=2380.0,
        location=EarthLocation(lat=-29.0146 * u.deg, lon=-70.6926 * u.deg, height=2380.0 * u.m),
    ),
    "ctio": ObservatorySite(
        key="ctio",
        name="Cerro Tololo Inter-American Observatory (CTIO)",
        lat_deg=-30.1697,
        lon_deg=-70.8065,
        height_m=2207.0,
        location=EarthLocation(lat=-30.1697 * u.deg, lon=-70.8065 * u.deg, height=2207.0 * u.m),
    ),
    "alma": ObservatorySite(
        key="alma",
        name="ALMA (Chajnantor Plateau)",
        lat_deg=-23.0290,
        lon_deg=-67.7550,
        height_m=5058.0,
        location=EarthLocation(lat=-23.0290 * u.deg, lon=-67.7550 * u.deg, height=5058.0 * u.m),
    ),
}


@lru_cache(maxsize=1)
def _build_2026_night_grid() -> tuple[Time, np.ndarray, SkyCoord]:
    """Build hourly night timestamps (22:00 to 11:00 UTC next day) on the 15th of each month."""
    timestamps: list[str] = []
    months: list[int] = []

    for month in range(1, 13):
        start_dt = datetime(REFERENCE_YEAR, month, 15, 22, 0, 0, tzinfo=UTC)
        for hour_offset in range(14):  # 22:00 UTC .. 11:00 UTC next day
            dt = start_dt + timedelta(hours=hour_offset)
            timestamps.append(dt.strftime("%Y-%m-%dT%H:%M:%S"))
            months.append(month)

    times_utc = Time(timestamps, format="isot", scale="utc")
    sun_coords = get_sun(times_utc)
    return times_utc, np.asarray(months, dtype=int), sun_coords


@lru_cache(maxsize=8)
def _site_dark_masks() -> dict[str, tuple[AltAz, np.ndarray]]:
    """Precompute AltAz frames and astronomical-twilight masks per observatory."""
    times_utc, _, sun_coords = _build_2026_night_grid()
    frames: dict[str, tuple[AltAz, np.ndarray]] = {}
    for key, site in CHILE_OBSERVATORIES.items():
        frame = AltAz(obstime=times_utc, location=site.location)
        sun_alt = sun_coords.transform_to(frame).alt.deg
        dark_mask = sun_alt < ASTRONOMICAL_TWILIGHT_DEG
        frames[key] = (frame, dark_mask)
    return frames


def _compute_site_metrics(
    target: SkyCoord,
    month_indices: np.ndarray,
    frame: AltAz,
    dark_mask: np.ndarray,
) -> dict:
    """Compute observability summary for one observatory site."""
    target_alt = target.transform_to(frame).alt.deg

    if dark_mask.any():
        max_alt = float(np.max(target_alt[dark_mask]))
    else:
        max_alt = None

    if max_alt is not None and max_alt > MIN_ALTITUDE_FOR_AIRMASS_DEG:
        min_airmass = float(1.0 / np.sin(np.deg2rad(max_alt)))
    else:
        min_airmass = None

    observable_airmass_2 = bool(min_airmass is not None and min_airmass <= 2.0)

    monthly_hours: list[float] = []
    good_mask = dark_mask & (target_alt >= AIRMASS_2_ALT_DEG)
    for month in range(1, 13):
        hours = float(np.sum((month_indices == month) & good_mask))
        monthly_hours.append(hours)

    best_months = [m for m, hrs in enumerate(monthly_hours, start=1) if hrs >= 2.0]
    if not best_months and max(monthly_hours) > 0.0:
        peak = max(monthly_hours)
        best_months = [m for m, hrs in enumerate(monthly_hours, start=1) if hrs == peak]

    return {
        "max_altitude_deg": round(max_alt, 3) if max_alt is not None else None,
        "min_airmass": round(min_airmass, 4) if min_airmass is not None else None,
        "observable_airmass_2": observable_airmass_2,
        "best_months": best_months,
        "monthly_hours_airmass_le_2": monthly_hours,
    }


def compute_planet_observability(
    pl_name: str,
    ra_deg: float | None,
    dec_deg: float | None,
) -> dict:
    """Compute 2026 seasonal observability for a target across the 5 Chilean observatories."""
    if (
        ra_deg is None
        or dec_deg is None
        or not np.isfinite(float(ra_deg))
        or not np.isfinite(float(dec_deg))
    ):
        empty_site = {
            "max_altitude_deg": None,
            "min_airmass": None,
            "observable_airmass_2": False,
            "best_months": [],
            "monthly_hours_airmass_le_2": [0.0] * 12,
        }
        observatories_empty = {
            key: {
                "name": site.name,
                "lat_deg": site.lat_deg,
                "lon_deg": site.lon_deg,
                "height_m": site.height_m,
                **empty_site,
            }
            for key, site in CHILE_OBSERVATORIES.items()
        }
        return {
            "pl_name": pl_name,
            "ra_deg": None,
            "dec_deg": None,
            "visible_chile_cutoff": False,
            "reference_observatory": "paranal",
            **empty_site,
            "sites": [
                {
                    "site_id": key,
                    "site_name": val["name"],
                    **empty_site,
                }
                for key, val in observatories_empty.items()
            ],
            "observatories": observatories_empty,
        }

    ra_val = float(ra_deg)
    dec_val = float(dec_deg)
    target = SkyCoord(ra=ra_val * u.deg, dec=dec_val * u.deg, frame="icrs")
    _, month_indices, _ = _build_2026_night_grid()
    site_frames = _site_dark_masks()

    observatories_out: dict[str, dict] = {}
    sites_out: list[dict] = []
    for key, site in CHILE_OBSERVATORIES.items():
        frame, dark_mask = site_frames[key]
        metrics = _compute_site_metrics(target, month_indices, frame, dark_mask)
        observatories_out[key] = {
            "name": site.name,
            "lat_deg": site.lat_deg,
            "lon_deg": site.lon_deg,
            "height_m": site.height_m,
            **metrics,
        }
        sites_out.append(
            {
                "site_id": key,
                "site_name": site.name,
                **metrics,
            }
        )

    paranal = observatories_out["paranal"]
    return {
        "pl_name": pl_name,
        "ra_deg": ra_val,
        "dec_deg": dec_val,
        "visible_chile_cutoff": bool(dec_val <= 20.0),
        "reference_observatory": "paranal",
        "max_altitude_deg": paranal["max_altitude_deg"],
        "min_airmass": paranal["min_airmass"],
        "observable_airmass_2": paranal["observable_airmass_2"],
        "best_months": paranal["best_months"],
        "monthly_hours_airmass_le_2": paranal["monthly_hours_airmass_le_2"],
        "sites": sites_out,
        "observatories": observatories_out,
    }
