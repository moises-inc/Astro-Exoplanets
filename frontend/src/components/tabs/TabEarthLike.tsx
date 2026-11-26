import { useMemo } from 'react';
import {
  formatDecimal,
  formatInt,
  formatPercent,
  translateMethod,
  type TranslationDictionary,
} from '../../i18n';
import type { HzMode, Lang, PlanetRecord } from '../../types/exoplanet';
import { getHzBounds, getTopCandidates, PC_TO_LY } from '../../utils/analytics';
import { buildZonaHabitableEsiOption } from '../../utils/charts';
import { buildCandidateColumns } from '../candidateColumns';
import { EChartPanel } from '../EChartPanel';
import { ResponsiveTable } from '../ResponsiveTable';
import { TacReading } from '../TacReading';

interface TabEarthLikeProps {
  dict: TranslationDictionary;
  lang: Lang;
  allPlanets: PlanetRecord[];
  filteredPlanets: PlanetRecord[];
  hzPlanets: PlanetRecord[];
  rMax: number;
  hzMode: HzMode;
  onInspectPlanet: (plName: string) => void;
}

interface FeaturedPlanetCardProps {
  name: string;
  planet: PlanetRecord | undefined;
  role: string;
  imageSrc: string;
  imageAlt: string;
  imageCaption: string;
  accent: 'cerulean' | 'highlight';
  dict: TranslationDictionary;
  lang: Lang;
  onInspectPlanet: (plName: string) => void;
}

