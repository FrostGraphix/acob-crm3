import { Router } from "express";
import { siteConsumptionEngine } from "../services/site-consumption-engine.js";
import {
  SITE_CONSUMPTION_SITES,
  type SiteConsumptionSeries,
  type SiteConsumptionSite,
} from "../services/site-consumption-store.js";
import { sendEnvelope } from "../services/response.js";

export const siteConsumptionRouter = Router();

type Granularity = "daily" | "monthly" | "yearly";
type CompareMode = "compare" | "combined";

interface SiteConsumptionReportRow {
  periodLabel: string;
  site: string;
  consumption: number | null;
  unitLabel: string;
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
  granularity: Granularity;
  compareMode: CompareMode;
  units: {
    valueKey: "consumption";
    label: string;
  };
  availableSites: readonly SiteConsumptionSite[];
  selectedSites: SiteConsumptionSite[];
  lastUpdatedAt: string | null;
  refreshStatus: {
    inProgress: boolean;
    lastAttemptAt: string | null;
    lastError: string | null;
  };
  summary: Array<{
    site: SiteConsumptionSite;
    totalConsumption: number;
  }>;
  topSite: {
    site: SiteConsumptionSite;
    totalConsumption: number;
  } | null;
  series: ReturnType<typeof filterSeriesByRange>;
  rows: SiteConsumptionReportRow[];
  issues: string[];
}

function isSite(value: string): value is SiteConsumptionSite {
  return SITE_CONSUMPTION_SITES.includes(value as SiteConsumptionSite);
}

function toIsoDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  const dayFirstMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dayFirstMatch) {
    return null;
  }

  const [, day, month, year] = dayFirstMatch;
  return `${year}-${month}-${day}`;
}

function clampRange(
  requestedFromDate: string | null,
  requestedToDate: string | null,
  sourceWindow: { fromDate: string; toDate: string },
) {
  const fromDate = requestedFromDate ?? sourceWindow.fromDate;
  const toDate = requestedToDate ?? sourceWindow.toDate;

  const normalizedFromDate = fromDate > toDate ? toDate : fromDate;
  const normalizedToDate = toDate < fromDate ? fromDate : toDate;

  return {
    requested: {
      fromDate: normalizedFromDate,
      toDate: normalizedToDate,
    },
    effective: {
      fromDate: normalizedFromDate < sourceWindow.fromDate ? sourceWindow.fromDate : normalizedFromDate,
      toDate: normalizedToDate > sourceWindow.toDate ? sourceWindow.toDate : normalizedToDate,
    },
  };
}

function readSelectedSites(rawValue: unknown) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return {
      selectedSites: SITE_CONSUMPTION_SITES.slice(),
      invalidSites: [] as string[],
    };
  }

  const seen = new Set<SiteConsumptionSite>();
  const invalidSites: string[] = [];

  for (const token of rawValue.split(",")) {
    const normalized = token.trim();
    if (!normalized) {
      continue;
    }

    const site = SITE_CONSUMPTION_SITES.find(
      (candidate) => candidate.toLowerCase() === normalized.toLowerCase(),
    );

    if (!site) {
      invalidSites.push(normalized);
      continue;
    }

    seen.add(site);
  }

  return {
    selectedSites: seen.size > 0 ? Array.from(seen) : SITE_CONSUMPTION_SITES.slice(),
    invalidSites,
  };
}

function filterSeriesByRange(
  series: SiteConsumptionSeries,
  selectedSites: SiteConsumptionSite[],
  fromDate: string,
  toDate: string,
) {
  const labelIndexes = series.labels.reduce<number[]>((indexes, label, index) => {
    if (label >= fromDate && label <= toDate) {
      indexes.push(index);
    }

    return indexes;
  }, []);

  const selectedSiteSet = new Set(selectedSites);

  return {
    labels: labelIndexes.map((index) => series.labels[index]),
    series: series.series
      .filter((entry) => selectedSiteSet.has(entry.site))
      .map((entry) => ({
        site: entry.site,
        values: labelIndexes.map((index) => {
          const value = entry.values[index];
          return typeof value === "number" && Number.isFinite(value) ? value : null;
        }),
      })),
  };
}

function buildSummaryFromSeries(series: ReturnType<typeof filterSeriesByRange>) {
  return series.series.map((entry) => ({
    site: entry.site,
    totalConsumption: entry.values.reduce<number>((total, value) => total + (value ?? 0), 0),
  }));
}

function buildRows(series: ReturnType<typeof filterSeriesByRange>): SiteConsumptionReportRow[] {
  const rows: SiteConsumptionReportRow[] = [];

  for (let labelIndex = 0; labelIndex < series.labels.length; labelIndex += 1) {
    const periodLabel = series.labels[labelIndex] ?? "";
    for (const entry of series.series) {
      rows.push({
        periodLabel,
        site: entry.site,
        consumption: entry.values[labelIndex] ?? null,
        unitLabel: "kWh",
      });
    }
  }

  return rows;
}

