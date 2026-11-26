import type { EChartsOption } from 'echarts';
import {
  formatDecimal,
  formatInt,
  formatPercent,
  shortObservatoryName,
  translateMethod,
  type TranslationDictionary,
} from '../i18n';
import type {
  DistTsmRow,
  FultonHzRow,
  HzMode,
  Lang,
  LightcurveResponse,
  ObservabilityResponse,
  PlanetRecord,
} from '../types/exoplanet';
import {
  DEC_LIMIT_CHILE,
  getHzBounds,
  PC_TO_LY,
  summarizeByMethod,
  summarizeChileObservatories,
} from './analytics';

export const DARK_ROMER_PALETTE = {
  canvas: '#080809',
  sidebar: '#0E0E0F',
  surface1: '#101112',
  surface2: '#151617',
  surfaceHigh: '#191A1C',
  borderSubtle: '#1B1C1E',
  borderStructural: '#232426',
  borderMuted: '#2A2A2B',
  accent: '#5E6BFF',
  accentHover: '#7A85FF',
  cerulean: '#50D8E9',
  teal: '#00B1C2',
  highlight: '#FFB689',
  amber: '#E0731D',
  slate: '#8F8FA1',
  danger: '#FFB4AB',
  textPrimary: '#E5E2E3',
  textSecondary: '#C6C5D8',
  textMuted: '#9A9DA3',
} as const;

export const CHART_CATEGORICAL_COLORS = [
  DARK_ROMER_PALETTE.cerulean,
  DARK_ROMER_PALETTE.accent,
  DARK_ROMER_PALETTE.highlight,
  DARK_ROMER_PALETTE.accentHover,
  DARK_ROMER_PALETTE.teal,
  DARK_ROMER_PALETTE.textSecondary,
];

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function darkAxis(
  type: 'value' | 'category' | 'log',
  name: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const axis: Record<string, unknown> = {
    type,
    axisLine: { show: true, lineStyle: { color: DARK_ROMER_PALETTE.borderStructural } },
    axisTick: { lineStyle: { color: DARK_ROMER_PALETTE.borderStructural } },
    axisLabel: { color: DARK_ROMER_PALETTE.textMuted, fontSize: 11 },
    splitLine: {
      show: type !== 'category',
      lineStyle: { color: DARK_ROMER_PALETTE.borderSubtle, type: 'dashed' },
    },
  };
  if (name) {
    axis.name = name;
    axis.nameLocation = 'middle';
    axis.nameGap = type === 'category' ? 28 : 30;
    axis.nameTextStyle = {
      color: DARK_ROMER_PALETTE.textSecondary,
      fontSize: 12,
      fontWeight: 500,
    };
  }
  if (extra) {
    Object.assign(axis, extra);
  }
  return axis;
}

function baseChartSpec(
  dict: TranslationDictionary,
  options?: {
    tooltipTrigger?: 'item' | 'axis';
    toolbox?: boolean;
    magicTypes?: Array<'line' | 'bar'>;
    grid?: Record<string, unknown>;
  },
): EChartsOption {
  const spec: EChartsOption = {
    backgroundColor: 'transparent',
    color: [...CHART_CATEGORICAL_COLORS],
    animation: true,
    animationDuration: 450,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 280,
    animationEasingUpdate: 'cubicOut',
    textStyle: {
      color: DARK_ROMER_PALETTE.textMuted,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      fontSize: 12,
    },
    tooltip: {
      trigger: options?.tooltipTrigger ?? 'item',
      confine: true,
      backgroundColor: 'rgba(16, 17, 18, 0.96)',
      borderColor: DARK_ROMER_PALETTE.borderStructural,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: DARK_ROMER_PALETTE.textPrimary,
        fontSize: 12,
      },
    },
  };

  if (options?.grid) {
    spec.grid = options.grid;
  }

  if (options?.toolbox !== false) {
    const feature: NonNullable<EChartsOption['toolbox']> extends infer T
      ? T extends { feature?: infer F }
        ? NonNullable<F>
        : never
      : never = {
      restore: { title: dict.charts.restoreTitle },
    };
    if (options?.magicTypes) {
      feature.magicType = {
        type: options.magicTypes,
        title: { line: dict.charts.lineType, bar: dict.charts.barType },
      };
    }
    spec.toolbox = {
      right: 8,
      top: 2,
      itemSize: 14,
      iconStyle: { borderColor: DARK_ROMER_PALETTE.textMuted },
      emphasis: { iconStyle: { borderColor: DARK_ROMER_PALETTE.textPrimary } },
      feature,
    };
  }

  return spec;
}

function emptyChartSpec(dict: TranslationDictionary, title: string, message: string): EChartsOption {
  return {
    ...baseChartSpec(dict, { toolbox: false }),
    series: [],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: `${title}\n\n${message}`,
          fill: DARK_ROMER_PALETTE.textMuted,
          font: '500 13px Inter, system-ui, sans-serif',
          align: 'center',
          lineHeight: 20,
        },
      },
    ],
  };
}

