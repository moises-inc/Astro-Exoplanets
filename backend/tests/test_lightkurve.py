"""Tests for Lightkurve MAST photometry client and disk caching."""

from __future__ import annotations

import json
from pathlib import Path

import astropy.units as u
import lightkurve as lk
import numpy as np

from astro_exoplanets.api_client import mast_lightkurve
from astro_exoplanets.api_client.mast_lightkurve import (
    MAX_DOWNLOAD_CANDIDATES,
    get_lightcurve,
    slugify_planet_name,
)
from astro_exoplanets.config import get_lightcurve_cache_dir


def test_slugify_planet_name() -> None:
    assert slugify_planet_name("TRAPPIST-1 e") == "trappist-1_e"
    assert slugify_planet_name("LHS 1140 b") == "lhs_1140_b"
    assert slugify_planet_name("TOI-700 d") == "toi-700_d"
    assert slugify_planet_name("..") == "unknown_planet"
    assert slugify_planet_name("...TRAPPIST-1 e...") == "trappist-1_e"


def test_offline_uncached_returns_unavailable(tmp_path: Path) -> None:
    res = get_lightcurve(
        pl_name="Uncached Test b",
        hostname="Uncached Test",
        pl_orbper=5.0,
        force_offline=True,
        cache_dir=tmp_path,
    )
    assert res["available"] is False
    assert res["cached"] is False
    assert res["reason_es"]
    assert res["reason_en"]


def test_disk_cache_hit_skips_mast_query(monkeypatch, tmp_path: Path) -> None:
    cached_payload = {
        "pl_name": "Cached-1 b",
        "hostname": "Cached-1",
        "available": True,
        "cached": False,
        "mission": "TESS",
        "author": "SPOC",
        "sector_or_quarter": "Sector 1",
        "period_days": 3.5,
        "raw_points_total": 100,
        "raw_series": [{"btjd": 2000.0, "flux": 1.0}],
        "folded_points": [{"phase_days": 0.0, "flux": 0.99}],
        "folded_binned": [{"phase_days": 0.0, "flux": 0.99, "count": 1}],
        "reason_es": None,
        "reason_en": None,
    }
    (tmp_path / "cached-1_b.json").write_text(
        json.dumps(cached_payload),
        encoding="utf-8",
    )

    def fail_search(*args, **kwargs):
        raise AssertionError("MAST search should not be called on cache hit")

    monkeypatch.setattr(mast_lightkurve.lk, "search_lightcurve", fail_search)
    res = get_lightcurve(
        pl_name="Cached-1 b",
        hostname="Cached-1",
        pl_orbper=3.5,
        force_offline=False,
        cache_dir=tmp_path,
    )
    assert res["available"] is True
    assert res["cached"] is True
    assert res["mission"] == "TESS"


def test_mocked_mast_download_downsamples_folds_bins_and_caches(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("EXO_FORCE_OFFLINE", raising=False)
    time = np.linspace(1500.0, 1527.0, 1200)
    flux = 1.0 + 0.0005 * np.sin(time)
    lc = lk.LightCurve(
        time=time,
        flux=flux,
        meta={"MISSION": "TESS", "AUTHOR": "SPOC", "SECTOR": 70},
    )

    class _FakeRow:
        def download(self):
            return lc

    class _FakeSearchResult:
        def __init__(self):
            self.table = {"author": ["SPOC"], "mission": ["TESS Sector 70"]}
            self.table = type(
                "Tbl",
                (),
                {
                    "colnames": ["author", "mission"],
                    "__getitem__": lambda _s, k: ["SPOC"]
                    if k == "author"
                    else ["TESS Sector 70"],
                },
            )()

        def __len__(self) -> int:
            return 1

        def __getitem__(self, idx: int):
            return _FakeRow()

    monkeypatch.setattr(
        mast_lightkurve.lk,
        "search_lightcurve",
        lambda *a, **kw: _FakeSearchResult(),
    )

    res = get_lightcurve(
        pl_name="Mocked-1 b",
        hostname="Mocked-1",
        pl_orbper=4.0,
        force_offline=False,
        cache_dir=tmp_path,
    )
    assert res["available"] is True
    assert res["raw_points_total"] <= 1200
    assert len(res["raw_series"]) <= 600
    assert len(res["folded_points"]) <= 600
    assert 1 <= len(res["folded_binned"]) <= 40
    assert all(-2.0 <= pt["phase_days"] <= 2.0 for pt in res["folded_points"])
    assert (tmp_path / "mocked-1_b.json").exists()


def test_precached_real_mast_targets_exist_and_valid() -> None:
    cache_dir = get_lightcurve_cache_dir()
    for name in ("TRAPPIST-1 e", "LHS 1140 b", "TOI-700 d"):
        path = cache_dir / f"{slugify_planet_name(name)}.json"
        assert path.exists(), f"Missing pre-cached MAST file: {path.name}"
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["available"] is True
        assert len(data["raw_series"]) > 0
        assert len(data["folded_points"]) > 0
        assert len(data["folded_binned"]) > 0
        assert isinstance(u.day, u.UnitBase)


def test_download_attempts_capped_at_max_candidates(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.delenv("EXO_FORCE_OFFLINE", raising=False)
    assert MAX_DOWNLOAD_CANDIDATES == 3
    attempts = {"count": 0}

    class _FailingRow:
        def download(self):
            attempts["count"] += 1
            raise RuntimeError("simulated download failure")

    class _FakeSearchResult:
        def __init__(self, count: int) -> None:
            self._count = count
            self.table = type(
                "Tbl",
                (),
                {
                    "colnames": ["author", "exptime"],
                    "__getitem__": lambda _s, k: (
                        ["SPOC"] * count if k == "author" else [120.0] * count
                    ),
                },
            )()

        def __len__(self) -> int:
            return self._count

        def __getitem__(self, idx: int) -> _FailingRow:
            return _FailingRow()

    monkeypatch.setattr(
        mast_lightkurve.lk,
        "search_lightcurve",
        lambda *a, **kw: _FakeSearchResult(10),
    )

    res = get_lightcurve(
        pl_name="Failing-10 b",
        hostname="Failing-10",
        pl_orbper=4.0,
        force_offline=False,
        cache_dir=tmp_path,
    )
    assert res["available"] is False
    assert attempts["count"] == MAX_DOWNLOAD_CANDIDATES
