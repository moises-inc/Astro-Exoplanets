import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCatalogBootstrap } from './api/client';
import { HeaderHero } from './components/HeaderHero';
import { KpiRow } from './components/KpiRow';
import { PlanetInspectorDialog } from './components/PlanetInspectorDialog';
import { SidebarFilters } from './components/SidebarFilters';
import { TabPanel, TabsBar, type TabDefinition } from './components/TabsBar';
import { TabChileJwst } from './components/tabs/TabChileJwst';
import { TabEarthLike } from './components/tabs/TabEarthLike';
import { TabHistoryMethods } from './components/tabs/TabHistoryMethods';
import { TabQualityData } from './components/tabs/TabQualityData';
import { TabSensitivity } from './components/tabs/TabSensitivity';
import { getDictionary, getInitialLang, syncLangToUrl } from './i18n';
import type {
  BootstrapResponse,
  FilterState,
  Lang,
  PlanetRecord,
  TabId,
} from './types/exoplanet';
import { filterHzRocky, filterPlanets } from './utils/analytics';

const INITIAL_FILTERS: FilterState = {
  yearMin: 1995,
  yearMax: 2026,
  methods: [],
  rMax: 1.6,
  hzMode: 'Optimista',
  onlyChile: false,
  forceOffline: false,
};