export function buildEvolucionAnualOption(
  planets: PlanetRecord[],
  dict: TranslationDictionary,
): EChartsOption {
  const valid = planets.filter((p) => p.disc_year !== null && Number.isFinite(p.disc_year));
  if (valid.length === 0) {
    return emptyChartSpec(dict, dict.charts.noDataTitle, dict.charts.empty.evolution);
  }

  const years = valid.map((p) => Math.round(p.disc_year as number));
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  const yearLabels: string[] = [];
  const transitCounts: number[] = [];
  const rvCounts: number[] = [];
  const otherCounts: number[] = [];

  const buckets = new Map<number, { t: number; r: number; o: number }>();
  for (let y = minY; y <= maxY; y++) {
    buckets.set(y, { t: 0, r: 0, o: 0 });
  }
  for (const p of valid) {
    const y = Math.round(p.disc_year as number);
    const b = buckets.get(y);
    if (!b) continue;
    if (p.discoverymethod === 'Transit') b.t += 1;
    else if (p.discoverymethod === 'Radial Velocity') b.r += 1;
    else b.o += 1;
  }

  let maxAnnual = 0;
  for (let y = minY; y <= maxY; y++) {
    const b = buckets.get(y)!;
    yearLabels.push(String(y));
    transitCounts.push(b.t);
    rvCounts.push(b.r);
    otherCounts.push(b.o);
    maxAnnual = Math.max(maxAnnual, b.t + b.r + b.o);
  }

  const yMax = Math.max(10, Math.ceil((maxAnnual * 1.28) / 100) * 100);
  const presentYears = new Set(yearLabels);
  const milestones = [
    { yr: '2014', label: 'Kepler 2014', color: DARK_ROMER_PALETTE.cerulean },
    { yr: '2016', label: 'Kepler 2016', color: DARK_ROMER_PALETTE.cerulean },
    { yr: '2019', label: 'TESS 2019', color: DARK_ROMER_PALETTE.highlight },
  ].filter((m) => presentYears.has(m.yr));

  const markLineData = milestones.map((m) => ({
    xAxis: m.yr,
    name: m.label,
    lineStyle: { color: m.color, type: 'dashed' as const, width: 1.3 },
    label: {
      show: true,
      formatter: m.label,
      position: 'insideEndTop' as const,
      distance: 4,
      color: m.color,
      fontSize: 11,
      backgroundColor: 'rgba(16, 17, 18, 0.88)',
      padding: [2, 4],
      borderRadius: 3,
    },
  }));

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'axis',
    magicTypes: ['line', 'bar'],
    grid: { top: 68, bottom: 76, left: 64, right: 24, containLabel: true },
  });

  return {
    ...spec,
    tooltip: {
      ...spec.tooltip,
      axisPointer: {
        type: 'line',
        lineStyle: { color: DARK_ROMER_PALETTE.borderMuted },
      },
    },
    legend: {
      top: 4,
      left: 'center',
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 12 },
      itemWidth: 14,
      itemHeight: 10,
    },
    xAxis: darkAxis('category', dict.charts.axes.discYear, {
      data: yearLabels,
      boundaryGap: false,
      splitLine: { show: false },
      axisLabel: {
        color: DARK_ROMER_PALETTE.textMuted,
        fontSize: 11,
        interval: 'auto',
        hideOverlap: true,
      },
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('value', dict.charts.axes.planetsPerYear, {
      nameRotate: 90,
      nameGap: 52,
      min: 0,
      max: yMax,
    }) as EChartsOption['yAxis'],
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 22,
        bottom: 10,
        borderColor: DARK_ROMER_PALETTE.borderStructural,
        backgroundColor: DARK_ROMER_PALETTE.surface2,
        fillerColor: 'rgba(94, 107, 255, 0.20)',
        handleStyle: {
          color: DARK_ROMER_PALETTE.accent,
          borderColor: DARK_ROMER_PALETTE.accentHover,
        },
        textStyle: { color: DARK_ROMER_PALETTE.textMuted, fontSize: 11 },
      },
    ],
    series: [
      {
        name: dict.charts.series.transit,
        type: 'line',
        stack: 'total',
        smooth: 0.25,
        showSymbol: yearLabels.length <= 35,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: DARK_ROMER_PALETTE.cerulean },
        itemStyle: { color: DARK_ROMER_PALETTE.cerulean },
        areaStyle: { opacity: 0.22, color: DARK_ROMER_PALETTE.cerulean },
        emphasis: { focus: 'series' },
        data: transitCounts,
        ...(markLineData.length > 0
          ? {
              markLine: {
                symbol: ['none', 'none'],
                silent: true,
                data: markLineData,
              },
            }
          : {}),
      },
      {
        name: dict.charts.series.radialVelocity,
        type: 'line',
        stack: 'total',
        smooth: 0.25,
        showSymbol: yearLabels.length <= 35,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: DARK_ROMER_PALETTE.accent },
        itemStyle: { color: DARK_ROMER_PALETTE.accent },
        areaStyle: { opacity: 0.22, color: DARK_ROMER_PALETTE.accent },
        emphasis: { focus: 'series' },
        data: rvCounts,
      },
      {
        name: dict.charts.series.otherMethods,
        type: 'line',
        stack: 'total',
        smooth: 0.25,
        showSymbol: yearLabels.length <= 35,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: DARK_ROMER_PALETTE.highlight },
        itemStyle: { color: DARK_ROMER_PALETTE.highlight },
        areaStyle: { opacity: 0.22, color: DARK_ROMER_PALETTE.highlight },
        emphasis: { focus: 'series' },
        data: otherCounts,
      },
    ],
  };
}

export function buildMetodosOption(
  planets: PlanetRecord[],
  dict: TranslationDictionary,
  lang: Lang,
): EChartsOption {
  const summary = summarizeByMethod(planets);
  if (summary.length === 0) {
    return emptyChartSpec(dict, dict.tab1.methodsTitle, dict.charts.empty.methods);
  }

  let rows: Array<{ key: string; label: string; total: number; pct: number }>;
  if (summary.length > 5) {
    const top4 = summary.slice(0, 4).map((r) => ({
      key: r.discoverymethod,
      label: translateMethod(r.discoverymethod, dict),
      total: r.total,
      pct: r.percentage,
    }));
    const rest = summary.slice(4);
    const restTotal = rest.reduce((acc, r) => acc + r.total, 0);
    const restPct = rest.reduce((acc, r) => acc + r.percentage, 0);
    rows = [
      ...top4,
      {
        key: 'Other',
        label: dict.charts.otherMethodsGroup(rest.length),
        total: restTotal,
        pct: restPct,
      },
    ];
  } else {
    rows = summary.map((r) => ({
      key: r.discoverymethod,
      label: translateMethod(r.discoverymethod, dict),
      total: r.total,
      pct: r.percentage,
    }));
  }

  const ordered = [...rows].reverse();
  const maxTot = Math.max(...ordered.map((r) => r.total), 1);

  const barData = ordered.map((r, idx) => {
    let color: string = DARK_ROMER_PALETTE.highlight;
    if (r.key === 'Transit') color = DARK_ROMER_PALETTE.cerulean;
    else if (r.key === 'Radial Velocity') color = DARK_ROMER_PALETTE.accent;
    else if (r.key === 'Other') color = DARK_ROMER_PALETTE.slate;
    else if (idx % 2 !== 0) color = DARK_ROMER_PALETTE.teal;

    return {
      value: r.total,
      name: r.label,
      pctStr: formatPercent(r.pct, 1, lang),
      totalStr: formatInt(r.total, lang),
      itemStyle: { color, borderRadius: [0, 4, 4, 0] },
    };
  });

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'axis',
    grid: { top: 36, bottom: 42, left: 12, right: 124, containLabel: true },
  });

  return {
    ...spec,
    tooltip: {
      ...spec.tooltip,
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        const first = arr[0] as { data?: { name: string; totalStr: string; pctStr: string } };
        if (!first?.data) return '';
        return `<b>${escapeHtml(first.data.name)}</b><br/>${escapeHtml(dict.charts.axes.confirmedPlanets)}: ${escapeHtml(first.data.totalStr)}<br/>${escapeHtml(first.data.pctStr)}`;
      },
    },
    xAxis: darkAxis('value', dict.charts.axes.confirmedPlanets, {
      max: Math.round(maxTot * 1.32),
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('category', '', {
      data: ordered.map((r) => r.label),
      splitLine: { show: false },
    }) as EChartsOption['yAxis'],
    series: [
      {
        name: dict.tab1.methodsTitle,
        type: 'bar',
        barMaxWidth: 28,
        data: barData,
        label: {
          show: true,
          position: 'right',
          color: DARK_ROMER_PALETTE.textPrimary,
          fontSize: 11,
          formatter: (p: unknown) => {
            const item = p as { data?: { totalStr: string; pctStr: string } };
            return item.data ? `${item.data.totalStr} (${item.data.pctStr})` : '';
          },
        },
        emphasis: {
          focus: 'self',
          itemStyle: { borderColor: DARK_ROMER_PALETTE.textPrimary, borderWidth: 1.2 },
        },
      },
    ],
  };
}

