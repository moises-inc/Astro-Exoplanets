import { useMemo } from 'react';
import {
  formatDecimal,
  formatInt,
  translateMethod,
  type TranslationDictionary,
} from '../../i18n';
import type { Lang, PlanetRecord } from '../../types/exoplanet';
import { summarizeChileObservatories, type ObservatoryChileRow } from '../../utils/analytics';
import {
  buildEvolucionAnualOption,
  buildMetodosOption,
  buildObservatoriosChileOption,
} from '../../utils/charts';
import { EChartPanel } from '../EChartPanel';
import { ResponsiveTable, type TableColumn } from '../ResponsiveTable';
import { TacReading } from '../TacReading';

interface TabHistoryMethodsProps {
  dict: TranslationDictionary;
  lang: Lang;
  filteredPlanets: PlanetRecord[];
}

export function TabHistoryMethods({
  dict,
  lang,
  filteredPlanets,
}: TabHistoryMethodsProps) {
  const evolutionOption = useMemo(
    () => buildEvolucionAnualOption(filteredPlanets, dict),
    [filteredPlanets, dict],
  );
  const methodsOption = useMemo(
    () => buildMetodosOption(filteredPlanets, dict, lang),
    [filteredPlanets, dict, lang],
  );
  const chileObsOption = useMemo(
    () => buildObservatoriosChileOption(filteredPlanets, dict),
    [filteredPlanets, dict],
  );

  const obsRows = useMemo(
    () => summarizeChileObservatories(filteredPlanets),
    [filteredPlanets],
  );

  const transitsCount = useMemo(
    () => filteredPlanets.filter((p) => p.es_transito).length,
    [filteredPlanets],
  );
  const rvCount = useMemo(
    () => filteredPlanets.filter((p) => p.discoverymethod === 'Radial Velocity').length,
    [filteredPlanets],
  );

  const chileTotal = useMemo(
    () => obsRows.reduce((acc, row) => acc + row.totalDiscovered, 0),
    [obsRows],
  );
  const leaderObs = obsRows.length > 0 ? obsRows[0].observatory : 'Chilean observatories';

  const obsColumns: TableColumn<ObservatoryChileRow>[] = useMemo(
    () => [
      { key: 'observatory', label: dict.tab1.obsColumns[0], render: (r) => r.observatory },
      {
        key: 'total',
        label: dict.tab1.obsColumns[1],
        numeric: true,
        render: (r) => formatInt(r.totalDiscovered, lang),
      },
      {
        key: 'rocky',
        label: dict.tab1.obsColumns[2],
        numeric: true,
        render: (r) => formatInt(r.rocky16, lang),
      },
      {
        key: 'hz',
        label: dict.tab1.obsColumns[3],
        numeric: true,
        render: (r) => formatInt(r.inHzOptimistic, lang),
      },
      {
        key: 'vis',
        label: dict.tab1.obsColumns[4],
        numeric: true,
        render: (r) => formatInt(r.visibleChile, lang),
      },
      {
        key: 'method',
        label: dict.tab1.obsColumns[5],
        render: (r) => translateMethod(r.primaryMethod, dict),
      },
      {
        key: 'firstYear',
        label: dict.tab1.obsColumns[6],
        numeric: true,
        render: (r) => (r.firstYear !== null ? String(r.firstYear) : '—'),
      },
      {
        key: 'lastYear',
        label: dict.tab1.obsColumns[7],
        numeric: true,
        render: (r) => (r.lastYear !== null ? String(r.lastYear) : '—'),
      },
      {
        key: 'medRad',
        label: dict.tab1.obsColumns[8],
        numeric: true,
        render: (r) => formatDecimal(r.medianRadius, 2, lang),
      },
      {
        key: 'medDist',
        label: dict.tab1.obsColumns[9],
        numeric: true,
        render: (r) => formatDecimal(r.medianDistLy, 1, lang),
      },
    ],
    [dict, lang],
  );

  return (
    <>
      <h2 className="section-heading">{dict.tab1.heading}</h2>

      <EChartPanel
        option={evolutionOption}
        alt={dict.tab1.evolutionAlt}
        height={420}
      />

      <TacReading
        overline={dict.tac.overline}
        text={dict.tab1.evolutionReading(
          formatInt(filteredPlanets.length, lang),
          formatInt(transitsCount, lang),
          formatInt(rvCount, lang),
        )}
      />

      <div className="grid-2col">
        <EChartPanel
          title={dict.tab1.methodsTitle}
          option={methodsOption}
          alt={dict.tab1.methodsAlt}
          height={380}
        />
        <EChartPanel
          title={dict.tab1.chileObsTitle}
          option={chileObsOption}
          alt={dict.tab1.chileObsAlt}
          height={380}
        />
      </div>

      <TacReading
        overline={dict.tac.overline}
        text={dict.tab1.methodsReading(formatInt(chileTotal, lang), leaderObs)}
      />

      {obsRows.length > 0 ? (
        <section className="table-section" aria-labelledby="obs-table-heading">
          <h3 id="obs-table-heading" className="subsection-heading">
            {dict.tab1.obsTableTitle}
          </h3>
          <ResponsiveTable
            titleId="obs-table-heading"
            columns={obsColumns}
            rows={obsRows}
            rowKey={(r) => r.observatory}
            emptyText={dict.common.noRows}
          />
        </section>
      ) : null}
    </>
  );
}