export function App() {
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const dict = useMemo(() => getDictionary(lang), [lang]);

  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [activeTab, setActiveTab] = useState<TabId>('history');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [inspectedPlanetName, setInspectedPlanetName] = useState<string | null>(null);

  useEffect(() => {
    syncLangToUrl(lang);
    document.title = dict.meta.pageTitle;
  }, [lang, dict.meta.pageTitle]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    fetchCatalogBootstrap(filters.forceOffline, controller.signal)
      .then((data) => {
        setBootstrap(data);
        setFilters((prev) => {
          const allMethodIds = data.methods.map((m) => m.id);
          const hasInitializedMethods = prev.methods.length > 0;
          const validMethods = hasInitializedMethods
            ? prev.methods.filter((id) => allMethodIds.includes(id))
            : allMethodIds;

          return {
            ...prev,
            yearMin:
              prev.yearMin === INITIAL_FILTERS.yearMin && !hasInitializedMethods
                ? data.year_min
                : Math.max(data.year_min, Math.min(prev.yearMin, data.year_max)),
            yearMax:
              prev.yearMax === INITIAL_FILTERS.yearMax && !hasInitializedMethods
                ? data.year_max
                : Math.min(data.year_max, Math.max(prev.yearMax, data.year_min)),
            methods: validMethods.length > 0 ? validMethods : allMethodIds,
          };
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : dict.status.loadErrorFallback);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [filters.forceOffline, reloadNonce, dict.status.loadErrorFallback]);

  const handleResetFilters = useCallback(() => {
    if (!bootstrap) {
      setFilters(INITIAL_FILTERS);
      return;
    }
    setFilters((prev) => ({
      yearMin: bootstrap.year_min,
      yearMax: bootstrap.year_max,
      methods: bootstrap.methods.map((m) => m.id),
      rMax: 1.6,
      hzMode: 'Optimista',
      onlyChile: false,
      forceOffline: prev.forceOffline,
    }));
  }, [bootstrap]);

  const allPlanets = useMemo(() => bootstrap?.planets ?? [], [bootstrap]);

  const filteredPlanets = useMemo(
    () => filterPlanets(allPlanets, filters),
    [allPlanets, filters],
  );

  const hzPlanets = useMemo(
    () => filterHzRocky(filteredPlanets, filters.rMax, filters.hzMode),
    [filteredPlanets, filters.rMax, filters.hzMode],
  );

  const inspectedPlanet: PlanetRecord | null = useMemo(() => {
    if (!inspectedPlanetName) return null;
    return allPlanets.find((p) => p.pl_name === inspectedPlanetName) ?? null;
  }, [allPlanets, inspectedPlanetName]);

  const handleInspectPlanet = useCallback(
    (plName: string) => {
      if (allPlanets.some((p) => p.pl_name === plName)) {
        setInspectedPlanetName(plName);
      }
    },
    [allPlanets],
  );

  const tabs: TabDefinition[] = useMemo(
    () => [
      { id: 'history', label: dict.tabs.history },
      { id: 'earthlike', label: dict.tabs.earthlike },
      { id: 'chile-jwst', label: dict.tabs.chileJwst },
      { id: 'sensitivity', label: dict.tabs.sensitivity },
      { id: 'quality', label: dict.tabs.quality },
    ],
    [dict.tabs],
  );

  const source = loadError ? 'error' : (bootstrap?.source ?? 'API');
  const sourceMessage = loadError
    ? loadError
    : bootstrap
      ? lang === 'es'
        ? bootstrap.source_message_es
        : bootstrap.source_message_en
      : '';

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {dict.meta.skipToMain}
      </a>

      <SidebarFilters
        dict={dict}
        lang={lang}
        filters={filters}
        yearBoundMin={bootstrap?.year_min ?? 1995}
        yearBoundMax={bootstrap?.year_max ?? 2026}
        methodsCatalog={bootstrap?.methods ?? []}
        filteredCount={filteredPlanets.length}
        totalCount={allPlanets.length}
        isOpenMobile={mobileFiltersOpen}
        onCloseMobile={() => setMobileFiltersOpen(false)}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      <main id="main-content" className="app-main">
        <HeaderHero
          dict={dict}
          lang={lang}
          onChangeLang={setLang}
          source={source}
          sourceMessage={sourceMessage}
          loading={loading}
          onOpenMobileFilters={() => setMobileFiltersOpen(true)}
        />

        {loadError && !bootstrap ? (
          <div className="notice-bar notice-bar--error" role="alert">
            <strong>{dict.status.loadErrorTitle}:</strong> {loadError}{' '}
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              style={{ marginLeft: '12px' }}
              onClick={() => setReloadNonce((n) => n + 1)}
            >
              {dict.status.retry}
            </button>
          </div>
        ) : null}

        {bootstrap ? (
          <>
            <KpiRow
              dict={dict}
              lang={lang}
              filteredCount={filteredPlanets.length}
              initialCount={bootstrap.audit.total_filas || allPlanets.length}
              hzPlanets={hzPlanets}
              filteredPlanets={filteredPlanets}
              rMax={filters.rMax}
              hzMode={filters.hzMode}
              onInspectPlanet={handleInspectPlanet}
            />

            {filteredPlanets.length === 0 ? (
              <div className="notice-bar" role="status">
                {dict.kpi.noResultsWarning}
              </div>
            ) : null}

            <section className="tabs-container" aria-label={dict.tabs.ariaLabel}>
              <TabsBar
                ariaLabel={dict.tabs.ariaLabel}
                tabs={tabs}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
              />

              <TabPanel
                id="history"
                active={activeTab === 'history'}
                onActivateFromFind={setActiveTab}
              >
                <TabHistoryMethods
                  dict={dict}
                  lang={lang}
                  filteredPlanets={filteredPlanets}
                />
              </TabPanel>

              <TabPanel
                id="earthlike"
                active={activeTab === 'earthlike'}
                onActivateFromFind={setActiveTab}
              >
                <TabEarthLike
                  dict={dict}
                  lang={lang}
                  allPlanets={allPlanets}
                  filteredPlanets={filteredPlanets}
                  hzPlanets={hzPlanets}
                  rMax={filters.rMax}
                  hzMode={filters.hzMode}
                  onInspectPlanet={handleInspectPlanet}
                />
              </TabPanel>

              <TabPanel
                id="chile-jwst"
                active={activeTab === 'chile-jwst'}
                onActivateFromFind={setActiveTab}
              >
                <TabChileJwst
                  dict={dict}
                  lang={lang}
                  filteredPlanets={filteredPlanets}
                  hzPlanets={hzPlanets}
                  rMax={filters.rMax}
                  hzMode={filters.hzMode}
                  onInspectPlanet={handleInspectPlanet}
                />
              </TabPanel>

              <TabPanel
                id="sensitivity"
                active={activeTab === 'sensitivity'}
                onActivateFromFind={setActiveTab}
              >
                <TabSensitivity
                  dict={dict}
                  lang={lang}
                  filteredPlanets={filteredPlanets}
                />
              </TabPanel>

              <TabPanel
                id="quality"
                active={activeTab === 'quality'}
                onActivateFromFind={setActiveTab}
              >
                <TabQualityData
                  dict={dict}
                  lang={lang}
                  audit={bootstrap.audit}
                  filteredPlanets={filteredPlanets}
                  filters={filters}
                  allMethodsCount={bootstrap.methods.length}
                  onInspectPlanet={handleInspectPlanet}
                />
              </TabPanel>
            </section>
          </>
        ) : null}
      </main>

      <PlanetInspectorDialog
        planet={inspectedPlanet}
        dict={dict}
        lang={lang}
        onClose={() => setInspectedPlanetName(null)}
      />
    </div>
  );
}
export default App;