export function buildObservatoriosChileOption(
  planets: PlanetRecord[],
  dict: TranslationDictionary,
): EChartsOption {
  const obs = summarizeChileObservatories(planets);
  if (obs.length === 0) {
    return emptyChartSpec(dict, dict.tab1.chileObsTitle, dict.charts.empty.observatories);
  }

  const ordered = obs.slice(0, 6).reverse();
  const labels = ordered.map((o) => shortObservatoryName(o.observatory));

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'axis',
    grid: { top: 60, bottom: 42, left: 12, right: 34, containLabel: true },
  });

  return {
    ...spec,
    tooltip: {
      ...spec.tooltip,
      axisPointer: { type: 'shadow' },
    },
    legend: {
      top: 4,
      left: 12,
      right: 56,
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
      itemWidth: 12,
      itemHeight: 9,
    },
    xAxis: darkAxis('value', dict.charts.axes.planetsFromChile) as EChartsOption['xAxis'],
    yAxis: darkAxis('category', '', {
      data: labels,
      splitLine: { show: false },
    }) as EChartsOption['yAxis'],
    series: [
      {
        name: dict.charts.series.totalDiscovered,
        type: 'bar',
        barMaxWidth: 14,
        itemStyle: { color: DARK_ROMER_PALETTE.cerulean, borderRadius: [0, 3, 3, 0] },
        emphasis: { focus: 'series' },
        data: ordered.map((o) => o.totalDiscovered),
      },
      {
        name: dict.charts.series.rocky16,
        type: 'bar',
        barMaxWidth: 14,
        itemStyle: { color: DARK_ROMER_PALETTE.accent, borderRadius: [0, 3, 3, 0] },
        emphasis: { focus: 'series' },
        data: ordered.map((o) => o.rocky16),
      },
      {
        name: dict.charts.series.inWideHz,
        type: 'bar',
        barMaxWidth: 14,
        itemStyle: { color: DARK_ROMER_PALETTE.highlight, borderRadius: [0, 3, 3, 0] },
        emphasis: { focus: 'series' },
        data: ordered.map((o) => o.inHzOptimistic),
      },
    ],
  };
}

