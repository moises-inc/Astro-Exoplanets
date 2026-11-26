import type { CSSProperties, ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
  render: (row: T) => ReactNode;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface ResponsiveTableProps<T> {
  titleId: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyText: string;
  sort?: SortState | null;
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
}

export function ResponsiveTable<T>({
  titleId,
  columns,
  rows,
  rowKey,
  emptyText,
  sort,
  onSortChange,
  onRowClick,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return <div className="notice-bar">{emptyText}</div>;
  }

  const labelVars: Record<string, string> = {};
  columns.forEach((col, idx) => {
    labelVars[`--label-${idx + 1}`] = `"${col.label.replace(/"/g, '\\"')}"`;
  });

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby={titleId}
      className="table-wrapper"
    >
      <table className="exo-table" style={labelVars as CSSProperties}>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              const ariaSort = col.sortable
                ? isSorted
                  ? sort.dir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined;

              return (
                <th
                  key={col.key}
                  scope="col"
                  className={col.numeric ? 'is-numeric' : undefined}
                  aria-sort={ariaSort}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={() => onSortChange(col.key)}
                    >
                      <span>{col.label}</span>
                      <span aria-hidden="true">
                        {isSorted ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={rowKey(row, idx)}
              className={onRowClick ? 'is-clickable' : undefined}
              onClick={
                onRowClick
                  ? (e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button, a, input, select')) return;
                      onRowClick(row);
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td key={col.key} className={col.numeric ? 'is-numeric' : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
