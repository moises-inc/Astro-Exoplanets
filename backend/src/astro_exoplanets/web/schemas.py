"""Pydantic v2 response schemas for the Astro-Exoplanets REST API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: str
    version: str
    source: str
    total_raw: int
    total_clean: int


class PlanetRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    pl_name: str
    hostname: str | None = None
    discoverymethod: str | None = None
    disc_year: float | int | None = None
    disc_facility: str | None = None
    pl_orbper: float | None = None
    pl_rade: float | None = None
    pl_bmasse: float | None = None
    pl_insol: float | None = None
    pl_eqt: float | None = None
    st_teff: float | None = None
    st_rad: float | None = None
    sy_dist: float | None = None
    sy_jmag: float | None = None
    dec: float | None = None
    ra: float | None = None
    esi: float | None = None
    tsm: float | None = None
    hz_conservadora: bool
    hz_optimista: bool
    visible_chile: bool
    descubierto_chile: bool
    es_transito: bool
    categoria_radio: str
    min_airmass_paranal: float | None = None


class SensitivityResponse(BaseModel):
    fulton_hz: list[dict]
    dist_tsm: list[dict]


class MethodSummaryItem(BaseModel):
    id: str
    count: int


class BootstrapResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: str
    source_message_es: str
    source_message_en: str
    insecure_ssl: bool = False
    audit: dict
    year_min: int | None
    year_max: int | None
    methods: list[MethodSummaryItem]
    chile_observatories: list[dict]
    sensitivity: SensitivityResponse
    planets: list[PlanetRecord]


class ObservatoryMetrics(BaseModel):
    name: str
    lat_deg: float
    lon_deg: float
    height_m: float
    max_altitude_deg: float | None = None
    min_airmass: float | None = None
    observable_airmass_2: bool
    best_months: list[int]
    monthly_hours_airmass_le_2: list[float]


class ObservatorySiteVisibility(BaseModel):
    site_id: str
    site_name: str
    max_altitude_deg: float | None = None
    min_airmass: float | None = None
    observable_airmass_2: bool
    best_months: list[int]
    monthly_hours_airmass_le_2: list[float]


class ObservabilityResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    pl_name: str
    ra_deg: float | None = None
    dec_deg: float | None = None
    visible_chile_cutoff: bool = False
    reference_observatory: str
    max_altitude_deg: float | None = None
    min_airmass: float | None = None
    observable_airmass_2: bool
    best_months: list[int]
    monthly_hours_airmass_le_2: list[float]
    sites: list[ObservatorySiteVisibility]
    observatories: dict[str, ObservatoryMetrics]


class RawLightCurvePoint(BaseModel):
    btjd: float
    flux: float


class FoldedLightCurvePoint(BaseModel):
    phase_days: float
    flux: float


class BinnedLightCurvePoint(BaseModel):
    phase_days: float
    flux: float
    count: int


class LightCurveResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    pl_name: str
    hostname: str | None = None
    available: bool
    cached: bool = False
    source: str | None = None
    mission: str | None = None
    author: str | None = None
    sector_or_quarter: str | None = None
    period_days: float | None = None
    raw_points_total: int = 0
    raw_series: list[RawLightCurvePoint] = []
    folded_points: list[FoldedLightCurvePoint] = []
    folded_binned: list[BinnedLightCurvePoint] = []
    reason_es: str | None = None
    reason_en: str | None = None
