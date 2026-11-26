"""Tests for Chilean observatory seasonal observability via Astropy."""

from __future__ import annotations

from astro_exoplanets.astrophysics.observability import (
    CHILE_OBSERVATORIES,
    compute_planet_observability,
)


def test_five_chilean_observatories_defined() -> None:
    assert set(CHILE_OBSERVATORIES.keys()) == {
        "paranal",
        "lasilla",
        "lascampanas",
        "ctio",
        "alma",
    }


def test_trappist1e_observability_from_chile() -> None:
    result = compute_planet_observability(
        pl_name="TRAPPIST-1 e",
        ra_deg=346.6263919,
        dec_deg=-5.0434618,
    )
    assert result["pl_name"] == "TRAPPIST-1 e"
    assert result["observable_airmass_2"] is True
    assert result["min_airmass"] is not None
    assert 1.0 <= result["min_airmass"] <= 1.2
    assert result["max_altitude_deg"] is not None
    assert result["max_altitude_deg"] > 60.0
    assert len(result["monthly_hours_airmass_le_2"]) == 12
    assert sum(result["monthly_hours_airmass_le_2"]) > 0.0
    assert len(result["best_months"]) >= 1
    assert set(result["observatories"].keys()) == set(CHILE_OBSERVATORIES.keys())


def test_far_northern_target_not_observable_at_airmass_2() -> None:
    result = compute_planet_observability(
        pl_name="Polar-North b",
        ra_deg=180.0,
        dec_deg=80.0,
    )
    assert result["observable_airmass_2"] is False
    assert result["min_airmass"] is None
    assert result["monthly_hours_airmass_le_2"] == [0.0] * 12
    assert result["best_months"] == []


def test_missing_coordinates_handled_gracefully() -> None:
    result = compute_planet_observability(
        pl_name="No-Coords b",
        ra_deg=None,
        dec_deg=None,
    )
    assert result["observable_airmass_2"] is False
    assert result["min_airmass"] is None
    assert result["max_altitude_deg"] is None
    assert result["monthly_hours_airmass_le_2"] == [0.0] * 12
