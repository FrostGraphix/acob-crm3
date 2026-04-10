import { request } from "./api";

export const SITE_CONSUMPTION_SITES = [
  "Musha",
  "Ogufa",
  "Umaisha",
  "Tunga",
  "Kyakale",
] as const;

export type SiteConsumptionSiteName = (typeof SITE_CONSUMPTION_SITES)[number];
export type SiteConsumptionGranularity = "daily" | "monthly" | "yearly";
export type SiteConsumptionCompareMode = "compare" | "combined";

export interface SiteConsumptionSummaryItem {
  site: string;
  totalConsumption: number | null;
}

export interface SiteConsumptionSeriesRow {
  site: string;
  values: Array<number | null>;
}

export interface SiteConsumptionSeriesSnapshot {
  labels: string[];
  series: SiteConsumptionSeriesRow[];
}

export interface SiteConsumptionReportRow {
  periodLabel: string;
  site: string;
  consumption: number | null;
  unitLabel: string;
}

export interface SiteConsumptionRefreshStatus {
  inProgress: boolean;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface SiteConsumptionReportResponse {
  range: {
    fromDate: string;
    toDate: string;
  };
  requestedRange: {
    fromDate: string;
    toDate: string;
  };
  sourceWindow: {
    fromDate: string;
    toDate: string;
  };
  granularity: SiteConsumptionGranularity;
  compareMode: SiteConsumptionCompareMode;
  units: {
    valueKey: "consumption";
    label: string;
  };
  availableSites: string[];
  selectedSites: string[];
  lastUpdatedAt: string | null;
  refreshStatus: SiteConsumptionRefreshStatus;
  summary: SiteConsumptionSummaryItem[];
  topSite: SiteConsumptionSummaryItem | null;
  series: SiteConsumptionSeriesSnapshot;
  rows: SiteConsumptionReportRow[];
  issues: string[];
}

export interface SiteConsumptionReportQuery {
  fromDate?: string;
  toDate?: string;
  granularity: SiteConsumptionGranularity;
  sites: string[];
  compareMode: SiteConsumptionCompareMode;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateSite(site: string) {
  return SITE_CONSUMPTION_SITES.includes(site as SiteConsumptionSiteName);
}

function toNullableNumber(value: unknown) {
  if (value == null) {
    return null;
  }

  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeSummary(rawSummary: unknown) {
  if (!Array.isArray(rawSummary)) {
    throw new Error("Site consumption summary payload is invalid.");
  }

  return rawSummary.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("Site consumption summary item is invalid.");
    }

    const site = String((item as Record<string, unknown>).site ?? "").trim();
    if (!validateSite(site)) {
      throw new Error(`Unexpected site "${site}" in site consumption summary.`);
    }

    return {
      site,
      totalConsumption: toNullableNumber((item as Record<string, unknown>).totalConsumption),
    };
  });
}

function normalizeSeries(rawSeries: unknown): SiteConsumptionSeriesSnapshot {
  if (typeof rawSeries !== "object" || rawSeries === null || Array.isArray(rawSeries)) {
    throw new Error("Site consumption series payload is invalid.");
  }

  const record = rawSeries as Record<string, unknown>;
  const labels = Array.isArray(record.labels)
    ? record.labels.map((label) => String(label))
    : [];

  if (!Array.isArray(record.series)) {
    throw new Error("Site consumption series rows are invalid.");
  }

  const series = record.series.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("Site consumption series row is invalid.");
    }

    const site = String((entry as Record<string, unknown>).site ?? "").trim();
    if (!validateSite(site)) {
      throw new Error(`Unexpected site "${site}" in site consumption series.`);
    }

    const rawValues = Array.isArray((entry as Record<string, unknown>).values)
      ? ((entry as Record<string, unknown>).values as unknown[])
      : [];

    if (rawValues.length !== labels.length) {
      throw new Error(`Series length mismatch for site "${site}".`);
    }

    return {
      site,
      values: rawValues.map(toNullableNumber),
    };
  });

  return {
    labels,
    series,
  };
}

