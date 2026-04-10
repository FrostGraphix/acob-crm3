import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMeterDrilldownData } from "../../services/meter-drilldown";
import { runPageAction } from "../../services/api";
import type { DataPageConfig, DataRow, TableColumn } from "../../types";

interface MeterDrilldownModalProps {
  page: DataPageConfig;
  meterId: string;
  appliedFilters: Record<string, string>;
  onClose: () => void;
}

function formatValue(value: DataRow[string]) {
  if (value === null || value === undefined) {
    return "--";
  }

  if (typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  const text = String(value);
  return text.trim().length > 0 ? text : "--";
}

function toLocalTimestamp(value: number | null) {
  if (!value) {
    return "--";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "--";
  }
}

function getColumns(page: DataPageConfig, rows: DataRow[]): TableColumn[] {
  if (rows.length === 0) {
    return page.columns;
  }

  const rowKeys = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((key) => rowKeys.add(key));
  }

  const preferred = page.columns.filter((column) => rowKeys.has(column.key));
  if (preferred.length > 0) {
    return preferred;
  }

  return Object.keys(rows[0]).map((key) => ({ key, label: key }));
}

export function MeterDrilldownModal({
  page,
  meterId,
  appliedFilters,
  onClose,
}: MeterDrilldownModalProps) {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<"primary" | "fallback" | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [caseFeedback, setCaseFeedback] = useState<string | null>(null);
  const refreshMs = page.meterDrilldown?.refreshMs ?? 30_000;

  const fetchDrilldown = useCallback(
    async (isBackgroundRefresh: boolean) => {
      if (isBackgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await loadMeterDrilldownData(page, meterId, appliedFilters);
        setRows(result.rows);
        setTotal(result.total);
        setSource(result.source);
        setError(result.error);
        setLastUpdatedAt(Date.now());
      } catch (caughtError) {
        setRows([]);
        setTotal(0);
        setSource(null);
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load meter drilldown data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedFilters, meterId, page],
  );

  useEffect(() => {
    void fetchDrilldown(false);
  }, [fetchDrilldown]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchDrilldown(true);
    }, refreshMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchDrilldown, refreshMs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const displayColumns = useMemo(() => getColumns(page, rows), [page, rows]);

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card meter-drilldown-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="modal-eyebrow">Live Meter Drilldown</span>
            <h3 className="modal-title">
              {page.menuLabel} • {meterId}
            </h3>
            <p className="meter-drilldown-meta">
              Source:{" "}
              <span className={`meter-drilldown-source meter-drilldown-source-${source ?? "none"}`}>
                {source ?? "--"}
              </span>
              {"  "}Last updated: {toLocalTimestamp(lastUpdatedAt)}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close">
            X
          </button>
        </div>

        <div className="modal-body">
          <div className="meter-drilldown-toolbar">
            <button
              className="modal-btn modal-btn--primary"
              disabled={loading || refreshing}
              onClick={() => void fetchDrilldown(true)}
              type="button"
            >
              {refreshing ? "Refreshing..." : "Refresh now"}
            </button>
            <span className="meter-drilldown-count">Rows: {total.toLocaleString()}</span>
          </div>

          {loading ? <p className="meter-drilldown-state">Loading meter details...</p> : null}
          {!loading && error ? <p className="meter-drilldown-state meter-drilldown-state-error">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="meter-drilldown-state">No drilldown records found for this meter and date range.</p>
          ) : null}

          {!loading && rows.length > 0 ? (
            <div className="meter-drilldown-table-wrap">
              <table className="data-table meter-drilldown-table">
                <thead>
                  <tr>
                    {displayColumns.map((column) => (
                      <th key={column.key} scope="col">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${meterId}-${index}`}>
                      {displayColumns.map((column) => (
                        <td data-label={column.label} key={`${meterId}-${index}-${column.key}`}>
                          {formatValue(row[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button
            className="modal-btn modal-btn--primary"
            onClick={() => {
              void runPageAction("/api/theft/cases/create", { meterId, notes: `Opened from ${page.menuLabel} drilldown` })
                .then((result) => setCaseFeedback(result.message ?? "Case created"))
                .catch((caughtError) =>
                  setCaseFeedback(caughtError instanceof Error ? caughtError.message : "Failed to open case"),
                );
            }}
            type="button"
          >
            Open Theft Case
          </button>
          <button className="modal-btn modal-btn--ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {caseFeedback ? <p className="status-banner">{caseFeedback}</p> : null}
      </div>
    </div>
  );
}
