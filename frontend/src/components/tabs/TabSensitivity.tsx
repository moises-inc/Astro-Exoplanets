import { useMemo } from 'react';
import { formatDecimal, formatInt, type TranslationDictionary } from '../../i18n';
import type { DistTsmRow, FultonHzRow, Lang, PlanetRecord } from '../../types/exoplanet';
import { computeSensitivity, PC_TO_LY } from '../../utils/analytics';
import {
  buildSensibilidadDistTsmOption,
  buildSensibilidadFultonOption,
} from '../../utils/charts';
import { EChartPanel } from '../EChartPanel';
import { ResponsiveTable, type TableColumn } from '../ResponsiveTable';
import { TacReading } from '../TacReading';

interface TabSensitivityProps {
  dict: TranslationDictionary;
  lang: Lang;
  filteredPlanets: PlanetRecord[];
}

export function TabSensitivity({ dict, lang, filteredPlanets }: TabSensitivityProps) {
  const sensitivity = useMemo(() => computeSensitivity(filteredPlanets), [filteredPlanets]);

  const fultonOption = useMemo(
    () => buildSensibilidadFultonOption(sensitivity.fulton_hz, dict, lang),
    [sensitivity.fulton_hz, dict, lang],
  );
  const distTsmOption = useMemo(
    () => buildSensibilidadDistTsmOption(sensitivity.dist_tsm, dict, lang),
    [sensitivity.dist_tsm, dict, lang],
  );

  const tacText = useMemo(() => {
    const findVal = (zone: string, radius: number, field: keyof FultonHzRow): number => {
      const hit = sensitivity.fulton_hz.find(
        (r) => r.zona_habitable === zone && Math.abs(r.radio_max_rt - radius) < 1e-6,
      );
      return hit ? Number(hit[field]) : 0;
    };

    const c16Tot = formatInt(findVal('Conservadora', 1.6, 'total_hz'), lang);
    const c18Tot = formatInt(findVal('Conservadora', 1.8, 'total_hz'), lang);
    const c20Tot = formatInt(findVal('Conservadora', 2.0, 'total_hz'), lang);
    const o16Tot = formatInt(findVal('Optimista', 1.6, 'total_hz'), lang);
    const o18Tot = formatInt(findVal('Optimista', 1.8, 'total_hz'), lang);
    const o20Tot = formatInt(findVal('Optimista', 2.0, 'total_hz'), lang);

    const c16Cl = findVal('Conservadora', 1.6, 'transitantes_chile_tsm10');
    const c18Cl = findVal('Conservadora', 1.8, 'transitantes_chile_tsm10');
    const c20Cl = findVal('Conservadora', 2.0, 'transitantes_chile_tsm10');
    const o16Cl = findVal('Optimista', 1.6, 'transitantes_chile_tsm10');
    const o18Cl = findVal('Optimista', 1.8, 'transitantes_chile_tsm10');
    const o20Cl = findVal('Optimista', 2.0, 'transitantes_chile_tsm10');

    const lhsPresent = filteredPlanets.some((p) => p.pl_name === 'LHS 1140 b');
    const lhsNote = lhsPresent && (c18Cl > c16Cl || o18Cl > o16Cl);

    return dict.tab4.sensitivityReading(
      c16Tot,
      c18Tot,
      c20Tot,
      o16Tot,
      o18Tot,
      o20Tot,
      formatInt(c16Cl, lang),
      formatInt(c18Cl, lang),
      formatInt(c20Cl, lang),
      formatInt(o16Cl, lang),
      formatInt(o18Cl, lang),
      formatInt(o20Cl, lang),
      lhsNote,
    );
  }, [sensitivity.fulton_hz, filteredPlanets, dict, lang]);

  const fultonCols: TableColumn<FultonHzRow>[] = useMemo(
    () => [
      {
        key: 'zone',
        label: dict.tab4.scenario1Cols[0],
        render: (r) =>
          r.zona_habitable.startsWith('Cons')
            ? dict.common.hzStrictShort
            : dict.common.hzWideShort,
      },
      {
        key: 'range',
        label: dict.tab4.scenario1Cols[1],
        render: (r) =>
          r.rango_insolacion.includes('0.36')
            ? `${formatDecimal(0.36, 2, lang)}–${formatDecimal(1.11, 2, lang)} ${dict.common.earthLightUnit}`
            : `${formatDecimal(0.25, 2, lang)}–${formatDecimal(1.5, 2, lang)} ${dict.common.earthLightUnit}`,
      },
      {
        key: 'rmax',
        label: dict.tab4.scenario1Cols[2],
        numeric: true,
        render: (r) => formatDecimal(r.radio_max_rt, 1, lang),
      },
      {
        key: 'total',
        label: dict.tab4.scenario1Cols[3],
        numeric: true,
        render: (r) => formatInt(r.total_hz, lang),
      },
      {
        key: 'trans',
        label: dict.tab4.scenario1Cols[4],
        numeric: true,
        render: (r) => formatInt(r.transitantes, lang),
      },
      {
        key: 'chile',
        label: dict.tab4.scenario1Cols[5],
        numeric: true,
        render: (r) => formatInt(r.visibles_chile, lang),
      },
      {
        key: 'tsm10',
        label: dict.tab4.scenario1Cols[6],
        numeric: true,
        render: (r) => formatInt(r.transitantes_chile_tsm10, lang),
      },
    ],
    [dict, lang],
  );

  const distTsmCols: TableColumn<DistTsmRow>[] = useMemo(
    () => [
      {
        key: 'dist',
        label: dict.tab4.scenario2Cols[0],
        numeric: true,
        render: (r) => formatInt(Math.round(r.distancia_max_pc * PC_TO_LY), lang),
      },
      {
        key: 'tsm',
        label: dict.tab4.scenario2Cols[1],
        numeric: true,
        render: (r) => formatInt(r.tsm_minimo, lang),
      },
      {
        key: 'total',
        label: dict.tab4.scenario2Cols[2],
        numeric: true,
        render: (r) => formatInt(r.total_candidatos, lang),
      },
      {
        key: 'trans',
        label: dict.tab4.scenario2Cols[3],
        numeric: true,
        render: (r) => formatInt(r.transitantes, lang),
      },
      {
        key: 'chile',
        label: dict.tab4.scenario2Cols[4],
        numeric: true,
        render: (r) => formatInt(r.visibles_chile, lang),
      },
      {
        key: 'both',
        label: dict.tab4.scenario2Cols[5],
        numeric: true,
        render: (r) => formatInt(r.transitantes_visibles_chile, lang),
      },
    ],
    [dict, lang],
  );

  return (
    <>
      <h2 className="section-heading">{dict.tab4.heading}</h2>

      <div className="grid-2col">
        <EChartPanel
          title={dict.tab4.fultonChartTitle}
          option={fultonOption}
          alt={dict.tab4.fultonChartAlt}
          height={420}
        />
        <EChartPanel
          title={dict.tab4.distTsmChartTitle}
          option={distTsmOption}
          alt={dict.tab4.distTsmChartAlt}
          height={420}
        />
      </div>

      <TacReading overline={dict.tac.overline} text={tacText} />

      <section className="table-section" aria-labelledby="sens1-heading">
        <h3 id="sens1-heading" className="subsection-heading">
          {dict.tab4.scenario1Title}
        </h3>
        <ResponsiveTable
          titleId="sens1-heading"
          columns={fultonCols}
          rows={sensitivity.fulton_hz}
          rowKey={(r) => `${r.zona_habitable}-${r.radio_max_rt}`}
          emptyText={dict.tab4.emptyTable}
        />
      </section>

      <section className="table-section" aria-labelledby="sens2-heading">
        <h3 id="sens2-heading" className="subsection-heading">
          {dict.tab4.scenario2Title}
        </h3>
        <ResponsiveTable
          titleId="sens2-heading"
          columns={distTsmCols}
          rows={sensitivity.dist_tsm}
          rowKey={(r) => `${r.distancia_max_pc}-${r.tsm_minimo}`}
          emptyText={dict.tab4.emptyTable}
        />
      </section>
    </>
  );
}
