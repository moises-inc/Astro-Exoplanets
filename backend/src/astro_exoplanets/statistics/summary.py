"""Descriptive statistics, log10 correlations, sensitivity tables, and observatory summaries."""

from __future__ import annotations

import numpy as np
import pandas as pd

VARIABLES_DESCRIPTIVAS = [
    "pl_rade",
    "pl_bmasse",
    "pl_insol",
    "pl_eqt",
    "sy_dist",
    "pl_orbper",
    "esi",
    "tsm",
]

METADATOS_VARIABLES: dict[str, tuple[str, str]] = {
    "pl_rade": ("Radio planetario", "R⊕"),
    "pl_bmasse": ("Masa planetaria", "M⊕"),
    "pl_insol": ("Flujo de insolación", "S⊕"),
    "pl_eqt": ("Temperatura de equilibrio", "K"),
    "sy_dist": ("Distancia al sistema", "pc"),
    "pl_orbper": ("Período orbital", "días"),
    "esi": ("Índice de Similitud con la Tierra (ESI)", "adim. (0–1)"),
    "tsm": ("Transmission Spectroscopy Metric (TSM)", "adim."),
}


def estadistica_descriptiva(df: pd.DataFrame) -> pd.DataFrame:
    """Compute sample descriptive statistics (ddof=1) for key astrophysical variables."""
    filas: list[dict] = []
    for var in VARIABLES_DESCRIPTIVAS:
        if var not in df.columns:
            continue
        nombre, unidad = METADATOS_VARIABLES.get(var, (var, ""))
        valores = df[var].dropna().to_numpy(dtype=float)
        n = int(len(valores))
        if n == 0:
            filas.append(
                {
                    "variable": var,
                    "nombre": nombre,
                    "unidad": unidad,
                    "n": 0,
                    "promedio": np.nan,
                    "mediana": np.nan,
                    "desv_estandar": np.nan,
                    "minimo": np.nan,
                    "maximo": np.nan,
                    "p95": np.nan,
                }
            )
            continue

        std_val = float(np.std(valores, ddof=1)) if n > 1 else 0.0
        filas.append(
            {
                "variable": var,
                "nombre": nombre,
                "unidad": unidad,
                "n": n,
                "promedio": float(np.mean(valores)),
                "mediana": float(np.median(valores)),
                "desv_estandar": std_val,
                "minimo": float(np.min(valores)),
                "maximo": float(np.max(valores)),
                "p95": float(np.percentile(valores, 95)),
            }
        )

    return pd.DataFrame(filas)


def _correlacion_log10(df: pd.DataFrame, col_x: str, col_y: str) -> tuple[float, int]:
    """Compute Pearson correlation between log10(col_x) and log10(col_y)."""
    if col_x not in df.columns or col_y not in df.columns:
        return np.nan, 0

    sub = df[[col_x, col_y]].dropna()
    sub = sub[(sub[col_x] > 0.0) & (sub[col_y] > 0.0)]
    n = int(len(sub))
    if n < 2:
        return np.nan, n

    lx = np.log10(sub[col_x].to_numpy(dtype=float))
    ly = np.log10(sub[col_y].to_numpy(dtype=float))
    if np.std(lx) == 0.0 or np.std(ly) == 0.0:
        return np.nan, n

    r = float(np.corrcoef(lx, ly)[0, 1])
    return r, n


