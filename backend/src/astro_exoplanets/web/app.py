"""FastAPI application for Astro-Exoplanets."""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response

from astro_exoplanets import __version__
from astro_exoplanets.api_client.mast_lightkurve import get_lightcurve
from astro_exoplanets.api_client.nasa_tap import fetch_exoplanets
from astro_exoplanets.astrophysics.metrics import limpiar_y_enriquecer
from astro_exoplanets.astrophysics.observability import compute_planet_observability
from astro_exoplanets.config import get_csv_backup_path, is_force_offline
from astro_exoplanets.statistics.summary import (
    resumen_observatorios_chile,
    tabla_sensibilidad,
)
from astro_exoplanets.web.schemas import (
    BootstrapResponse,
    HealthResponse,
    LightCurveResponse,
    ObservabilityResponse,
)

logger = logging.getLogger(__name__)

BOOTSTRAP_CACHE_TTL_SECONDS = 900.0
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


@dataclass
class _CachedCatalog:
    expires_at: float
    source: str
    source_message_es: str
    source_message_en: str
    insecure_ssl: bool
    df_clean: pd.DataFrame
    audit: dict[str, Any]
    bootstrap_payload: dict[str, Any]


def _sanitize_value(val: Any) -> Any:
    """Recursively convert NaN, Inf, and NumPy scalars into JSON-compliant Python values."""
    if val is None:
        return None
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        fval = float(val)
        return None if (math.isnan(fval) or math.isinf(fval)) else fval
    if isinstance(val, dict):
        return {str(k): _sanitize_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_sanitize_value(v) for v in val]
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError) as exc:
        logger.debug("Skipping pd.isna check for %s: %s", type(val).__name__, exc)
    return val


def _sanitize_csv_cell(val: Any) -> Any:
    if isinstance(val, str) and val.lstrip(" ").startswith(_CSV_FORMULA_PREFIXES):
        return f"'{val}"
    return val


def _sanitize_df_for_csv(df: pd.DataFrame) -> pd.DataFrame:
    """Escape leading formula characters in string/object columns before CSV export."""
    sanitized = df.copy()
    for col in sanitized.columns:
        col_dtype = sanitized[col].dtype
        if (
            pd.api.types.is_string_dtype(col_dtype)
            or pd.api.types.is_object_dtype(col_dtype)
            or isinstance(col_dtype, pd.StringDtype)
        ):
            sanitized[col] = sanitized[col].map(_sanitize_csv_cell)
    return sanitized


def _df_to_clean_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    raw_records = df.to_dict(orient="records")
    sanitized: list[dict[str, Any]] = []
    for rec in raw_records:
        clean_rec = {str(k): _sanitize_value(v) for k, v in rec.items()}
        if clean_rec.get("disc_year") is not None:
            clean_rec["disc_year"] = int(round(float(clean_rec["disc_year"])))
        sanitized.append(clean_rec)
    return sanitized


def _build_bootstrap_payload(
    source: str,
    source_message_es: str,
    source_message_en: str,
    insecure_ssl: bool,
    df_clean: pd.DataFrame,
    audit: dict[str, Any],
) -> dict[str, Any]:
    df_fulton, df_dist_tsm = tabla_sensibilidad(df_clean)
    df_chile_obs = resumen_observatorios_chile(df_clean)

    years = (
        df_clean["disc_year"].dropna()
        if "disc_year" in df_clean.columns
        else pd.Series(dtype=float)
    )
    year_min = int(round(float(years.min()))) if not years.empty else None
    year_max = int(round(float(years.max()))) if not years.empty else None

    methods: list[dict[str, Any]] = []
    if "discoverymethod" in df_clean.columns and not df_clean.empty:
        counts = df_clean["discoverymethod"].dropna().astype(str).value_counts()
        methods = [{"id": str(m), "count": int(c)} for m, c in counts.items()]

    raw_audit = audit.get("auditoria_raw", {})
    merged_audit = {
        **(raw_audit if isinstance(raw_audit, dict) else {}),
        **audit,
    }

    payload = {
        "source": source,
        "source_message_es": source_message_es,
        "source_message_en": source_message_en,
        "insecure_ssl": insecure_ssl,
        "audit": _sanitize_value(merged_audit),
        "year_min": year_min,
        "year_max": year_max,
        "methods": methods,
        "chile_observatories": _df_to_clean_records(df_chile_obs),
        "sensitivity": {
            "fulton_hz": _df_to_clean_records(df_fulton),
            "dist_tsm": _df_to_clean_records(df_dist_tsm),
        },
        "planets": _df_to_clean_records(df_clean),
    }
    return payload


def _lookup_planet_row(df_clean: pd.DataFrame, pl_name: str) -> dict[str, Any] | None:
    if df_clean.empty or "pl_name" not in df_clean.columns:
        return None
    target = pl_name.strip()
    exact = df_clean.loc[df_clean["pl_name"].astype(str) == target]
    if exact.empty:
        lowered = target.lower()
        exact = df_clean.loc[
            df_clean["pl_name"].astype(str).str.strip().str.lower() == lowered
        ]
    if exact.empty:
        return None
    row = exact.iloc[0].to_dict()
    return {str(k): _sanitize_value(v) for k, v in row.items()}


