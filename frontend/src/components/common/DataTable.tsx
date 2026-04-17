import { useState, useRef, useEffect } from "react";
import { Badge, Button, Surface } from "../../design-system";
import { formatNaira, formatNumber, isCurrencyColumnKey } from "../../services/currency.ts";
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
  onRowClick?: (row: DataRow) => void;
  columnFilters?: Record<string, string>;
  onColumnFilterChange?: (key: string, value: string) => void;
  onColumnSearch?: () => void;
  selectionMode?: "multiple" | "single" | "none";
}

function getColumnLabelText(label: React.ReactNode, fallback: string) {
  if (typeof label === "string" && label.trim().length > 0) {
    return label;
  }

  if (typeof label === "number") {
    return String(label);
  }

  return fallback;
}

function renderValue(value: DataRow[string], columnKey: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span style={{ opacity: 0.4 }}>--</span>;
  }

  const stringValue = String(value);

  if (
    columnKey === "consumption" &&
    ((typeof value === "number" && value === -1) || stringValue.trim() === "-1")
  ) {
    return <span style={{ opacity: 0.4 }}>--</span>;
  }

  // Status Badge Logic
  const statusKeys = ["status", "relayStatus", "energyStatus", "magneticStatus", "terminalCover", "upperOpen", "currentReverse", "currentUnbalance"];
  if (statusKeys.includes(columnKey)) {
    const lower = stringValue.toLowerCase();
    let tone: "neutral" | "success" | "warning" | "danger" = "neutral";
    if (lower.includes("success") || lower.includes("open") || lower.includes("on") || lower === "0") tone = "success";
    if (lower.includes("fail") || lower.includes("close") || lower.includes("off") || lower === "1") tone = "danger";
    if (lower.includes("pend") || lower.includes("wait")) tone = "warning";

    return <Badge tone={tone}>{stringValue}</Badge>;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return <span style={{ opacity: 0.4 }}>--</span>;
  }

  if (typeof value === "number") {
    if (isCurrencyColumnKey(columnKey)) {
      return formatNaira(value);
    }

    return formatNumber(value);
  }

  return stringValue;
}

