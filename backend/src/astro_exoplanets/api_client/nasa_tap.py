"""NASA Exoplanet Archive TAP client with local CSV fallback (Plan B)."""

from __future__ import annotations

import logging
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import requests

from astro_exoplanets.config import (
    get_ca_bundle_path,
    get_csv_backup_path,
    is_force_offline,
)

logger = logging.getLogger(__name__)

URL_BASE = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
CONSULTA_ADQL = (
    "select pl_name, hostname, discoverymethod, disc_year, disc_facility, "
    "pl_orbper, pl_rade, pl_bmasse, pl_insol, pl_eqt, st_teff, st_rad, "
    "sy_dist, sy_jmag, dec, ra from pscomppars"
)
COLUMNAS_CONSULTA = [
    "pl_name",
    "hostname",
    "discoverymethod",
    "disc_year",
    "disc_facility",
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


@dataclass(frozen=True)
class TapFetchResult:
    """Structured result from NASA TAP query or local CSV backup."""

    df: pd.DataFrame | None
    source: str
    source_message_es: str
    source_message_en: str
    insecure_ssl: bool = False


def json_a_tabla(datos_json: list[dict]) -> pd.DataFrame:
    """Convert TAP JSON records into a normalized DataFrame."""
    if not datos_json:
        return pd.DataFrame(columns=COLUMNAS_CONSULTA)

    filas: list[dict] = []
    for registro in datos_json:
        if not isinstance(registro, dict):
            continue
        fila = {col: registro.get(col) for col in COLUMNAS_CONSULTA}
        for clave, valor in registro.items():
            if clave not in fila:
                fila[clave] = valor
        filas.append(fila)

    if not filas:
        return pd.DataFrame(columns=COLUMNAS_CONSULTA)

    return pd.DataFrame(filas)


def _format_int_es(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def _format_int_en(value: int) -> str:
    return f"{value:,}"


def _load_csv_backup(
    reason_es: str,
    reason_en: str,
    csv_path: Path | None = None,
) -> TapFetchResult:
    """Load the local CSV backup (Plan B) without exposing internal paths or tracebacks."""
    ruta = csv_path or get_csv_backup_path()
    filename = ruta.name
    if not ruta.exists():
        return TapFetchResult(
            df=None,
            source="error",
            source_message_es=(
                f"{reason_es}. Tampoco existe el respaldo local {filename} para activar el Plan B."
            ),
            source_message_en=(
                f"{reason_en}. Local backup {filename} was not found for Plan B fallback."
            ),
            insecure_ssl=False,
        )

    try:
        df = pd.read_csv(ruta)
    except (
        OSError,
        pd.errors.EmptyDataError,
        pd.errors.ParserError,
        UnicodeDecodeError,
        ValueError,
    ) as exc:
        logger.debug("Failed to read local CSV backup %s: %s", ruta, exc)
        return TapFetchResult(
            df=None,
            source="error",
            source_message_es=f"{reason_es}. No fue posible leer el respaldo local {filename}.",
            source_message_en=f"{reason_en}. Local backup {filename} could not be read.",
            insecure_ssl=False,
        )

    if df.empty:
        return TapFetchResult(
            df=None,
            source="error",
            source_message_es=f"{reason_es}. El respaldo local {filename} está vacío.",
            source_message_en=f"{reason_en}. Local backup {filename} is empty.",
            insecure_ssl=False,
        )

    total_es = _format_int_es(len(df))
    total_en = _format_int_en(len(df))
    return TapFetchResult(
        df=df,
        source="csv_backup",
        source_message_es=(
            f"{reason_es}. Plan B activado: se cargaron {total_es} planetas "
            f"desde la copia local {filename}."
        ),
        source_message_en=(
            f"{reason_en}. Plan B active: loaded {total_en} planets "
            f"from local snapshot {filename}."
        ),
        insecure_ssl=False,
    )


def _should_refresh_backup(df: pd.DataFrame, csv_path: Path | None) -> bool:
    if csv_path is not None or os.getenv("ASTRO_DATA_DIR", "").strip():
        return True
    return len(df) >= 1000


def _atomic_write_csv(df: pd.DataFrame, target_csv: Path) -> None:
    """Atomically write DataFrame to CSV via a temporary file and os.replace."""
    target_csv.parent.mkdir(parents=True, exist_ok=True)
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=target_csv.parent,
            prefix=".exo_tmp_",
            suffix=".csv",
            delete=False,
        ) as tmp_file:
            tmp_path = Path(tmp_file.name)
            df.to_csv(tmp_file, index=False)
            tmp_file.flush()
            os.fsync(tmp_file.fileno())
        os.replace(tmp_path, target_csv)
    except Exception:
        if tmp_path is not None and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError as cleanup_exc:
                logger.debug("Failed to clean up temporary CSV %s: %s", tmp_path, cleanup_exc)
        raise


def fetch_exoplanets(
    force_offline: bool = False,
    csv_path: Path | None = None,
    timeout: float = 30.0,
) -> TapFetchResult:
    """Fetch confirmed exoplanets from NASA TAP or local CSV backup."""
    if force_offline or is_force_offline():
        return _load_csv_backup(
            "Modo sin conexión controlado activado",
            "Controlled offline mode enabled",
            csv_path=csv_path,
        )

    params = {"query": CONSULTA_ADQL, "format": "json"}

    try:
        respuesta = requests.get(
            URL_BASE,
            params=params,
            timeout=timeout,
            verify=get_ca_bundle_path(),
        )
    except requests.exceptions.SSLError:
        return _load_csv_backup(
            "Falló la verificación de certificado TLS al consultar el catálogo oficial",
            "TLS certificate verification failed while querying the exoplanet archive",
            csv_path=csv_path,
        )
    except requests.exceptions.Timeout:
        return _load_csv_backup(
            "Tiempo de espera agotado al consultar el archivo oficial de exoplanetas",
            "Connection timed out while querying the official exoplanet archive",
            csv_path=csv_path,
        )
    except requests.exceptions.RequestException:
        return _load_csv_backup(
            "No fue posible conectar con el archivo oficial de exoplanetas",
            "Could not connect to the official exoplanet archive",
            csv_path=csv_path,
        )

    if respuesta.status_code != 200:
        return _load_csv_backup(
            f"El servicio remoto respondió con código HTTP {respuesta.status_code}",
            f"Remote archive service returned HTTP status {respuesta.status_code}",
            csv_path=csv_path,
        )

    try:
        datos_json = respuesta.json()
    except ValueError:
        return _load_csv_backup(
            "El servicio remoto respondió HTTP 200 pero los datos no pudieron interpretarse",
            "Remote archive returned HTTP 200 with unreadable JSON payload",
            csv_path=csv_path,
        )

    if not isinstance(datos_json, list) or len(datos_json) == 0:
        return _load_csv_backup(
            "El servicio remoto respondió HTTP 200 pero no devolvió registros",
            "Remote archive returned HTTP 200 with no planet records",
            csv_path=csv_path,
        )

    df = json_a_tabla(datos_json)
    if _should_refresh_backup(df, csv_path):
        target_csv = csv_path or get_csv_backup_path()
        try:
            _atomic_write_csv(df, target_csv)
        except OSError as exc:
            logger.debug("Skipping local CSV snapshot refresh (%s): %s", target_csv, exc)

    total_es = _format_int_es(len(df))
    total_en = _format_int_en(len(df))
    msg_es = (
        f"Conectado al catálogo oficial de la NASA (HTTP 200): "
        f"se cargaron {total_es} planetas confirmados."
    )
    msg_en = (
        f"Connected to the official NASA catalog (HTTP 200): "
        f"loaded {total_en} confirmed planets."
    )

    return TapFetchResult(
        df=df,
        source="api",
        source_message_es=msg_es,
        source_message_en=msg_en,
        insecure_ssl=False,
    )
