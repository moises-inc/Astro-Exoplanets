import type {
  DistTsmRow,
  FilterState,
  FultonHzRow,
  HzMode,
  PlanetRecord,
  SensitivityData,
} from '../types/exoplanet';

export const PC_TO_LY = 3.26156;
export const DEC_LIMIT_CHILE = 20.0;
export const HZ_CONSERVATIVE_MIN = 0.36;
export const HZ_CONSERVATIVE_MAX = 1.11;
export const HZ_OPTIMISTIC_MIN = 0.25;
export const HZ_OPTIMISTIC_MAX = 1.50;

export function getHzBounds(mode: HzMode): { min: number; max: number } {
  return mode === 'Conservadora'
    ? { min: HZ_CONSERVATIVE_MIN, max: HZ_CONSERVATIVE_MAX }
    : { min: HZ_OPTIMISTIC_MIN, max: HZ_OPTIMISTIC_MAX };
}

export function filterPlanets(planets: PlanetRecord[], filters: FilterState): PlanetRecord[] {
  const selectedMethods = new Set(filters.methods);
  if (selectedMethods.size === 0) return [];

  return planets.filter((p) => {
    if (p.disc_year !== null && Number.isFinite(p.disc_year)) {
      const yr = Math.round(p.disc_year);
      if (yr < filters.yearMin || yr > filters.yearMax) return false;
    }
    if (!p.discoverymethod || !selectedMethods.has(p.discoverymethod)) {
      return false;
    }
    if (filters.onlyChile && !p.visible_chile) {
      return false;
    }
    return true;
  });
}

export function filterHzRocky(
  planets: PlanetRecord[],
  rMax: number,
  hzMode: HzMode,
): PlanetRecord[] {
  return planets.filter((p) => {
    const inHz = hzMode === 'Conservadora' ? p.hz_conservadora : p.hz_optimista;
    return inHz && p.pl_rade <= rMax;
  });
}

