import {
  formatDecimal,
  formatInt,
  translateMethod,
  type TranslationDictionary,
} from '../i18n';
import type { Lang, PlanetRecord } from '../types/exoplanet';
import { PC_TO_LY } from '../utils/analytics';
import type { TableColumn } from './ResponsiveTable';

export function buildCandidateColumns(
  dict: TranslationDictionary,
  lang: Lang,
  onInspectPlanet: (plName: string) => void,
  sortable = false,
): TableColumn<PlanetRecord>[] {
  return [
    {
      key: 'pl_name',
      label: dict.candidateColumns.planet,
      sortable,
      render: (p) => (
        <button
          type="button"
          className="table-planet-btn"
          onClick={() => onInspectPlanet(p.pl_name)}
        >
          {p.pl_name}
        </button>
      ),
    },
    {
      key: 'hostname',
      label: dict.candidateColumns.star,
      sortable,
      render: (p) => p.hostname ?? dict.common.notAvailable,
    },
    {
      key: 'discoverymethod',
      label: dict.candidateColumns.method,
      sortable,
      render: (p) => translateMethod(p.discoverymethod, dict),
    },
    {
      key: 'disc_year',
      label: dict.candidateColumns.year,
      numeric: true,
      sortable,
      render: (p) => (p.disc_year !== null ? Math.round(p.disc_year) : '—'),
    },
    {
      key: 'pl_rade',
      label: dict.candidateColumns.radius,
      numeric: true,
      sortable,
      render: (p) => formatDecimal(p.pl_rade, 2, lang),
    },
    {
      key: 'pl_insol',
      label: dict.candidateColumns.insolation,
      numeric: true,
      sortable,
      render: (p) => formatDecimal(p.pl_insol, 2, lang),
    },
    {
      key: 'pl_eqt',
      label: dict.candidateColumns.tempC,
      numeric: true,
      sortable,
      render: (p) => formatInt(p.pl_eqt - 273.15, lang),
    },
    {
      key: 'sy_dist',
      label: dict.candidateColumns.distanceLy,
      numeric: true,
      sortable,
      render: (p) => formatDecimal(p.sy_dist * PC_TO_LY, 1, lang),
    },
    {
      key: 'esi',
      label: dict.candidateColumns.esiPct,
      numeric: true,
      sortable,
      render: (p) => formatDecimal(p.esi * 100, 1, lang),
    },
    {
      key: 'tsm',
      label: dict.candidateColumns.tsm,
      numeric: true,
      sortable,
      render: (p) => (p.tsm !== null ? formatDecimal(p.tsm, 1, lang) : '—'),
    },
    {
      key: 'visible_chile',
      label: dict.candidateColumns.visibleChile,
      sortable,
      render: (p) => (p.visible_chile ? dict.common.yes : dict.common.no),
    },
  ];
}
