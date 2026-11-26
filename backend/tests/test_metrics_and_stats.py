"""Tests for astrophysical quality audit, cleaning, metrics, and statistics."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from astro_exoplanets.astrophysics.metrics import (
    _calcular_tsm,
    auditar_calidad,
    limpiar_y_enriquecer,
)
from astro_exoplanets.config import get_csv_backup_path
from astro_exoplanets.statistics.summary import (
    estadistica_descriptiva,
    metricas_numpy,
    resumen_observatorios_chile,
    resumen_por_metodo,
    tabla_sensibilidad,
)


def test_real_nasa_csv_audit_and_cleaning_counts() -> None:
    df_raw = pd.read_csv(get_csv_backup_path())
    audit = auditar_calidad(df_raw)

    assert audit["total_filas"] == 6473
    assert audit["duplicados_pl_name"] == 0
    assert audit["total_nulos"] == 2580
    assert audit["imposibles_por_columna"]["pl_insol"] == 46

    df_clean, report = limpiar_y_enriquecer(df_raw)
    assert len(df_clean) == 5767
    assert report["filas_finales"] == 5767
    assert report["porcentaje_retenido"] == 89.09
    assert "min_airmass_paranal" in df_clean.columns


def test_tsm_kempton_2018_exact_scale_factors() -> None:
    df = pd.DataFrame(
        {
            "pl_rade": [1.0, 2.0, 3.0, 5.0, 10.5],
            "pl_bmasse": [1.0, 1.0, 1.0, 1.0, 1.0],
            "pl_eqt": [300.0, 300.0, 300.0, 300.0, 300.0],
            "st_rad": [1.0, 1.0, 1.0, 1.0, 1.0],
            "sy_jmag": [0.0, 0.0, 0.0, 0.0, 0.0],
        }
    )
    tsm = _calcular_tsm(df)
    assert math.isclose(tsm.iloc[0], 0.190 * (1.0**3) * 300.0, rel_tol=1e-9)
    assert math.isclose(tsm.iloc[1], 1.26 * (2.0**3) * 300.0, rel_tol=1e-9)
    assert math.isclose(tsm.iloc[2], 1.28 * (3.0**3) * 300.0, rel_tol=1e-9)
    assert math.isclose(tsm.iloc[3], 1.15 * (5.0**3) * 300.0, rel_tol=1e-9)
    assert np.isnan(tsm.iloc[4])


def test_derived_metrics_and_min_airmass_paranal() -> None:
    df_raw = pd.DataFrame(
        [
            {
                "pl_name": "Zenith-Paranal b",
                "hostname": "Zenith-Paranal",
                "discoverymethod": "Transit",
                "disc_year": 2023,
                "disc_facility": "Paranal Observatory",
                "pl_orbper": 10.0,
                "pl_rade": 1.0,
                "pl_bmasse": 1.0,
                "pl_insol": 1.0,
                "pl_eqt": 288.0,
                "st_teff": 5778.0,
                "st_rad": 1.0,
                "sy_dist": 10.0,
                "sy_jmag": 8.0,
                "dec": -24.6272,
                "ra": 100.0,
            },
            {
                "pl_name": "North-Pole b",
                "hostname": "North-Pole",
                "discoverymethod": "Radial Velocity",
                "disc_year": 2020,
                "disc_facility": "Keck Observatory",
                "pl_orbper": 100.0,
                "pl_rade": 5.0,
                "pl_bmasse": 30.0,
                "pl_insol": 0.5,
                "pl_eqt": 230.0,
                "st_teff": 5500.0,
                "st_rad": 0.9,
                "sy_dist": 25.0,
                "sy_jmag": 9.0,
                "dec": 80.0,
                "ra": 200.0,
            },
        ]
    )
    df_clean, _ = limpiar_y_enriquecer(df_raw)
    assert math.isclose(df_clean.loc[0, "esi"], 1.0, abs_tol=1e-9)
    assert bool(df_clean.loc[0, "hz_conservadora"]) is True
    assert bool(df_clean.loc[0, "hz_optimista"]) is True
    assert bool(df_clean.loc[0, "visible_chile"]) is True
    assert bool(df_clean.loc[0, "descubierto_chile"]) is True
    assert bool(df_clean.loc[0, "es_transito"]) is True
    assert df_clean.loc[0, "categoria_radio"] == "Terrestre"
    assert math.isclose(df_clean.loc[0, "min_airmass_paranal"], 1.0, abs_tol=1e-6)

    assert bool(df_clean.loc[1, "visible_chile"]) is False
    assert bool(df_clean.loc[1, "descubierto_chile"]) is False
    assert bool(df_clean.loc[1, "es_transito"]) is False
    assert df_clean.loc[1, "categoria_radio"] == "Gigante"
    assert np.isnan(df_clean.loc[1, "min_airmass_paranal"])


def test_statistics_and_sensitivity_tables_on_real_catalog() -> None:
    df_raw = pd.read_csv(get_csv_backup_path())
    df_clean, _ = limpiar_y_enriquecer(df_raw)

    desc = estadistica_descriptiva(df_clean)
    assert not desc.empty
    assert set(desc["variable"]) >= {"pl_rade", "esi", "tsm"}

    metrics = metricas_numpy(df_clean)
    assert metrics["ddof_std"] == 1
    assert metrics["total_planetas"] == 5767
    assert -1.0 <= metrics["corr_log_periodo_radio"] <= 1.0
    assert -1.0 <= metrics["corr_log_distancia_radio"] <= 1.0

    fulton_hz, dist_tsm = tabla_sensibilidad(df_clean)
    assert len(fulton_hz) == 6
    assert len(dist_tsm) == 9

    obs_chile = resumen_observatorios_chile(df_clean)
    assert not obs_chile.empty
    assert obs_chile["total_descubiertos"].sum() > 0

    by_method = resumen_por_metodo(df_clean)
    assert not by_method.empty
    assert by_method["total"].sum() == 5767