export interface MethodSummaryRow {
  discoverymethod: string;
  total: number;
  percentage: number;
  medianRadius: number;
  medianDistPc: number;
  inHzOptimistic: number;
  visibleChile: number;
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function summarizeByMethod(planets: PlanetRecord[]): MethodSummaryRow[] {
  if (planets.length === 0) return [];
  const groups = new Map<string, PlanetRecord[]>();
  for (const p of planets) {
    const m = p.discoverymethod ?? 'Unknown';
    const arr = groups.get(m);
    if (arr) arr.push(p);
    else groups.set(m, [p]);
  }
  const totalGlobal = planets.length;
  const rows: MethodSummaryRow[] = [];
  for (const [discoverymethod, items] of groups.entries()) {
    rows.push({
      discoverymethod,
      total: items.length,
      percentage: Number(((items.length / totalGlobal) * 100).toFixed(2)),
      medianRadius: median(items.map((x) => x.pl_rade).filter(Number.isFinite)),
      medianDistPc: median(items.map((x) => x.sy_dist).filter(Number.isFinite)),
      inHzOptimistic: items.filter((x) => x.hz_optimista).length,
      visibleChile: items.filter((x) => x.visible_chile).length,
    });
  }
  return rows.sort((a, b) => b.total - a.total);
}

export interface ObservatoryChileRow {
  observatory: string;
  totalDiscovered: number;
  rocky16: number;
  inHzOptimistic: number;
  visibleChile: number;
  primaryMethod: string;
  firstYear: number | null;
  lastYear: number | null;
  medianRadius: number;
  medianDistLy: number;
}

export function summarizeChileObservatories(planets: PlanetRecord[]): ObservatoryChileRow[] {
  const chileDisc = planets.filter((p) => p.descubierto_chile && p.disc_facility);
  if (chileDisc.length === 0) return [];

  const groups = new Map<string, PlanetRecord[]>();
  for (const p of chileDisc) {
    const fac = p.disc_facility ?? 'Unknown';
    const arr = groups.get(fac);
    if (arr) arr.push(p);
    else groups.set(fac, [p]);
  }

  const rows: ObservatoryChileRow[] = [];
  for (const [observatory, items] of groups.entries()) {
    const methodCounts = new Map<string, number>();
    const years: number[] = [];
    for (const item of items) {
      if (item.discoverymethod) {
        methodCounts.set(item.discoverymethod, (methodCounts.get(item.discoverymethod) ?? 0) + 1);
      }
      if (item.disc_year !== null && Number.isFinite(item.disc_year)) {
        years.push(Math.round(item.disc_year));
      }
    }
    let primaryMethod = 'N/D';
    let bestCount = -1;
    for (const [m, cnt] of methodCounts.entries()) {
      if (cnt > bestCount) {
        bestCount = cnt;
        primaryMethod = m;
      }
    }

    rows.push({
      observatory,
      totalDiscovered: items.length,
      rocky16: items.filter((x) => x.pl_rade <= 1.6).length,
      inHzOptimistic: items.filter((x) => x.hz_optimista).length,
      visibleChile: items.filter((x) => x.visible_chile).length,
      primaryMethod,
      firstYear: years.length > 0 ? Math.min(...years) : null,
      lastYear: years.length > 0 ? Math.max(...years) : null,
      medianRadius: median(items.map((x) => x.pl_rade).filter(Number.isFinite)),
      medianDistLy: median(items.map((x) => x.sy_dist).filter(Number.isFinite)) * PC_TO_LY,
    });
  }

  return rows.sort((a, b) => b.totalDiscovered - a.totalDiscovered);
}

export function computeSensitivity(planets: PlanetRecord[]): SensitivityData {
  const fulton_hz: FultonHzRow[] = [];
  const defs: Array<{ zone: string; range: string; check: (p: PlanetRecord) => boolean }> = [
    { zone: 'Conservadora', range: '0.36–1.11 S⊕', check: (p) => p.hz_conservadora },
    { zone: 'Optimista', range: '0.25–1.50 S⊕', check: (p) => p.hz_optimista },
  ];
  for (const def of defs) {
    for (const rMax of [1.6, 1.8, 2.0]) {
      const sub = planets.filter((p) => def.check(p) && p.pl_rade <= rMax);
      fulton_hz.push({
        zona_habitable: def.zone,
        rango_insolacion: def.range,
        radio_max_rt: rMax,
        total_hz: sub.length,
        transitantes: sub.filter((p) => p.es_transito).length,
        visibles_chile: sub.filter((p) => p.visible_chile).length,
        transitantes_chile_tsm10: sub.filter(
          (p) => p.es_transito && p.visible_chile && p.tsm !== null && p.tsm >= 10.0,
        ).length,
      });
    }
  }

  const dist_tsm: DistTsmRow[] = [];
  const opt16 = planets.filter((p) => p.hz_optimista && p.pl_rade <= 1.6);
  for (const dMax of [15, 30, 50]) {
    for (const tsmMin of [10, 15, 20]) {
      const sub = opt16.filter(
        (p) => p.sy_dist <= dMax && p.tsm !== null && p.tsm >= tsmMin,
      );
      dist_tsm.push({
        distancia_max_pc: dMax,
        tsm_minimo: tsmMin,
        total_candidatos: sub.length,
        transitantes: sub.filter((p) => p.es_transito).length,
        visibles_chile: sub.filter((p) => p.visible_chile).length,
        transitantes_visibles_chile: sub.filter((p) => p.es_transito && p.visible_chile).length,
      });
    }
  }

  return { fulton_hz, dist_tsm };
}

export interface DescriptiveStatRow {
  variable: string;
  n: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  p95: number;
}

const DESCRIPTIVE_VARS: Array<{
  key: string;
  extract: (p: PlanetRecord) => number | null;
}> = [
  { key: 'pl_rade', extract: (p) => p.pl_rade },
  { key: 'pl_bmasse', extract: (p) => p.pl_bmasse },
  { key: 'pl_insol', extract: (p) => p.pl_insol },
  { key: 'pl_eqt', extract: (p) => (Number.isFinite(p.pl_eqt) ? p.pl_eqt - 273.15 : null) },
  { key: 'sy_dist', extract: (p) => (Number.isFinite(p.sy_dist) ? p.sy_dist * PC_TO_LY : null) },
  { key: 'pl_orbper', extract: (p) => p.pl_orbper },
  { key: 'esi', extract: (p) => p.esi },
  { key: 'tsm', extract: (p) => p.tsm },
];

export function computeDescriptiveStats(planets: PlanetRecord[]): DescriptiveStatRow[] {
  if (planets.length === 0) return [];
  const rows: DescriptiveStatRow[] = [];

  for (const spec of DESCRIPTIVE_VARS) {
    const vals: number[] = [];
    for (const p of planets) {
      const v = spec.extract(p);
      if (v !== null && Number.isFinite(v)) vals.push(v);
    }
    const n = vals.length;
    if (n === 0) {
      rows.push({
        variable: spec.key,
        n: 0,
        mean: Number.NaN,
        median: Number.NaN,
        std: Number.NaN,
        min: Number.NaN,
        max: Number.NaN,
        p95: Number.NaN,
      });
      continue;
    }

    const sum = vals.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;
    const med = median(vals);
    let std = 0;
    if (n > 1) {
      const sq = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0);
      std = Math.sqrt(sq / (n - 1));
    }
    let minVal = vals[0];
    let maxVal = vals[0];
    for (const v of vals) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    rows.push({
      variable: spec.key,
      n,
      mean,
      median: med,
      std,
      min: minVal,
      max: maxVal,
      p95: percentile(vals, 95),
    });
  }