function getCellToneClass(columnKey: string) {
  const numericAccentKeys = ["vatCharge", "totalUnit", "totalPrice", "tokenRecharge", "maximumPowerLimit", "maximumOverdraftLimit", "score"];
  const timestampKeys = ["createTime", "updateTime", "updatedAt"];
  const badgeKeys = ["stationId", "stationName", "site", "siteId"];
  const monoAccentKeys = ["receiptId", "meterId", "customerId", "id"];

  if (columnKey === "token") {
    return "table-value table-value--token";
  }

  if (columnKey === "remark" || columnKey === "notes") {
    return "table-value table-value--remark";
  }

  if (badgeKeys.includes(columnKey)) {
    return "table-value table-value--badge";
  }

  if (timestampKeys.includes(columnKey)) {
    return "table-value table-value--timestamp";
  }

  if (numericAccentKeys.includes(columnKey)) {
    return "table-value table-value--accent";
  }

  if (monoAccentKeys.includes(columnKey)) {
    return "table-value table-value--mono";
  }

  if (columnKey === "customerName") {
    return "table-value table-value--strong";
  }

  return "table-value";
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
  onRowClick,
  columnFilters = {},
  onColumnFilterChange,
  onColumnSearch,
  selectionMode = "multiple",
}: DataTableProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const showSelection = selectionMode !== "none";
  const allVisibleSelected =
    showSelection && rows.length > 0 && rows.every((row) => selectedKeys.includes(getRowKey(row)));
  const rangeStart = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(total, pageNumber * pageSize);
  const extraColumnCount = (showSelection ? 1 : 0) + (rowActions.length > 0 ? 1 : 0);

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
    <Surface className="table-panel table-panel-vercel ds-table-surface" tone="raised">
      <div className="table-panel-header">
        <div>
          <p className="table-panel-eyebrow">Data view</p>
          <div className="table-panel-title-row">
            <strong className="table-panel-title">{total.toLocaleString()} entries</strong>
            <span className="table-panel-range">
              Showing {rangeStart}-{rangeEnd}
            </span>
          </div>
        </div>
        <div className="table-panel-status">
          {showSelection ? (
            <Badge className="table-panel-chip">
              {selectedKeys.length.toLocaleString()} selected
            </Badge>
          ) : null}
          <Badge className="table-panel-chip">
            Page {pageNumber} of {pageCount}
          </Badge>
        </div>
      </div>

      <div className="table-wrap table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              {showSelection ? (
                <th className="table-select-column">
                  {selectionMode === "multiple" ? (
                    <input checked={allVisibleSelected} className="data-table-checkbox" onChange={onToggleAll} type="checkbox" />
                  ) : (
                    <span className="table-select-placeholder">Target</span>
                  )}
                </th>
              ) : null}
              {columns.map((column) => (
                <th className={`cell-align-${column.align ?? "start"}`} key={column.key} scope="col">
                  <div className="table-header-cell">
                    <span className="table-header-label">{column.label}</span>
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
              {rowActions.length > 0 ? <th className="table-actions-column">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="table-empty" colSpan={columns.length + extraColumnCount}>
                  <div className="loading-pulse">
                    <div className="pulse-circle"></div>
                    <span>Loading rows</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan={columns.length + extraColumnCount}>
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowKey = getRowKey(row);
                const isSelected = selectedKeys.includes(rowKey);

                return (
                  <tr
                    className={`${isSelected ? "selected" : ""}${onRowClick ? " table-row-clickable" : ""}`}
                    key={rowKey}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {showSelection ? (
                      <td className="table-select-column" data-label={selectionMode === "single" ? "Target" : "Select"}>
                        <input
                          checked={isSelected}
                          className="data-table-checkbox"
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => onToggleRow(row)}
                          type={selectionMode === "single" ? "radio" : "checkbox"}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        className={`cell-align-${column.align ?? "start"}`}
                        data-label={getColumnLabelText(column.label, column.key)}
                        data-column-key={column.key}
                        key={`${rowKey}-${column.key}`}
                      >
                        <span className={getCellToneClass(column.key)}>
                          {renderValue(row[column.key], column.key)}
                        </span>
                      </td>
                    ))}
                    {rowActions.length > 0 ? (
                      <td className="row-actions table-actions-column" data-label="Actions">
                        <RowActionsMenu
                          actions={rowActions}
                          row={row}
                          onAction={(action, currentRow) => {
                            onRowAction(action, currentRow);
                          }}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-meta table-meta-vercel">
        <div className="table-meta-summary">
          <strong>Total {total.toLocaleString()}</strong>
          <span>
            Rows {rangeStart}-{rangeEnd}
          </span>
        </div>
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
            <Button
              aria-label="Previous page"
              className="button-icon-only"
              disabled={pageNumber <= 1}
              onClick={() => onPageChange(pageNumber - 1)}
              size="icon"
              tone="ghost"
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Button>
            
            <div className="pagination-numbers">
              {getPageNumbers().map((num) => (
                <Button
                  key={num}
                  className={`pagination-number ${pageNumber === num ? "active" : ""}`}
                  active={pageNumber === num}
                  onClick={() => onPageChange(num)}
                  size="sm"
                  tone={pageNumber === num ? "primary" : "ghost"}
                >
                  {num}
                </Button>
              ))}
            </div>

            <Button
              aria-label="Next page"
              className="button-icon-only"
              disabled={pageNumber >= pageCount}
              onClick={() => onPageChange(pageNumber + 1)}
              size="icon"
              tone="ghost"
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </Surface>
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
    <div className="table-filter-shell" ref={containerRef}>
      <Button
        className={`table-filter-trigger${active ? " is-active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        title="Filter column"
        tone={active ? "secondary" : "ghost"}
      >
        <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" x2="16.65" y1="21" y2="16.65" />
        </svg>
      </Button>

      {isOpen ? (
        <div className="table-filter-popover">
          <input
            autoFocus
            className="table-filter-input"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsOpen(false);
                onSearch();
              }
            }}
            placeholder="Search..."
            type="text"
            value={value}
          />
          <Button
            onClick={() => {
              setIsOpen(false);
              onSearch();
            }}
            tone="primary"
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RowActionsMenu({
  actions,
  row,
  onAction,
}: {
  actions: ActionConfig[];
  row: DataRow;
  onAction: (action: ActionConfig, row: DataRow) => void;
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

  return (
    <div className="table-filter-shell" ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <Button
        className={`table-filter-trigger${isOpen ? " is-active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        title="Actions"
        tone={isOpen ? "secondary" : "ghost"}
      >
        <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
        </svg>
      </Button>

      {isOpen ? (
        <div className="table-filter-popover" style={{ minWidth: "120px", padding: '0.4rem', right: 0, left: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {actions.map((action) => (
            <Button
              key={action.key}
              className={`mini-button mini-button-${action.tone ?? "neutral"}`}
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen(false);
                onAction(action, row);
              }}
              size="sm"
              tone={
                action.tone === "primary"
                  ? "primary"
                  : action.tone === "danger"
                    ? "danger"
                    : "ghost"
              }
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
