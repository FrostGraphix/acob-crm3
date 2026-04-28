import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildReadPayload } from "../services/payload-mapper";
import { loadTableData } from "../services/api";
import { createInitialFilters } from "../services/filter-defaults.ts";
import type { DataPageConfig, DataRow } from "../types";

function getRowKeyValue(row: DataRow) {
  const candidate =
    row.id ??
    row.customerId ??
    row.meterId ??
    row.receiptId ??
    row.gatewayId ??
    row.name;

  return String(candidate ?? JSON.stringify(row));
}

export function useDataTable(page: DataPageConfig) {
  const initialFilters = useMemo(() => createInitialFilters(page), [page]);
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>(initialFilters);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortName, setSortName] = useState(page.columns[0]?.key ?? "createTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [livePaused, setLivePaused] = useState(false);
  const liveFailureCountRef = useRef(0);

  const fetchRows = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      if (options.showLoading) {
        setLoading(true);
      }
      setError(null);

      const mapping = buildReadPayload(
        page,
        {
          ...appliedFilters,
          orderBy: sortName ? `${sortName} ${sortDirection}` : "",
        },
        pageNumber,
        pageSize,
      );
      if (!mapping.ok || !mapping.payload) {
        setError(mapping.message ?? "Invalid search filters");
        if (options.showLoading) {
          setLoading(false);
        }
        return false;
      }

      try {
        const result = await loadTableData(
          page.readEndpoint,
          mapping.payload,
          page.readMethod ?? "POST",
        );
        setRows(result.rows);
        setTotal(result.total);
        setLastUpdatedAt(Date.now());
        return true;
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load data");
        return false;
      } finally {
        if (options.showLoading) {
          setLoading(false);
        }
      }
    },
    [appliedFilters, page, pageNumber, pageSize, sortDirection, sortName],
  );

  useEffect(() => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSelectedKeys([]);
    setPageNumber(1);
    setSortName(page.columns[0]?.key ?? "createTime");
    setSortDirection("desc");
    setLastUpdatedAt(null);
  }, [initialFilters, page.columns]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const success = await fetchRows({ showLoading: true });
      if (!cancelled) {
        liveFailureCountRef.current = success ? 0 : liveFailureCountRef.current;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchRows]);

  useEffect(() => {
    const liveConfig = page.live;
    if (!liveConfig?.enabled || liveConfig.intervalMs <= 0) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const scheduleNext = (delayMs: number) => {
      timeoutId = window.setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (cancelled) {
        return;
      }

      const hidden = typeof document !== "undefined" && document.hidden;
      if (livePaused || (liveConfig.pauseOnHidden && hidden)) {
        scheduleNext(liveConfig.intervalMs);
        return;
      }

      const success = await fetchRows();
      if (success) {
        liveFailureCountRef.current = 0;
      } else {
        liveFailureCountRef.current = Math.min(liveFailureCountRef.current + 1, 4);
      }

      const multiplier = Math.max(1, 2 ** liveFailureCountRef.current);
      scheduleNext(liveConfig.intervalMs * multiplier);
    };

    scheduleNext(liveConfig.intervalMs);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [fetchRows, livePaused, page.live]);

  const search = useCallback(() => {
    setSelectedKeys([]);
    setPageNumber(1);
    setAppliedFilters(draftFilters);
  }, [draftFilters]);

  const reset = useCallback(() => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSelectedKeys([]);
    setPageNumber(1);
  }, [initialFilters]);

  const refresh = useCallback(async () => {
    const success = await fetchRows();
    if (!success) {
      throw new Error(error ?? "Failed to refresh");
    }
  }, [error, fetchRows]);

  const toggleRow = useCallback((row: DataRow) => {
    const rowKey = getRowKeyValue(row);

    setSelectedKeys((current) =>
      current.includes(rowKey)
        ? current.filter((entry) => entry !== rowKey)
        : [...current, rowKey],
    );
  }, []);

  const toggleAll = useCallback(() => {
    const keys = rows.map(getRowKeyValue);
    const allSelected = keys.length > 0 && keys.every((key) => selectedKeys.includes(key));

    setSelectedKeys(allSelected ? [] : keys);
  }, [rows, selectedKeys]);

  return {
    draftFilters,
    setDraftFilters,
    appliedFilters,
    rows,
    total,
    loading,
    error,
    selectedKeys,
    pageNumber,
    pageSize,
    sortName,
    sortDirection,
    setSortName,
    setSortDirection,
    setPageNumber,
    setPageSize,
    search,
    reset,
    refresh,
    toggleRow,
    toggleAll,
    getRowKeyValue,
    live: {
      enabled: Boolean(page.live?.enabled),
      paused: livePaused,
      setPaused: setLivePaused,
      lastUpdatedAt,
    },
  };
}