export function buildZonaHabitableEsiOption(
  planets: PlanetRecord[],
  rMax: number,
  hzMode: HzMode,
  dict: TranslationDictionary,
  lang: Lang,
): EChartsOption {
  const valid = planets.filter(
    (p) => p.pl_rade > 0 && p.pl_insol > 0 && Number.isFinite(p.esi),
  );
  if (valid.length === 0) {
    return emptyChartSpec(dict, dict.tab2.heading, dict.charts.empty.hzEsi);
  }

  const { min: sMin, max: sMax } = getHzBounds(hzMode);
  const hzLabel =
    hzMode === 'Conservadora' ? dict.common.hzStrictDesc : dict.common.hzWideDesc;

  const sMinData = Math.min(...valid.map((p) => p.pl_insol));
  const sMaxData = Math.max(...valid.map((p) => p.pl_insol));
  const rMaxData = Math.max(...valid.map((p) => p.pl_rade));

  const xMin = 10 ** Math.floor(Math.log10(Math.max(1e-5, Math.min(0.01, sMinData * 0.7))));
  const xMax = 10 ** Math.ceil(Math.log10(Math.max(10000, sMaxData * 1.15)));
  const yMin = 0.2;
  const yMax = Math.max(100, 10 ** Math.ceil(Math.log10(Math.max(1, rMaxData * 1.1))));

  const points = valid.map((p) => ({
    value: [Number(p.pl_insol.toFixed(4)), Number(p.pl_rade.toFixed(3)), Number(p.esi.toFixed(3))],
    plName: p.pl_name,
    method: translateMethod(p.discoverymethod, dict),
    distLy: formatDecimal(p.sy_dist * PC_TO_LY, 1, lang),
    esiPct: formatPercent(p.esi * 100, 1, lang),
    esiFmt: formatDecimal(p.esi, 3, lang),
    radFmt: formatDecimal(p.pl_rade, 2, lang),
    insolFmt: formatDecimal(p.pl_insol, 2, lang),
  }));

  const markLineData: Array<Record<string, unknown>> = [
    {
      yAxis: 1.6,
      name: dict.charts.fultonLine,
      lineStyle: { color: DARK_ROMER_PALETTE.accent, type: 'dashed', width: 1.5 },
      label: {
        show: true,
        formatter: dict.charts.fultonLine,
        position: 'insideStartTop',
        color: DARK_ROMER_PALETTE.accentHover,
        fontSize: 11,
      },
    },
  ];
  if (Math.abs(rMax - 1.6) > 1e-6) {
    const rLabel = dict.charts.chosenRadiusLine(formatDecimal(rMax, 1, lang));
    markLineData.push({
      yAxis: rMax,
      name: rLabel,
      lineStyle: { color: DARK_ROMER_PALETTE.highlight, type: 'dotted', width: 1.8 },
      label: {
        show: true,
        formatter: rLabel,
        position: 'insideStartBottom',
        color: DARK_ROMER_PALETTE.highlight,
        fontSize: 11,
      },
    });
  }

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'item',
    grid: { top: 58, bottom: 76, left: 64, right: 120, containLabel: true },
  });

  return {
    ...spec,
    legend: {
      top: 4,
      left: 12,
      right: 56,
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 12 },
    },
    visualMap: {
      type: 'continuous',
      min: 0.1,
      max: 1.0,
      dimension: 2,
      seriesIndex: 0,
      calculable: false,
      itemHeight: 140,
      orient: 'vertical',
      right: 12,
      top: 'middle',
      text: dict.charts.visualMapHighLow,
      textStyle: { color: DARK_ROMER_PALETTE.textMuted, fontSize: 11 },
      inRange: {
        color: [
          '#454655',
          DARK_ROMER_PALETTE.accent,
          DARK_ROMER_PALETTE.cerulean,
          DARK_ROMER_PALETTE.highlight,
        ],
      },
    },
    xAxis: darkAxis('log', dict.charts.axes.insolationLog, {
      min: xMin,
      max: xMax,
      logBase: 10,
      nameGap: 30,
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('log', dict.charts.axes.radiusLog, {
      min: yMin,
      max: yMax,
      logBase: 10,
      nameRotate: 90,
      nameGap: 46,
    }) as EChartsOption['yAxis'],
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, yAxisIndex: 0 },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 20,
        bottom: 10,
        borderColor: DARK_ROMER_PALETTE.borderStructural,
        backgroundColor: DARK_ROMER_PALETTE.surface2,
        fillerColor: 'rgba(80, 216, 233, 0.16)',
        handleStyle: { color: DARK_ROMER_PALETTE.cerulean },
        textStyle: { color: DARK_ROMER_PALETTE.textMuted, fontSize: 10 },
      },
    ],
    series: [
      {
        name: `${dict.kpi.filteredLabel} (n = ${formatInt(points.length, lang)})`,
        type: 'scatter',
        symbolSize: 6,
        large: true,
        largeThreshold: 2500,
        data: points,
        tooltip: {
          trigger: 'item',
          formatter: (p: unknown) => {
            const d = (p as { data?: (typeof points)[number] }).data;
            if (!d) return '';
            return `<b>${escapeHtml(d.plName)}</b><br/>${escapeHtml(dict.candidateColumns.radius)}: ${escapeHtml(d.radFmt)} ${escapeHtml(dict.common.earthRadiiShort)}<br/>${escapeHtml(dict.candidateColumns.insolation)}: ${escapeHtml(d.insolFmt)} ${escapeHtml(dict.common.earthLightUnit)}<br/>ESI: ${escapeHtml(d.esiPct)} (${escapeHtml(d.esiFmt)})<br/>${escapeHtml(dict.candidateColumns.method)}: ${escapeHtml(d.method)}<br/>${escapeHtml(dict.candidateColumns.distanceLy)}: ${escapeHtml(d.distLy)}`;
          },
        },
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(0, 177, 194, 0.14)',
            borderColor: DARK_ROMER_PALETTE.teal,
            borderWidth: 1,
            borderType: 'dashed',
          },
          label: {
            show: true,
            position: 'insideTop',
            color: DARK_ROMER_PALETTE.cerulean,
            fontSize: 11,
          },
          data: [[{ name: hzLabel, xAxis: sMin }, { xAxis: sMax }]],
        },
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          data: markLineData as never,
        },
      },
      {
        name: dict.charts.earthRef,
        type: 'scatter',
        symbol: 'diamond',
        symbolSize: 15,
        data: [[1.0, 1.0]],
        itemStyle: {
          color: DARK_ROMER_PALETTE.danger,
          borderColor: DARK_ROMER_PALETTE.textPrimary,
          borderWidth: 1.5,
        },
        label: {
          show: true,
          position: 'bottom',
          distance: 6,
          formatter: lang === 'es' ? 'Tierra' : 'Earth',
          color: DARK_ROMER_PALETTE.textPrimary,
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: 'rgba(16, 17, 18, 0.88)',
          padding: [2, 5],
          borderRadius: 3,
        },
        tooltip: {
          trigger: 'item',
          formatter: dict.charts.earthRefTooltip,
        },
        z: 10,
      },
    ],
  };
}

