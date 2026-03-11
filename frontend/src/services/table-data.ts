import type { ApiDataResponse, DataRow } from "../types";
import { mapEndpointRows } from "./endpoint-row-mapper.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toDataRowArray(value: unknown): DataRow[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((entry, index) => {
    if (isPlainObject(entry)) {
      return entry as DataRow;
    }

    return {
      id: `row-${index + 1}`,
      value: entry === null || entry === undefined ? "" : String(entry),
    } satisfies DataRow;
  });
}

function buildResponse(
  rows: DataRow[],
  totalCandidate?: unknown,
  endpoint?: string,
): ApiDataResponse {
  const normalizedTotal = toFiniteNumber(totalCandidate);
  const mappedRows = mapEndpointRows(endpoint, rows);

  return {
    rows: mappedRows,
    total: normalizedTotal === null ? mappedRows.length : Math.max(0, Math.floor(normalizedTotal)),
  };
}

function tryNormalizeCandidate(candidate: unknown, endpoint?: string): ApiDataResponse | null {
  const directRows = toDataRowArray(candidate);
  if (directRows) {
    return buildResponse(directRows, undefined, endpoint);
  }

  if (!isPlainObject(candidate)) {
    return null;
  }

  const collectionKeys = ["rows", "data", "list", "records", "items"];
  const totalKeys = ["total", "count", "totalCount", "recordsTotal", "rowCount", "size"];

  for (const collectionKey of collectionKeys) {
    const rows = toDataRowArray(candidate[collectionKey]);
    if (rows) {
      const totalKey = totalKeys.find((key) => candidate[key] !== undefined);
      return buildResponse(rows, totalKey ? candidate[totalKey] : undefined, endpoint);
    }
  }

  for (const nestedKey of ["result", "page", "payload", "content"]) {
    if (candidate[nestedKey] !== undefined) {
      const nested = tryNormalizeCandidate(candidate[nestedKey], endpoint);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function normalizeTableData(result: unknown, endpoint?: string): ApiDataResponse {
  return tryNormalizeCandidate(result, endpoint) ?? { rows: [], total: 0 };
}