  return rows;
}

export interface LogCorrelations {
  rPeriodRadius: number;
  nPeriodRadius: number;
  rDistRadius: number;
  nDistRadius: number;
  tsmGe10Count: number;
}

function pearsonLog10(
  planets: PlanetRecord[],
  getX: (p: PlanetRecord) => number | null,
  getY: (p: PlanetRecord) => number | null,
): { r: number; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of planets) {
    const x = getX(p);
    const y = getY(p);
    if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0) {
      xs.push(Math.log10(x));
      ys.push(Math.log10(y));
    }
  }
  const n = xs.length;
  if (n < 2) return { r: Number.NaN, n };
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return { r: Number.NaN, n };
  return { r: num / Math.sqrt(denX * denY), n };
}

export function computeLogCorrelations(planets: PlanetRecord[]): LogCorrelations {
  const pr = pearsonLog10(
    planets,
    (p) => p.pl_orbper,
    (p) => p.pl_rade,
  );
  const dr = pearsonLog10(
    planets,
    (p) => p.sy_dist,
    (p) => p.pl_rade,
  );
  const tsmGe10Count = planets.filter((p) => p.tsm !== null && p.tsm >= 10).length;
  return {
    rPeriodRadius: pr.r,
    nPeriodRadius: pr.n,
    rDistRadius: dr.r,
    nDistRadius: dr.n,
    tsmGe10Count,
  };
}

export function getTopCandidates(
  planets: PlanetRecord[],
  options: {
    n: number;
    onlyTransit: boolean;
    onlyChile: boolean;
    hzMode: HzMode;
    rMax: number;
    sortBy: 'esi' | 'tsm';
  },
): PlanetRecord[] {
  const filtered = planets.filter((p) => {
    const inHz = options.hzMode === 'Conservadora' ? p.hz_conservadora : p.hz_optimista;
    if (!inHz) return false;
    if (p.pl_rade > options.rMax) return false;
    if (options.onlyTransit && !p.es_transito) return false;
    if (options.onlyChile && !p.visible_chile) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (options.sortBy === 'tsm') {
      const ta = a.tsm ?? -Infinity;
      const tb = b.tsm ?? -Infinity;
      if (tb !== ta) return tb - ta;
      return b.esi - a.esi;
    }
    return b.esi - a.esi;
  });

  return sorted.slice(0, options.n);
}

export function buildCsvContent(planets: PlanetRecord[]): string {
  const headers = [
    'pl_name',
    'hostname',
    'discoverymethod',
    'disc_year',
    'disc_facility',
    'pl_orbper',
    'pl_rade',
    'pl_bmasse',
    'pl_insol',
    'pl_eqt',
    'st_teff',
    'st_rad',
    'sy_dist',
    'sy_jmag',
    'dec',
    'ra',
    'esi',
    'tsm',
    'hz_conservadora',
    'hz_optimista',
    'visible_chile',
    'descubierto_chile',
    'es_transito',
    'categoria_radio',
    'min_airmass_paranal',
  ] as const;

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [headers.join(',')];
  for (const p of planets) {
    lines.push(headers.map((h) => escapeCell(p[h])).join(','));
  }
  return lines.join('\n');
}
