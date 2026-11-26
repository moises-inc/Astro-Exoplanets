import { useMemo, useState } from 'react';
import { buildExportCsvUrl } from '../../api/client';
import {
  formatDecimal,
  formatInt,
  formatPercent,
  translateMethod,
  type TranslationDictionary,
} from '../../i18n';
import type { AuditReport, FilterState, Lang, PlanetRecord } from '../../types/exoplanet';
import {
  buildCsvContent,
  computeDescriptiveStats,
  computeLogCorrelations,
  type DescriptiveStatRow,
} from '../../utils/analytics';
import { buildCandidateColumns } from '../candidateColumns';
import { ResponsiveTable, type SortState, type TableColumn } from '../ResponsiveTable';

interface TabQualityDataProps {
  dict: TranslationDictionary;
  lang: Lang;
  audit: AuditReport;
  filteredPlanets: PlanetRecord[];
  filters: FilterState;
  allMethodsCount: number;
  onInspectPlanet: (plName: string) => void;
}

interface AuditColumnRow {
  column: string;
  description: string;
  nulls: number;
  impossibles: number;
}

const PAGE_SIZE = 25;

export function TabQualityData({
  dict,
  lang,
  audit,
  filteredPlanets,
  filters,
  allMethodsCount,
  onInspectPlanet,
}: TabQualityDataProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>({ key: 'esi', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const statsRows = useMemo(() => computeDescriptiveStats(filteredPlanets), [filteredPlanets]);
  const corrs = useMemo(() => computeLogCorrelations(filteredPlanets), [filteredPlanets]);

  const statsCols: TableColumn<DescriptiveStatRow>[] = useMemo(
    () => [
      {
        key: 'name',
        label: dict.tab5.statsColumns[0],
        render: (r) => dict.tab5.statsVariables[r.variable]?.name ?? r.variable,
      },
      {
        key: 'unit',
        label: dict.tab5.statsColumns[1],
        render: (r) => dict.tab5.statsVariables[r.variable]?.unit ?? '',
      },
      {
        key: 'n',
        label: dict.tab5.statsColumns[2],
        numeric: true,
        render: (r) => formatInt(r.n, lang),
      },
      {
        key: 'mean',
        label: dict.tab5.statsColumns[3],
        numeric: true,
        render: (r) => formatDecimal(r.mean, r.variable === 'esi' ? 3 : 2, lang),
      },
      {
        key: 'median',
        label: dict.tab5.statsColumns[4],
        numeric: true,
        render: (r) => formatDecimal(r.median, r.variable === 'esi' ? 3 : 2, lang),
      },
      {
        key: 'std',
        label: dict.tab5.statsColumns[5],
        numeric: true,
        render: (r) => formatDecimal(r.std, r.variable === 'esi' ? 3 : 2, lang),
      },
      {
        key: 'min',
        label: dict.tab5.statsColumns[6],
        numeric: true,
        render: (r) => formatDecimal(r.min, r.variable === 'esi' ? 3 : 2, lang),
      },
      {
        key: 'max',
        label: dict.tab5.statsColumns[7],
        numeric: true,
        render: (r) => formatDecimal(r.max, r.variable === 'esi' ? 3 : 2, lang),
      },
      {
        key: 'p95',
        label: dict.tab5.statsColumns[8],
        numeric: true,
        render: (r) => formatDecimal(r.p95, r.variable === 'esi' ? 3 : 2, lang),
      },
    ],
    [dict, lang],
  );

  const searchedPlanets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredPlanets;
    return filteredPlanets.filter((p) => {
      const m = translateMethod(p.discoverymethod, dict).toLowerCase();
      return (
        p.pl_name.toLowerCase().includes(q) ||
        (p.hostname ?? '').toLowerCase().includes(q) ||
        (p.discoverymethod ?? '').toLowerCase().includes(q) ||
        m.includes(q)
      );
    });
  }, [filteredPlanets, searchQuery, dict]);

  const sortedPlanets = useMemo(() => {
    if (!sort) return searchedPlanets;
    const factor = sort.dir === 'asc' ? 1 : -1;
    const copy = [...searchedPlanets];

    copy.sort((a, b) => {
      switch (sort.key) {
        case 'pl_name':
          return a.pl_name.localeCompare(b.pl_name) * factor;
        case 'hostname':
          return (a.hostname ?? '').localeCompare(b.hostname ?? '') * factor;
        case 'discoverymethod':
          return (a.discoverymethod ?? '').localeCompare(b.discoverymethod ?? '') * factor;
        case 'disc_year':
          return ((a.disc_year ?? -Infinity) - (b.disc_year ?? -Infinity)) * factor;
        case 'pl_rade':
          return (a.pl_rade - b.pl_rade) * factor;
        case 'pl_insol':
          return (a.pl_insol - b.pl_insol) * factor;
        case 'pl_eqt':
          return (a.pl_eqt - b.pl_eqt) * factor;
        case 'sy_dist':
          return (a.sy_dist - b.sy_dist) * factor;
        case 'esi':
          return (a.esi - b.esi) * factor;
        case 'tsm': {
          const ta = a.tsm ?? (sort.dir === 'asc' ? Infinity : -Infinity);
          const tb = b.tsm ?? (sort.dir === 'asc' ? Infinity : -Infinity);
          return (ta - tb) * factor;
        }
        case 'visible_chile':
          return (Number(a.visible_chile) - Number(b.visible_chile)) * factor;
        default:
          return 0;
      }
    });
    return copy;
  }, [searchedPlanets, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedPlanets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = sortedPlanets.slice(pageStart, pageStart + PAGE_SIZE);

  const handleSortChange = (key: string) => {
    setPage(1);
    setSort((prev) => {
      if (prev && prev.key === key) {
        return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
      }
      return { key, dir: key === 'pl_name' || key === 'hostname' ? 'asc' : 'desc' };
    });
  };

  const handleDownloadCsv = async () => {
    if (sortedPlanets.length === 0 || downloading) return;
    setDownloading(true);
    const filename = 'exoplanetas_filtrados_chile_jwst.csv';

    const triggerBlobDownload = (text: string) => {
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    try {
      if (!searchQuery.trim()) {
        const resp = await fetch(buildExportCsvUrl(filters, allMethodsCount));
        if (resp.ok) {
          const text = await resp.text();
          triggerBlobDownload(text);
          return;
        }
      }
      triggerBlobDownload(buildCsvContent(sortedPlanets));
    } catch {
      triggerBlobDownload(buildCsvContent(sortedPlanets));
    } finally {
      setDownloading(false);
    }
  };

  const catalogCols = useMemo(
    () => buildCandidateColumns(dict, lang, onInspectPlanet, true),
    [dict, lang, onInspectPlanet],
  );

  const auditRows: AuditColumnRow[] = useMemo(() => {
    return Object.entries(audit.nulos_por_columna).map(([col, nulls]) => ({
      column: col,
      description: dict.tab5.nasaColDescriptions[col] ?? dict.tab5.defaultColDescription,
      nulls,
      impossibles: audit.imposibles_por_columna[col] ?? 0,
    }));
  }, [audit, dict]);

  const auditCols: TableColumn<AuditColumnRow>[] = useMemo(
    () => [
      {
        key: 'column',
        label: dict.tab5.auditColumns[0],
        render: (r) => <span className="mono">{r.column}</span>,
      },
      {
        key: 'description',
        label: dict.tab5.auditColumns[1],
        render: (r) => r.description,
      },
      {
        key: 'nulls',
        label: dict.tab5.auditColumns[2],
        numeric: true,
        render: (r) => formatInt(r.nulls, lang),
      },
      {
        key: 'impossibles',
        label: dict.tab5.auditColumns[3],
        numeric: true,
        render: (r) => formatInt(r.impossibles, lang),
      },
    ],
    [dict, lang],
  );

  return (
    <>
      <h2 className="section-heading">{dict.tab5.heading}</h2>

      <section className="kpi-grid" aria-label="Audit KPIs">
        <div className="kpi-card">
          <span className="kpi-label">{dict.tab5.auditKpis.rawTitle}</span>
          <span className="kpi-value">{formatInt(audit.total_filas, lang)}</span>
          <span className="kpi-delta">{dict.tab5.auditKpis.rawDelta}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">{dict.tab5.auditKpis.impossibleTitle}</span>
          <span className="kpi-value">{formatInt(audit.total_imposibles, lang)}</span>
          <span className="kpi-delta">{dict.tab5.auditKpis.impossibleDelta}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">{dict.tab5.auditKpis.nullsTitle}</span>
          <span className="kpi-value">{formatInt(audit.total_nulos, lang)}</span>
          <span className="kpi-delta">{dict.tab5.auditKpis.nullsDelta}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">{dict.tab5.auditKpis.cleanTitle}</span>
          <span className="kpi-value">{formatInt(audit.filas_finales, lang)}</span>
          <span className="kpi-delta">
            {dict.tab5.auditKpis.cleanDelta(formatPercent(audit.porcentaje_retenido, 2, lang))}
          </span>
        </div>
      </section>

      <section className="table-section" aria-labelledby="stats-table-heading">
        <h3 id="stats-table-heading" className="subsection-heading">
          {dict.tab5.statsTitle}
        </h3>
        <ResponsiveTable
          titleId="stats-table-heading"
          columns={statsCols}
          rows={statsRows}
          rowKey={(r) => r.variable}
          emptyText={dict.tab5.statsEmpty}
        />
        <p className="filter-help">
          {dict.tab5.numpyCaption(
            Number.isFinite(corrs.rPeriodRadius)
              ? formatDecimal(corrs.rPeriodRadius, 3, lang)
              : dict.common.notAvailable,
            formatInt(corrs.nPeriodRadius, lang),
            Number.isFinite(corrs.rDistRadius)
              ? formatDecimal(corrs.rDistRadius, 3, lang)
              : dict.common.notAvailable,
            formatInt(corrs.nDistRadius, lang),
            formatInt(corrs.tsmGe10Count, lang),
          )}
        </p>
      </section>

      <section className="table-section" aria-labelledby="full-catalog-heading">
        <h3 id="full-catalog-heading" className="subsection-heading">
          {dict.tab5.catalogTitle}
        </h3>

        <div className="table-toolbar">
          <div className="table-search-box">
            <input
              type="search"
              className="field-input"
              aria-label={dict.tab5.searchLabel}
              placeholder={dict.tab5.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={sortedPlanets.length === 0 || downloading}
            onClick={handleDownloadCsv}
          >
            {downloading ? dict.tab5.downloadingCsv : dict.tab5.downloadCsv}
          </button>
        </div>

        <ResponsiveTable
          titleId="full-catalog-heading"
          columns={catalogCols}
          rows={pageRows}
          rowKey={(p) => p.pl_name}
          emptyText={dict.common.noRows}
          sort={sort}
          onSortChange={handleSortChange}
          onRowClick={(p) => onInspectPlanet(p.pl_name)}
        />

        {sortedPlanets.length > 0 ? (
          <div className="pagination-bar">
            <span className="pagination-info">
              {dict.tab5.paginationShowing(
                formatInt(pageStart + 1, lang),
                formatInt(Math.min(pageStart + PAGE_SIZE, sortedPlanets.length), lang),
                formatInt(sortedPlanets.length, lang),
              )}
            </span>
            <div className="pagination-actions">
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {dict.tab5.prevPage}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {dict.tab5.nextPage}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="table-section" aria-labelledby="raw-audit-heading">
        <h3 id="raw-audit-heading" className="subsection-heading">
          {dict.tab5.auditTableTitle}
        </h3>
        <ResponsiveTable
          titleId="raw-audit-heading"
          columns={auditCols}
          rows={auditRows}
          rowKey={(r) => r.column}
          emptyText={dict.common.noRows}
        />
      </section>
    </>
  );
}
