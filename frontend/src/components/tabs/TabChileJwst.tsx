import { useMemo } from 'react';
import {
  formatDecimal,
  formatInt,
  formatPercent,
  type TranslationDictionary,
} from '../../i18n';
import type { HzMode, Lang, PlanetRecord } from '../../types/exoplanet';
import { getTopCandidates, PC_TO_LY } from '../../utils/analytics';
import {
  buildDistanciaEsiOption,
  buildMapaCieloChileOption,
  buildRadarCandidatosOption,
  buildTsmRankingOption,
} from '../../utils/charts';
import { buildCandidateColumns } from '../candidateColumns';
import { EChartPanel } from '../EChartPanel';
import { ResponsiveTable } from '../ResponsiveTable';
import { TacReading } from '../TacReading';

interface TabChileJwstProps {
  dict: TranslationDictionary;
  lang: Lang;
  filteredPlanets: PlanetRecord[];
  hzPlanets: PlanetRecord[];
  rMax: number;
  hzMode: HzMode;
  onInspectPlanet: (plName: string) => void;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function TabChileJwst({
  dict,
  lang,
  filteredPlanets,
  hzPlanets,
  rMax,
  hzMode,
  onInspectPlanet,
}: TabChileJwstProps) {
  const hzShort =
    hzMode === 'Conservadora' ? dict.common.hzStrictShort : dict.common.hzWideShort;

  const subTr = useMemo(
    () => hzPlanets.filter((p) => p.discoverymethod === 'Transit'),
    [hzPlanets],
  );
  const subRv = useMemo(
    () => hzPlanets.filter((p) => p.discoverymethod === 'Radial Velocity'),
    [hzPlanets],
  );

  const distTr =
    subTr.length > 0
      ? `${formatDecimal(medianOf(subTr.map((p) => p.sy_dist)) * PC_TO_LY, 1, lang)} ${dict.common.lightYearsUnit}`
      : '—';
  const esiTr =
    subTr.length > 0
      ? formatPercent(medianOf(subTr.map((p) => p.esi)) * 100, 1, lang)
      : '—';
  const tsm10Tr = subTr.filter((p) => p.tsm !== null && p.tsm >= 10).length;
  const visTr = subTr.filter((p) => p.visible_chile).length;

  const distRv =
    subRv.length > 0
      ? `${formatDecimal(medianOf(subRv.map((p) => p.sy_dist)) * PC_TO_LY, 1, lang)} ${dict.common.lightYearsUnit}`
      : '—';
  const esiRv =
    subRv.length > 0
      ? formatPercent(medianOf(subRv.map((p) => p.esi)) * 100, 1, lang)
      : '—';
  const visRv = subRv.filter((p) => p.visible_chile).length;

  const distEsiOption = useMemo(
    () => buildDistanciaEsiOption(hzPlanets, dict, lang),
    [hzPlanets, dict, lang],
  );
  const tsmRankingOption = useMemo(
    () => buildTsmRankingOption(hzPlanets, dict, lang),
    [hzPlanets, dict, lang],
  );
  const skyMapOption = useMemo(
    () => buildMapaCieloChileOption(filteredPlanets, rMax, hzMode, dict, lang),
    [filteredPlanets, rMax, hzMode, dict, lang],
  );
  const radarOption = useMemo(
    () => buildRadarCandidatosOption(hzPlanets, dict),
    [hzPlanets, dict],
  );

  const prioritizationText = useMemo(() => {
    if (hzPlanets.length === 0) return dict.tab3.prioritizationEmpty;
    const parts = [
      dict.tab3.prioritizationSummary(
        formatInt(hzPlanets.length, lang),
        formatInt(subTr.length, lang),
        formatInt(subRv.length, lang),
      ),
    ];
    if (subRv.length > 0) {
      const closestRv = [...subRv].sort((a, b) => a.sy_dist - b.sy_dist)[0];
      parts.push(
        dict.tab3.prioritizationRvHighlight(
          closestRv.pl_name,
          formatDecimal(closestRv.sy_dist * PC_TO_LY, 1, lang),
          formatPercent(closestRv.esi * 100, 1, lang),
        ),
      );
    }
    const validTr = subTr.filter((p) => p.tsm !== null && Number.isFinite(p.tsm));
    if (validTr.length > 0) {
      const topTr = [...validTr].sort((a, b) => (b.tsm ?? 0) - (a.tsm ?? 0))[0];
      parts.push(
        dict.tab3.prioritizationTsmHighlight(
          topTr.pl_name,
          formatDecimal(topTr.tsm, 1, lang),
        ),
      );
    }
    return parts.join(' ');
  }, [hzPlanets.length, subTr, subRv, dict, lang]);

  const visChileHz = hzPlanets.filter((p) => p.visible_chile).length;
  const northOnlyHz = Math.max(hzPlanets.length - visChileHz, 0);
  const notables = ['TRAPPIST-1 e', 'TOI-700 d', 'LP 890-9 c', 'LHS 1140 b', 'Ross 128 b'].filter(
    (name) => hzPlanets.some((p) => p.pl_name === name),
  );

  const topTsmWaitlist = useMemo(
    () =>
      getTopCandidates(filteredPlanets, {
        n: 15,
        onlyTransit: true,
        onlyChile: false,
        hzMode,
        rMax,
        sortBy: 'tsm',
      }),
    [filteredPlanets, hzMode, rMax],
  );

  const columns = useMemo(
    () => buildCandidateColumns(dict, lang, onInspectPlanet, false),
    [dict, lang, onInspectPlanet],
  );

  return (
    <>
      <h2 className="section-heading">{dict.tab3.heading}</h2>

      <div className="grid-asym">
        <figure className="hero-figure">
          <img
            src="/assets/telescopios_chile_jwst.png"
            alt={dict.tab3.jwstDiagramAlt}
            loading="lazy"
          />
          <figcaption>{dict.tab3.jwstDiagramCaption}</figcaption>
        </figure>

        <div className="compare-stack">
          <section className="exo-compare-panel">
            <div className="compare-title-row">
              <span className="status-dot status-dot--api" aria-hidden="true" />
              <h3 className="subsection-heading">{dict.tab3.jwstPanelTitle}</h3>
            </div>
            <p className="compare-subtitle">{dict.tab3.jwstPanelSub}</p>
            <ul className="kv-list">
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.candidatesHz}</span>
                <span className="kv-val">{formatInt(subTr.length, lang)}</span>
              </li>
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.medianDist}</span>
                <span className="kv-val">{distTr}</span>
              </li>
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.medianEsi}</span>
                <span className="kv-val">{esiTr}</span>
              </li>
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.tsm10}</span>
                <span className="kv-val">{formatInt(tsm10Tr, lang)}</span>
              </li>
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.visibleChile}</span>
                <span className="kv-val">{formatInt(visTr, lang)}</span>
              </li>
            </ul>
          </section>

          <section className="exo-compare-panel">
            <div className="compare-title-row">
              <span
                className="status-dot"
                style={{ backgroundColor: 'var(--exo-accent)' }}
                aria-hidden="true"
              />
              <h3 className="subsection-heading">{dict.tab3.eltPanelTitle}</h3>
            </div>
            <p className="compare-subtitle">{dict.tab3.eltPanelSub}</p>
            <ul className="kv-list">
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.candidatesHz}</span>
                <span className="kv-val">{formatInt(subRv.length, lang)}</span>
              </li>
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.medianDist}</span>
                <span className="kv-val">{distRv}</span>
              </li>
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.medianEsi}</span>
                <span className="kv-val">{esiRv}</span>
              </li>
              <li className="kv-row">
                <span className="kv-key">{dict.tab3.panelItems.visibleChile}</span>
                <span className="kv-val">{formatInt(visRv, lang)}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <div className="grid-2col">
        <EChartPanel
          title={dict.tab3.distChartTitle}
          option={distEsiOption}
          alt={dict.tab3.distChartAlt}
          height={430}
          onSelectPlanet={onInspectPlanet}
        />
        <EChartPanel
          title={dict.tab3.tsmChartTitle}
          option={tsmRankingOption}
          alt={dict.tab3.tsmChartAlt}
          height={430}
          onSelectPlanet={onInspectPlanet}
        />
      </div>

      <TacReading overline={dict.tac.overline} text={prioritizationText} />

      <EChartPanel
        title={dict.tab3.skyMapTitle}
        option={skyMapOption}
        alt={dict.tab3.skyMapAlt}
        height={460}
        onSelectPlanet={onInspectPlanet}
      />

      <TacReading
        overline={dict.tac.overline}
        text={dict.tab3.skyMapReading(
          formatInt(hzPlanets.length, lang),
          formatInt(visChileHz, lang),
          formatInt(northOnlyHz, lang),
          notables,
        )}
      />

      <EChartPanel
        title={dict.tab3.radarTitle(hzShort, formatDecimal(rMax, 1, lang))}
        option={radarOption}
        alt={dict.tab3.radarAlt}
        height={430}
      />

      <TacReading overline={dict.tac.overline} text={dict.tab3.radarReading} />

      <section className="table-section" aria-labelledby="jwst-waitlist-heading">
        <h3 id="jwst-waitlist-heading" className="subsection-heading">
          {dict.tab3.waitlistTitle(hzShort, formatDecimal(rMax, 1, lang))}
        </h3>
        <ResponsiveTable
          titleId="jwst-waitlist-heading"
          columns={columns}
          rows={topTsmWaitlist}
          rowKey={(p) => p.pl_name}
          emptyText={dict.tab3.waitlistEmpty}
          onRowClick={(p) => onInspectPlanet(p.pl_name)}
        />
      </section>
    </>
  );
}
