import { useEffect, useMemo, useState } from "react";
import { buildReadPayload } from "../services/payload-mapper";
import { loadTableData } from "../services/api";
import type { DataPageConfig, DataRow } from "../types";

function createInitialFilters(page: DataPageConfig) {
  return page.filters.reduce<Record<string, string>>((accumulator, filter) => {
    accumulator[filter.key] = "";
    return accumulator;
  }, {});
}

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

  useEffect(() => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSelectedKeys([]);
    setPageNumber(1);
  }, [initialFilters]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRows() {
      setLoading(true);
      setError(null);

      try {
        const mapping = buildReadPayload(page, appliedFilters, pageNumber, pageSize);
        if (!mapping.ok || !mapping.payload) {
          setError(mapping.message ?? "Invalid search filters");
          setLoading(false);
          return;
        }

        const result = await loadTableData(page.readEndpoint, mapping.payload);

        if (!cancelled) {
          setRows(result.rows);
          setTotal(result.total);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchRows();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, page, page.readEndpoint, pageNumber, pageSize]);

  const search = () => {
    setSelectedKeys([]);
    setPageNumber(1);
    setAppliedFilters(draftFilters);
  };

  const reset = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSelectedKeys([]);
    setPageNumber(1);
  };

  const refresh = async () => {
    const mapping = buildReadPayload(page, appliedFilters, pageNumber, pageSize);
    if (!mapping.ok || !mapping.payload) {
      setError(mapping.message ?? "Invalid search filters");
      return;
    }

    const result = await loadTableData(page.readEndpoint, mapping.payload);

    setRows(result.rows);
    setTotal(result.total);
  };

  const toggleRow = (row: DataRow) => {
    const rowKey = getRowKeyValue(row);

    setSelectedKeys((current) =>
      current.includes(rowKey)
        ? current.filter((entry) => entry !== rowKey)
        : [...current, rowKey],
    );
  };

  const toggleAll = () => {
    const keys = rows.map(getRowKeyValue);
    const allSelected = keys.length > 0 && keys.every((key) => selectedKeys.includes(key));

    setSelectedKeys(allSelected ? [] : keys);
  };

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
    setPageNumber,
    setPageSize,
    search,
    reset,
    refresh,
    toggleRow,
    toggleAll,
    getRowKeyValue,
  };
}