def metricas_numpy(df: pd.DataFrame) -> dict:
    """Compute summary metrics, CV, log-log correlations, and counts using NumPy (ddof=1)."""
    variables_stats: dict[str, dict] = {}
    for var in VARIABLES_DESCRIPTIVAS:
        if var not in df.columns:
            continue
        vals = df[var].dropna().to_numpy(dtype=float)
        n = int(len(vals))
        if n == 0:
            variables_stats[var] = {
                "n": 0,
                "promedio": np.nan,
                "mediana": np.nan,
                "desv_estandar": np.nan,
                "p25": np.nan,
                "p75": np.nan,
                "p95": np.nan,
                "cv_pct": np.nan,
            }
            continue

        promedio = float(np.mean(vals))
        mediana = float(np.median(vals))
        desv = float(np.std(vals, ddof=1)) if n > 1 else 0.0
        p25 = float(np.percentile(vals, 25))
        p75 = float(np.percentile(vals, 75))
        p95 = float(np.percentile(vals, 95))
        cv_pct = float(desv / promedio * 100.0) if promedio != 0.0 else np.nan
        variables_stats[var] = {
            "n": n,
            "promedio": promedio,
            "mediana": mediana,
            "desv_estandar": desv,
            "p25": p25,
            "p75": p75,
            "p95": p95,
            "cv_pct": cv_pct,
        }

    corr_per_rad, n_corr_per_rad = _correlacion_log10(df, "pl_orbper", "pl_rade")
    corr_dist_rad, n_corr_dist_rad = _correlacion_log10(df, "sy_dist", "pl_rade")

    def _sum_bool(col: str) -> int:
        if col not in df.columns or df.empty:
            return 0
        return int(np.sum(df[col].fillna(False).to_numpy(dtype=bool)))

    required_prio = {"hz_optimista", "pl_rade", "es_transito", "visible_chile", "tsm"}
    if not df.empty and required_prio.issubset(df.columns):
        tsm_arr = df["tsm"].to_numpy(dtype=float)
        tsm_valido = ~np.isnan(tsm_arr)
        conteo_tsm_valido = int(np.sum(tsm_valido))
        conteo_tsm_10 = int(np.sum(np.where(tsm_valido, tsm_arr >= 10.0, False)))
        prioritarios_mask = (
            df["hz_optimista"].to_numpy(dtype=bool)
            & (df["pl_rade"].to_numpy(dtype=float) <= 1.8)
            & df["es_transito"].to_numpy(dtype=bool)
            & df["visible_chile"].to_numpy(dtype=bool)
            & np.where(tsm_valido, tsm_arr >= 10.0, False)
        )
        conteo_prioritarios = int(np.sum(prioritarios_mask))
    else:
        conteo_tsm_valido = 0
        conteo_tsm_10 = 0
        conteo_prioritarios = 0

    return {
        "total_planetas": int(len(df)),
        "ddof_std": 1,
        "variables": variables_stats,
        "corr_log_periodo_radio": corr_per_rad,
        "n_corr_periodo_radio": n_corr_per_rad,
        "corr_log_distancia_radio": corr_dist_rad,
        "n_corr_distancia_radio": n_corr_dist_rad,
        "conteo_hz_conservadora": _sum_bool("hz_conservadora"),
        "conteo_hz_optimista": _sum_bool("hz_optimista"),
        "conteo_visible_chile": _sum_bool("visible_chile"),
        "conteo_transito": _sum_bool("es_transito"),
        "conteo_descubierto_chile": _sum_bool("descubierto_chile"),
        "conteo_tsm_valido": conteo_tsm_valido,
        "conteo_tsm_mayor_igual_10": conteo_tsm_10,
        "conteo_prioritarios_chile": conteo_prioritarios,
    }


