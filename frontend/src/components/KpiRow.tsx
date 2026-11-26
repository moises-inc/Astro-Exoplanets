import { formatDecimal, formatInt, formatPercent, type TranslationDictionary } from '../i18n';
import type { HzMode, Lang, PlanetRecord } from '../types/exoplanet';
import { PC_TO_LY } from '../utils/analytics';

interface KpiRowProps {
  dict: TranslationDictionary;
  lang: Lang;
  filteredCount: number;
  initialCount: number;
  hzPlanets: PlanetRecord[];
  filteredPlanets: PlanetRecord[];
  rMax: number;
  hzMode: HzMode;
  onInspectPlanet: (plName: string) => void;
}

export function KpiRow({
  dict,
  lang,
  filteredCount,
  initialCount,
  hzPlanets,
  filteredPlanets,
  rMax,
  hzMode,
  onInspectPlanet,
}: KpiRowProps) {
  const pctFiltered = initialCount > 0 ? (filteredCount / initialCount) * 100 : 0;
  const hzShort =
    hzMode === 'Conservadora' ? dict.common.hzStrictShort : dict.common.hzWideShort;

  const visibleChileHz = hzPlanets.filter((p) => p.visible_chile).length;
  const jwstReadyCount = hzPlanets.filter(
    (p) => p.es_transito && p.visible_chile && p.tsm !== null && p.tsm >= 10,
  ).length;

  let bestPlanet: PlanetRecord | null = null;
  let outsideHz = false;
  if (hzPlanets.length > 0) {
    bestPlanet = [...hzPlanets].sort((a, b) => b.esi - a.esi)[0];
  } else if (filteredPlanets.length > 0) {
    bestPlanet = [...filteredPlanets].sort((a, b) => b.esi - a.esi)[0];
    outsideHz = true;
  }

  return (
    <section className="kpi-grid" aria-label="TAC metrics">
      <div className="kpi-card">
        <span className="kpi-label">{dict.kpi.filteredLabel}</span>
        <span className="kpi-value">{formatInt(filteredCount, lang)}</span>
        <span className="kpi-delta">
          {dict.kpi.filteredDelta(
            formatPercent(pctFiltered, 1, lang),
            formatInt(initialCount, lang),
          )}
        </span>
      </div>

      <div className="kpi-card">
        <span className="kpi-label">{dict.kpi.hzLabel}</span>
        <span className="kpi-value">{formatInt(hzPlanets.length, lang)}</span>
        <span className="kpi-delta">
          {dict.kpi.hzDelta(formatDecimal(rMax, 1, lang), hzShort)}
        </span>
      </div>

      <div className="kpi-card">
        <span className="kpi-label">{dict.kpi.chileLabel}</span>
        <span className="kpi-value">{formatInt(visibleChileHz, lang)}</span>
        <span className="kpi-delta">
          {dict.kpi.chileDelta(formatInt(jwstReadyCount, lang))}
        </span>
      </div>

      {bestPlanet ? (
        <button
          type="button"
          className="kpi-card kpi-card--interactive"
          onClick={() => onInspectPlanet(bestPlanet.pl_name)}
        >
          <span className="kpi-label">{dict.kpi.bestLabel}</span>
          <span className="kpi-value">{bestPlanet.pl_name}</span>
          <span className="kpi-delta">
            {dict.kpi.bestDelta(
              formatPercent(bestPlanet.esi * 100, 1, lang),
              formatDecimal(bestPlanet.sy_dist * PC_TO_LY, 1, lang),
              outsideHz,
            )}
          </span>
          <span className="kpi-inspect-hint">{dict.kpi.inspectHint} →</span>
        </button>
      ) : (
        <div className="kpi-card">
          <span className="kpi-label">{dict.kpi.bestLabel}</span>
          <span className="kpi-value">{dict.kpi.bestEmpty}</span>
          <span className="kpi-delta">{dict.kpi.bestEmptyDelta}</span>
        </div>
      )}
    </section>
  );
}