def create_app(cache_ttl_seconds: float = BOOTSTRAP_CACHE_TTL_SECONDS) -> FastAPI:
    """Create and configure the Astro-Exoplanets FastAPI application."""
    application = FastAPI(
        title="Astro-Exoplanets API",
        version=__version__,
        description="Astrophysical catalog, Chilean observability, and MAST light curves API.",
    )

    application.add_middleware(GZipMiddleware, minimum_size=1024)
    application.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )

    @application.middleware("http")
    async def add_security_headers(request: Request, call_next: Any) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

    application.state.catalog_cache = {}

    def _get_catalog(force_offline: bool = False) -> _CachedCatalog:
        effective_offline = bool(force_offline or is_force_offline())
        cache_key = (effective_offline, str(get_csv_backup_path()))
        now = time.monotonic()

        cached: _CachedCatalog | None = application.state.catalog_cache.get(cache_key)
        if cached is not None and cached.expires_at > now:
            return cached

        result = fetch_exoplanets(force_offline=effective_offline)
        if result.df is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "message_es": result.source_message_es,
                    "message_en": result.source_message_en,
                },
            )

        df_clean, audit = limpiar_y_enriquecer(result.df)
        bootstrap_payload = _build_bootstrap_payload(
            source=result.source,
            source_message_es=result.source_message_es,
            source_message_en=result.source_message_en,
            insecure_ssl=result.insecure_ssl,
            df_clean=df_clean,
            audit=audit,
        )

        entry = _CachedCatalog(
            expires_at=now + cache_ttl_seconds,
            source=result.source,
            source_message_es=result.source_message_es,
            source_message_en=result.source_message_en,
            insecure_ssl=result.insecure_ssl,
            df_clean=df_clean,
            audit=audit,
            bootstrap_payload=bootstrap_payload,
        )
        application.state.catalog_cache[cache_key] = entry
        return entry

    @application.get("/api/v1/health", response_model=HealthResponse)
    def health() -> dict[str, Any]:
        try:
            catalog = _get_catalog(force_offline=False)
        except HTTPException:
            return {
                "status": "degraded",
                "version": __version__,
                "source": "error",
                "total_raw": 0,
                "total_clean": 0,
            }
        return {
            "status": "ok",
            "version": __version__,
            "source": catalog.source,
            "total_raw": int(catalog.audit.get("filas_iniciales", 0)),
            "total_clean": int(catalog.audit.get("filas_finales", 0)),
        }

    @application.get("/api/v1/catalog/bootstrap", response_model=BootstrapResponse)
    def catalog_bootstrap(force_offline: bool = Query(default=False)) -> dict[str, Any]:
        catalog = _get_catalog(force_offline=force_offline)
        return catalog.bootstrap_payload

    @application.get(
        "/api/v1/planets/{pl_name:path}/observability",
        response_model=ObservabilityResponse,
    )
    def planet_observability(pl_name: str) -> dict[str, Any]:
        catalog = _get_catalog(force_offline=False)
        row = _lookup_planet_row(catalog.df_clean, pl_name)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Exoplanet '{pl_name}' not found in the clean catalog.",
            )
        return compute_planet_observability(
            pl_name=str(row["pl_name"]),
            ra_deg=row.get("ra"),
            dec_deg=row.get("dec"),
        )

    @application.get(
        "/api/v1/planets/{pl_name:path}/lightcurve",
        response_model=LightCurveResponse,
    )
    def planet_lightcurve(
        pl_name: str,
        force_offline: bool = Query(default=False),
    ) -> dict[str, Any]:
        catalog = _get_catalog(force_offline=force_offline)
        row = _lookup_planet_row(catalog.df_clean, pl_name)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Exoplanet '{pl_name}' not found in the clean catalog.",
            )
        return get_lightcurve(
            pl_name=str(row["pl_name"]),
            hostname=row.get("hostname"),
            pl_orbper=row.get("pl_orbper"),
            force_offline=force_offline,
        )

    @application.get("/api/v1/catalog/export.csv")
    def export_catalog_csv(
        year_min: int | None = Query(default=None, ge=1980, le=2100),
        year_max: int | None = Query(default=None, ge=1980, le=2100),
        methods: list[str] | None = Query(default=None),
        r_max: float | None = Query(default=None, gt=0.0, le=100.0),
        hz_mode: Literal["conservadora", "conservative", "optimista", "optimistic"] | None = Query(
            default=None
        ),
        only_chile: bool = Query(default=False),
        force_offline: bool = Query(default=False),
    ) -> Response:
        catalog = _get_catalog(force_offline=force_offline)
        df = catalog.df_clean.copy()

        if year_min is not None and "disc_year" in df.columns:
            df = df.loc[df["disc_year"].notna() & (df["disc_year"] >= float(year_min))]
        if year_max is not None and "disc_year" in df.columns:
            df = df.loc[df["disc_year"].notna() & (df["disc_year"] <= float(year_max))]

        if methods:
            parsed_methods: list[str] = []
            for item in methods:
                for part in item.split(","):
                    cleaned = part.strip()
                    if cleaned:
                        parsed_methods.append(cleaned)
            if parsed_methods and "discoverymethod" in df.columns:
                df = df.loc[df["discoverymethod"].astype(str).isin(parsed_methods)]

        if r_max is not None and "pl_rade" in df.columns:
            df = df.loc[df["pl_rade"] <= float(r_max)]

        if hz_mode:
            mode = hz_mode.strip().lower()
            if mode in {"conservadora", "conservative"} and "hz_conservadora" in df.columns:
                df = df.loc[df["hz_conservadora"]]
            elif mode in {"optimista", "optimistic"} and "hz_optimista" in df.columns:
                df = df.loc[df["hz_optimista"]]

        if only_chile and "visible_chile" in df.columns:
            df = df.loc[df["visible_chile"]]

        df = _sanitize_df_for_csv(df)
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="astro_exoplanets_filtered.csv"'
            },
        )

    return application


app = create_app()
