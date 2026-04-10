import { loadTableData } from "./api.ts";
import type { ApiDataResponse, DataPageConfig, DataRow } from "../types/index.ts";

export interface MeterDrilldownResult {
  rows: DataRow[];
  total: number;
  source: "primary" | "fallback" | null;
  error: string | null;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Failed to load meter drilldown data";
}

export function buildMeterDrilldownPayload(
  meterId: string,
  filters: Record<string, string>,
  pageSize = 50,
) {
  const payload: Record<string, unknown> = {
    meterId,
    pageNumber: 1,
    pageSize,
  };

  if (filters.fromDate) {
    payload.fromDate = filters.fromDate;
  }

  if (filters.toDate) {
    payload.toDate = filters.toDate;
  }

  return payload;
}

export async function loadMeterDrilldownData(
  page: DataPageConfig,
  meterId: string,
  filters: Record<string, string>,
  loader: (path: string, body: Record<string, unknown>) => Promise<ApiDataResponse> = loadTableData,
): Promise<MeterDrilldownResult> {
  const drilldown = page.meterDrilldown;
  if (!drilldown) {
    return {
      rows: [],
      total: 0,
      source: null,
      error: "Meter drilldown is not configured for this page",
    };
  }

  const payload = buildMeterDrilldownPayload(meterId, filters);
  let primaryError: string | null = null;

  try {
    const primary = await loader(drilldown.primaryEndpoint, payload);
    if (primary.rows.length > 0) {
      return {
        ...primary,
        source: "primary",
        error: null,
      };
    }
  } catch (error) {
    primaryError = toErrorMessage(error);
  }

  try {
    const fallback = await loader(drilldown.fallbackEndpoint, payload);
    return {
      ...fallback,
      source: "fallback",
      error: null,
    };
  } catch (error) {
    const fallbackError = toErrorMessage(error);
    return {
      rows: [],
      total: 0,
      source: null,
      error: primaryError
        ? `${primaryError}. Fallback failed: ${fallbackError}`
        : fallbackError,
    };
  }
}
