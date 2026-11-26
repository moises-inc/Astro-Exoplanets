"""Integration tests for FastAPI REST endpoints."""

from __future__ import annotations

import csv
import io
import sys

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from astro_exoplanets.api_client.nasa_tap import TapFetchResult
from astro_exoplanets.web.app import _sanitize_df_for_csv, create_app


def test_health_and_bootstrap_offline(monkeypatch) -> None:
    monkeypatch.setenv("EXO_FORCE_OFFLINE", "1")
    client = TestClient(create_app())

    health_resp = client.get("/api/v1/health")
    assert health_resp.status_code == 200
    health = health_resp.json()
    assert health["status"] == "ok"
    assert health["version"] == "2.0.0"
    assert health["source"] == "csv_backup"
    assert health["total_raw"] == 6473
    assert health["total_clean"] == 5767

    boot_resp = client.get("/api/v1/catalog/bootstrap?force_offline=true")
    assert boot_resp.status_code == 200
    boot = boot_resp.json()
    assert boot["source"] == "csv_backup"
    assert len(boot["planets"]) == 5767
    assert boot["year_min"] is not None
    assert boot["year_max"] is not None
    assert any(m["id"] == "Transit" and m["count"] > 0 for m in boot["methods"])
    assert boot["audit"]["total_filas"] == 6473
    assert boot["audit"]["total_imposibles"] == 46
    assert len(boot["sensitivity"]["fulton_hz"]) == 6
    assert len(boot["sensitivity"]["dist_tsm"]) == 9
    assert "min_airmass_paranal" in boot["planets"][0]


def test_planet_observability_and_404(monkeypatch) -> None:
    monkeypatch.setenv("EXO_FORCE_OFFLINE", "1")
    client = TestClient(create_app())

    obs_resp = client.get("/api/v1/planets/TRAPPIST-1%20e/observability")
    assert obs_resp.status_code == 200
    obs = obs_resp.json()
    assert obs["pl_name"] == "TRAPPIST-1 e"
    assert obs["observable_airmass_2"] is True
    assert len(obs["monthly_hours_airmass_le_2"]) == 12

    not_found = client.get("/api/v1/planets/NoSuchPlanet%20999%20z/observability")
    assert not_found.status_code == 404


def test_planet_lightcurve_uses_real_cache(monkeypatch) -> None:
    monkeypatch.setenv("EXO_FORCE_OFFLINE", "1")
    client = TestClient(create_app())

    lc_resp = client.get("/api/v1/planets/TRAPPIST-1%20e/lightcurve")
    assert lc_resp.status_code == 200
    lc = lc_resp.json()
    assert lc["pl_name"] == "TRAPPIST-1 e"
    assert lc["available"] is True
    assert lc["cached"] is True
    assert len(lc["raw_series"]) > 0
    assert len(lc["folded_points"]) > 0
    assert len(lc["folded_binned"]) > 0