function FeaturedPlanetCard({
  name,
  planet,
  role,
  imageSrc,
  imageAlt,
  imageCaption,
  accent,
  dict,
  lang,
  onInspectPlanet,
}: FeaturedPlanetCardProps) {
  const dotColor = accent === 'cerulean' ? 'var(--exo-cerulean)' : 'var(--exo-highlight)';

  const kvItems: Array<[string, string]> = planet
    ? [
        [
          dict.tab2.cardLabels.radius,
          `${formatDecimal(planet.pl_rade, 2, lang)} ${dict.common.earthRadiiUnit}`,
        ],
        [
          dict.tab2.cardLabels.insolation,
          `${formatDecimal(planet.pl_insol, 2, lang)} ${dict.common.earthLightUnit}`,
        ],
        [
          dict.tab2.cardLabels.temperature,
          `${formatInt(planet.pl_eqt - 273.15, lang)} ${dict.common.celsiusUnit} (${formatInt(planet.pl_eqt, lang)} ${dict.common.kelvinUnit})`,
        ],
        [
          dict.tab2.cardLabels.distance,
          `${formatDecimal(planet.sy_dist * PC_TO_LY, 1, lang)} ${dict.common.lightYearsUnit}`,
        ],
        [dict.tab2.cardLabels.esi, formatPercent(planet.esi * 100, 1, lang)],
        [dict.tab2.cardLabels.method, translateMethod(planet.discoverymethod, dict)],
        [
          dict.tab2.cardLabels.tsm,
          planet.tsm !== null
            ? planet.es_transito
              ? planet.tsm >= 10
                ? `${formatDecimal(planet.tsm, 1, lang)} (${dict.tab2.cardLabels.tsmJwstReady})`
                : formatDecimal(planet.tsm, 1, lang)
              : `${formatDecimal(planet.tsm, 1, lang)} (${dict.tab2.cardLabels.tsmNoTransit})`
            : dict.common.notApplicable,
        ],
        [
          dict.tab2.cardLabels.visibleChile,
          planet.visible_chile ? dict.tab2.cardLabels.chileYes : dict.tab2.cardLabels.chileNo,
        ],
      ]
    : [[dict.common.notAvailable, dict.tab2.missingFeatured]];

  return (
    <article className="featured-card">
      <figure className="featured-card-media">
        <img src={imageSrc} alt={imageAlt} loading="lazy" />
        <figcaption>{imageCaption}</figcaption>
      </figure>
      <div className="featured-card-body">
        <div className="featured-card-title-row">
          <span
            className="status-dot"
            style={{ backgroundColor: dotColor }}
            aria-hidden="true"
          />
          <h4 className="subsection-heading">{name}</h4>
        </div>
        <p className="featured-card-role">{role}</p>
        <ul className="kv-list">
          {kvItems.map(([k, v]) => (
            <li key={k} className="kv-row">
              <span className="kv-key">{k}</span>
              <span className="kv-val">{v}</span>
            </li>
          ))}
        </ul>
        {planet ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onInspectPlanet(planet.pl_name)}
          >
            {dict.common.inspectButton}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function TabEarthLike({
  dict,
  lang,
  allPlanets,
  filteredPlanets,
  hzPlanets,
  rMax,
  hzMode,
  onInspectPlanet,
}: TabEarthLikeProps) {
  const hzChartOption = useMemo(
    () => buildZonaHabitableEsiOption(filteredPlanets, rMax, hzMode, dict, lang),
    [filteredPlanets, rMax, hzMode, dict, lang],
  );

  const { min: sMin, max: sMax } = getHzBounds(hzMode);
  const hzShort =
    hzMode === 'Conservadora' ? dict.common.hzStrictShort : dict.common.hzWideShort;

  const trappist1e = useMemo(
    () => allPlanets.find((p) => p.pl_name === 'TRAPPIST-1 e'),
    [allPlanets],
  );
  const teegardenB = useMemo(
    () => allPlanets.find((p) => p.pl_name === "Teegarden's Star b"),
    [allPlanets],
  );

  const top15Esi = useMemo(
    () =>
      getTopCandidates(filteredPlanets, {
        n: 15,
        onlyTransit: false,
        onlyChile: false,
        hzMode,
        rMax,
        sortBy: 'esi',
      }),
    [filteredPlanets, hzMode, rMax],
  );

  const columns = useMemo(
    () => buildCandidateColumns(dict, lang, onInspectPlanet, false),
    [dict, lang, onInspectPlanet],
  );

  return (
    <>
      <h2 className="section-heading">{dict.tab2.heading}</h2>

      <EChartPanel
        option={hzChartOption}
        alt={dict.tab2.hzChartAlt}
        height={480}
        onSelectPlanet={onInspectPlanet}
      />

      <TacReading
        overline={dict.tac.overline}
        text={dict.tab2.hzReading(
          formatDecimal(rMax, 1, lang),
          hzShort,
          formatDecimal(sMin, 2, lang),
          formatDecimal(sMax, 2, lang),
          formatInt(hzPlanets.length, lang),
        )}
      />

      <h3 className="subsection-heading">{dict.tab2.featuredTitle}</h3>
      <div className="grid-2col">
        <FeaturedPlanetCard
          name="TRAPPIST-1 e"
          planet={trappist1e}
          role={dict.tab2.trappistRole}
          imageSrc="/assets/mundo_trappist1e.png"
          imageAlt={dict.tab2.trappistAlt}
          imageCaption={dict.tab2.trappistCaption}
          accent="cerulean"
          dict={dict}
          lang={lang}
          onInspectPlanet={onInspectPlanet}
        />
        <FeaturedPlanetCard
          name="Teegarden's Star b"
          planet={teegardenB}
          role={dict.tab2.teegardenRole}
          imageSrc="/assets/mundo_teegarden_b.png"
          imageAlt={dict.tab2.teegardenAlt}
          imageCaption={dict.tab2.teegardenCaption}
          accent="highlight"
          dict={dict}
          lang={lang}
          onInspectPlanet={onInspectPlanet}
        />
      </div>

      <section className="table-section" aria-labelledby="top15-esi-heading">
        <h3 id="top15-esi-heading" className="subsection-heading">
          {dict.tab2.top15Title(hzShort, formatDecimal(rMax, 1, lang))}
        </h3>
        <ResponsiveTable
          titleId="top15-esi-heading"
          columns={columns}
          rows={top15Esi}
          rowKey={(p) => p.pl_name}
          emptyText={dict.tab2.top15Empty}
          onRowClick={(p) => onInspectPlanet(p.pl_name)}
        />
      </section>
    </>
  );
}
