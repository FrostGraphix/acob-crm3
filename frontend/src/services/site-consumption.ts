import { request } from "./api";

export const SITE_CONSUMPTION_SITES = [
  "Musha",
  "Ogufa",
  "Umaisha",
  "Tunga",
  "Kyakale",
] as const;

export type SiteConsumptionSiteName = (typeof SITE_CONSUMPTION_SITES)[number];

export interface SiteConsumptionSiteStat {
  site: string;
  totalConsumption: number;
}

export interface SiteConsumptionSeriesRow {
  site: string;
  values: number[];
}

export interface SiteConsumptionSummaryResponse {
  lastUpdatedAt?: string | null;
  sites?: SiteConsumptionSiteStat[];
  summary?: SiteConsumptionSiteStat[];
}

export interface SiteConsumptionSeriesResponse {
  lastUpdatedAt?: string | null;
  labels?: string[];
  series?:
    | SiteConsumptionSeriesRow[]
    | {
        labels?: string[];
        series?: SiteConsumptionSeriesRow[];
      };
}

export interface SiteConsumptionSeriesSnapshot {
  labels: string[];
  series: SiteConsumptionSeriesRow[];
}

export interface SiteConsumptionStatusResponse {
  lastUpdatedAt?: string | null;
  inProgress?: boolean;
  message?: string | null;
  status?: SiteConsumptionStatusResponse;
}

export interface SiteConsumptionPageSnapshot {
  lastUpdatedAt: string | null;
  summary: SiteConsumptionSiteStat[];
  daily: SiteConsumptionSeriesSnapshot;
  monthly: SiteConsumptionSeriesSnapshot;
  yearly: SiteConsumptionSeriesSnapshot;
  status: SiteConsumptionStatusResponse | null;
  errors: string[];
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeSiteName(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();

  switch (normalized) {
    case "musha":
      return "Musha";
    case "ogufa":
      return "Ogufa";
    case "umaisha":
      return "Umaisha";
    case "tunga":
      return "Tunga";
    case "kyakale":
      return "Kyakale";
    default:
      return trimmed;
  }
}

function createEmptySummary(): SiteConsumptionSiteStat[] {
  return SITE_CONSUMPTION_SITES.map((site) => ({
    site,
    totalConsumption: 0,
  }));
}

function createEmptySeries(): SiteConsumptionSeriesSnapshot {
  return {
    labels: [],
    series: SITE_CONSUMPTION_SITES.map((site) => ({
      site,
      values: [],
    })),
  };
}

function normalizeSummary(payload: SiteConsumptionSummaryResponse | null | undefined) {
  const totals = new Map(SITE_CONSUMPTION_SITES.map((site) => [site, 0]));

  const entries = payload?.sites ?? payload?.summary ?? [];

  for (const item of entries) {
    const site = normalizeSiteName(item.site);
    if (!totals.has(site as SiteConsumptionSiteName)) {
      continue;
    }

    totals.set(site as SiteConsumptionSiteName, toNumber(item.totalConsumption));
  }

  return SITE_CONSUMPTION_SITES.map((site) => ({
    site,
    totalConsumption: totals.get(site) ?? 0,
  }));
}

function normalizeSeries(
  payload: SiteConsumptionSeriesResponse | null | undefined,
): SiteConsumptionSeriesSnapshot {
  if (!payload) {
    return createEmptySeries();
  }

  const seriesPayload = Array.isArray(payload.series)
    ? payload
    : payload.series && typeof payload.series === "object"
      ? payload.series
      : payload;

  const labels = (seriesPayload.labels ?? [])
    .map((label) => (typeof label === "string" ? label.trim() : ""))
    .filter((label) => label.length > 0);

  const seriesBySite = new Map(
    SITE_CONSUMPTION_SITES.map((site) => [site, [] as number[]]),
  );

  const entries = Array.isArray(seriesPayload.series) ? seriesPayload.series : [];

  for (const entry of entries) {
    const site = normalizeSiteName(entry.site);
    if (!seriesBySite.has(site as SiteConsumptionSiteName)) {
      continue;
    }

    const values = labels.map((_, index) => toNumber(entry.values?.[index]));
    seriesBySite.set(site as SiteConsumptionSiteName, values);
  }

  return {
    labels,
    series: SITE_CONSUMPTION_SITES.map((site) => ({
      site,
      values: seriesBySite.get(site) ?? [],
    })),
  };
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load site consumption snapshot";
}

async function loadSummary() {
  return request<SiteConsumptionSummaryResponse>("/api/site-consumption/summary", {
    method: "GET",
  });
}

async function loadSeries(path: string) {
  return request<SiteConsumptionSeriesResponse>(path, {
    method: "GET",
  });
}

async function loadStatus() {
  return request<SiteConsumptionStatusResponse>("/api/site-consumption/status", {
    method: "GET",
  });
}

export function triggerSiteConsumptionRefresh() {
  return request<{ status?: SiteConsumptionStatusResponse }>(
    "/api/site-consumption/refresh",
    {
      method: "POST",
      body: {},
    },
  );
}

export async function loadSiteConsumptionSnapshot(): Promise<SiteConsumptionPageSnapshot> {
  const settled = await Promise.allSettled([
    loadSummary(),
    loadSeries("/api/site-consumption/daily"),
    loadSeries("/api/site-consumption/monthly"),
    loadSeries("/api/site-consumption/yearly"),
    loadStatus(),
  ]);

  const errors: string[] = [];
  const summaryResult = settled[0];
  const dailyResult = settled[1];
  const monthlyResult = settled[2];
  const yearlyResult = settled[3];
  const statusResult = settled[4];

  const summary =
    summaryResult.status === "fulfilled"
      ? normalizeSummary(summaryResult.value)
      : createEmptySummary();
  if (summaryResult.status === "rejected") {
    errors.push(readErrorMessage(summaryResult.reason));
  }

  const daily =
    dailyResult.status === "fulfilled" ? normalizeSeries(dailyResult.value) : createEmptySeries();
  if (dailyResult.status === "rejected") {
    errors.push(readErrorMessage(dailyResult.reason));
  }

  const monthly =
    monthlyResult.status === "fulfilled"
      ? normalizeSeries(monthlyResult.value)
      : createEmptySeries();
  if (monthlyResult.status === "rejected") {
    errors.push(readErrorMessage(monthlyResult.reason));
  }

  const yearly =
    yearlyResult.status === "fulfilled"
      ? normalizeSeries(yearlyResult.value)
      : createEmptySeries();
  if (yearlyResult.status === "rejected") {
    errors.push(readErrorMessage(yearlyResult.reason));
  }

  const status =
    statusResult.status === "fulfilled"
      ? statusResult.value.status ?? statusResult.value
      : null;
  if (statusResult.status === "rejected") {
    errors.push(readErrorMessage(statusResult.reason));
  }

  const lastUpdatedAt =
    status?.lastUpdatedAt ??
    (summaryResult.status === "fulfilled" ? summaryResult.value.lastUpdatedAt ?? null : null);

  return {
    lastUpdatedAt,
    summary,
    daily,
    monthly,
    yearly,
    status,
    errors,
  };
}
