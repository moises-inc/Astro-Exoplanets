import type { Lang } from '../types/exoplanet';
import { en } from './en';
import { es } from './es';
import type { TranslationDictionary } from './types';

export type { TranslationDictionary } from './types';

const DICTIONARIES: Record<Lang, TranslationDictionary> = { es, en };

export function getDictionary(lang: Lang): TranslationDictionary {
  return DICTIONARIES[lang];
}

export function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'es';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('lang');
  return raw === 'en' ? 'en' : 'es';
}

export function syncLangToUrl(lang: Lang): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.history.replaceState(null, '', url.toString());
  document.documentElement.lang = lang;
}

export function getLocale(lang: Lang): string {
  return lang === 'es' ? 'es-CL' : 'en-US';
}

function applyTypographicMinus(formatted: string): string {
  return formatted.replace(/-/g, '\u2212');
}

export function formatInt(value: number | null | undefined, lang: Lang): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const str = new Intl.NumberFormat(getLocale(lang), {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return applyTypographicMinus(str);
}

export function formatDecimal(
  value: number | null | undefined,
  decimals: number,
  lang: Lang,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const str = new Intl.NumberFormat(getLocale(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return applyTypographicMinus(str);
}

export function formatPercent(
  value: number | null | undefined,
  decimals: number,
  lang: Lang,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${formatDecimal(value, decimals, lang)} %`;
}

export function translateMethod(method: string | null | undefined, dict: TranslationDictionary): string {
  if (!method || !method.trim()) return dict.common.notAvailable;
  const key = method.trim();
  return dict.methods[key] ?? key;
}

export function translateRadiusCategory(
  category: string | null | undefined,
  dict: TranslationDictionary,
): string {
  if (!category || !category.trim()) return dict.common.notAvailable;
  const key = category.trim();
  return dict.radiusCategories[key] ?? key;
}

const OBSERVATORY_SHORT_NAMES: Record<string, string> = {
  'Cerro Tololo Inter-American Observatory': 'CTIO (Cerro Tololo)',
  'Cerro Tololo Inter-American Observatory (CTIO)': 'CTIO (Tololo)',
  'Atacama Large Millimeter Array (ALMA)': 'ALMA (Atacama)',
  'ALMA (Chajnantor Plateau)': 'ALMA (Chajnantor)',
  'La Silla Observatory': 'La Silla (ESO)',
  'ESO La Silla Observatory': 'La Silla (ESO)',
  'Las Campanas Observatory': 'Las Campanas',
  'Paranal Observatory': 'Paranal (ESO / VLT)',
  'ESO Paranal Observatory (VLT)': 'Paranal (VLT/ELT)',
};

export function shortObservatoryName(name: string): string {
  return OBSERVATORY_SHORT_NAMES[name] ?? name;
}
