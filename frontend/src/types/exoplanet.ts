export type Lang = 'es' | 'en';

export type HzMode = 'Conservadora' | 'Optimista';

export type DataSource = 'API' | 'api' | 'archivo' | 'csv_backup' | 'error';

export type TabId = 'history' | 'earthlike' | 'chile-jwst' | 'sensitivity' | 'quality';

export interface AuditReport {
  total_filas: number;
  total_columnas: number;
  duplicados_pl_name: number;
  total_nulos: number;
  nulos_por_columna: Record<string, number>;
  total_imposibles: number;
  imposibles_por_columna: Record<string, number>;
  excluidas_imposibles: number;
  excluidas_nulos: number;
  filas_finales: number;
  porcentaje_retenido: number;
}

export interface MethodSummaryItem {
  id: string;
  count: number;
}

export interface ChileObservatoryInfo {
  id: string;
  name: string;
  lat_deg: number;
  lon_deg: number;
  elev_m: number;
}

export interface FultonHzRow {
  zona_habitable: string;
  rango_insolacion: string;
  radio_max_rt: number;
  total_hz: number;
  transitantes: number;
  visibles_chile: number;
  transitantes_chile_tsm10: number;
}

export interface DistTsmRow {
  distancia_max_pc: number;
  tsm_minimo: number;
  total_candidatos: number;
  transitantes: number;
  visibles_chile: number;
  transitantes_visibles_chile: number;
}

export interface SensitivityData {
  fulton_hz: FultonHzRow[];
  dist_tsm: DistTsmRow[];
}

export interface PlanetRecord {
  pl_name: string;
  hostname: string | null;
  discoverymethod: string | null;
  disc_year: number | null;
  disc_facility: string | null;
  pl_orbper: number | null;
  pl_rade: number;
  pl_bmasse: number | null;
  pl_insol: number;
  pl_eqt: number;
  st_teff: number | null;
  st_rad: number | null;
  sy_dist: number;
  sy_jmag: number | null;
  dec: number | null;
  ra: number | null;
  esi: number;
  tsm: number | null;
  hz_conservadora: boolean;
  hz_optimista: boolean;
  visible_chile: boolean;
  descubierto_chile: boolean;
  es_transito: boolean;
  categoria_radio: string;
  min_airmass_paranal: number | null;
}

export interface BootstrapResponse {
  source: DataSource;
  source_message_es: string;
  source_message_en: string;
  audit: AuditReport;
  year_min: number;
  year_max: number;
  methods: MethodSummaryItem[];
  chile_observatories: ChileObservatoryInfo[];
  sensitivity: SensitivityData;
  planets: PlanetRecord[];
}

export interface ObservatorySiteVisibility {
  site_id: string;
  site_name: string;
  max_altitude_deg: number | null;
  min_airmass: number | null;
  observable_airmass_2: boolean;
  best_months: Array<string | number>;
  monthly_hours_airmass_le_2: number[];
}

export interface ObservabilityResponse {
  pl_name: string;
  ra_deg: number;
  dec_deg: number;
  visible_chile_cutoff: boolean;
  sites: ObservatorySiteVisibility[];
}

export interface LightcurveRawPoint {
  btjd: number;
  flux: number;
}

export interface LightcurveFoldedPoint {
  phase_days: number;
  flux: number;
}

export interface LightcurveResponse {
  pl_name: string;
  hostname: string | null;
  available: boolean;
  mission: string | null;
  author: string | null;
  period_days: number | null;
  source: string | null;
  reason_es: string | null;
  reason_en: string | null;
  raw_series: LightcurveRawPoint[];
  folded_points: LightcurveFoldedPoint[];
  folded_binned: LightcurveFoldedPoint[];
}

export interface FilterState {
  yearMin: number;
  yearMax: number;
  methods: string[];
  rMax: number;
  hzMode: HzMode;
  onlyChile: boolean;
  forceOffline: boolean;
}
