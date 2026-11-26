"""External API clients for NASA Exoplanet Archive TAP and MAST light curves."""

from astro_exoplanets.api_client.mast_lightkurve import (
    get_lightcurve,
    slugify_planet_name,
)
from astro_exoplanets.api_client.nasa_tap import (
    COLUMNAS_CONSULTA,
    CONSULTA_ADQL,
    URL_BASE,
    TapFetchResult,
    fetch_exoplanets,
    json_a_tabla,
)

__all__ = [
    "COLUMNAS_CONSULTA",
    "CONSULTA_ADQL",
    "TapFetchResult",
    "URL_BASE",
    "fetch_exoplanets",
    "get_lightcurve",
    "json_a_tabla",
    "slugify_planet_name",
]
