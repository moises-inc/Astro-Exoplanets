"""Data quality auditing, physical filtering, and derived astrophysical indicators."""

from __future__ import annotations

import numpy as np
import pandas as pd

COLUMNAS_NUMERICAS = [
    "disc_year",
    "pl_orbper",
    "pl_rade",
    "pl_bmasse",
    "pl_insol",
    "pl_eqt",
    "st_teff",
    "st_rad",
    "sy_dist",
    "sy_jmag",
    "dec",
    "ra",
]

COLUMNAS_IMPOSIBLES_AUDITORIA = [
    "pl_rade",
    "pl_bmasse",
    "pl_insol",
    "pl_eqt",
    "pl_orbper",
    "sy_dist",
    "st_rad",
    "st_teff",
]

COLUMNAS_FISICA_BASICA = ["pl_rade", "pl_insol", "pl_eqt", "sy_dist"]

REGEX_OBSERVATORIOS_CHILE = (
    r"La Silla|Paranal|Cerro Tololo|Las Campanas|CTIO|ALMA|Magellan|Gemini South"
)
DEC_LIMITE_CHILE = 20.0
PARANAL_LAT_DEG = -24.6272
PARANAL_MIN_ALT_DEG = 5.0
HZ_CONSERVADORA_MIN = 0.36
HZ_CONSERVADORA_MAX = 1.11
HZ_OPTIMISTA_MIN = 0.25
HZ_OPTIMISTA_MAX = 1.50


def auditar_calidad(df_raw: pd.DataFrame) -> dict:
    """Audit nulls, duplicates by ``pl_name``, and physically impossible (<= 0) values."""
    total_filas = int(len(df_raw))
    duplicados = (
        int(df_raw["pl_name"].duplicated().sum())
        if "pl_name" in df_raw.columns
        else 0
    )

    nulos_por_columna = {
        col: int(df_raw[col].isna().sum()) for col in df_raw.columns
    }

    imposibles_por_columna: dict[str, int] = {}
    for col in COLUMNAS_IMPOSIBLES_AUDITORIA:
        if col in df_raw.columns:
            serie_num = pd.to_numeric(df_raw[col], errors="coerce")
            imposibles_por_columna[col] = int((serie_num <= 0).sum())
        else:
            imposibles_por_columna[col] = 0

    return {
        "total_filas": total_filas,
        "total_columnas": int(len(df_raw.columns)),
        "duplicados_pl_name": duplicados,
        "nulos_por_columna": nulos_por_columna,
        "total_nulos": int(sum(nulos_por_columna.values())),
        "imposibles_por_columna": imposibles_por_columna,
        "total_imposibles": int(sum(imposibles_por_columna.values())),
    }


def _clasificar_radio(radios: pd.Series) -> pd.Series:
    """Classify planetary radius according to physical regime and Fulton radius gap."""
    r = radios.to_numpy(dtype=float)
    condiciones = [
        r < 1.25,
        (r >= 1.25) & (r < 1.6),
        (r >= 1.6) & (r < 2.0),
        (r >= 2.0) & (r < 4.0),
        r >= 4.0,
    ]
    etiquetas = [
        "Terrestre",
        "Super-Tierra",
        "Transición Brecha",
        "Sub-Neptuno",
        "Gigante",
    ]
    return pd.Series(
        np.select(condiciones, etiquetas, default="Sin clasificar"),
        index=radios.index,
        dtype="object",
    )


def _calcular_tsm(df: pd.DataFrame) -> pd.Series:
    """Compute Transmission Spectroscopy Metric (Kempton et al., 2018)."""
    tsm = pd.Series(np.nan, index=df.index, dtype=float)
    cols_necesarias = {"pl_rade", "pl_bmasse", "pl_eqt", "st_rad", "sy_jmag"}
    if not cols_necesarias.issubset(df.columns) or df.empty:
        return tsm

    r = df["pl_rade"]
    m_p = df["pl_bmasse"]
    t_eq = df["pl_eqt"]
    r_star = df["st_rad"]
    jmag = df["sy_jmag"]

    valido = (
        r.notna()
        & (r > 0.0)
        & (r < 10.0)
        & m_p.notna()
        & (m_p > 0.0)
        & r_star.notna()
        & (r_star > 0.0)
        & t_eq.notna()
        & (t_eq > 0.0)
        & jmag.notna()
    )
    if not valido.any():
        return tsm

    r_val = r.loc[valido].to_numpy(dtype=float)
    f_scale = np.select(
        [
            r_val < 1.5,
            (r_val >= 1.5) & (r_val < 2.75),
            (r_val >= 2.75) & (r_val < 4.0),
            (r_val >= 4.0) & (r_val < 10.0),
        ],
        [0.190, 1.26, 1.28, 1.15],
        default=np.nan,
    )

    m_val = m_p.loc[valido].to_numpy(dtype=float)
    teq_val = t_eq.loc[valido].to_numpy(dtype=float)
    rs_val = r_star.loc[valido].to_numpy(dtype=float)
    j_val = jmag.loc[valido].to_numpy(dtype=float)

    tsm_val = (
        f_scale
        * ((r_val ** 3) * teq_val)
        / (m_val * (rs_val ** 2))
        * (10.0 ** (-j_val / 5.0))
    )
    tsm.loc[valido] = tsm_val
    return tsm


