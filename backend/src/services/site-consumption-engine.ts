import cron from "node-cron";
import {
  asRecordArray,
  extractRows,
  readNumber,
  readString,
  type ReportRow,
} from "../lib/upstream-data.js";
import { env } from "./env.js";
import { forwardToUpstream, loginToUpstream } from "./upstream.js";
import {
  createEmptySiteConsumptionState,
  loadSiteConsumptionState,
  saveSiteConsumptionState,
  SITE_CONSUMPTION_SITES,
  type SiteConsumptionSeries,
  type SiteConsumptionSite,
  type SiteConsumptionSnapshot,
  type SiteConsumptionState,
} from "./site-consumption-store.js";
import { SchedulerLeader, type SchedulerLeaderStatus } from "./scheduler-leader.js";

interface ParsedCollection {
  rows: ReportRow[];
  total: number | null;
}

interface SiteConsumptionStatus {
  refreshing: boolean;
  lastUpdatedAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  sourceWindow: {
    fromDate: string;
    toDate: string;
  };
}

interface SiteConsumptionRangeData {
  summary: Array<{
    site: SiteConsumptionSite;
    totalConsumption: number;
  }>;
  daily: SiteConsumptionSeries;
  monthly: SiteConsumptionSeries;
  yearly: SiteConsumptionSeries;
}

const persistedState = (await loadSiteConsumptionState()) ?? createEmptySiteConsumptionState();

function extractTotal(result: unknown): number | null {
  const candidateValues: unknown[] = [];

  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    const root = result as Record<string, unknown>;
    candidateValues.push(root.total, root.count, root.totalCount, root.recordsTotal, root.rowCount, root.size);

    if (typeof root.page === "object" && root.page !== null && !Array.isArray(root.page)) {
      const page = root.page as Record<string, unknown>;
      candidateValues.push(page.total, page.count, page.totalCount, page.recordsTotal, page.rowCount, page.size);
    }
  }

  for (const value of candidateValues) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }
  }

  return null;
}




function parseDateString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return { year, month, day };
  }

  const dayFirstMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return { year, month, day };
  }

  return null;
}

function toIsoDate(value: unknown) {
  const parsed = parseDateString(value);
  return parsed ? `${parsed.year}-${parsed.month}-${parsed.day}` : null;
}

