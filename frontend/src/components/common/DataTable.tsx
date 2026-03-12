import { useState, useRef, useEffect } from "react";
import type { ActionConfig, DataRow, TableColumn } from "../../types";

interface DataTableProps {
  columns: TableColumn[];
  rows: DataRow[];
  rowActions?: ActionConfig[];
  selectedKeys: string[];
  pageNumber: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onToggleAll: () => void;
  onToggleRow: (row: DataRow) => void;
  onRowAction: (action: ActionConfig, row: DataRow) => void;
  onPageChange: (pageNumber: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  getRowKey: (row: DataRow) => string;
  columnFilters?: Record<string, string>;
  onColumnFilterChange?: (key: string, value: string) => void;
  onColumnSearch?: () => void;
}

function renderValue(value: DataRow[string], columnKey: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span style={{ opacity: 0.4 }}>--</span>;
  }

  const stringValue = String(value);

  // Status Badge Logic
  const statusKeys = ["status", "relayStatus", "energyStatus", "magneticStatus", "terminalCover", "upperOpen", "currentReverse", "currentUnbalance"];
  if (statusKeys.includes(columnKey)) {
    const lower = stringValue.toLowerCase();
    let type = "neutral";
    if (lower.includes("success") || lower.includes("open") || lower.includes("on") || lower === "0") type = "success";
    if (lower.includes("fail") || lower.includes("close") || lower.includes("off") || lower === "1") type = "danger";
    if (lower.includes("pend") || lower.includes("wait")) type = "warning";
    
    return <span className={`badge badge-${type}`}>{stringValue}</span>;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return <span style={{ opacity: 0.4 }}>--</span>;
  }

  if (typeof value === "number") {
    // Format numbers with commas (e.g. 21,604,000 or 4,302.25)
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  return stringValue;
}

export function DataTable({
  columns,
  rows,
  rowActions = [],
  selectedKeys,
  pageNumber,
  pageSize,
  total,
  loading,
  onToggleAll,
  onToggleRow,
  onRowAction,
  onPageChange,
  onPageSizeChange,
  getRowKey,
  columnFilters = {},
  onColumnFilterChange,
  onColumnSearch,
}: DataTableProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selectedKeys.includes(getRowKey(row)));

  // Generate pagination window
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, pageNumber - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    if (end > pageCount) {
      end = pageCount;
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <section className="table-panel">
      <div className="table-wrap table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input checked={allVisibleSelected} className="data-table-checkbox" onChange={onToggleAll} type="checkbox" />
              </th>
              {columns.map((column) => (
                <th key={column.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>{column.label}</span>
                    <span className="sort-indicator">
                      <svg fill="currentColor" height="6" viewBox="0 0 10 6" width="10" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 0L10 6H0L5 0Z" />
                      </svg>
                      <svg fill="currentColor" height="6" style={{ marginTop: '2px' }} viewBox="0 0 10 6" width="10" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 6L0 0H10L5 6Z" />
                      </svg>
                    </span>
                    {column.searchable ? (
                      <ColumnFilter
                        value={columnFilters[column.key] ?? ""}
                        onChange={(val) => onColumnFilterChange?.(column.key, val)}
                        onSearch={() => onColumnSearch?.()}
                      />
                    ) : null}
                  </div>
                </th>
              ))}
              {rowActions.length > 0 ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="table-empty" colSpan={columns.length + 2}>
                  <div className="loading-pulse">
                    <div className="pulse-circle"></div>
                    <span>Loading Premium Data...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={columns.length + 2}>
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowKey = getRowKey(row);
                const isSelected = selectedKeys.includes(rowKey);

                return (
                  <tr className={isSelected ? "selected" : ""} key={rowKey}>
                    <td>
                      <input
                        checked={isSelected}
                        className="data-table-checkbox"
                        onChange={() => onToggleRow(row)}
                        type="checkbox"
                      />
                    </td>
                    {columns.map((column) => (
                      <td
                        className={`cell-align-${column.align ?? "start"}`}
                        key={`${rowKey}-${column.key}`}
                      >
                        {renderValue(row[column.key], column.key)}
                      </td>
                    ))}
                    {rowActions.length > 0 ? (
                      <td className="row-actions" style={{ whiteSpace: 'nowrap' }}>
                        {rowActions.map((action) => (
                          <button
                            className={`mini-button mini-button-${action.tone ?? "neutral"}`}
                            key={action.key}
                            onClick={() => onRowAction(action, row)}
                            type="button"
                          >
                            {action.label}
                          </button>
                        ))}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-meta" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', background: 'color-mix(in srgb, var(--panel-glass) 96%, transparent)' }}>
        <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total {total}</strong>
        <div className="table-pagination">
          <label className="pagination-page-size">
            <span>Rows:</span>
            <select
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={pageSize}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          
          <div className="pagination-controls">
            <button
              className="button-icon-only"
              disabled={pageNumber <= 1}
              onClick={() => onPageChange(pageNumber - 1)}
              type="button"
              aria-label="Previous page"
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            
            <div className="pagination-numbers">
              {getPageNumbers().map((num) => (
                <button
                  key={num}
                  className={`pagination-number ${pageNumber === num ? 'active' : ''}`}
                  onClick={() => onPageChange(num)}
                  type="button"
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              className="button-icon-only"
              disabled={pageNumber >= pageCount}
              onClick={() => onPageChange(pageNumber + 1)}
              type="button"
              aria-label="Next page"
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ColumnFilter({
  value,
  onChange,
  onSearch,
}: {
  value: string;
  onChange: (val: string) => void;
  onSearch: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const active = value.trim().length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        className="button-icon-only"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: "2px",
          color: active ? "var(--acob-green)" : "inherit",
          opacity: active ? 1 : 0.4,
          background: "transparent",
        }}
        title="Filter column"
        type="button"
      >
        <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" x2="16.65" y1="21" y2="16.65" />
        </svg>
      </button>

      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "-1rem",
            marginTop: "0.25rem",
            padding: "0.75rem",
            background: "var(--bg-panel)",
            border: "1px solid var(--border-light)",
            borderRadius: "0.5rem",
            boxShadow: "var(--shadow-modal)",
            zIndex: 20,
            display: "flex",
            gap: "0.5rem",
          }}
        >
          <input
            autoFocus
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsOpen(false);
                onSearch();
              }
            }}
            placeholder="Search..."
            style={{
              padding: "0.4rem 0.6rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border-light)",
              background: "var(--bg-app)",
              color: "var(--text-main)",
              fontSize: "0.875rem",
              width: "12rem",
            }}
            type="text"
            value={value}
          />
          <button
            className="button button-primary"
            onClick={() => {
              setIsOpen(false);
              onSearch();
            }}
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.875rem" }}
            type="button"
          >
            Go
          </button>
        </div>
      ) : null}
    </div>
  );
}
