import { loadRuntimeState, saveRuntimeState } from "./runtime-state-store.js";

export const SITE_CONSUMPTION_SITES = [
  "Musha",
  "Ogufa",
  "Umaisha",
  "Tunga",
  "Kyakale",
] as const;

export type SiteConsumptionSite = (typeof SITE_CONSUMPTION_SITES)[number];

export interface SiteConsumptionSummaryItem {
  site: SiteConsumptionSite;
  totalConsumption: number;
}

export interface SiteConsumptionSeries {
  labels: string[];
  series: Array<{
    site: SiteConsumptionSite;
    values: number[];
  }>;
}

export interface SiteConsumptionSnapshot {
  generatedAt: string;
  sourceWindow: {
    fromDate: string;
    toDate: string;
  };
  summary: SiteConsumptionSummaryItem[];
  daily: SiteConsumptionSeries;
  monthly: SiteConsumptionSeries;
  yearly: SiteConsumptionSeries;
}

export interface SiteConsumptionState {
  snapshot: SiteConsumptionSnapshot;
  lastUpdatedAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  refreshing: boolean;
}

function createEmptySeries(labels: string[]) {
  return {
    labels,
    series: SITE_CONSUMPTION_SITES.map((site) => ({
      site,
      values: labels.map(() => 0),
    })),
  };
}

export function createEmptySnapshot(fromDate = "2025-01-01", toDate = new Date().toISOString().slice(0, 10)): SiteConsumptionSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    sourceWindow: {
      fromDate,
      toDate,
    },
    summary: SITE_CONSUMPTION_SITES.map((site) => ({
      site,
      totalConsumption: 0,
    })),
    daily: createEmptySeries([]),
    monthly: createEmptySeries([]),
    yearly: createEmptySeries([]),
  };
}

function normalizeSummaryItem(value: unknown): SiteConsumptionSummaryItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const site = SITE_CONSUMPTION_SITES.find(
    (entry) => entry.toLowerCase() === String(record.site ?? record.label ?? "").trim().toLowerCase(),
  );
  const totalConsumption =
    typeof record.totalConsumption === "number" && Number.isFinite(record.totalConsumption)
      ? record.totalConsumption
      : typeof record.value === "number" && Number.isFinite(record.value)
        ? record.value
        : typeof record.total === "number" && Number.isFinite(record.total)
          ? record.total
          : null;

  return site && totalConsumption !== null
    ? {
        site,
        totalConsumption,
      }
    : null;
}

function normalizeSeries(value: unknown, fallbackLabels: string[]): SiteConsumptionSeries {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      labels: fallbackLabels,
      series: SITE_CONSUMPTION_SITES.map((site) => ({
        site,
        values: fallbackLabels.map(() => 0),
      })),
    };
  }

  const record = value as Record<string, unknown>;
  const labels = Array.isArray(record.labels)
    ? record.labels.filter((entry): entry is string => typeof entry === "string")
    : fallbackLabels;
  const series = Array.isArray(record.series)
    ? record.series
        .map((entry) => {
          if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            return null;
          }

          const seriesRecord = entry as Record<string, unknown>;
          const site = SITE_CONSUMPTION_SITES.find(
            (candidate) =>
              candidate.toLowerCase() ===
              String(seriesRecord.site ?? seriesRecord.label ?? "").trim().toLowerCase(),
          );
          const values = Array.isArray(seriesRecord.values)
            ? seriesRecord.values
                .map((item) => (typeof item === "number" && Number.isFinite(item) ? item : 0))
                .slice(0, labels.length)
            : [];

          return site
            ? {
                site,
                values: [...values, ...labels.slice(values.length).map(() => 0)],
              }
            : null;
        })
        .filter((entry): entry is { site: SiteConsumptionSite; values: number[] } => entry !== null)
    : [];

  const existingSites = new Set(series.map((entry) => entry.site));
  for (const site of SITE_CONSUMPTION_SITES) {
    if (!existingSites.has(site)) {
      series.push({
        site,
        values: labels.map(() => 0),
      });
    }
  }

  return {
    labels,
    series: series.slice(0, SITE_CONSUMPTION_SITES.length),
  };
}

function normalizeSnapshot(value: unknown): SiteConsumptionSnapshot | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sourceWindow =
    typeof record.sourceWindow === "object" &&
    record.sourceWindow !== null &&
    !Array.isArray(record.sourceWindow)
      ? (record.sourceWindow as Record<string, unknown>)
      : {};
  const fromDate = typeof sourceWindow.fromDate === "string" ? sourceWindow.fromDate : "2025-01-01";
  const toDate = typeof sourceWindow.toDate === "string" ? sourceWindow.toDate : new Date().toISOString().slice(0, 10);

  const summary = Array.isArray(record.summary)
    ? record.summary.map(normalizeSummaryItem).filter((entry): entry is SiteConsumptionSummaryItem => entry !== null)
    : [];
  const summaryMap = new Map(summary.map((entry) => [entry.site, entry.totalConsumption]));

  return {
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : new Date().toISOString(),
    sourceWindow: {
      fromDate,
      toDate,
    },
    summary: SITE_CONSUMPTION_SITES.map((site) => ({
      site,
      totalConsumption: summaryMap.get(site) ?? 0,
    })),
    daily: normalizeSeries(record.daily, []),
    monthly: normalizeSeries(record.monthly, []),
    yearly: normalizeSeries(record.yearly, []),
  };
}

function normalizeState(value: unknown): SiteConsumptionState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const snapshot = normalizeSnapshot(record.snapshot ?? record);

  if (!snapshot) {
    return null;
  }

  return {
    snapshot,
    lastUpdatedAt:
      typeof record.lastUpdatedAt === "string"
        ? record.lastUpdatedAt
        : snapshot.generatedAt,
    lastAttemptAt:
      typeof record.lastAttemptAt === "string"
        ? record.lastAttemptAt
        : snapshot.generatedAt,
    lastError: typeof record.lastError === "string" ? record.lastError : null,
    refreshing: typeof record.refreshing === "boolean" ? record.refreshing : false,
  };
}

export async function loadSiteConsumptionState(): Promise<SiteConsumptionState | null> {
  const runtimeState = await loadRuntimeState<unknown>("site-consumption");
  return normalizeState(runtimeState);
}

export async function saveSiteConsumptionState(state: SiteConsumptionState): Promise<void> {
  await saveRuntimeState("site-consumption", state);
}

export function createEmptySiteConsumptionState(): SiteConsumptionState {
  return {
    snapshot: createEmptySnapshot(),
    lastUpdatedAt: null,
    lastAttemptAt: null,
    lastError: null,
    refreshing: false,
  };
}