function toDayFirstDate(value: unknown) {
  const parsed = parseDateString(value);
  return parsed ? `${parsed.day}/${parsed.month}/${parsed.year}` : null;
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMonthKey(value: Date) {
  return value.toISOString().slice(0, 7);
}

function formatYearKey(value: Date) {
  return value.toISOString().slice(0, 4);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function addMonths(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function addDays(date: Date, delta: number) {
  return new Date(date.getTime() + delta * 24 * 60 * 60 * 1000);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function createDateRange(startDate: string, endDate: string) {
  const labels: string[] = [];
  let cursor = toDate(startDate);
  const last = toDate(endDate);

  while (cursor.getTime() <= last.getTime()) {
    labels.push(formatDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return labels;
}

function createMonthRange(startDate: string, endDate: string) {
  const labels: string[] = [];
  let cursor = startOfMonth(toDate(startDate));
  const last = startOfMonth(toDate(endDate));

  while (cursor.getTime() <= last.getTime()) {
    labels.push(formatMonthKey(cursor));
    cursor = addMonths(cursor, 1);
  }

  return labels;
}

function createYearRange(startDate: string, endDate: string) {
  const labels: string[] = [];
  let year = Number(formatYearKey(toDate(startDate)));
  const lastYear = Number(formatYearKey(toDate(endDate)));

  while (year <= lastYear) {
    labels.push(String(year));
    year += 1;
  }

  return labels;
}

function normalizeConsumptionValue(row: ReportRow) {
  const value =
    readNumber(row, [
      "consumption",
      "totalEnergy",
      "total1",
      "energy",
      "usedEnergy",
      "electricityConsumption",
      "consumptionValue",
      "kwh",
      "usage",
      "usage1",
    ]) ?? 0;

  return value >= 0 ? value : 0;
}

function readSiteLabel(row: ReportRow) {
  return (
    readString(
      row,
      [
        "stationId",
        "stationCode",
        "site",
        "siteId",
        "station",
        "sectionId",
        "stationName",
        "siteName",
        "addr",
        "customerAddress",
      ],
    ) ??
    undefined
  );
}

function normalizeSiteLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "musha" ||
    normalized.includes(" musha") ||
    normalized.startsWith("musha ")
  ) {
    return "musha";
  }

  if (
    normalized === "ogufa" ||
    normalized.includes(" ogufa") ||
    normalized.startsWith("ogufa ")
  ) {
    return "ogufa";
  }

  if (
    normalized === "umaisha" ||
    normalized.includes(" umaisha") ||
    normalized.startsWith("umaisha ")
  ) {
    return "umaisha";
  }

  if (
    normalized === "tunga" ||
    normalized.includes(" tunga") ||
    normalized.startsWith("tunga ")
  ) {
    return "tunga";
  }

  if (
    normalized === "kyakale" ||
    normalized.includes(" kyakale") ||
    normalized.startsWith("kyakale ")
  ) {
    return "kyakale";
  }

  return normalized;
}

function buildRequestBodies(site: SiteConsumptionSite, fromDate: string, toDate: string) {
  const common = {
    Lang: "en",
    fromDate,
    toDate,
    pageNumber: 1,
    pageSize: 500,
    page: 1,
    limit: 500,
  };

  return [
    {
      ...common,
      stationId: site,
    },
    {
      ...common,
      site,
    },
    {
      ...common,
      siteId: site,
    },
    {
      ...common,
      station: site,
    },
    {
      ...common,
      sectionId: site,
    },
    {
      ...common,
      stationId: site,
      site,
      siteId: site,
      station: site,
      sectionId: site,
    },
  ];
}

function normalizeSnapshotShape(data: SiteConsumptionRangeData, sourceWindow: { fromDate: string; toDate: string }): SiteConsumptionSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    sourceWindow,
    summary: data.summary,
    daily: data.daily,
    monthly: data.monthly,
    yearly: data.yearly,
  };
}

class SiteConsumptionEngine {
  private cronJob: cron.ScheduledTask | null = null;
  private refreshPromise: Promise<void> | null = null;
  private state: SiteConsumptionState = persistedState;
  private schedulerRunning = false;
  private readonly leader = new SchedulerLeader("site-consumption-engine", {
    onLeadershipAcquired: () => {
      this.ensureCronSchedule();
      this.scheduleImmediateRefresh(3_000);
    },
    onLeadershipLost: () => {
      this.stopCronSchedule();
    },
  });
  private lastRunStartedAt: string | null = null;
  private lastRunCompletedAt: string | null = null;
  private lastRunDurationMs: number | null = null;

  private persistState() {
    void saveSiteConsumptionState(this.state);
  }

  private setRefreshing(refreshing: boolean) {
    this.state = {
      ...this.state,
      refreshing,
      lastAttemptAt: new Date().toISOString(),
    };
    this.persistState();
  }

  private setError(message: string | null) {
    this.state = {
      ...this.state,
      lastError: message,
    };
    this.persistState();
  }

  private setSnapshot(snapshot: SiteConsumptionSnapshot) {
    this.state = {
      snapshot,
      lastUpdatedAt: snapshot.generatedAt,
      lastAttemptAt: snapshot.generatedAt,
      lastError: null,
      refreshing: false,
    };
    this.persistState();
  }

  private async authenticateUpstream() {
    if (!env.upstreamPassword.trim()) {
      return null;
    }

    const login = await loginToUpstream({
      username: env.upstreamUsername.trim(),
      password: env.upstreamPassword.trim(),
    });

    if (login.statusCode >= 400 || login.payload.code !== 0 || !login.upstreamCookie) {
      return null;
    }

    return login.upstreamCookie;
  }

  private async fetchRows(authToken: string, site: SiteConsumptionSite, fromDate: string, toDate: string) {
    const rows: ReportRow[] = [];

    for (const body of buildRequestBodies(site, fromDate, toDate)) {
      let pageNumber = 1;
      let total: number | null = null;
      let attempts = 0;

      while (attempts < 100) {
        attempts += 1;
        const response = await forwardToUpstream(
          "/api/DailyDataMeter/read",
          {
            ...body,
            pageNumber,
            page: pageNumber,
            pageSize: 500,
            limit: 500,
          },
          authToken,
          { timeoutMs: 30_000 },
        );

        if (response.statusCode >= 400 || response.payload.code !== 0) {
          break;
        }

        const pageRows = extractRows(response.payload.result);
        total = total ?? extractTotal(response.payload.result);

        if (pageRows.length === 0) {
          break;
        }

        rows.push(...pageRows);

        if (total !== null && rows.length >= total) {
          break;
        }

        if (pageRows.length < 500) {
          break;
        }

        pageNumber += 1;
      }

      if (rows.length > 0) {
        break;
      }
    }

    return rows;
  }

  private accumulateRangeData(rowsBySite: Map<SiteConsumptionSite, ReportRow[]>, startDate: string, endDate: string) {
    const dailyLabels = createDateRange(startDate, endDate);
    const monthlyLabels = createMonthRange(startDate, endDate);
    const yearlyLabels = createYearRange(startDate, endDate);

    const dailyBuckets = new Map<string, Map<SiteConsumptionSite, number>>();
    const monthlyBuckets = new Map<string, Map<SiteConsumptionSite, number>>();
    const yearlyBuckets = new Map<string, Map<SiteConsumptionSite, number>>();
    const summaryMap = new Map<SiteConsumptionSite, number>(
      SITE_CONSUMPTION_SITES.map((site) => [site, 0]),
    );

    for (const site of SITE_CONSUMPTION_SITES) {
      const rows = rowsBySite.get(site) ?? [];
      const normalizedSite = normalizeSiteLabel(site);

      for (const row of rows) {
        const siteLabel = readSiteLabel(row);
        if (siteLabel && normalizeSiteLabel(siteLabel) !== normalizedSite) {
          continue;
        }

        const consumption = normalizeConsumptionValue(row);
        if (!Number.isFinite(consumption)) {
          continue;
        }

        const dateKey =
          toIsoDate(
            readString(row, ["collectionDate", "collectDate", "dataDate", "readDate", "date", "periodStart"]),
          ) ??
          toIsoDate(readString(row, ["createTime", "updateTime"])) ??
          null;

        if (!dateKey) {
          continue;
        }

        const monthKey = dateKey.slice(0, 7);
        const yearKey = dateKey.slice(0, 4);

        summaryMap.set(site, (summaryMap.get(site) ?? 0) + consumption);

        const dayMap = dailyBuckets.get(dateKey) ?? new Map<SiteConsumptionSite, number>();
        dayMap.set(site, (dayMap.get(site) ?? 0) + consumption);
        dailyBuckets.set(dateKey, dayMap);

        const monthMap = monthlyBuckets.get(monthKey) ?? new Map<SiteConsumptionSite, number>();
        monthMap.set(site, (monthMap.get(site) ?? 0) + consumption);
        monthlyBuckets.set(monthKey, monthMap);

        const yearMap = yearlyBuckets.get(yearKey) ?? new Map<SiteConsumptionSite, number>();
        yearMap.set(site, (yearMap.get(site) ?? 0) + consumption);
        yearlyBuckets.set(yearKey, yearMap);
      }
    }

    const buildSeries = (
      labels: string[],
      buckets: Map<string, Map<SiteConsumptionSite, number>>,
    ): SiteConsumptionSeries => ({
      labels,
      series: SITE_CONSUMPTION_SITES.map((site) => ({
        site,
        values: labels.map((label) => buckets.get(label)?.get(site) ?? 0),
      })),
    });

    return normalizeSnapshotShape(
      {
        summary: SITE_CONSUMPTION_SITES.map((site) => ({
          site,
          totalConsumption: summaryMap.get(site) ?? 0,
        })),
        daily: buildSeries(dailyLabels, dailyBuckets),
        monthly: buildSeries(monthlyLabels, monthlyBuckets),
        yearly: buildSeries(yearlyLabels, yearlyBuckets),
      },
      { fromDate: startDate, toDate: endDate },
    );
  }

  public getSnapshot() {
    return this.state.snapshot;
  }

  public getStatus(): SiteConsumptionStatus {
    return {
      refreshing: this.state.refreshing,
      lastUpdatedAt: this.state.lastUpdatedAt,
      lastAttemptAt: this.state.lastAttemptAt,
      lastError: this.state.lastError,
      sourceWindow: this.state.snapshot.sourceWindow,
    };
  }

  public async refresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const startedAt = Date.now();
      this.lastRunStartedAt = new Date(startedAt).toISOString();
      this.setRefreshing(true);
      const sourceWindow = {
        fromDate: "2025-01-01",
        toDate: formatDateKey(new Date()),
      };

      try {
        const authToken = await this.authenticateUpstream();
        if (!authToken) {
          this.state = {
            ...this.state,
            refreshing: false,
            lastError: "Upstream authentication unavailable",
            lastAttemptAt: new Date().toISOString(),
          };
          this.persistState();
          return;
        }

        const rowsBySite = new Map<SiteConsumptionSite, ReportRow[]>();

        for (const site of SITE_CONSUMPTION_SITES) {
          const rows = await this.fetchRows(authToken, site, sourceWindow.fromDate, sourceWindow.toDate);
          rowsBySite.set(site, rows);
        }

        const snapshot = this.accumulateRangeData(rowsBySite, sourceWindow.fromDate, sourceWindow.toDate);
        this.setSnapshot(snapshot);
        this.lastRunCompletedAt = new Date().toISOString();
        this.lastRunDurationMs = Date.now() - startedAt;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Site consumption refresh failed";
        this.setError(message);
        this.state = {
          ...this.state,
          refreshing: false,
          lastAttemptAt: new Date().toISOString(),
        };
        this.persistState();
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public requestRefresh() {
    void this.refresh();
  }

  public start() {
    if (this.schedulerRunning) {
      return;
    }

    this.schedulerRunning = true;
    this.leader.start();
  }

  public async stop() {
    if (!this.schedulerRunning) {
      return;
    }

    this.schedulerRunning = false;
    this.stopCronSchedule();
    await this.leader.stop();
  }

  public getAdminStatus(): ManagedSiteConsumptionEngineStatus {
    return {
      name: "site-consumption-engine",
      enabledByConfig: env.enableSiteConsumptionEngine,
      schedulerRunning: this.schedulerRunning,
      leader: this.leader.getStatus(),
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunCompletedAt: this.lastRunCompletedAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.state.lastError,
      sourceWindow: this.state.snapshot.sourceWindow,
    };
  }

  public async runNow() {
    if (!this.leader.currentlyLeads()) {
      return {
        accepted: false,
        reason: "This replica is not the active leader for site-consumption-engine.",
      };
    }

    await this.refresh();
    return {
      accepted: true,
      reason: "Site consumption refresh completed on the active leader.",
    };
  }

  private ensureCronSchedule() {
    if (this.cronJob) {
      return;
    }

    this.cronJob = cron.schedule("*/30 * * * *", () => {
      void this.refresh();
    });
  }

  private stopCronSchedule() {
    if (!this.cronJob) {
      return;
    }

    this.cronJob.stop();
    this.cronJob = null;
  }

  private scheduleImmediateRefresh(delayMs: number) {
    setTimeout(() => {
      if (this.schedulerRunning && this.leader.currentlyLeads()) {
        void this.refresh();
      }
    }, delayMs);
  }
}

export const siteConsumptionEngine = new SiteConsumptionEngine();
export interface ManagedSiteConsumptionEngineStatus {
  name: string;
  enabledByConfig: boolean;
  schedulerRunning: boolean;
  leader: SchedulerLeaderStatus;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRunDurationMs: number | null;
  lastError: string | null;
  sourceWindow: {
    fromDate: string;
    toDate: string;
  };
}

export type { SiteConsumptionStatus, SiteConsumptionSnapshot, SiteConsumptionSeries };