def _calcular_min_airmass_paranal(dec: pd.Series) -> pd.Series:
    """Vectorized minimum culmination airmass from ESO Paranal (lat = -24.6272 deg)."""
    dec_arr = dec.to_numpy(dtype=float)
    culmination_alt = 90.0 - np.abs(PARANAL_LAT_DEG - dec_arr)
    valid = np.isfinite(culmination_alt) & (culmination_alt > PARANAL_MIN_ALT_DEG)
    airmass = np.full_like(dec_arr, np.nan, dtype=float)
    airmass[valid] = 1.0 / np.sin(np.deg2rad(culmination_alt[valid]))
    return pd.Series(airmass, index=dec.index, dtype=float)


def limpiar_y_enriquecer(df_raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Clean physically invalid/null records and compute ESI, TSM, HZ, and Chile metrics."""
    auditoria_raw = auditar_calidad(df_raw)
    df = df_raw.copy()

    for col in COLUMNAS_NUMERICAS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype(float)

    filas_iniciales = int(len(df))
    cols_base = [c for c in COLUMNAS_FISICA_BASICA if c in df.columns]
    nulos_raw_base = int(df[cols_base].isna().any(axis=1).sum()) if cols_base else 0

    if "pl_name" in df.columns:
        antes_dup = len(df)
        df = df.drop_duplicates(subset=["pl_name"], keep="first").copy()
        duplicados_eliminados = int(antes_dup - len(df))
    else:
        duplicados_eliminados = 0

    mask_imposibles = pd.Series(False, index=df.index)
    for col in cols_base:
        mask_imposibles = mask_imposibles | (df[col] <= 0.0)
    excluidas_imposibles = int(mask_imposibles.sum())
    df = df.loc[~mask_imposibles].copy()

    mask_nulos = (
        df[cols_base].isna().any(axis=1)
        if cols_base
        else pd.Series(False, index=df.index)
    )
    excluidas_nulos = int(mask_nulos.sum())
    df = df.loc[~mask_nulos].copy().reset_index(drop=True)

    if not df.empty:
        s_flux = df["pl_insol"].to_numpy(dtype=float)
        r_planeta = df["pl_rade"].to_numpy(dtype=float)
        df["esi"] = 1.0 - np.sqrt(
            0.5
            * (
                ((s_flux - 1.0) / (s_flux + 1.0)) ** 2
                + ((r_planeta - 1.0) / (r_planeta + 1.0)) ** 2
            )
        )
        df["tsm"] = _calcular_tsm(df)
        df["hz_conservadora"] = (
            (df["pl_insol"] >= HZ_CONSERVADORA_MIN)
            & (df["pl_insol"] <= HZ_CONSERVADORA_MAX)
        )
        df["hz_optimista"] = (
            (df["pl_insol"] >= HZ_OPTIMISTA_MIN)
            & (df["pl_insol"] <= HZ_OPTIMISTA_MAX)
        )
        df["visible_chile"] = (
            df["dec"].notna() & (df["dec"] <= DEC_LIMITE_CHILE)
            if "dec" in df.columns
            else False
        )
        df["descubierto_chile"] = (
            df["disc_facility"]
            .fillna("")
            .astype(str)
            .str.contains(REGEX_OBSERVATORIOS_CHILE, case=False, regex=True)
            if "disc_facility" in df.columns
            else False
        )
        df["es_transito"] = (
            df["discoverymethod"].fillna("").astype(str) == "Transit"
            if "discoverymethod" in df.columns
            else False
        )
        df["categoria_radio"] = _clasificar_radio(df["pl_rade"])
        df["min_airmass_paranal"] = (
            _calcular_min_airmass_paranal(df["dec"])
            if "dec" in df.columns
            else np.nan
        )
    else:
        for col_derivada, dtype in [
            ("esi", float),
            ("tsm", float),
            ("hz_conservadora", bool),
            ("hz_optimista", bool),
            ("visible_chile", bool),
            ("descubierto_chile", bool),
            ("es_transito", bool),
            ("categoria_radio", object),
            ("min_airmass_paranal", float),
        ]:
            df[col_derivada] = pd.Series(dtype=dtype)

    filas_finales = int(len(df))
    reporte = {
        "filas_iniciales": filas_iniciales,
        "duplicados_eliminados": duplicados_eliminados,
        "excluidas_imposibles": excluidas_imposibles,
        "excluidas_nulos": excluidas_nulos,
        "nulos_fisica_basica_raw": nulos_raw_base,
        "imposibles_pl_insol_raw": auditoria_raw["imposibles_por_columna"].get(
            "pl_insol", 0
        ),
        "filas_finales": filas_finales,
        "porcentaje_retenido": (
            round(filas_finales / filas_iniciales * 100.0, 2)
            if filas_iniciales > 0
            else 0.0
        ),
        "auditoria_raw": auditoria_raw,
    }
    return df, reporte
