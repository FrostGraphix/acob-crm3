import { request } from "./api.ts";

export interface ManagementConsumptionSummary {
  totalConsumptionKwh: number;
  totalDayKwh: number;
  totalNightKwh: number;
  percentDay: number;
  percentNight: number;
  totalRevenue: number | null;
  peakDay: {
    label: string;
    dayKwh: number;
    nightKwh: number;
    totalKwh: number;
  } | null;
  totalAccounts: number | null;
  trackedSites: number;
  topSite: {
    site: string;
    totalConsumptionKwh: number;
  } | null;
}

export interface ManagementConsumptionResponse {
  availableSites: string[];
  selectedSite: string | null;
  sourceWindow: {
    fromDate: string;
    toDate: string;
  };
  lastUpdatedAt: string | null;
  summary: ManagementConsumptionSummary;
  trend: {
    labels: string[];
    dayValues: number[];
    nightValues: number[];
    totalValues: number[];
  };
  issues: string[];
}

export interface ManagementMeterConsumptionRow {
  meterId: string;
  customerName: string;
  site: string;
  totalKwh: number;
  dayKwh: number;
  nightKwh: number;
  percentDay: number;
  updatedAt: string | null;
  snapshotDate: string | null;
}

export interface ManagementMeterConsumptionResponse {
  availableSites: string[];
  selectedSite: string | null;
  snapshotDate: string | null;
  lastUpdatedAt: string | null;
  total: number;
  rows: ManagementMeterConsumptionRow[];
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeConsumptionResponse(payload: unknown): ManagementConsumptionResponse {
  const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const summaryRecord =
    typeof record.summary === "object" && record.summary !== null
      ? (record.summary as Record<string, unknown>)
      : {};
  const topSiteRecord =
    typeof summaryRecord.topSite === "object" && summaryRecord.topSite !== null
      ? (summaryRecord.topSite as Record<string, unknown>)
      : null;
  const peakDayRecord =
    typeof summaryRecord.peakDay === "object" && summaryRecord.peakDay !== null
      ? (summaryRecord.peakDay as Record<string, unknown>)
      : null;
  const trendRecord =
    typeof record.trend === "object" && record.trend !== null
      ? (record.trend as Record<string, unknown>)
      : {};

  return {
    availableSites: Array.isArray(record.availableSites)
      ? record.availableSites.map((site) => String(site))
      : [],
    selectedSite: typeof record.selectedSite === "string" ? record.selectedSite : null,
    sourceWindow: {
      fromDate: String((record.sourceWindow as Record<string, unknown> | undefined)?.fromDate ?? ""),
      toDate: String((record.sourceWindow as Record<string, unknown> | undefined)?.toDate ?? ""),
    },
    lastUpdatedAt: typeof record.lastUpdatedAt === "string" ? record.lastUpdatedAt : null,
    summary: {
      totalConsumptionKwh: asNumber(summaryRecord.totalConsumptionKwh),
      totalDayKwh: asNumber(summaryRecord.totalDayKwh),
      totalNightKwh: asNumber(summaryRecord.totalNightKwh),
      percentDay: asNumber(summaryRecord.percentDay),
      percentNight: asNumber(summaryRecord.percentNight),
      totalRevenue: summaryRecord.totalRevenue == null ? null : asNumber(summaryRecord.totalRevenue),
      peakDay:
        peakDayRecord == null
          ? null
          : {
              label: String(peakDayRecord.label ?? ""),
              dayKwh: asNumber(peakDayRecord.dayKwh),
              nightKwh: asNumber(peakDayRecord.nightKwh),
              totalKwh: asNumber(peakDayRecord.totalKwh),
            },
      totalAccounts: summaryRecord.totalAccounts == null ? null : asNumber(summaryRecord.totalAccounts),
      trackedSites: asNumber(summaryRecord.trackedSites),
      topSite:
        topSiteRecord == null
          ? null
          : {
              site: String(topSiteRecord.site ?? ""),
              totalConsumptionKwh: asNumber(topSiteRecord.totalConsumptionKwh),
            },
    },
    trend: {
      labels: Array.isArray(trendRecord.labels) ? trendRecord.labels.map((label) => String(label)) : [],
      dayValues: Array.isArray(trendRecord.dayValues) ? trendRecord.dayValues.map(asNumber) : [],
      nightValues: Array.isArray(trendRecord.nightValues) ? trendRecord.nightValues.map(asNumber) : [],
      totalValues: Array.isArray(trendRecord.totalValues) ? trendRecord.totalValues.map(asNumber) : [],
    },
    issues: Array.isArray(record.issues) ? record.issues.map((issue) => String(issue)) : [],
  };
}

function normalizeMeterResponse(payload: unknown): ManagementMeterConsumptionResponse {
  const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(record.rows)
    ? record.rows.map((entry) => {
        const row = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
        return {
          meterId: String(row.meterId ?? ""),
          customerName: String(row.customerName ?? ""),
          site: String(row.site ?? ""),
          totalKwh: asNumber(row.totalKwh),
          dayKwh: asNumber(row.dayKwh),
          nightKwh: asNumber(row.nightKwh),
          percentDay: asNumber(row.percentDay),
          updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
          snapshotDate: typeof row.snapshotDate === "string" ? row.snapshotDate : null,
        } satisfies ManagementMeterConsumptionRow;
      })
    : [];

  return {
    availableSites: Array.isArray(record.availableSites)
      ? record.availableSites.map((site) => String(site))
      : [],
    selectedSite: typeof record.selectedSite === "string" ? record.selectedSite : null,
    snapshotDate: typeof record.snapshotDate === "string" ? record.snapshotDate : null,
    lastUpdatedAt: typeof record.lastUpdatedAt === "string" ? record.lastUpdatedAt : null,
    total: asNumber(record.total),
    rows,
  };
}

export async function loadManagementConsumption(site: string | null) {
  const payload = await request<unknown>("/api/management/analytics/consumption", {
    method: "GET",
    query: {
      siteId: site || undefined,
      site: site || undefined,
    },
  });

  return normalizeConsumptionResponse(payload);
}

export async function loadManagementMeterConsumption(
  site: string | null,
  options: { pageNumber?: number; pageSize?: number } = {},
) {
  const payload = await request<unknown>("/api/management/analytics/meter-consumption", {
    method: "GET",
    query: {
      siteId: site || undefined,
      site: site || undefined,
      pageNumber: options.pageNumber,
      pageSize: options.pageSize,
      limit: options.pageSize, // Fallback for various backend patterns
      offset: options.pageNumber && options.pageSize ? (options.pageNumber - 1) * options.pageSize : undefined,
    },
  });

  return normalizeMeterResponse(payload);
}