export function buildDistanciaEsiOption(
  hzPlanets: PlanetRecord[],
  dict: TranslationDictionary,
  lang: Lang,
): EChartsOption {
  const valid = hzPlanets.filter((p) => p.sy_dist > 0 && Number.isFinite(p.esi));
  if (valid.length === 0) {
    return emptyChartSpec(dict, dict.tab3.distChartTitle, dict.charts.empty.distEsi);
  }

  const distsLy = valid.map((p) => Math.max(0.1, p.sy_dist * PC_TO_LY));
  const dMin = Number(Math.max(0.05, Math.min(...distsLy) * 0.7).toFixed(2));
  const dMax = Number(Math.max(150, Math.max(...distsLy) * 1.4).toFixed(1));
  const esiMin = Number(Math.max(0, Math.min(0.5, Math.min(...valid.map((p) => p.esi)) - 0.05)).toFixed(2));

  const mapPoint = (p: PlanetRecord, groupLabel: string) => {
    const distLy = Math.max(0.1, p.sy_dist * PC_TO_LY);
    return {
      value: [Number(distLy.toFixed(1)), Number(p.esi.toFixed(3))],
      plName: p.pl_name,
      groupLabel,
      distFmt: formatDecimal(distLy, 1, lang),
      esiPctFmt: formatPercent(p.esi * 100, 1, lang),
      esiFmt: formatDecimal(p.esi, 3, lang),
      tsmFmt: p.tsm !== null && Number.isFinite(p.tsm) ? formatDecimal(p.tsm, 1, lang) : dict.common.notApplicable,
    };
  };

  const trPts = valid
    .filter((p) => p.discoverymethod === 'Transit')
    .map((p) => mapPoint(p, dict.charts.series.transitJwstGroup));
  const rvPts = valid
    .filter((p) => p.discoverymethod === 'Radial Velocity')
    .map((p) => mapPoint(p, dict.charts.series.rvChileGroup));
  const otherPts = valid
    .filter((p) => p.discoverymethod !== 'Transit' && p.discoverymethod !== 'Radial Velocity')
    .map((p) => mapPoint(p, dict.charts.series.otherMethods));

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'item',
    grid: { top: 68, bottom: 50, left: 58, right: 24, containLabel: true },
  });

  const tooltipFmt = (p: unknown) => {
    const d = (p as { data?: ReturnType<typeof mapPoint> }).data;
    if (!d) return '';
    return `<b>${escapeHtml(d.plName)}</b><br/>${escapeHtml(d.groupLabel)}<br/>${escapeHtml(dict.candidateColumns.distanceLy)}: ${escapeHtml(d.distFmt)}<br/>ESI: ${escapeHtml(d.esiPctFmt)} (${escapeHtml(d.esiFmt)})<br/>TSM: ${escapeHtml(d.tsmFmt)}`;
  };

  const series: EChartsOption['series'] = [
    {
      name: dict.charts.series.transitJwstGroup,
      type: 'scatter',
      symbol: 'circle',
      symbolSize: 11,
      itemStyle: {
        color: DARK_ROMER_PALETTE.cerulean,
        borderColor: DARK_ROMER_PALETTE.surface1,
        borderWidth: 1,
      },
      emphasis: { focus: 'series', scale: 1.35 },
      data: trPts,
    },
    {
      name: dict.charts.series.rvChileGroup,
      type: 'scatter',
      symbol: 'diamond',
      symbolSize: 11,
      itemStyle: {
        color: DARK_ROMER_PALETTE.accent,
        borderColor: DARK_ROMER_PALETTE.surface1,
        borderWidth: 1,
      },
      emphasis: { focus: 'series', scale: 1.35 },
      data: rvPts,
    },
  ];

  if (otherPts.length > 0) {
    series.push({
      name: dict.charts.series.otherMethods,
      type: 'scatter',
      symbol: 'triangle',
      symbolSize: 10,
      itemStyle: {
        color: DARK_ROMER_PALETTE.highlight,
        borderColor: DARK_ROMER_PALETTE.surface1,
        borderWidth: 1,
      },
      emphasis: { focus: 'series', scale: 1.35 },
      data: otherPts,
    });
  }

  return {
    ...spec,
    tooltip: {
      ...spec.tooltip,
      formatter: tooltipFmt,
    },
    legend: {
      top: 4,
      left: 12,
      right: 56,
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
    },
    xAxis: darkAxis('log', dict.charts.axes.distanceLogLy, {
      min: dMin,
      max: dMax,
      logBase: 10,
      nameGap: 28,
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('value', dict.charts.axes.esiScore, {
      min: esiMin,
      max: 1.0,
      nameRotate: 90,
      nameGap: 44,
    }) as EChartsOption['yAxis'],
    dataZoom: [{ type: 'inside', xAxisIndex: 0, yAxisIndex: 0 }],
    series,
  };
}

export function buildTsmRankingOption(
  hzPlanets: PlanetRecord[],
  dict: TranslationDictionary,
  lang: Lang,
): EChartsOption {
  const ranked = hzPlanets
    .filter((p) => p.discoverymethod === 'Transit' && p.tsm !== null && Number.isFinite(p.tsm))
    .sort((a, b) => {
      const diff = (b.tsm ?? 0) - (a.tsm ?? 0);
      return diff !== 0 ? diff : b.esi - a.esi;
    })
    .slice(0, 12)
    .reverse();

  if (ranked.length === 0) {
    return emptyChartSpec(dict, dict.tab3.tsmChartTitle, dict.charts.empty.tsmRanking);
  }

  const maxTsm = Math.max(Math.max(...ranked.map((p) => p.tsm ?? 0)) * 1.4, 14.0);
  const barData = ranked.map((p) => {
    const tsm = p.tsm as number;
    const color =
      tsm >= 10 && p.visible_chile
        ? DARK_ROMER_PALETTE.cerulean
        : tsm >= 10
          ? DARK_ROMER_PALETTE.accent
          : DARK_ROMER_PALETTE.slate;
    const chileTag = p.visible_chile ? dict.charts.visibleChileTag : dict.charts.northOnlyTag;
    return {
      value: Number(tsm.toFixed(2)),
      plName: p.pl_name,
      tsmFmt1: formatDecimal(tsm, 1, lang),
      tsmFmt2: formatDecimal(tsm, 2, lang),
      esiPctFmt: formatPercent(p.esi * 100, 1, lang),
      distFmt: formatDecimal(p.sy_dist * PC_TO_LY, 1, lang),
      chileTag,
      itemStyle: { color, borderRadius: [0, 4, 4, 0] },
    };
  });

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'item',
    grid: { top: 44, bottom: 44, left: 14, right: 138, containLabel: true },
  });

  return {
    ...spec,
    tooltip: {
      ...spec.tooltip,
      formatter: (p: unknown) => {
        const d = (p as { data?: (typeof barData)[number] }).data;
        if (!d) return '';
        return `<b>${escapeHtml(d.plName)}</b><br/>TSM: ${escapeHtml(d.tsmFmt2)}<br/>ESI: ${escapeHtml(d.esiPctFmt)}<br/>${escapeHtml(dict.candidateColumns.distanceLy)}: ${escapeHtml(d.distFmt)}<br/>${escapeHtml(d.chileTag)}`;
      },
    },
    xAxis: darkAxis('value', dict.charts.axes.tsmIndex, {
      min: 0,
      max: Number(maxTsm.toFixed(1)),
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('category', '', {
      data: ranked.map((p) => p.pl_name),
      splitLine: { show: false },
    }) as EChartsOption['yAxis'],
    series: [
      {
        name: 'TSM',
        type: 'bar',
        barMaxWidth: 20,
        data: barData,
        label: {
          show: true,
          position: 'right',
          color: DARK_ROMER_PALETTE.textSecondary,
          fontSize: 10,
          formatter: (p: unknown) => {
            const d = (p as { data?: (typeof barData)[number] }).data;
            return d ? `${d.tsmFmt1} · ${d.chileTag}` : '';
          },
        },
        emphasis: {
          focus: 'self',
          itemStyle: { borderColor: DARK_ROMER_PALETTE.textPrimary, borderWidth: 1.1 },
        },
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          lineStyle: { color: DARK_ROMER_PALETTE.highlight, type: 'dashed', width: 1.6 },
          label: {
            show: true,
            formatter: dict.charts.tsmRecommendedLine,
            position: 'end',
            distance: 6,
            color: DARK_ROMER_PALETTE.highlight,
            fontSize: 11,
            backgroundColor: 'rgba(16, 17, 18, 0.88)',
            padding: [2, 5],
            borderRadius: 3,
          },
          data: [{ xAxis: 10 }],
        },
      },
    ],
  };
}