def test_export_csv_with_filters(monkeypatch) -> None:
    monkeypatch.setenv("EXO_FORCE_OFFLINE", "1")
    client = TestClient(create_app())

    resp = client.get(
        "/api/v1/catalog/export.csv",
        params={
            "year_min": 2015,
            "year_max": 2024,
            "methods": "Transit",
            "r_max": 1.8,
            "hz_mode": "optimista",
            "only_chile": "true",
        },
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    rows = list(csv.DictReader(io.StringIO(resp.text)))
    assert len(rows) > 0
    for row in rows:
        assert row["discoverymethod"] == "Transit"
        assert float(row["pl_rade"]) <= 1.8
        assert row["hz_optimista"] == "True"
        assert row["visible_chile"] == "True"
        assert 2015 <= int(float(row["disc_year"])) <= 2024


def test_security_headers_and_cors_hardening(monkeypatch) -> None:
    monkeypatch.setenv("EXO_FORCE_OFFLINE", "1")
    client = TestClient(create_app())

    health_resp = client.get("/api/v1/health")
    assert health_resp.status_code == 200
    assert health_resp.headers["x-content-type-options"] == "nosniff"
    assert health_resp.headers["x-frame-options"] == "DENY"
    assert health_resp.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert (
        health_resp.headers["permissions-policy"]
        == "geolocation=(), microphone=(), camera=()"
    )

    preflight = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert preflight.headers.get("access-control-allow-credentials") != "true"
    assert preflight.headers["x-content-type-options"] == "nosniff"
    assert preflight.headers["x-frame-options"] == "DENY"


def test_csv_formula_injection_sanitization(monkeypatch) -> None:
    raw_df = pd.DataFrame(
        [
            {
                "pl_name": "=CMD|' /C calc'!A0",
                "hostname": "+2+3",
                "discoverymethod": "Transit",
                "disc_year": 2023,
                "disc_facility": "@SUM(A1:A2)",
                "pl_orbper": 10.0,
                "pl_rade": 1.2,
                "pl_bmasse": 2.1,
                "pl_insol": 0.9,
                "pl_eqt": 270.0,
                "st_teff": 4800.0,
                "st_rad": 0.8,
                "sy_dist": 12.5,
                "sy_jmag": 9.1,
                "dec": -24.627,
                "ra": 120.0,
            }
        ]
    )

    sanitized_direct = _sanitize_df_for_csv(raw_df)
    assert sanitized_direct.loc[0, "pl_name"] == "'=CMD|' /C calc'!A0"
    assert sanitized_direct.loc[0, "hostname"] == "'+2+3"
    assert sanitized_direct.loc[0, "disc_facility"] == "'@SUM(A1:A2)"
    assert sanitized_direct.loc[0, "dec"] == -24.627
    assert pd.api.types.is_numeric_dtype(sanitized_direct["dec"])

    monkeypatch.setattr(
        sys.modules["astro_exoplanets.web.app"],
        "fetch_exoplanets",
        lambda force_offline=False: TapFetchResult(
            df=raw_df,
            source="csv_backup",
            source_message_es="mock",
            source_message_en="mock",
            insecure_ssl=False,
        ),
    )

    client = TestClient(create_app())
    resp = client.get("/api/v1/catalog/export.csv")
    assert resp.status_code == 200
    rows = list(csv.DictReader(io.StringIO(resp.text)))
    assert len(rows) == 1
    assert rows[0]["pl_name"] == "'=CMD|' /C calc'!A0"
    assert rows[0]["hostname"] == "'+2+3"
    assert rows[0]["disc_facility"] == "'@SUM(A1:A2)"
    assert float(rows[0]["dec"]) == -24.627
    assert not rows[0]["dec"].startswith("'")


def test_csv_formula_injection_leading_spaces(monkeypatch) -> None:
    raw_df = pd.DataFrame(
        [
            {
                "pl_name": " =HYPERLINK(\"https://example.com\",\"x\")",
                "hostname": "  +1+1",
                "discoverymethod": " -2+3",
                "disc_year": 2024,
                "disc_facility": "\t=1+1",
                "pl_orbper": 12.0,
                "pl_rade": 1.1,
                "pl_bmasse": 1.5,
                "pl_insol": 1.0,
                "pl_eqt": 280.0,
                "st_teff": 5200.0,
                "st_rad": 0.9,
                "sy_dist": 10.0,
                "sy_jmag": 8.8,
                "dec": -15.5,
                "ra": 90.0,
            }
        ]
    )

    sanitized_direct = _sanitize_df_for_csv(raw_df)
    assert sanitized_direct.loc[0, "pl_name"] == "' =HYPERLINK(\"https://example.com\",\"x\")"
    assert sanitized_direct.loc[0, "hostname"] == "'  +1+1"
    assert sanitized_direct.loc[0, "discoverymethod"] == "' -2+3"
    assert sanitized_direct.loc[0, "disc_facility"] == "'\t=1+1"
    assert sanitized_direct.loc[0, "dec"] == -15.5

    monkeypatch.setattr(
        sys.modules["astro_exoplanets.web.app"],
        "fetch_exoplanets",
        lambda force_offline=False: TapFetchResult(
            df=raw_df,
            source="csv_backup",
            source_message_es="mock",
            source_message_en="mock",
            insecure_ssl=False,
        ),
    )

    client = TestClient(create_app())
    resp = client.get("/api/v1/catalog/export.csv")
    assert resp.status_code == 200
    rows = list(csv.DictReader(io.StringIO(resp.text)))
    assert len(rows) == 1
    assert rows[0]["pl_name"] == "' =HYPERLINK(\"https://example.com\",\"x\")"
    assert rows[0]["hostname"] == "'  +1+1"
    assert rows[0]["discoverymethod"] == "' -2+3"
    assert rows[0]["disc_facility"] == "'\t=1+1"
    assert float(rows[0]["dec"]) == -15.5


@pytest.mark.parametrize(
    "params",
    [
        {"hz_mode": "invalid"},
        {"year_min": 1800},
        {"year_max": 2200},
        {"r_max": 0},
        {"r_max": -2},
        {"r_max": 500},
    ],
)
def test_export_csv_invalid_query_params_return_422(monkeypatch, params: dict) -> None:
    monkeypatch.setenv("EXO_FORCE_OFFLINE", "1")
    client = TestClient(create_app())
    resp = client.get("/api/v1/catalog/export.csv", params=params)
    assert resp.status_code == 422
