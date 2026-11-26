import { formatDecimal, formatInt, translateMethod, type TranslationDictionary } from '../i18n';
import type { FilterState, Lang, MethodSummaryItem } from '../types/exoplanet';

interface SidebarFiltersProps {
  dict: TranslationDictionary;
  lang: Lang;
  filters: FilterState;
  yearBoundMin: number;
  yearBoundMax: number;
  methodsCatalog: MethodSummaryItem[];
  filteredCount: number;
  totalCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}

export function SidebarFilters({
  dict,
  lang,
  filters,
  yearBoundMin,
  yearBoundMax,
  methodsCatalog,
  filteredCount,
  totalCount,
  isOpenMobile,
  onCloseMobile,
  onChange,
  onReset,
}: SidebarFiltersProps) {
  const toggleMethod = (methodId: string) => {
    const exists = filters.methods.includes(methodId);
    const nextMethods = exists
      ? filters.methods.filter((m) => m !== methodId)
      : [...filters.methods, methodId];
    onChange({ ...filters, methods: nextMethods });
  };

  return (
    <>
      <div
        className={`sidebar-backdrop${isOpenMobile ? ' is-open' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`app-sidebar${isOpenMobile ? ' is-open' : ''}`}
        aria-label={dict.sidebar.filtersHeading}
      >
        <div className="sidebar-top-row">
          <h2 className="sidebar-heading">{dict.sidebar.filtersHeading}</h2>
          <button
            type="button"
            className="btn btn-secondary btn-compact sidebar-close-btn"
            onClick={onCloseMobile}
          >
            {dict.header.closeFilters}
          </button>
        </div>

        <div className="filter-value-pill">
          {dict.sidebar.activeFilterCount(
            formatInt(filteredCount, lang),
            formatInt(totalCount, lang),
          )}
        </div>

        {/* 1. Year Range */}
        <div className="filter-group">
          <div className="filter-label-row">
            <span className="filter-label">{dict.sidebar.yearLabel}</span>
            <span className="filter-value-pill">
              {filters.yearMin}–{filters.yearMax}
            </span>
          </div>
          <div className="year-inputs-grid">
            <div className="year-input-box">
              <label htmlFor="flt-year-min">{dict.sidebar.yearMinLabel}</label>
              <input
                id="flt-year-min"
                type="number"
                className="field-input mono"
                min={yearBoundMin}
                max={filters.yearMax}
                value={filters.yearMin}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  if (!Number.isFinite(raw)) return;
                  const clamped = Math.max(yearBoundMin, Math.min(filters.yearMax, Math.round(raw)));
                  onChange({ ...filters, yearMin: clamped });
                }}
              />
            </div>
            <div className="year-input-box">
              <label htmlFor="flt-year-max">{dict.sidebar.yearMaxLabel}</label>
              <input
                id="flt-year-max"
                type="number"
                className="field-input mono"
                min={filters.yearMin}
                max={yearBoundMax}
                value={filters.yearMax}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  if (!Number.isFinite(raw)) return;
                  const clamped = Math.min(yearBoundMax, Math.max(filters.yearMin, Math.round(raw)));
                  onChange({ ...filters, yearMax: clamped });
                }}
              />
            </div>
          </div>
        </div>

        {/* 2. Discovery Methods */}
        <div className="filter-group">
          <div className="filter-label-row">
            <span className="filter-label">{dict.sidebar.methodsLabel}</span>
            <div className="method-actions">
              <button
                type="button"
                className="method-action-link"
                onClick={() =>
                  onChange({ ...filters, methods: methodsCatalog.map((m) => m.id) })
                }
              >
                {dict.sidebar.selectAll}
              </button>
              <button
                type="button"
                className="method-action-link"
                onClick={() => onChange({ ...filters, methods: [] })}
              >
                {dict.sidebar.selectNone}
              </button>
            </div>
          </div>
          <div className="method-checklist" role="group" aria-label={dict.sidebar.methodsLabel}>
            {methodsCatalog.map((m) => {
              const checked = filters.methods.includes(m.id);
              return (
                <label key={m.id} className="method-item">
                  <span className="method-item-left">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMethod(m.id)}
                    />
                    <span>{translateMethod(m.id, dict)}</span>
                  </span>
                  <span className="method-item-count">{formatInt(m.count, lang)}</span>
                </label>
              );
            })}
          </div>
          <p className="filter-help">{dict.sidebar.methodsHint}</p>
        </div>

        {/* 3. R_max Slider */}
        <div className="filter-group">
          <div className="filter-label-row">
            <label htmlFor="flt-rmax" className="filter-label">
              {dict.sidebar.rMaxLabel}
            </label>
            <span className="filter-value-pill">
              {formatDecimal(filters.rMax, 1, lang)} {dict.common.earthRadiiShort}
            </span>
          </div>
          <input
            id="flt-rmax"
            type="range"
            className="range-slider"
            min={1.2}
            max={2.5}
            step={0.1}
            value={filters.rMax}
            onChange={(e) => onChange({ ...filters, rMax: Number(e.target.value) })}
          />
          <p className="filter-help">{dict.sidebar.rMaxHelp}</p>
        </div>

        {/* 4. HZ Mode Segmented Control */}
        <div className="filter-group">
          <span className="filter-label">{dict.sidebar.hzLabel}</span>
          <div
            className="segmented-control"
            role="group"
            aria-label={dict.sidebar.hzLabel}
          >
            <button
              type="button"
              className="segmented-btn"
              aria-pressed={filters.hzMode === 'Conservadora'}
              onClick={() => onChange({ ...filters, hzMode: 'Conservadora' })}
            >
              <strong>{dict.sidebar.hzConservative}</strong>
              <span>{dict.sidebar.hzConservativeSub}</span>
            </button>
            <button
              type="button"
              className="segmented-btn"
              aria-pressed={filters.hzMode === 'Optimista'}
              onClick={() => onChange({ ...filters, hzMode: 'Optimista' })}
            >
              <strong>{dict.sidebar.hzOptimistic}</strong>
              <span>{dict.sidebar.hzOptimisticSub}</span>
            </button>
          </div>
          <p className="filter-help">{dict.sidebar.hzHelp}</p>
        </div>

        {/* 5. Only Chile */}
        <div className="filter-group">
          <label className="switch-row">
            <span>{dict.sidebar.onlyChileLabel}</span>
            <input
              type="checkbox"
              className="switch-input"
              checked={filters.onlyChile}
              onChange={(e) => onChange({ ...filters, onlyChile: e.target.checked })}
            />
          </label>
          <p className="filter-help">{dict.sidebar.onlyChileHelp}</p>
        </div>

        {/* Data Source */}
        <div className="filter-group">
          <h3 className="sidebar-heading">{dict.sidebar.sourceHeading}</h3>
          <label className="switch-row">
            <span>{dict.sidebar.offlineToggleLabel}</span>
            <input
              type="checkbox"
              className="switch-input"
              checked={filters.forceOffline}
              onChange={(e) => onChange({ ...filters, forceOffline: e.target.checked })}
            />
          </label>
          <p className="filter-help">{dict.sidebar.offlineHelp}</p>
          <p className="filter-help">{dict.sidebar.offlineNote}</p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onReset}
        >
          {dict.sidebar.resetFilters}
        </button>
      </aside>
    </>
  );
}