def tabla_sensibilidad(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build sensitivity matrices (fulton_hz and dist_tsm)."""
    cols_t1 = [
        "zona_habitable",
        "rango_insolacion",
        "radio_max_rt",
        "total_hz",
        "transitantes",
        "visibles_chile",
        "transitantes_chile_tsm10",
    ]
    cols_t2 = [
        "distancia_max_pc",
        "tsm_minimo",
        "total_candidatos",
        "transitantes",
        "visibles_chile",
        "transitantes_visibles_chile",
    ]

    if df.empty:
        return pd.DataFrame(columns=cols_t1), pd.DataFrame(columns=cols_t2)

    r_arr = df["pl_rade"].to_numpy(dtype=float)
    d_arr = df["sy_dist"].to_numpy(dtype=float)
    tsm_arr = df["tsm"].to_numpy(dtype=float)
    tsm_ok = ~np.isnan(tsm_arr)
    trans_arr = df["es_transito"].to_numpy(dtype=bool)
    chile_arr = df["visible_chile"].to_numpy(dtype=bool)
    hz_cons_arr = df["hz_conservadora"].to_numpy(dtype=bool)
    hz_opt_arr = df["hz_optimista"].to_numpy(dtype=bool)

    filas_t1: list[dict] = []
    definiciones_hz = [
        ("Conservadora", "0.36–1.11 S⊕", hz_cons_arr),
        ("Optimista", "0.25–1.50 S⊕", hz_opt_arr),
    ]
    for nombre_hz, rango_str, mask_hz in definiciones_hz:
        for r_max in (1.6, 1.8, 2.0):
            mask_base = mask_hz & (r_arr <= r_max)
            mask_tsm10 = np.where(tsm_ok, tsm_arr >= 10.0, False)
            filas_t1.append(
                {
                    "zona_habitable": nombre_hz,
                    "rango_insolacion": rango_str,
                    "radio_max_rt": float(r_max),
                    "total_hz": int(np.sum(mask_base)),
                    "transitantes": int(np.sum(mask_base & trans_arr)),
                    "visibles_chile": int(np.sum(mask_base & chile_arr)),
                    "transitantes_chile_tsm10": int(
                        np.sum(mask_base & trans_arr & chile_arr & mask_tsm10)
                    ),
                }
            )

    filas_t2: list[dict] = []
    mask_opt_r16 = hz_opt_arr & (r_arr <= 1.6)
    for d_max in (15, 30, 50):
        for tsm_min in (10, 15, 20):
            mask_tsm = np.where(tsm_ok, tsm_arr >= float(tsm_min), False)
            mask_base = mask_opt_r16 & (d_arr <= float(d_max)) & mask_tsm
            filas_t2.append(
                {
                    "distancia_max_pc": int(d_max),
                    "tsm_minimo": int(tsm_min),
                    "total_candidatos": int(np.sum(mask_base)),
                    "transitantes": int(np.sum(mask_base & trans_arr)),
                    "visibles_chile": int(np.sum(mask_base & chile_arr)),
                    "transitantes_visibles_chile": int(
                        np.sum(mask_base & trans_arr & chile_arr)
                    ),
                }
            )

    return pd.DataFrame(filas_t1, columns=cols_t1), pd.DataFrame(
        filas_t2, columns=cols_t2
    )


def resumen_observatorios_chile(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate planets discovered from Chilean observatories."""
    columnas = [
        "observatorio",
        "total_descubiertos",
        "terrestres_o_super_tierras",
        "en_hz_optimista",
        "visibles_chile",
        "metodo_principal",
        "anio_primero",
        "anio_ultimo",
        "radio_mediano_rt",
        "distancia_mediana_pc",
    ]
    if df.empty or "descubierto_chile" not in df.columns:
        return pd.DataFrame(columns=columnas)

    sub = df.loc[df["descubierto_chile"]].copy()
    if sub.empty:
        return pd.DataFrame(columns=columnas)

    sub["_es_rocoso"] = sub["pl_rade"] <= 1.6

    def _moda(serie: pd.Series) -> str:
        modos = serie.dropna().mode()
        return str(modos.iloc[0]) if not modos.empty else "N/D"

    agrupado = (
        sub.groupby("disc_facility", as_index=False)
        .agg(
            total_descubiertos=("pl_name", "count"),
            terrestres_o_super_tierras=("_es_rocoso", "sum"),
            en_hz_optimista=("hz_optimista", "sum"),
            visibles_chile=("visible_chile", "sum"),
            metodo_principal=("discoverymethod", _moda),
            anio_primero=("disc_year", "min"),
            anio_ultimo=("disc_year", "max"),
            radio_mediano_rt=("pl_rade", "median"),
            distancia_mediana_pc=("sy_dist", "median"),
        )
        .rename(columns={"disc_facility": "observatorio"})
        .sort_values("total_descubiertos", ascending=False)
        .reset_index(drop=True)
    )

    for col_int in (
        "total_descubiertos",
        "terrestres_o_super_tierras",
        "en_hz_optimista",
        "visibles_chile",
    ):
        agrupado[col_int] = agrupado[col_int].astype(int)
    for col_anio in ("anio_primero", "anio_ultimo"):
        agrupado[col_anio] = agrupado[col_anio].round().astype("Int64")

    return agrupado[columnas]


def resumen_por_metodo(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate key metrics by exoplanet discovery method."""
    columnas = [
        "discoverymethod",
        "total",
        "porcentaje",
        "radio_mediano_rt",
        "distancia_mediana_pc",
        "en_hz_optimista",
        "visibles_chile",
    ]
    if df.empty or "discoverymethod" not in df.columns:
        return pd.DataFrame(columns=columnas)

    total_global = len(df)
    resumen = (
        df.groupby("discoverymethod", as_index=False)
        .agg(
            total=("pl_name", "count"),
            radio_mediano_rt=("pl_rade", "median"),
            distancia_mediana_pc=("sy_dist", "median"),
            en_hz_optimista=("hz_optimista", "sum"),
            visibles_chile=("visible_chile", "sum"),
        )
        .sort_values("total", ascending=False)
        .reset_index(drop=True)
    )
    resumen["porcentaje"] = (resumen["total"] / total_global * 100.0).round(2)
    resumen["en_hz_optimista"] = resumen["en_hz_optimista"].astype(int)
    resumen["visibles_chile"] = resumen["visibles_chile"].astype(int)
    return resumen[columnas]


def tabla_dinamica_metodo_radio(df: pd.DataFrame) -> pd.DataFrame:
    """Build pivot table of discovery method vs radius regime."""
    if df.empty or not {
        "discoverymethod",
        "categoria_radio",
        "pl_name",
    }.issubset(df.columns):
        return pd.DataFrame()

    pivote = pd.pivot_table(
        df,
        values="pl_name",
        index="discoverymethod",
        columns="categoria_radio",
        aggfunc="count",
        fill_value=0,
        margins=True,
        margins_name="Total",
    )
    orden_cols = [
        c
        for c in [
            "Terrestre",
            "Super-Tierra",
            "Transición Brecha",
            "Sub-Neptuno",
            "Gigante",
            "Total",
        ]
        if c in pivote.columns
    ]
    return pivote[orden_cols]
