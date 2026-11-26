export interface GuideItem {
  title: string;
  body: string;
  bullets?: Array<{ label: string; text: string }>;
}

export interface TranslationDictionary {
  meta: {
    pageTitle: string;
    skipToMain: string;
  };
  header: {
    kicker: string;
    title: string;
    subtitle: string;
    questionLabel: string;
    question: string;
    heroAlt: string;
    heroCaption: string;
    langToggleAria: string;
    openFilters: string;
    closeFilters: string;
  };
  status: {
    liveTag: string;
    offlineTag: string;
    errorTag: string;
    loading: string;
    retry: string;
    loadErrorTitle: string;
    loadErrorFallback: string;
  };
  guide: {
    summary: string;
    left: GuideItem[];
    right: GuideItem[];
  };
  sidebar: {
    filtersHeading: string;
    yearLabel: string;
    yearMinLabel: string;
    yearMaxLabel: string;
    methodsLabel: string;
    methodsHint: string;
    selectAll: string;
    selectNone: string;
    rMaxLabel: string;
    rMaxHelp: string;
    hzLabel: string;
    hzConservative: string;
    hzConservativeSub: string;
    hzOptimistic: string;
    hzOptimisticSub: string;
    hzHelp: string;
    onlyChileLabel: string;
    onlyChileHelp: string;
    sourceHeading: string;
    offlineToggleLabel: string;
    offlineHelp: string;
    offlineNote: string;
    resetFilters: string;
    activeFilterCount: (shown: string, total: string) => string;
  };
  kpi: {
    filteredLabel: string;
    filteredDelta: (pct: string, total: string) => string;
    hzLabel: string;
    hzDelta: (rMax: string, hzShort: string) => string;
    chileLabel: string;
    chileDelta: (jwstCount: string) => string;
    bestLabel: string;
    bestDelta: (esiPct: string, distLy: string, outsideHz: boolean) => string;
    bestEmpty: string;
    bestEmptyDelta: string;
    inspectHint: string;
    noResultsWarning: string;
  };
  tabs: {
    ariaLabel: string;
    history: string;
    earthlike: string;
    chileJwst: string;
    sensitivity: string;
    quality: string;
  };
  tac: {
    overline: string;
  };
  common: {
    yes: string;
    no: string;
    notAvailable: string;
    notApplicable: string;
    earthRadiiUnit: string;
    earthRadiiShort: string;
    earthLightUnit: string;
    lightYearsUnit: string;
    daysUnit: string;
    celsiusUnit: string;
    kelvinUnit: string;
    degreesUnit: string;
    inspectButton: string;
    closeButton: string;
    loading: string;
    noRows: string;
    hzStrictShort: string;
    hzWideShort: string;
    hzStrictDesc: string;
    hzWideDesc: string;
  };
  methods: Record<string, string>;
  radiusCategories: Record<string, string>;
  months: string[];
  charts: {
    noDataTitle: string;
    restoreTitle: string;
    lineType: string;
    barType: string;
    earthRef: string;
    earthRefTooltip: string;
    fultonLine: string;
    chosenRadiusLine: (rMax: string) => string;
    chileVisibleLimit: string;
    chileVisibleBand: string;
    tsmRecommendedLine: string;
    visibleChileTag: string;
    northOnlyTag: string;
    otherMethodsGroup: (count: number) => string;
    series: {
      transit: string;
      radialVelocity: string;
      otherMethods: string;
      totalDiscovered: string;
      rocky16: string;
      inWideHz: string;
      transitJwstGroup: string;
      rvChileGroup: string;
      catalogRest: string;
      chileCandidates: string;
      northCandidates: string;
      inHz: string;
      transiting: string;
      visibleChile: string;
      chilePlusTsm10: string;
      totalCandidates: string;
      transitVisibleChile: string;
    };
    axes: {
      discYear: string;
      planetsPerYear: string;
      confirmedPlanets: string;
      planetsFromChile: string;
      insolationLog: string;
      radiusLog: string;
      distanceLogLy: string;
      esiScore: string;
      tsmIndex: string;
      raDeg: string;
      decDeg: string;
      fultonHzCriterion: string;
      distTsmCriterion: string;
      candidateCount: string;
      months: string;
      hoursPerNight: string;
      btjd: string;
      phaseDays: string;
      normalizedFlux: string;
    };
    radarIndicators: {
      esi: string;
      tsm: string;
      proximity: string;
      temperate: string;
      chileVis: string;
    };
    visualMapHighLow: [string, string];
    empty: {
      evolution: string;
      methods: string;
      observatories: string;
      hzEsi: string;
      distEsi: string;
      tsmRanking: string;
      skyMap: string;
      radar: string;
      sensitivity: string;
    };
  };
  tab1: {
    heading: string;
    evolutionAlt: string;
    evolutionReading: (total: string, transits: string, rv: string) => string;
    methodsTitle: string;
    methodsAlt: string;
    chileObsTitle: string;
    chileObsAlt: string;
    methodsReading: (chileDisc: string, leaderObs: string) => string;
    obsTableTitle: string;
    obsColumns: string[];
  };
  tab2: {
    heading: string;
    hzChartAlt: string;
    hzReading: (rMax: string, hzShort: string, sMin: string, sMax: string, count: string) => string;
    featuredTitle: string;
    trappistRole: string;
    trappistAlt: string;
    trappistCaption: string;
    teegardenRole: string;
    teegardenAlt: string;
    teegardenCaption: string;
    missingFeatured: string;
    cardLabels: {
      radius: string;
      insolation: string;
      temperature: string;
      distance: string;
      esi: string;
      method: string;
      tsm: string;
      visibleChile: string;
      tsmJwstReady: string;
      tsmNoTransit: string;
      chileYes: string;
      chileNo: string;
    };
    top15Title: (hzShort: string, rMax: string) => string;
    top15Empty: string;
  };
  tab3: {
    heading: string;
    jwstDiagramAlt: string;
    jwstDiagramCaption: string;
    jwstPanelTitle: string;
    jwstPanelSub: string;
    eltPanelTitle: string;
    eltPanelSub: string;
    panelItems: {
      candidatesHz: string;
      medianDist: string;
      medianEsi: string;
      tsm10: string;
      visibleChile: string;
    };
    distChartTitle: string;
    distChartAlt: string;
    tsmChartTitle: string;
    tsmChartAlt: string;
    prioritizationEmpty: string;
    prioritizationSummary: (totalHz: string, transits: string, rv: string) => string;
    prioritizationRvHighlight: (name: string, distLy: string, esiPct: string) => string;
    prioritizationTsmHighlight: (name: string, tsm: string) => string;
    skyMapTitle: string;
    skyMapAlt: string;
    skyMapReading: (totalHz: string, visChile: string, northOnly: string, notables: string[]) => string;
    radarTitle: (hzShort: string, rMax: string) => string;
    radarAlt: string;
    radarReading: string;
    waitlistTitle: (hzShort: string, rMax: string) => string;
    waitlistEmpty: string;
  };
  tab4: {
    heading: string;
    fultonChartTitle: string;
    fultonChartAlt: string;
    distTsmChartTitle: string;
    distTsmChartAlt: string;
    sensitivityReading: (
      c16Tot: string,
      c18Tot: string,
      c20Tot: string,
      o16Tot: string,
      o18Tot: string,
      o20Tot: string,
      c16Cl: string,
      c18Cl: string,
      c20Cl: string,
      o16Cl: string,
      o18Cl: string,
      o20Cl: string,
      lhsNote: boolean,
    ) => string;
    scenario1Title: string;
    scenario1Cols: string[];
    scenario2Title: string;
    scenario2Cols: string[];
    emptyTable: string;
  };
  tab5: {
    heading: string;
    auditKpis: {
      rawTitle: string;
      rawDelta: string;
      impossibleTitle: string;
      impossibleDelta: string;
      nullsTitle: string;
      nullsDelta: string;
      cleanTitle: string;
      cleanDelta: (pct: string) => string;
    };
    statsTitle: string;
    statsEmpty: string;
    statsColumns: string[];
    statsVariables: Record<string, { name: string; unit: string }>;
    numpyCaption: (
      rPeriod: string,
      nPeriod: string,
      rDist: string,
      nDist: string,
      tsm10Count: string,
    ) => string;
    catalogTitle: string;
    searchPlaceholder: string;
    searchLabel: string;
    downloadCsv: string;
    downloadingCsv: string;
    paginationShowing: (from: string, to: string, total: string) => string;
    prevPage: string;
    nextPage: string;
    auditTableTitle: string;
    auditColumns: string[];
    nasaColDescriptions: Record<string, string>;
    defaultColDescription: string;
  };
  candidateColumns: {
    planet: string;
    star: string;
    method: string;
    year: string;
    radius: string;
    insolation: string;
    tempC: string;
    distanceLy: string;
    esiPct: string;
    tsm: string;
    visibleChile: string;
  };
  inspector: {
    kicker: string;
    subtitle: (host: string, method: string, year: string) => string;
    telemetryHeading: string;
    obsHeading: string;
    obsDesc: string;
    obsLoading: string;
    obsError: string;
    obsCutoffYes: string;
    obsCutoffNo: string;
    obsChartAlt: string;
    obsColumns: string[];
    obsNoMonths: string;
    lcHeading: string;
    lcModeRaw: string;
    lcModeFolded: string;
    lcLoading: string;
    lcError: string;
    lcUnavailableTitle: string;
    lcChartAlt: string;
    lcMeta: (mission: string, author: string, period: string, source: string) => string;
    lcRawSeriesName: string;
    lcFoldedPointsName: string;
    lcBinnedMedianName: string;
    metrics: {
      radius: string;
      mass: string;
      insolation: string;
      temp: string;
      period: string;
      distance: string;
      esi: string;
      tsm: string;
      coordinates: string;
      paranalAirmass: string;
      facility: string;
      category: string;
    };
  };
}