export function buildMapaCieloChileOption(
  planets: PlanetRecord[],
  rMax: number,
  hzMode: HzMode,
  dict: TranslationDictionary,
  lang: Lang,
): EChartsOption {
  const valid = planets.filter(
    (p) =>
      p.ra !== null &&
      p.dec !== null &&
      Number.isFinite(p.ra) &&
      Number.isFinite(p.dec),
  );
  if (valid.length === 0) {
    return emptyChartSpec(dict, dict.tab3.skyMapTitle, dict.charts.empty.skyMap);
  }

  const toPoint = (p: PlanetRecord) => ({
    value: [Number((p.ra as number).toFixed(2)), Number((p.dec as number).toFixed(2))],
    plName: p.pl_name,
    radFmt: formatDecimal(p.pl_rade, 2, lang),
    esiPctFmt: formatPercent(p.esi * 100, 1, lang),
    method: translateMethod(p.discoverymethod, dict),
    raFmt: formatDecimal(p.ra, 2, lang),
    decFmt: formatDecimal(p.dec, 2, lang),
  });

  const bgPoints: Array<ReturnType<typeof toPoint>> = [];
  const chilePoints: Array<ReturnType<typeof toPoint>> = [];
  const northPoints: Array<ReturnType<typeof toPoint>> = [];

  for (const p of valid) {
    const inHz = hzMode === 'Conservadora' ? p.hz_conservadora : p.hz_optimista;
    const isCandidate = inHz && p.pl_rade <= rMax;
    const pt = toPoint(p);
    if (!isCandidate) {
      bgPoints.push(pt);
    } else if ((p.dec as number) <= DEC_LIMIT_CHILE) {
      chilePoints.push(pt);
    } else {
      northPoints.push(pt);
    }
  }

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'item',
    grid: { top: 60, bottom: 54, left: 56, right: 26, containLabel: true },
  });

  return {
    ...spec,
    tooltip: {
      ...spec.tooltip,
      formatter: (p: unknown) => {
        const d = (p as { data?: ReturnType<typeof toPoint> }).data;
        if (!d) return '';
        return `<b>${escapeHtml(d.plName)}</b><br/>${escapeHtml(dict.candidateColumns.radius)}: ${escapeHtml(d.radFmt)} ${escapeHtml(dict.common.earthRadiiShort)}<br/>ESI: ${escapeHtml(d.esiPctFmt)}<br/>${escapeHtml(dict.candidateColumns.method)}: ${escapeHtml(d.method)}<br/>RA / Dec: ${escapeHtml(d.raFmt)}° / ${escapeHtml(d.decFmt)}°`;
      },
    },
    legend: {
      top: 4,
      left: 12,
      right: 56,
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
    },
    xAxis: darkAxis('value', dict.charts.axes.raDeg, {
      min: 0,
      max: 360,
      interval: 60,
      nameGap: 28,
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('value', dict.charts.axes.decDeg, {
      min: -90,
      max: 90,
      interval: 30,
      nameRotate: 90,
      nameGap: 44,
    }) as EChartsOption['yAxis'],
    dataZoom: [{ type: 'inside', xAxisIndex: 0, yAxisIndex: 0 }],
    series: [
      {
        name: `${dict.charts.series.catalogRest} (n = ${formatInt(bgPoints.length, lang)})`,
        type: 'scatter',
        symbolSize: 4,
        large: true,
        largeThreshold: 2000,
        itemStyle: { color: 'rgba(143, 143, 161, 0.34)' },
        data: bgPoints,
        z: 1,
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(0, 177, 194, 0.10)',
            borderColor: DARK_ROMER_PALETTE.teal,
            borderWidth: 1,
            borderType: 'dashed',
          },
          label: {
            show: true,
            position: 'insideTopLeft',
            color: DARK_ROMER_PALETTE.cerulean,
            fontSize: 11,
          },
          data: [[{ name: dict.charts.chileVisibleBand, yAxis: -90 }, { yAxis: DEC_LIMIT_CHILE }]],
        },
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          lineStyle: { color: DARK_ROMER_PALETTE.teal, type: 'dashed', width: 1.4 },
          label: {
            show: true,
            formatter: dict.charts.chileVisibleLimit,
            position: 'insideEndTop',
            color: DARK_ROMER_PALETTE.cerulean,
            fontSize: 11,
          },
          data: [{ yAxis: DEC_LIMIT_CHILE }],
        },
      },
      {
        name: `${dict.charts.series.chileCandidates} (n = ${formatInt(chilePoints.length, lang)})`,
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: {
          color: DARK_ROMER_PALETTE.cerulean,
          borderColor: DARK_ROMER_PALETTE.surface1,
          borderWidth: 1,
        },
        emphasis: { focus: 'series', scale: 1.4 },
        data: chilePoints,
        z: 5,
      },
      {
        name: `${dict.charts.series.northCandidates} (n = ${formatInt(northPoints.length, lang)})`,
        type: 'scatter',
        symbol: 'diamond',
        symbolSize: 10,
        itemStyle: {
          color: DARK_ROMER_PALETTE.highlight,
          borderColor: DARK_ROMER_PALETTE.surface1,
          borderWidth: 1,
        },
        emphasis: { focus: 'series', scale: 1.4 },
        data: northPoints,
        z: 4,
      },
    ],
  };
}

