import type {
  BootstrapResponse,
  FilterState,
  LightcurveResponse,
  ObservabilityResponse,
} from '../types/exoplanet';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { detail?: string };
      if (errBody?.detail) {
        detail = errBody.detail;
      }
    } catch {
      // keep HTTP status string
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export function fetchCatalogBootstrap(
  forceOffline: boolean,
  signal?: AbortSignal,
): Promise<BootstrapResponse> {
  const params = new URLSearchParams({
    force_offline: forceOffline ? 'true' : 'false',
  });
  return fetchJson<BootstrapResponse>(`/api/v1/catalog/bootstrap?${params.toString()}`, signal);
}

export function fetchPlanetObservability(
  plName: string,
  signal?: AbortSignal,
): Promise<ObservabilityResponse> {
  return fetchJson<ObservabilityResponse>(
    `/api/v1/planets/${encodeURIComponent(plName)}/observability`,
    signal,
  );
}

export function fetchPlanetLightcurve(
  plName: string,
  signal?: AbortSignal,
): Promise<LightcurveResponse> {
  return fetchJson<LightcurveResponse>(
    `/api/v1/planets/${encodeURIComponent(plName)}/lightcurve`,
    signal,
  );
}

export function buildExportCsvUrl(filters: FilterState, allMethodsCount: number): string {
  const params = new URLSearchParams({
    year_min: String(filters.yearMin),
    year_max: String(filters.yearMax),
    r_max: String(filters.rMax),
    hz_mode: filters.hzMode.toLowerCase(),
    only_chile: filters.onlyChile ? 'true' : 'false',
    force_offline: filters.forceOffline ? 'true' : 'false',
  });
  if (filters.methods.length > 0 && filters.methods.length < allMethodsCount) {
    params.set('methods', filters.methods.join(','));
  }
  return `/api/v1/catalog/export.csv?${params.toString()}`;
}