function normalizeRows(rawRows: unknown) {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("Site consumption row is invalid.");
    }

    const row = entry as Record<string, unknown>;
    const site = String(row.site ?? "").trim();
    if (!validateSite(site)) {
      throw new Error(`Unexpected site "${site}" in site consumption rows.`);
    }

    return {
      periodLabel: String(row.periodLabel ?? ""),
      site,
      consumption: toNullableNumber(row.consumption),
      unitLabel: String(row.unitLabel ?? "kWh"),
    };
  });
}

function normalizeResponse(payload: unknown): SiteConsumptionReportResponse {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Site consumption report payload is invalid.");
  }

  const record = payload as Record<string, unknown>;

  return {
    range: record.range as SiteConsumptionReportResponse["range"],
    requestedRange: record.requestedRange as SiteConsumptionReportResponse["requestedRange"],
    sourceWindow: record.sourceWindow as SiteConsumptionReportResponse["sourceWindow"],
    granularity: (record.granularity as SiteConsumptionGranularity) ?? "daily",
    compareMode: (record.compareMode as SiteConsumptionCompareMode) ?? "compare",
    units: (record.units as SiteConsumptionReportResponse["units"]) ?? {
      valueKey: "consumption",
      label: "kWh",
    },
    availableSites: Array.isArray(record.availableSites)
      ? record.availableSites.map((site) => String(site))
      : SITE_CONSUMPTION_SITES.slice(),
    selectedSites: Array.isArray(record.selectedSites)
      ? record.selectedSites.map((site) => String(site))
      : SITE_CONSUMPTION_SITES.slice(),
    lastUpdatedAt: typeof record.lastUpdatedAt === "string" ? record.lastUpdatedAt : null,
    refreshStatus:
      typeof record.refreshStatus === "object" && record.refreshStatus !== null && !Array.isArray(record.refreshStatus)
        ? {
            inProgress: Boolean((record.refreshStatus as Record<string, unknown>).inProgress),
            lastAttemptAt:
              typeof (record.refreshStatus as Record<string, unknown>).lastAttemptAt === "string"
                ? String((record.refreshStatus as Record<string, unknown>).lastAttemptAt)
                : null,
            lastError:
              typeof (record.refreshStatus as Record<string, unknown>).lastError === "string"
                ? String((record.refreshStatus as Record<string, unknown>).lastError)
                : null,
          }
        : {
            inProgress: false,
            lastAttemptAt: null,
            lastError: null,
          },
    summary: normalizeSummary(record.summary),
    topSite:
      typeof record.topSite === "object" && record.topSite !== null && !Array.isArray(record.topSite)
        ? normalizeSummary([record.topSite])[0] ?? null
        : null,
    series: normalizeSeries(record.series),
    rows: normalizeRows(record.rows),
    issues: Array.isArray(record.issues) ? record.issues.map((item) => String(item)) : [],
  };
}

export function createDefaultSiteConsumptionQuery(): SiteConsumptionReportQuery {
  const today = new Date();
  const fromDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: today.toISOString().slice(0, 10),
    granularity: "daily",
    sites: SITE_CONSUMPTION_SITES.slice(),
    compareMode: "compare",
  };
}

export async function loadSiteConsumptionReport(query: SiteConsumptionReportQuery) {
  const payload = await request<unknown>("/api/site-consumption/report", {
    method: "GET",
    query: {
      fromDate: query.fromDate,
      toDate: query.toDate,
      granularity: query.granularity,
      sites: query.sites.join(","),
      compareMode: query.compareMode,
    },
  });

  return normalizeResponse(payload);
}

export function triggerSiteConsumptionRefresh() {
  return request<{ status?: SiteConsumptionRefreshStatus }>("/api/site-consumption/refresh", {
    method: "POST",
    body: {},
  });
}