export function buildRadarCandidatosOption(
  hzPlanets: PlanetRecord[],
  dict: TranslationDictionary,
): EChartsOption {
  const valid = hzPlanets.filter(
    (p) => p.sy_dist > 0 && Number.isFinite(p.esi) && Number.isFinite(p.pl_eqt),
  );
  if (valid.length === 0) {
    return emptyChartSpec(dict, dict.tab3.radarReading, dict.charts.empty.radar);
  }

  const validTsm = valid
    .map((p) => p.tsm)
    .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
  const maxTsmRef = validTsm.length > 0 ? Math.max(...validTsm) : 50;
  const denomTsm = Math.log1p(Math.max(maxTsmRef, 50));
  const dMinRef = Math.min(...valid.map((p) => p.sy_dist));

  const scored = valid.map((p) => {
    const esiS = Math.max(0, Math.min(100, p.esi * 100));
    const tsmS =
      p.tsm !== null && Number.isFinite(p.tsm) && p.tsm > 0
        ? Math.max(0, Math.min(100, (Math.log1p(p.tsm) / denomTsm) * 100))
        : 0;
    const proxS = Math.max(0, Math.min(100, (dMinRef / p.sy_dist) * 100));
    const tempS = Math.max(0, Math.min(100, 100 * (1 - Math.abs(p.pl_eqt - 255) / 150)));
    const chileS =
      p.dec === null || !Number.isFinite(p.dec) || p.dec > DEC_LIMIT_CHILE
        ? 0
        : Math.max(20, Math.min(100, 100 - Math.abs(p.dec - -25) * 1.35));

    const composite = 0.35 * esiS + 0.3 * tsmS + 0.2 * chileS + 0.15 * proxS;
    return {
      name: p.pl_name,
      composite,
      values: [
        Number(esiS.toFixed(1)),
        Number(tsmS.toFixed(1)),
        Number(proxS.toFixed(1)),
        Number(tempS.toFixed(1)),
        Number(chileS.toFixed(1)),
      ],
    };
  });

  const top5 = scored.sort((a, b) => b.composite - a.composite).slice(0, 5);
  const spec = baseChartSpec(dict, { tooltipTrigger: 'item' });

  return {
    ...spec,
    legend: {
      top: 4,
      left: 'center',
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
    },
    radar: {
      indicator: [
        { name: dict.charts.radarIndicators.esi, max: 100 },
        { name: dict.charts.radarIndicators.tsm, max: 100 },
        { name: dict.charts.radarIndicators.proximity, max: 100 },
        { name: dict.charts.radarIndicators.temperate, max: 100 },
        { name: dict.charts.radarIndicators.chileVis, max: 100 },
      ],
      radius: '62%',
      center: ['50%', '57%'],
      splitNumber: 4,
      axisName: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
      splitArea: {
        areaStyle: {
          color: ['rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.03)'],
        },
      },
      splitLine: { lineStyle: { color: DARK_ROMER_PALETTE.borderStructural } },
      axisLine: { lineStyle: { color: DARK_ROMER_PALETTE.borderMuted } },
    },
    series: [
      {
        name: 'Top 5 HZ',
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        emphasis: { lineStyle: { width: 3.2 } },
        data: top5.map((item, idx) => {
          const color = CHART_CATEGORICAL_COLORS[idx % CHART_CATEGORICAL_COLORS.length];
          return {
            name: item.name,
            value: item.values,
            lineStyle: { width: 2.2, color },
            itemStyle: { color },
            areaStyle: { opacity: 0.12, color },
          };
        }),
      },
    ],
  };
}

