import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPlanetLightcurve, fetchPlanetObservability } from '../api/client';
import {
  formatDecimal,
  formatInt,
  formatPercent,
  shortObservatoryName,
  translateMethod,
  translateRadiusCategory,
  type TranslationDictionary,
} from '../i18n';
import type {
  Lang,
  LightcurveResponse,
  ObservabilityResponse,
  ObservatorySiteVisibility,
  PlanetRecord,
} from '../types/exoplanet';
import { PC_TO_LY } from '../utils/analytics';
import { buildLightcurveOption, buildObservabilityMonthlyOption } from '../utils/charts';
import { EChartPanel } from './EChartPanel';
import { ResponsiveTable, type TableColumn } from './ResponsiveTable';

declare module 'react' {
  interface DialogHTMLAttributes<T> {
    closedby?: 'any' | 'closerequest' | 'none';
  }
}

interface PlanetInspectorDialogProps {
  planet: PlanetRecord | null;
  dict: TranslationDictionary;
  lang: Lang;
  onClose: () => void;
}

export function PlanetInspectorDialog({
  planet,
  dict,
  lang,
  onClose,
}: PlanetInspectorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pointerDownOutsideRef = useRef(false);

  const [obsData, setObsData] = useState<ObservabilityResponse | null>(null);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);

  const [lcData, setLcData] = useState<LightcurveResponse | null>(null);
  const [lcLoading, setLcLoading] = useState(false);
  const [lcError, setLcError] = useState<string | null>(null);
  const [lcMode, setLcMode] = useState<'raw' | 'folded'>('folded');

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    if (planet) {
      if (!dlg.open) {
        dlg.showModal();
      }
    } else if (dlg.open) {
      dlg.close();
    }
  }, [planet]);

  useEffect(() => {
    if (!planet) return;

    const controller = new AbortController();
    setObsData(null);
    setObsError(null);
    setObsLoading(true);

    setLcData(null);
    setLcError(null);
    setLcLoading(true);

    fetchPlanetObservability(planet.pl_name, controller.signal)
      .then((res) => {
        setObsData(res);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setObsError(err instanceof Error ? err.message : dict.inspector.obsError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setObsLoading(false);
      });

    fetchPlanetLightcurve(planet.pl_name, controller.signal)
      .then((res) => {
        setLcData(res);
        setLcMode(res.folded_points.length > 0 ? 'folded' : 'raw');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLcError(err instanceof Error ? err.message : dict.inspector.lcError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLcLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [planet, dict.inspector.obsError, dict.inspector.lcError]);

  const obsOption = useMemo(
    () => (obsData ? buildObservabilityMonthlyOption(obsData, dict) : null),
    [obsData, dict],
  );

  const lcOption = useMemo(
    () => (lcData && lcData.available ? buildLightcurveOption(lcData, lcMode, dict) : null),
    [lcData, lcMode, dict],
  );

  const obsCols: TableColumn<ObservatorySiteVisibility>[] = useMemo(
    () => [
      {
        key: 'site',
        label: dict.inspector.obsColumns[0],
        render: (s) => shortObservatoryName(s.site_name),
      },
      {
        key: 'alt',
        label: dict.inspector.obsColumns[1],
        numeric: true,
        render: (s) => `${formatDecimal(s.max_altitude_deg, 1, lang)}°`,
      },
      {
        key: 'airmass',
        label: dict.inspector.obsColumns[2],
        numeric: true,
        render: (s) =>
          s.min_airmass !== null ? formatDecimal(s.min_airmass, 2, lang) : '—',
      },
      {
        key: 'observable',
        label: dict.inspector.obsColumns[3],
        render: (s) => (s.observable_airmass_2 ? dict.common.yes : dict.common.no),
      },
      {
        key: 'months',
        label: dict.inspector.obsColumns[4],
        render: (s) =>
          s.best_months.length > 0 ? s.best_months.join(', ') : dict.inspector.obsNoMonths,
      },
    ],
    [dict, lang],
  );

  const isClickOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>): boolean => {
    const dlg = dialogRef.current;
    if (!dlg) return false;
    const rect = dlg.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      className="planet-dialog"
      aria-labelledby="inspector-dialog-title"
      onClose={onClose}
      onPointerDown={(e) => {
        if ('closedBy' in HTMLDialogElement.prototype) return;
        pointerDownOutsideRef.current = e.target === dialogRef.current && isClickOutsideDialog(e);
      }}
      onPointerUp={(e) => {
        if ('closedBy' in HTMLDialogElement.prototype) return;
        if (
          pointerDownOutsideRef.current &&
          e.target === dialogRef.current &&
          isClickOutsideDialog(e)
        ) {
          dialogRef.current?.close();
        }
        pointerDownOutsideRef.current = false;
      }}
    >
      {planet ? (
        <div className="dialog-inner">
          <header className="dialog-header">
            <div>
              <span className="exo-kicker">{dict.inspector.kicker}</span>
              <h2 id="inspector-dialog-title" className="dialog-title">
                {planet.pl_name}
              </h2>
              <p className="dialog-subtitle">
                {dict.inspector.subtitle(
                  planet.hostname ?? dict.common.notAvailable,
                  translateMethod(planet.discoverymethod, dict),
                  planet.disc_year !== null ? String(Math.round(planet.disc_year)) : '—',
                )}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => dialogRef.current?.close()}
            >
              {dict.common.closeButton}
            </button>
          </header>

          <div className="dialog-body">
            {/* Telemetry Grid */}
            <section className="dialog-section" aria-labelledby="inspector-telemetry-h">
              <h3 id="inspector-telemetry-h" className="subsection-heading">
                {dict.inspector.telemetryHeading}
              </h3>
              <div className="telemetry-grid">
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.radius}</span>
                  <span className="telemetry-cell-value">
                    {formatDecimal(planet.pl_rade, 2, lang)} {dict.common.earthRadiiShort}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.mass}</span>
                  <span className="telemetry-cell-value">
                    {planet.pl_bmasse !== null
                      ? `${formatDecimal(planet.pl_bmasse, 2, lang)} M⊕`
                      : '—'}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.insolation}</span>
                  <span className="telemetry-cell-value">
                    {formatDecimal(planet.pl_insol, 2, lang)} {dict.common.earthLightUnit}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.temp}</span>
                  <span className="telemetry-cell-value">
                    {formatInt(planet.pl_eqt - 273.15, lang)} {dict.common.celsiusUnit} (
                    {formatInt(planet.pl_eqt, lang)} K)
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.period}</span>
                  <span className="telemetry-cell-value">
                    {planet.pl_orbper !== null
                      ? `${formatDecimal(planet.pl_orbper, 2, lang)} ${dict.common.daysUnit}`
                      : '—'}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.distance}</span>
                  <span className="telemetry-cell-value">
                    {formatDecimal(planet.sy_dist * PC_TO_LY, 1, lang)}{' '}
                    {dict.common.lightYearsUnit}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.esi}</span>
                  <span className="telemetry-cell-value">
                    {formatPercent(planet.esi * 100, 1, lang)} ({formatDecimal(planet.esi, 3, lang)})
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.tsm}</span>
                  <span className="telemetry-cell-value">
                    {planet.tsm !== null ? formatDecimal(planet.tsm, 1, lang) : '—'}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.coordinates}</span>
                  <span className="telemetry-cell-value">
                    {planet.ra !== null && planet.dec !== null
                      ? `${formatDecimal(planet.ra, 2, lang)}° / ${formatDecimal(planet.dec, 2, lang)}°`
                      : '—'}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">
                    {dict.inspector.metrics.paranalAirmass}
                  </span>
                  <span className="telemetry-cell-value">
                    {planet.min_airmass_paranal !== null
                      ? formatDecimal(planet.min_airmass_paranal, 2, lang)
                      : '—'}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.category}</span>
                  <span className="telemetry-cell-value">
                    {translateRadiusCategory(planet.categoria_radio, dict)}
                  </span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-cell-label">{dict.inspector.metrics.facility}</span>
                  <span className="telemetry-cell-value">
                    {planet.disc_facility ?? dict.common.notAvailable}
                  </span>
                </div>
              </div>
            </section>

            {/* Astropy Observability */}
            <section className="dialog-section" aria-labelledby="inspector-obs-h">
              <div className="dialog-section-top">
                <div>
                  <h3 id="inspector-obs-h" className="subsection-heading">
                    {dict.inspector.obsHeading}
                  </h3>
                  <p className="filter-help">{dict.inspector.obsDesc}</p>
                </div>
                {obsData ? (
                  <span className="badge-pill">
                    <span
                      className={`status-dot ${
                        obsData.visible_chile_cutoff ? 'status-dot--api' : 'status-dot--archivo'
                      }`}
                      aria-hidden="true"
                    />
                    {obsData.visible_chile_cutoff
                      ? dict.inspector.obsCutoffYes
                      : dict.inspector.obsCutoffNo}
                  </span>
                ) : null}
              </div>

              {obsLoading ? (
                <div className="notice-bar">{dict.inspector.obsLoading}</div>
              ) : obsError ? (
                <div className="notice-bar notice-bar--error">{obsError}</div>
              ) : obsData && obsOption ? (
                <>
                  <EChartPanel
                    option={obsOption}
                    alt={dict.inspector.obsChartAlt}
                    height={310}
                  />
                  <ResponsiveTable
                    titleId="inspector-obs-h"
                    columns={obsCols}
                    rows={obsData.sites}
                    rowKey={(s) => s.site_id}
                    emptyText={dict.common.noRows}
                  />
                </>
              ) : null}
            </section>

            {/* Lightkurve Photometry */}
            <section className="dialog-section" aria-labelledby="inspector-lc-h">
              <div className="dialog-section-top">
                <div>
                  <h3 id="inspector-lc-h" className="subsection-heading">
                    {dict.inspector.lcHeading}
                  </h3>
                  {lcData && lcData.available ? (
                    <p className="filter-help">
                      {dict.inspector.lcMeta(
                        lcData.mission ?? '—',
                        lcData.author ?? '—',
                        lcData.period_days !== null
                          ? formatDecimal(lcData.period_days, 3, lang)
                          : '—',
                        lcData.source ?? '—',
                      )}
                    </p>
                  ) : null}
                </div>

                {lcData && lcData.available ? (
                  <div className="segmented-control" role="group" aria-label={dict.inspector.lcHeading}>
                    <button
                      type="button"
                      className="segmented-btn"
                      aria-pressed={lcMode === 'raw'}
                      disabled={lcData.raw_series.length === 0}
                      onClick={() => setLcMode('raw')}
                    >
                      <strong>{dict.inspector.lcModeRaw}</strong>
                    </button>
                    <button
                      type="button"
                      className="segmented-btn"
                      aria-pressed={lcMode === 'folded'}
                      disabled={lcData.folded_points.length === 0}
                      onClick={() => setLcMode('folded')}
                    >
                      <strong>{dict.inspector.lcModeFolded}</strong>
                    </button>
                  </div>
                ) : null}
              </div>

              {lcLoading ? (
                <div className="notice-bar">{dict.inspector.lcLoading}</div>
              ) : lcError ? (
                <div className="notice-bar notice-bar--error">{lcError}</div>
              ) : lcData && !lcData.available ? (
                <div className="notice-bar">
                  <strong>{dict.inspector.lcUnavailableTitle}:</strong>{' '}
                  {lang === 'es'
                    ? (lcData.reason_es ?? lcData.reason_en ?? dict.common.notAvailable)
                    : (lcData.reason_en ?? lcData.reason_es ?? dict.common.notAvailable)}
                </div>
              ) : lcOption ? (
                <EChartPanel
                  option={lcOption}
                  alt={dict.inspector.lcChartAlt}
                  height={330}
                />
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