function summarizeIssues(
  invalidSites: string[],
  requested: { fromDate: string; toDate: string },
  effective: { fromDate: string; toDate: string },
  sourceWindow: { fromDate: string; toDate: string },
) {
  const issues: string[] = [];

  if (invalidSites.length > 0) {
    issues.push(`Ignored unknown sites: ${invalidSites.join(", ")}.`);
  }

  if (
    requested.fromDate !== effective.fromDate ||
    requested.toDate !== effective.toDate
  ) {
    issues.push(
      `Requested range was clamped to available snapshot data (${sourceWindow.fromDate} to ${sourceWindow.toDate}).`,
    );
  }

  return issues;
}

siteConsumptionRouter.get("/status", (_request, response) => {
  sendEnvelope(
    response,
    200,
    {
      status: siteConsumptionEngine.getStatus(),
      snapshot: siteConsumptionEngine.getSnapshot(),
    },
    "success",
  );
});

export function buildSiteConsumptionReportResponse(options: {
  snapshot: ReturnType<typeof siteConsumptionEngine.getSnapshot>;
  status: ReturnType<typeof siteConsumptionEngine.getStatus>;
  query: Record<string, unknown>;
}): SiteConsumptionReportResponse {
  const { snapshot, status, query } = options;
  const granularityParam = String(query.granularity ?? "daily").toLowerCase();
  const granularity: Granularity =
    granularityParam === "monthly" || granularityParam === "yearly" ? granularityParam : "daily";
  const compareModeParam = String(query.compareMode ?? "compare").toLowerCase();
  const compareMode: CompareMode = compareModeParam === "combined" ? "combined" : "compare";
  const { selectedSites, invalidSites } = readSelectedSites(query.sites);
  const ranges = clampRange(
    toIsoDate(typeof query.fromDate === "string" ? query.fromDate : undefined),
    toIsoDate(typeof query.toDate === "string" ? query.toDate : undefined),
    snapshot.sourceWindow,
  );
  const sourceSeries =
    granularity === "monthly"
      ? snapshot.monthly
      : granularity === "yearly"
        ? snapshot.yearly
        : snapshot.daily;

  const filteredSeries = filterSeriesByRange(
    sourceSeries,
    selectedSites,
    ranges.effective.fromDate.slice(0, granularity === "yearly" ? 4 : granularity === "monthly" ? 7 : 10),
    ranges.effective.toDate.slice(0, granularity === "yearly" ? 4 : granularity === "monthly" ? 7 : 10),
  );
  const summary = buildSummaryFromSeries(filteredSeries);
  const rows = buildRows(filteredSeries);
  const topSite =
    [...summary].sort(
      (left, right) => (right.totalConsumption ?? 0) - (left.totalConsumption ?? 0),
    )[0] ?? null;
  const issues = summarizeIssues(invalidSites, ranges.requested, ranges.effective, snapshot.sourceWindow);

  return {
    range: ranges.effective,
    requestedRange: ranges.requested,
    sourceWindow: snapshot.sourceWindow,
    granularity,
    compareMode,
    units: {
      valueKey: "consumption",
      label: "kWh",
    },
    availableSites: SITE_CONSUMPTION_SITES,
    selectedSites,
    lastUpdatedAt: status.lastUpdatedAt,
    refreshStatus: {
      inProgress: status.refreshing,
      lastAttemptAt: status.lastAttemptAt,
      lastError: status.lastError,
    },
    summary,
    topSite,
    series: filteredSeries,
    rows,
    issues,
  };
}

siteConsumptionRouter.get("/report", (request, response) => {
  sendEnvelope(
    response,
    200,
    buildSiteConsumptionReportResponse({
      snapshot: siteConsumptionEngine.getSnapshot(),
      status: siteConsumptionEngine.getStatus(),
      query: request.query as Record<string, unknown>,
    }),
    "success",
  );
});

siteConsumptionRouter.get("/summary", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(
    response,
    200,
    {
      lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
      sourceWindow: snapshot.sourceWindow,
      summary: snapshot.summary,
    },
    "success",
  );
});

siteConsumptionRouter.get("/daily", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(
    response,
    200,
    {
      lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
      sourceWindow: snapshot.sourceWindow,
      series: snapshot.daily,
    },
    "success",
  );
});

siteConsumptionRouter.get("/monthly", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(
    response,
    200,
    {
      lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
      sourceWindow: snapshot.sourceWindow,
      series: snapshot.monthly,
    },
    "success",
  );
});

siteConsumptionRouter.get("/yearly", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  sendEnvelope(
    response,
    200,
    {
      lastUpdatedAt: siteConsumptionEngine.getStatus().lastUpdatedAt,
      sourceWindow: snapshot.sourceWindow,
      series: snapshot.yearly,
    },
    "success",
  );
});

siteConsumptionRouter.post("/refresh", (_request, response) => {
  siteConsumptionEngine.requestRefresh();
  sendEnvelope(
    response,
    202,
    {
      status: siteConsumptionEngine.getStatus(),
      snapshot: siteConsumptionEngine.getSnapshot(),
    },
    "refresh started",
  );
});