export function buildSensibilidadFultonOption(
  rows: FultonHzRow[],
  dict: TranslationDictionary,
  lang: Lang,
): EChartsOption {
  if (rows.length === 0) {
    return emptyChartSpec(dict, dict.tab4.fultonChartTitle, dict.charts.empty.sensitivity);
  }

  const ordered = [...rows].sort((a, b) => {
    if (a.zona_habitable !== b.zona_habitable) {
      return a.zona_habitable.localeCompare(b.zona_habitable);
    }
    return a.radio_max_rt - b.radio_max_rt;
  });

  const categories = ordered.map((r) => {
    const zShort = r.zona_habitable.startsWith('Cons')
      ? dict.common.hzStrictShort
      : dict.common.hzWideShort;
    return `${zShort} · ≤ ${formatDecimal(r.radio_max_rt, 1, lang)}`;
  });

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'axis',
    magicTypes: ['bar', 'line'],
    grid: { top: 62, bottom: 52, left: 54, right: 24, containLabel: true },
  });

  return {
    ...spec,
    tooltip: { ...spec.tooltip, axisPointer: { type: 'shadow' } },
    legend: {
      top: 4,
      left: 12,
      right: 84,
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
    },
    xAxis: darkAxis('category', dict.charts.axes.fultonHzCriterion, {
      data: categories,
      splitLine: { show: false },
      nameGap: 32,
      axisLabel: { interval: 0, color: DARK_ROMER_PALETTE.textMuted, fontSize: 10.5 },
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('value', dict.charts.axes.candidateCount, {
      nameRotate: 90,
      nameGap: 42,
    }) as EChartsOption['yAxis'],
    series: [
      {
        name: dict.charts.series.inHz,
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: DARK_ROMER_PALETTE.slate, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', color: DARK_ROMER_PALETTE.textSecondary, fontSize: 10 },
        emphasis: { focus: 'series' },
        data: ordered.map((r) => r.total_hz),
      },
      {
        name: dict.charts.series.transiting,
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: DARK_ROMER_PALETTE.accent, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', color: DARK_ROMER_PALETTE.textSecondary, fontSize: 10 },
        emphasis: { focus: 'series' },
        data: ordered.map((r) => r.transitantes),
      },
      {
        name: dict.charts.series.visibleChile,
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: DARK_ROMER_PALETTE.cerulean, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', color: DARK_ROMER_PALETTE.textSecondary, fontSize: 10 },
        emphasis: { focus: 'series' },
        data: ordered.map((r) => r.visibles_chile),
      },
      {
        name: dict.charts.series.chilePlusTsm10,
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: DARK_ROMER_PALETTE.highlight, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', color: DARK_ROMER_PALETTE.textSecondary, fontSize: 10 },
        emphasis: { focus: 'series' },
        data: ordered.map((r) => r.transitantes_chile_tsm10),
      },
    ],
  };
}

export function buildSensibilidadDistTsmOption(
  rows: DistTsmRow[],
  dict: TranslationDictionary,
  lang: Lang,
): EChartsOption {
  if (rows.length === 0) {
    return emptyChartSpec(dict, dict.tab4.distTsmChartTitle, dict.charts.empty.sensitivity);
  }

  const categories = rows.map((r) => {
    const distLy = Math.round(r.distancia_max_pc * PC_TO_LY);
    return `≤ ${formatInt(distLy, lang)} ${dict.common.lightYearsUnit} · TSM ≥ ${r.tsm_minimo}`;
  });

  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'axis',
    magicTypes: ['bar', 'line'],
    grid: { top: 62, bottom: 56, left: 54, right: 24, containLabel: true },
  });

  return {
    ...spec,
    tooltip: { ...spec.tooltip, axisPointer: { type: 'shadow' } },
    legend: {
      top: 4,
      left: 12,
      right: 84,
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
    },
    xAxis: darkAxis('category', dict.charts.axes.distTsmCriterion, {
      data: categories,
      splitLine: { show: false },
      nameGap: 34,
      axisLabel: {
        interval: 0,
        rotate: 16,
        color: DARK_ROMER_PALETTE.textMuted,
        fontSize: 10,
      },
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('value', dict.charts.axes.candidateCount, {
      nameRotate: 90,
      nameGap: 42,
    }) as EChartsOption['yAxis'],
    series: [
      {
        name: dict.charts.series.totalCandidates,
        type: 'bar',
        barMaxWidth: 20,
        itemStyle: { color: DARK_ROMER_PALETTE.slate, borderRadius: [3, 3, 0, 0] },
        emphasis: { focus: 'series' },
        data: rows.map((r) => r.total_candidatos),
      },
      {
        name: dict.charts.series.transiting,
        type: 'bar',
        barMaxWidth: 20,
        itemStyle: { color: DARK_ROMER_PALETTE.accent, borderRadius: [3, 3, 0, 0] },
        emphasis: { focus: 'series' },
        data: rows.map((r) => r.transitantes),
      },
      {
        name: dict.charts.series.visibleChile,
        type: 'bar',
        barMaxWidth: 20,
        itemStyle: { color: DARK_ROMER_PALETTE.cerulean, borderRadius: [3, 3, 0, 0] },
        emphasis: { focus: 'series' },
        data: rows.map((r) => r.visibles_chile),
      },
      {
        name: dict.charts.series.transitVisibleChile,
        type: 'bar',
        barMaxWidth: 20,
        itemStyle: { color: DARK_ROMER_PALETTE.highlight, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', color: DARK_ROMER_PALETTE.textSecondary, fontSize: 10 },
        emphasis: { focus: 'series' },
        data: rows.map((r) => r.transitantes_visibles_chile),
      },
    ],
  };
}

export function buildObservabilityMonthlyOption(
  obs: ObservabilityResponse,
  dict: TranslationDictionary,
): EChartsOption {
  const siteColors = [
    DARK_ROMER_PALETTE.cerulean,
    DARK_ROMER_PALETTE.accent,
    DARK_ROMER_PALETTE.highlight,
    DARK_ROMER_PALETTE.amber,
    DARK_ROMER_PALETTE.textSecondary,
  ];
  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'axis',
    grid: { top: 64, bottom: 44, left: 56, right: 20, containLabel: true },
  });

  return {
    ...spec,
    tooltip: {
      ...spec.tooltip,
      axisPointer: { type: 'line', lineStyle: { color: DARK_ROMER_PALETTE.borderMuted } },
    },
    legend: {
      top: 6,
      left: 10,
      right: 48,
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
    },
    xAxis: darkAxis('category', dict.charts.axes.months, {
      data: dict.months,
      boundaryGap: false,
      splitLine: { show: false },
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('value', dict.charts.axes.hoursPerNight, {
      min: 0,
      max: 12,
      nameRotate: 90,
      nameGap: 38,
    }) as EChartsOption['yAxis'],
    series: obs.sites.map((site, idx) => {
      const color = siteColors[idx % siteColors.length];
      return {
        name: shortObservatoryName(site.site_name),
        type: 'line',
        smooth: 0.2,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        emphasis: { focus: 'series' },
        data: site.monthly_hours_airmass_le_2.map((h) => Number(h.toFixed(2))),
      };
    }),
  };
}

export function buildLightcurveOption(
  lc: LightcurveResponse,
  mode: 'raw' | 'folded',
  dict: TranslationDictionary,
): EChartsOption {
  const spec = baseChartSpec(dict, {
    tooltipTrigger: 'axis',
    grid: { top: 44, bottom: 64, left: 64, right: 20, containLabel: true },
  });

  if (mode === 'raw') {
    const pts = lc.raw_series.map((pt) => [pt.btjd, pt.flux]);
    return {
      ...spec,
      tooltip: {
        ...spec.tooltip,
        trigger: 'item',
      },
      xAxis: darkAxis('value', dict.charts.axes.btjd, {
        scale: true,
        nameGap: 28,
      }) as EChartsOption['xAxis'],
      yAxis: darkAxis('value', dict.charts.axes.normalizedFlux, {
        scale: true,
        nameRotate: 90,
        nameGap: 50,
      }) as EChartsOption['yAxis'],
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 18,
          bottom: 8,
          borderColor: DARK_ROMER_PALETTE.borderStructural,
          backgroundColor: DARK_ROMER_PALETTE.surface2,
          fillerColor: 'rgba(80, 216, 233, 0.16)',
          handleStyle: { color: DARK_ROMER_PALETTE.cerulean },
          textStyle: { color: DARK_ROMER_PALETTE.textMuted, fontSize: 10 },
        },
      ],
      series: [
        {
          name: dict.inspector.lcRawSeriesName,
          type: 'scatter',
          symbolSize: 3.5,
          large: true,
          largeThreshold: 1500,
          itemStyle: { color: DARK_ROMER_PALETTE.cerulean, opacity: 0.72 },
          data: pts,
        },
      ],
    };
  }

  const scatterPts = lc.folded_points.map((pt) => [pt.phase_days, pt.flux]);
  const binnedPts = lc.folded_binned.map((pt) => [pt.phase_days, pt.flux]);

  return {
    ...spec,
    tooltip: { ...spec.tooltip, trigger: 'item' },
    legend: {
      top: 4,
      left: 'center',
      textStyle: { color: DARK_ROMER_PALETTE.textSecondary, fontSize: 11 },
    },
    xAxis: darkAxis('value', dict.charts.axes.phaseDays, {
      scale: true,
      nameGap: 28,
    }) as EChartsOption['xAxis'],
    yAxis: darkAxis('value', dict.charts.axes.normalizedFlux, {
      scale: true,
      nameRotate: 90,
      nameGap: 50,
    }) as EChartsOption['yAxis'],
    dataZoom: [{ type: 'inside', xAxisIndex: 0 }],
    series: [
      {
        name: dict.inspector.lcFoldedPointsName,
        type: 'scatter',
        symbolSize: 3.5,
        large: true,
        largeThreshold: 1500,
        itemStyle: { color: 'rgba(143, 143, 161, 0.45)' },
        data: scatterPts,
        z: 1,
      },
      {
        name: dict.inspector.lcBinnedMedianName,
        type: 'line',
        smooth: 0.15,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2.2, color: DARK_ROMER_PALETTE.highlight },
        itemStyle: { color: DARK_ROMER_PALETTE.highlight },
        data: binnedPts,
        z: 4,
      },
    ],
  };
}
