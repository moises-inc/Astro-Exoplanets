"""Tests for NASA Exoplanet Archive TAP client and TLS/offline fallback rules."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import certifi
import pandas as pd
import requests

from astro_exoplanets.api_client.nasa_tap import URL_BASE, fetch_exoplanets


def _write_sample_csv(path: Path) -> None:
    df = pd.DataFrame(
        [
            {
                "pl_name": "Sample-1 b",
                "hostname": "Sample-1",
                "discoverymethod": "Transit",
                "disc_year": 2022,
                "disc_facility": "La Silla Observatory",
                "pl_orbper": 10.5,
                "pl_rade": 1.2,
                "pl_bmasse": 2.0,
                "pl_insol": 0.9,
                "pl_eqt": 260.0,
                "st_teff": 4500.0,
                "st_rad": 0.7,
                "sy_dist": 12.0,
                "sy_jmag": 9.5,
                "dec": -20.0,
                "ra": 120.0,
            }
        ]
    )
    df.to_csv(path, index=False)


def test_force_offline_loads_real_csv_backup() -> None:
    res = fetch_exoplanets(force_offline=True)
    assert res.source == "csv_backup"
    assert res.df is not None
    assert len(res.df) == 6473
    assert res.insecure_ssl is False
    assert "Plan B" in res.source_message_es
    assert "Plan B" in res.source_message_en
    assert URL_BASE not in res.source_message_es
    assert URL_BASE not in res.source_message_en


def test_env_force_offline_loads_csv(monkeypatch, tmp_path: Path) -> None:
    csv_path = tmp_path / "exoplanetas_nasa.csv"
    _write_sample_csv(csv_path)
    monkeypatch.setenv("ASTRO_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("EXO_FORCE_OFFLINE", "1")

    res = fetch_exoplanets(force_offline=False)
    assert res.source == "csv_backup"
    assert res.df is not None
    assert len(res.df) == 1


def test_live_api_uses_certifi_verify_by_default(monkeypatch, tmp_path: Path) -> None:
    csv_path = tmp_path / "exoplanetas_nasa.csv"
    monkeypatch.setenv("ASTRO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("EXO_FORCE_OFFLINE", raising=False)
    monkeypatch.delenv("ASTRO_ALLOW_INSECURE_SSL", raising=False)
    monkeypatch.delenv("ASTRO_CA_BUNDLE", raising=False)
    monkeypatch.delenv("REQUESTS_CA_BUNDLE", raising=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [
        {
            "pl_name": "Live-1 b",
            "hostname": "Live-1",
            "discoverymethod": "Transit",
            "disc_year": 2024,
            "disc_facility": "Paranal Observatory",
            "pl_orbper": 5.0,
            "pl_rade": 1.1,
            "pl_bmasse": 1.4,
            "pl_insol": 1.0,
            "pl_eqt": 288.0,
            "st_teff": 5700.0,
            "st_rad": 1.0,
            "sy_dist": 15.0,
            "sy_jmag": 8.0,
            "dec": -24.0,
            "ra": 50.0,
        }
    ]
    calls: list[dict] = []

    def fake_get(url, params=None, timeout=None, verify=None):
        calls.append({"url": url, "verify": verify})
        return mock_resp

    monkeypatch.setattr(requests, "get", fake_get)
    res = fetch_exoplanets(force_offline=False, csv_path=csv_path)

    assert res.source == "api"
    assert res.insecure_ssl is False
    assert res.df is not None
    assert len(res.df) == 1
    assert calls[0]["verify"] == certifi.where()
    assert csv_path.exists()


def test_ssl_error_does_not_bypass_tls_by_default(monkeypatch, tmp_path: Path) -> None:
    csv_path = tmp_path / "exoplanetas_nasa.csv"
    _write_sample_csv(csv_path)
    monkeypatch.setenv("ASTRO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("ASTRO_ALLOW_INSECURE_SSL", raising=False)
    monkeypatch.delenv("ASTRO_CA_BUNDLE", raising=False)
    monkeypatch.delenv("REQUESTS_CA_BUNDLE", raising=False)
    monkeypatch.delenv("EXO_FORCE_OFFLINE", raising=False)

    verify_args: list = []

    def fake_get(url, params=None, timeout=None, verify=None):
        verify_args.append(verify)
        raise requests.exceptions.SSLError("certificate verify failed")

    monkeypatch.setattr(requests, "get", fake_get)
    res = fetch_exoplanets(force_offline=False, csv_path=csv_path)

    assert verify_args == [certifi.where()]
    assert res.source == "csv_backup"
    assert res.insecure_ssl is False
    assert "TLS" in res.source_message_es
    assert "TLS" in res.source_message_en
    assert URL_BASE not in res.source_message_es


def test_ssl_error_never_bypasses_tls_even_with_legacy_env(
    monkeypatch, tmp_path: Path
) -> None:
    csv_path = tmp_path / "exoplanetas_nasa.csv"
    _write_sample_csv(csv_path)
    monkeypatch.setenv("ASTRO_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ASTRO_ALLOW_INSECURE_SSL", "1")
    monkeypatch.delenv("ASTRO_CA_BUNDLE", raising=False)
    monkeypatch.delenv("REQUESTS_CA_BUNDLE", raising=False)
    monkeypatch.delenv("EXO_FORCE_OFFLINE", raising=False)

    verify_args: list = []

    def fake_get(url, params=None, timeout=None, verify=None):
        verify_args.append(verify)
        raise requests.exceptions.SSLError("self-signed proxy")

    monkeypatch.setattr(requests, "get", fake_get)
    res = fetch_exoplanets(force_offline=False, csv_path=csv_path)

    assert verify_args == [certifi.where()]
    assert False not in verify_args
    assert res.source == "csv_backup"
    assert res.insecure_ssl is False
    assert "TLS" in res.source_message_es
    assert "TLS" in res.source_message_en


def test_custom_ca_bundle_passed_to_requests_verify(monkeypatch, tmp_path: Path) -> None:
    csv_path = tmp_path / "exoplanetas_nasa.csv"
    ca_file = tmp_path / "custom_ca.pem"
    ca_file.write_text(
        "-----BEGIN CERTIFICATE-----\nDUMMY\n-----END CERTIFICATE-----\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("ASTRO_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ASTRO_CA_BUNDLE", str(ca_file))
    monkeypatch.delenv("EXO_FORCE_OFFLINE", raising=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"pl_name": "Proxy-1 b", "pl_rade": 1.3}]

    calls: list[dict] = []

    def fake_get(url, params=None, timeout=None, verify=None):
        calls.append({"url": url, "verify": verify})
        return mock_resp

    monkeypatch.setattr(requests, "get", fake_get)
    res = fetch_exoplanets(force_offline=False, csv_path=csv_path)

    assert len(calls) == 1
    assert calls[0]["verify"] == str(ca_file.resolve())
    assert res.source == "api"
    assert res.insecure_ssl is False


def test_http_500_falls_back_cleanly_without_raw_urls(
    monkeypatch, tmp_path: Path
) -> None:
    csv_path = tmp_path / "exoplanetas_nasa.csv"
    _write_sample_csv(csv_path)
    monkeypatch.setenv("ASTRO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("EXO_FORCE_OFFLINE", raising=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    monkeypatch.setattr(requests, "get", lambda *a, **kw: mock_resp)

    res = fetch_exoplanets(force_offline=False, csv_path=csv_path)
    assert res.source == "csv_backup"
    assert "500" in res.source_message_es
    assert URL_BASE not in res.source_message_es
    assert URL_BASE not in res.source_message_en
