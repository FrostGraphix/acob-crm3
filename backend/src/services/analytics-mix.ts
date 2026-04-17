import type { Response } from "express";
import type {
  AnalyticsMixCellValue,
  AnalyticsMixChart,
  AnalyticsMixResponse,
  AnalyticsMixSummaryItem,
  CollectionsPriorityResponse,
  Customer360LiteResponse,
  DashboardPortfolioHealthResponse,
  DashboardRevenueVsUsageResponse,
  DashboardRiskOverlayResponse,
  MasterDataConsistencyResponse,
  MeterPerformanceSheetResponse,
  NotificationsCorrelatedFeedResponse,
  SiteBenchmarkMatrixResponse,
  SiteLossExposureResponse,
  TheftPrioritizationResponse,
  TokenReconciliationResponse,
  TopConsumerWatchlistResponse,
} from "../../../common/types/index.js";
import { loadUpstreamCandidates } from "../api/alias-utils.js";
import { extractRows, readNumber, readString, type ReportRow } from "../lib/upstream-data.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { analysisEngine } from "./analysis-engine.js";
import {
  buildCustomerForecasts as buildCustomerForecastRows,
  buildCustomerSegments as buildCustomerSegmentRows,
} from "./customer-analytics.js";
import { loadDashboardAggregate, loadDashboardLineChart } from "./dashboard-service.js";
import {
  getManagementConsumptionAnalytics,
  getManagementMeterConsumptionAnalytics,
  getManagementTokenAnalyticsSnapshot,
} from "./management-token-analytics.js";
import { readRuntimeDiagnostics } from "./runtime-diagnostics.js";
import { checkRuntimeStateStoreHealth } from "./runtime-state-store.js";
import { checkSessionStoreHealth } from "./session-store.js";
import { SITE_CONSUMPTION_SITES } from "./site-consumption-store.js";
import { siteConsumptionEngine } from "./site-consumption-engine.js";
import {
  buildOperationalPriorityResponse,
  buildRevenueLeakageResponse,
} from "./priority-engines.js";
import {
  isSupabaseDbEnabled,
  listCustomerForecasts,
  listCustomerSegments,
  listOperationalPriorityFacts,
  listRevenueUsageSeries,
  listRevenueLeakageFacts,
  listSiteConsumptionSeries,
  loadTheftRuntimeSnapshot,
} from "./supabase-db.js";
import { theftIntelligenceService } from "./theft-intelligence.js";
import { checkUpstreamHealth } from "./upstream.js";

type MixRow = Record<string, AnalyticsMixCellValue>;

const DAY_MS = 24 * 60 * 60 * 1000;

function buildMixResponse<TKey extends string, T extends MixRow>(
  response: Omit<AnalyticsMixResponse<T>, "summary" | "mixKey"> & {
    mixKey: TKey;
    summary: AnalyticsMixSummaryItem[];
  },
): AnalyticsMixResponse<T> & { mixKey: TKey } {
  return response;
}

function normalizeKey(value: string | undefined) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dayFirst = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function formatDayFirstDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) {
    return value;
  }

  return `${parsed.slice(8, 10)}/${parsed.slice(5, 7)}/${parsed.slice(0, 4)}`;
}

function defaultFromDate() {
  return `${new Date().getFullYear()}-01-01`;
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

function readDateWindow(query: Record<string, unknown>) {
  const from = parseDate(query.from ?? query.fromDate) ?? defaultFromDate();
  const to = parseDate(query.to ?? query.toDate) ?? defaultToDate();
  const normalizedFrom = from <= to ? from : to;
  const normalizedTo = to >= from ? to : from;

  return {
    fromIso: normalizedFrom,
    toIso: normalizedTo,
    fromDayFirst: formatDayFirstDate(normalizedFrom),
    toDayFirst: formatDayFirstDate(normalizedTo),
  };
}

function readSiteFilter(query: Record<string, unknown>) {
  const rawValue = [query.siteId, query.site, query.stationId].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  return trimmed.toUpperCase() === "ALL" ? null : trimmed;
}

function readSitesFilter(query: Record<string, unknown>) {
  if (typeof query.sites !== "string" || query.sites.trim().length === 0) {
    return SITE_CONSUMPTION_SITES.slice();
  }

  const sites = query.sites
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry): entry is (typeof SITE_CONSUMPTION_SITES)[number] =>
      SITE_CONSUMPTION_SITES.some((site) => site.toLowerCase() === entry.toLowerCase()),
    );

  return sites.length > 0 ? sites : SITE_CONSUMPTION_SITES.slice();
}

function readLimit(query: Record<string, unknown>, fallback = 10, max = 50) {
  const raw = query.limit;
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim().length > 0
        ? Number(raw)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function readMeterId(row: ReportRow) {
  return readString(row, ["meterId", "meterSN", "meterNo", "meterCode", "MeterSN"]) ?? "";
}

function readCustomerId(row: ReportRow) {
  return readString(row, ["customerId", "customerNo", "userId", "certifiNo"]) ?? "";
}

function readCustomerName(row: ReportRow) {
  return readString(row, ["customerName", "name", "customer", "userName"]) ?? "";
}

function readAccountNo(row: ReportRow) {
  return readString(row, ["accountNo", "certifiNo", "accountId"]) ?? "";
}

function readGatewayId(row: ReportRow) {
  return readString(row, ["gatewayId", "gatewayNo", "collectorId"]) ?? "";
}

function readTariffId(row: ReportRow) {
  return readString(row, ["tariffId", "priceId", "tariffCode"]) ?? "";
}

function readSite(row: ReportRow) {
  return (
    readString(
      row,
      ["stationId", "siteId", "site", "station", "siteName", "stationName", "sectionId"],
    ) ?? ""
  );
}

function readTimestamp(row: ReportRow) {
  return (
    readString(
      row,
      [
        "createTime",
        "purchaseTime",
        "timestamp",
        "updateTime",
        "collectionDate",
        "currentDate",
        "date",
      ],
    ) ?? ""
  );
}

function readRemainingBalance(row: ReportRow) {
  return readNumber(row, ["remainingBalance", "balance", "remainBalance", "surplusAmount"]) ?? 0;
}

function readDaysWithoutPurchase(row: ReportRow) {
  return (
    readNumber(
      row,
      ["daysWithoutPurchase", "nonpurchaseDays", "noPurchaseDays", "inactiveDays", "days"],
    ) ?? 0
  );
}

function readConsumptionValue(row: ReportRow) {
  return (
    readNumber(
      row,
      ["consumption", "totalEnergy", "value", "kwh", "usage", "usage1", "usedEnergy"],
    ) ?? 0
  );
}

function rowMatchesSite(row: ReportRow, siteId: string | null) {
  if (!siteId) {
    return true;
  }

  const target = normalizeKey(siteId);
  return normalizeKey(readSite(row)).includes(target);
}

function rowMatchesText(row: ReportRow, query: Record<string, unknown>) {
  const searchTerm =
    typeof query.searchTerm === "string" && query.searchTerm.trim().length > 0
      ? query.searchTerm.trim().toLowerCase()
      : "";
  if (!searchTerm) {
    return true;
  }

  return [readMeterId(row), readCustomerId(row), readCustomerName(row), readAccountNo(row)]
    .join(" ")
    .toLowerCase()
    .includes(searchTerm);
}

async function fetchRows(
  request: AuthenticatedRequest,
  response: Response,
  pathnames: string[],
  body: Record<string, unknown>,
) {
  const upstreamResult = await loadUpstreamCandidates(request, response, pathnames, body);
  if (upstreamResult.statusCode >= 400 || upstreamResult.payload.code !== 0) {
    return [] as ReportRow[];
  }

  return extractRows(upstreamResult.payload.result);
}

function buildReportBody(query: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const window = readDateWindow(query);
  const siteId = readSiteFilter(query);

  return {
    fromDate: window.fromDayFirst,
    toDate: window.toDayFirst,
    pageNumber: 1,
    pageSize: 500,
    page: 1,
    limit: 500,
    ...(siteId
      ? {
          siteId,
          site: siteId,
          stationId: siteId,
          station: siteId,
          sectionId: siteId,
        }
      : {}),
    ...extra,
  };
}

function buildReadBody(query: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    pageNumber: 1,
    pageSize: 500,
    page: 1,
    limit: 500,
    ...extra,
    ...query,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sortByNumericKey<T extends Record<string, AnalyticsMixCellValue>>(rows: T[], key: keyof T) {
  return [...rows].sort((left, right) => {
    const leftValue = typeof left[key] === "number" ? left[key] : -Infinity;
    const rightValue = typeof right[key] === "number" ? right[key] : -Infinity;
    return rightValue - leftValue;
  });
}

function buildRiskChart(rows: MixRow[], valueKey: string, limit = 8): AnalyticsMixChart | null {
  const sliced = rows.slice(0, limit);
  if (sliced.length === 0) {
    return null;
  }

  return {
    labels: sliced.map((row) => String(row.meterId ?? row.site ?? row.period ?? "Unknown")),
    series: [
      {
        key: valueKey,
        label: valueKey,
        values: sliced.map((row) => (typeof row[valueKey] === "number" ? row[valueKey] : 0)),
        type: "bar",
      },
    ],
  };
}

export async function buildCustomerSegmentsMix(
  request: AuthenticatedRequest,
  response: Response,
) {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);
  const limit = readLimit(query, 10, 50);
  const sourceRows = isSupabaseDbEnabled()
    ? await listCustomerSegments({ siteId, limit })
    : [];
  const responseRows =
    sourceRows.length > 0
      ? sourceRows.map((row) => ({
          meterId: row.meter_sn,
          customerName: row.customer_name ?? row.meter_sn,
          accountNo: row.account_no ?? null,
          site: row.site_code ?? null,
          segment: row.segment,
          rechargeCount30d: Number(row.recharge_count_30d ?? 0),
          totalRechargeAmount30d: round(Number(row.total_recharge_amount_30d ?? 0)),
          avgDailyConsumption7d: round(Number(row.avg_daily_consumption_7d ?? 0)),
        }))
      : (await buildCustomerSegmentRows(request, response)).rows
          .filter((row) => !siteId || normalizeKey(row.site ?? "") === normalizeKey(siteId))
          .slice(0, limit);

  const rows = responseRows.map<MixRow>((row) => ({
    meterId: row.meterId,
    customerName: row.customerName,
    accountNo: row.accountNo,
    site: row.site,
    segment: row.segment,
    rechargeCount30d: row.rechargeCount30d,
    totalRechargeAmount30d: round(row.totalRechargeAmount30d),
    avgDailyConsumption7d: round(row.avgDailyConsumption7d),
  }));

  return buildMixResponse({
    mixKey: "customer-segments",
    title: "Customer Segments",
    description: "Groups customers by recharge behavior and recent usage so operations can target the right playbook.",
    summary: [
      { key: "tracked", label: "Tracked", value: rows.length, tone: "info" },
      {
        key: "highValue",
        label: "High Value",
        value: rows.filter((row) => row.segment === "high-value-stable").length,
        tone: "success",
      },
      {
        key: "recovering",
        label: "Recovering",
        value: rows.filter((row) => row.segment === "recovering" || row.segment === "erratic").length,
        tone: "warning",
      },
    ],
    chart: buildRiskChart(sortByNumericKey(rows, "totalRechargeAmount30d"), "totalRechargeAmount30d"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "segment", label: "Segment" },
      { key: "rechargeCount30d", label: "Recharge 30d", align: "end" },
      { key: "avgDailyConsumption7d", label: "Avg Use 7d", align: "end" },
    ],
    rows,
    metadata: {
      siteId: siteId ?? "ALL",
    },
  });
}

export async function buildCustomerForecastsMix(
  request: AuthenticatedRequest,
  response: Response,
) {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);
  const limit = readLimit(query, 10, 50);
  const sourceRows = isSupabaseDbEnabled()
    ? await listCustomerForecasts({ siteId, limit })
    : [];
  const responseRows =
    sourceRows.length > 0
      ? sourceRows.map((row) => ({
          meterId: row.meter_sn,
          customerName: row.customer_name ?? row.meter_sn,
          site: row.site_code ?? null,
          avgDailyConsumption7d: round(Number(row.avg_daily_consumption_7d ?? 0)),
          avgRechargeKwh30d: round(Number(row.avg_recharge_kwh_30d ?? 0)),
          estimatedDaysCovered: round(Number(row.estimated_days_covered ?? 0)),
          predictedNextRechargeDate: row.predicted_next_recharge_date ?? null,
        }))
      : (await buildCustomerForecastRows(request, response)).rows
          .filter((row) => !siteId || normalizeKey(row.site ?? "") === normalizeKey(siteId))
          .slice(0, limit);

  const rows = responseRows.map<MixRow>((row) => ({
    meterId: row.meterId,
    customerName: row.customerName,
    site: row.site,
    avgDailyConsumption7d: row.avgDailyConsumption7d,
    avgRechargeKwh30d: row.avgRechargeKwh30d,
    estimatedDaysCovered: row.estimatedDaysCovered,
    predictedNextRechargeDate: row.predictedNextRechargeDate,
  }));

  return buildMixResponse({
    mixKey: "customer-forecasts",
    title: "Customer Forecasts",
    description: "Highlights depletion timing and likely recharge windows from the latest recharge and usage facts.",
    summary: [
      { key: "tracked", label: "Tracked", value: rows.length, tone: "info" },
      {
        key: "urgent",
        label: "Under 3 Days",
        value: rows.filter((row) => Number(row.estimatedDaysCovered ?? 0) <= 3).length,
        tone: "danger",
      },
      {
        key: "avgCoverage",
        label: "Avg Days Covered",
        value: round(average(rows.map((row) => Number(row.estimatedDaysCovered ?? 0)))),
        tone: "warning",
      },
    ],
    chart: buildRiskChart(sortByNumericKey(rows, "estimatedDaysCovered"), "estimatedDaysCovered"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "avgDailyConsumption7d", label: "Avg Use 7d", align: "end" },
      { key: "estimatedDaysCovered", label: "Days Covered", align: "end" },
      { key: "predictedNextRechargeDate", label: "Next Recharge" },
    ],
    rows,
    metadata: {
      siteId: siteId ?? "ALL",
    },
  });
}

export async function buildRevenueLeakageMix(
  request: AuthenticatedRequest,
  _response: Response,
) {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);
  const limit = readLimit(query, 10, 50);
  const sourceRows = isSupabaseDbEnabled()
    ? await listRevenueLeakageFacts({ siteId, limit })
    : [];
  const responseRows =
    sourceRows.length > 0
      ? sourceRows.map((row) => ({
          meterId: row.meter_sn,
          customerName: row.customer_name ?? row.meter_sn,
          site: row.site_code ?? null,
          leakageScore: round(Number(row.leakage_score ?? 0)),
          estimatedLossKwh: round(Number(row.estimated_loss_kwh ?? 0)),
          reasons: Array.isArray(row.reasons) ? row.reasons : [],
        }))
      : (await buildRevenueLeakageResponse(siteId)).rows.slice(0, limit);

  const rows = responseRows.map<MixRow>((row) => ({
    meterId: row.meterId,
    customerName: row.customerName,
    site: row.site,
    leakageScore: row.leakageScore,
    estimatedLossKwh: row.estimatedLossKwh,
    reasons: row.reasons.join(" | "),
  }));

  return buildMixResponse({
    mixKey: "revenue-leakage",
    title: "Revenue Leakage",
    description: "Ranks meters where low purchase, non-purchase, and live risk signals point to likely value loss.",
    summary: [
      { key: "tracked", label: "Tracked", value: rows.length, tone: "info" },
      {
        key: "critical",
        label: "Critical",
        value: rows.filter((row) => Number(row.leakageScore ?? 0) >= 80).length,
        tone: "danger",
      },
      {
        key: "avgLoss",
        label: "Avg Loss kWh",
        value: round(average(rows.map((row) => Number(row.estimatedLossKwh ?? 0)))),
        tone: "warning",
      },
    ],
    chart: buildRiskChart(rows, "leakageScore"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "leakageScore", label: "Score", align: "end" },
      { key: "estimatedLossKwh", label: "Loss kWh", align: "end" },
      { key: "reasons", label: "Reasons" },
    ],
    rows,
    metadata: {
      siteId: siteId ?? "ALL",
    },
  });
}

export async function buildOperationalPriorityMix(
  request: AuthenticatedRequest,
  _response: Response,
) {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);
  const limit = readLimit(query, 10, 50);
  const sourceRows = isSupabaseDbEnabled()
    ? await listOperationalPriorityFacts({ siteId, limit })
    : [];
  const responseRows =
    sourceRows.length > 0
      ? sourceRows.map((row) => ({
          meterId: row.meter_sn,
          customerName: row.customer_name ?? row.meter_sn,
          site: row.site_code ?? null,
          priorityScore: round(Number(row.priority_score ?? 0)),
          recommendedAction: row.recommended_action ?? "Monitor",
          reasons: Array.isArray(row.reasons) ? row.reasons : [],
        }))
      : (await buildOperationalPriorityResponse(siteId)).rows.slice(0, limit);

  const rows = responseRows.map<MixRow>((row) => ({
    meterId: row.meterId,
    customerName: row.customerName,
    site: row.site,
    priorityScore: row.priorityScore,
    recommendedAction: row.recommendedAction,
    reasons: row.reasons.join(" | "),
  }));

  return buildMixResponse({
    mixKey: "operational-priority",
    title: "Operational Priority",
    description: "Turns leakage and depletion pressure into a field-ready action queue for operations teams.",
    summary: [
      { key: "tracked", label: "Tracked", value: rows.length, tone: "info" },
      {
        key: "urgent",
        label: "Urgent",
        value: rows.filter((row) => Number(row.priorityScore ?? 0) >= 90).length,
        tone: "danger",
      },
      {
        key: "avgPriority",
        label: "Avg Priority",
        value: round(average(rows.map((row) => Number(row.priorityScore ?? 0)))),
        tone: "warning",
      },
    ],
    chart: buildRiskChart(rows, "priorityScore"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "priorityScore", label: "Priority", align: "end" },
      { key: "recommendedAction", label: "Recommended Action" },
      { key: "reasons", label: "Reasons" },
    ],
    rows,
    metadata: {
      siteId: siteId ?? "ALL",
    },
  });
}

export async function buildDashboardRiskOverlay(
  request: AuthenticatedRequest,
  response: Response,
): Promise<DashboardRiskOverlayResponse> {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);
  const lowPurchaseRows = (
    await fetchRows(
      request,
      response,
      ["/API/PrepayReport/LowPurchaseSituation"],
      buildReportBody(query, { lowLimit: 500 }),
    )
  ).filter((row) => rowMatchesSite(row, siteId) && rowMatchesText(row, query));
  const nonPurchaseRows = (
    await fetchRows(
      request,
      response,
      ["/API/PrepayReport/LongNonpurchaseSituation"],
      buildReportBody(query, { nonpurchaseDaysStart: 30, nonpurchaseDaysEnd: 90 }),
    )
  ).filter((row) => rowMatchesSite(row, siteId) && rowMatchesText(row, query));
  const signals = theftIntelligenceService.listSignals();
  const riskMap = new Map<string, MixRow>();

  for (const row of lowPurchaseRows) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }

    const entry = riskMap.get(meterId) ?? {
      meterId,
      customerName: readCustomerName(row),
      site: readSite(row),
      lowBalance: round(readRemainingBalance(row)),
      daysWithoutPurchase: 0,
      theftScore: 0,
      riskScore: 0,
      reasons: "",
    };
    const lowPenalty =
      entry.lowBalance !== null && typeof entry.lowBalance === "number"
        ? Math.max(5, Math.round(Math.max(0, 500 - entry.lowBalance) / 20))
        : 0;
    const reasons = new Set(String(entry.reasons || "").split(" | ").filter(Boolean));
    reasons.add("Low purchase");
    entry.riskScore = (typeof entry.riskScore === "number" ? entry.riskScore : 0) + lowPenalty;
    entry.reasons = Array.from(reasons).join(" | ");
    riskMap.set(meterId, entry);
  }

  for (const row of nonPurchaseRows) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }

    const entry = riskMap.get(meterId) ?? {
      meterId,
      customerName: readCustomerName(row),
      site: readSite(row),
      lowBalance: null,
      daysWithoutPurchase: 0,
      theftScore: 0,
      riskScore: 0,
      reasons: "",
    };
    const days = readDaysWithoutPurchase(row);
    const reasons = new Set(String(entry.reasons || "").split(" | ").filter(Boolean));
    reasons.add("Long nonpurchase");
    entry.daysWithoutPurchase = days;
    entry.riskScore = (typeof entry.riskScore === "number" ? entry.riskScore : 0) + (days >= 60 ? 35 : 20);
    entry.reasons = Array.from(reasons).join(" | ");
    riskMap.set(meterId, entry);
  }

  for (const signal of signals) {
    const entry = riskMap.get(signal.meterId) ?? {
      meterId: signal.meterId,
      customerName: signal.customerName ?? "",
      site: "",
      lowBalance: null,
      daysWithoutPurchase: 0,
      theftScore: 0,
      riskScore: 0,
      reasons: "",
    };
    const reasons = new Set(String(entry.reasons || "").split(" | ").filter(Boolean));
    reasons.add(`Theft signal (${signal.severity})`);
    entry.theftScore = signal.score;
    entry.riskScore = (typeof entry.riskScore === "number" ? entry.riskScore : 0) + signal.score;
    entry.reasons = Array.from(reasons).join(" | ");
    riskMap.set(signal.meterId, entry);
  }

  const rows = sortByNumericKey(Array.from(riskMap.values()), "riskScore").slice(0, readLimit(query, 12, 50));
  const riskScores = rows
    .map((row) => (typeof row.riskScore === "number" ? row.riskScore : 0))
    .filter((value) => value > 0);

  return buildMixResponse({
    mixKey: "dashboard-risk-overlay",
    title: "Risk Overlay",
    description: "Correlates purchase stress, long inactivity, and theft signals into a ranked watchlist.",
    summary: [
      { key: "atRisk", label: "At Risk", value: rows.length, tone: "warning" },
      {
        key: "critical",
        label: "Critical",
        value: rows.filter((row) => typeof row.riskScore === "number" && row.riskScore >= 80).length,
        tone: "danger",
      },
      { key: "avgRisk", label: "Avg Risk", value: round(average(riskScores)), tone: "info" },
    ],
    chart: buildRiskChart(rows, "riskScore"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "site", label: "Site" },
      { key: "riskScore", label: "Risk Score", align: "end" },
      { key: "reasons", label: "Reasons" },
    ],
    rows,
    metadata: {
      siteId: siteId ?? "ALL",
    },
  });
}

export async function buildDashboardRevenueVsUsage(
  request: AuthenticatedRequest,
  response: Response,
): Promise<DashboardRevenueVsUsageResponse> {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query) ?? undefined;
  const window = readDateWindow(query);

  if (isSupabaseDbEnabled()) {
    const [revenueRows, consumptionRows] = await Promise.all([
      listRevenueUsageSeries({
        siteId,
        fromDate: window.fromIso,
        toDate: window.toIso,
        limit: 400,
      }),
      listSiteConsumptionSeries({
        siteId,
        fromDate: window.fromIso,
        toDate: window.toIso,
        granularity: "daily",
        limit: 400,
      }),
    ]);

    if (revenueRows.length > 0 || consumptionRows.length > 0) {
      const labels = Array.from(
        new Set([...revenueRows.map((row) => row.date), ...consumptionRows.map((row) => row.date)]),
      ).sort();
      const revenueByDate = new Map(revenueRows.map((row) => [row.date, row.totalRevenue]));
      const kwhByDate = new Map(consumptionRows.map((row) => [row.date, row.totalKwh]));

      const rows = labels.slice(-30).map<MixRow>((label) => {
        const revenue = revenueByDate.get(label) ?? 0;
        const kwh = kwhByDate.get(label) ?? revenueRows.find((row) => row.date === label)?.totalKwh ?? 0;
        return {
          period: label,
          revenue: round(revenue),
          consumptionKwh: round(kwh),
          nairaPerKwh: kwh > 0 ? round(revenue / kwh) : 0,
        };
      });

      const totalRevenue = rows.reduce((total, row) => total + (typeof row.revenue === "number" ? row.revenue : 0), 0);
      const totalKwh = rows.reduce(
        (total, row) => total + (typeof row.consumptionKwh === "number" ? row.consumptionKwh : 0),
        0,
      );

      return buildMixResponse({
        mixKey: "dashboard-revenue-vs-usage",
        title: "Revenue vs Usage",
        description: "Tracks revenue and energy directly from the Supabase warehouse for faster dashboard reads.",
        summary: [
          { key: "revenue", label: "Revenue", value: round(totalRevenue), tone: "success", unit: "NGN" },
          { key: "kwh", label: "kWh", value: round(totalKwh), tone: "info" },
          {
            key: "yield",
            label: "Avg Yield",
            value: totalKwh > 0 ? round(totalRevenue / totalKwh) : 0,
            tone: "warning",
            unit: "NGN/kWh",
          },
        ],
        chart: {
          labels: rows.map((row) => String(row.period ?? "")),
          series: [
            {
              key: "revenue",
              label: "Revenue",
              values: rows.map((row) => (typeof row.revenue === "number" ? row.revenue : 0)),
              type: "bar",
            },
            {
              key: "consumptionKwh",
              label: "Consumption",
              values: rows.map((row) => (typeof row.consumptionKwh === "number" ? row.consumptionKwh : 0)),
              type: "line",
            },
          ],
        },
        columns: [
          { key: "period", label: "Period" },
          { key: "revenue", label: "Revenue", align: "end" },
          { key: "consumptionKwh", label: "kWh", align: "end" },
          { key: "nairaPerKwh", label: "NGN/kWh", align: "end" },
        ],
        rows: rows.slice(-12).reverse(),
        metadata: {
          source: "supabase",
        },
      });
    }
  }

  const [revenueChart, usageChart, consumptionAnalytics] = await Promise.all([
    loadDashboardLineChart(request, response, {
      from: window.fromIso,
      to: window.toIso,
      ...(siteId ? { siteId } : {}),
      type: 1,
    }),
    loadDashboardLineChart(request, response, {
      from: window.fromIso,
      to: window.toIso,
      ...(siteId ? { siteId } : {}),
      type: 4,
    }),
    getManagementConsumptionAnalytics(request, response, siteId ? { siteId } : {}),
  ]);

  const labels = Array.from(new Set([...revenueChart.xData, ...usageChart.xData])).sort();
  const revenueByLabel = new Map(revenueChart.xData.map((label, index) => [label, revenueChart.yData[index] ?? 0]));
  const kwhByLabel = new Map(usageChart.xData.map((label, index) => [label, usageChart.yData[index] ?? 0]));

  const rows = labels.slice(-30).map<MixRow>((label) => {
    const revenue = revenueByLabel.get(label) ?? 0;
    const kwh = kwhByLabel.get(label) ?? 0;
    return {
      period: label,
      revenue: round(revenue),
      consumptionKwh: round(kwh),
      nairaPerKwh: kwh > 0 ? round(revenue / kwh) : 0,
    };
  });

  const totalRevenue = rows.reduce((total, row) => total + (typeof row.revenue === "number" ? row.revenue : 0), 0);
  const totalKwh = rows.reduce(
    (total, row) => total + (typeof row.consumptionKwh === "number" ? row.consumptionKwh : 0),
    0,
  );

  return buildMixResponse({
    mixKey: "dashboard-revenue-vs-usage",
    title: "Revenue vs Usage",
    description: "Tracks revenue, energy sold, and derived yield across the selected window.",
    summary: [
      { key: "revenue", label: "Revenue", value: round(totalRevenue), tone: "success", unit: "NGN" },
      { key: "kwh", label: "kWh", value: round(totalKwh), tone: "info" },
      {
        key: "yield",
        label: "Avg Yield",
        value: totalKwh > 0 ? round(totalRevenue / totalKwh) : 0,
        tone: "warning",
        unit: "NGN/kWh",
      },
    ],
    chart: {
      labels: rows.map((row) => String(row.period ?? "")),
      series: [
        {
          key: "revenue",
          label: "Revenue",
          values: rows.map((row) => (typeof row.revenue === "number" ? row.revenue : 0)),
          type: "bar",
        },
        {
          key: "consumptionKwh",
          label: "Consumption",
          values: rows.map((row) => (typeof row.consumptionKwh === "number" ? row.consumptionKwh : 0)),
          type: "line",
        },
      ],
    },
    columns: [
      { key: "period", label: "Period" },
      { key: "revenue", label: "Revenue", align: "end" },
      { key: "consumptionKwh", label: "kWh", align: "end" },
      { key: "nairaPerKwh", label: "NGN/kWh", align: "end" },
    ],
    rows: rows.slice(-12).reverse(),
    metadata: {
      trackedDays: consumptionAnalytics.length,
    },
  });
}

export async function buildDashboardPortfolioHealth(
  request: AuthenticatedRequest,
  response: Response,
): Promise<DashboardPortfolioHealthResponse> {
  const [dashboard, upstream, sessionStore, runtimeStateStore, unreadNotifications] = await Promise.all([
    loadDashboardAggregate(request, response),
    checkUpstreamHealth(),
    checkSessionStoreHealth(),
    checkRuntimeStateStoreHealth(),
    analysisEngine.getUnreadNotifications(request.authSession?.user.id ?? null),
  ]);
  const runtime = readRuntimeDiagnostics();
  const analysisStatus = analysisEngine.getStatus();
  const siteStatus = siteConsumptionEngine.getAdminStatus();
  const dependencyPenalty = [upstream, sessionStore, runtimeStateStore].filter((entry) => !entry.ok).length * 20;
  const notificationPenalty = Math.min(30, unreadNotifications.length / 20);
  const stalePenalty = analysisStatus.lastError || siteStatus.lastError ? 15 : 0;
  const healthScore = Math.max(0, Math.round(100 - dependencyPenalty - notificationPenalty - stalePenalty));

  return buildMixResponse({
    mixKey: "dashboard-portfolio-health",
    title: "Portfolio Health",
    description: "Combines runtime state, dependency readiness, and unread alert pressure into one health view.",
    summary: [
      { key: "score", label: "Health Score", value: healthScore, tone: healthScore >= 80 ? "success" : "warning" },
      { key: "alerts", label: "Unread Alerts", value: unreadNotifications.length, tone: "warning" },
      { key: "lowPurchase", label: "Low Purchase", value: dashboard.lowPurchaseCount, tone: "danger" },
    ],
    chart: {
      labels: ["Upstream", "Session", "Runtime State", "Alerts"],
      series: [
        {
          key: "health",
          label: "Health",
          values: [
            upstream.ok ? 100 : 0,
            sessionStore.ok ? 100 : 0,
            runtimeStateStore.ok ? 100 : 0,
            Math.max(0, 100 - unreadNotifications.length),
          ],
          type: "bar",
        },
      ],
    },
    columns: [
      { key: "component", label: "Component" },
      { key: "status", label: "Status" },
      { key: "detail", label: "Detail" },
    ],
    rows: [
      { component: "Runtime", status: runtime.nodeEnv, detail: runtime.sessionStoreMode },
      { component: "Analysis Engine", status: analysisStatus.schedulerRunning ? "Running" : "Stopped", detail: analysisStatus.lastError ?? "OK" },
      { component: "Site Consumption", status: siteStatus.schedulerRunning ? "Running" : "Stopped", detail: siteStatus.lastError ?? "OK" },
      { component: "Upstream", status: upstream.ok ? "Healthy" : "Degraded", detail: upstream.detail ?? "OK" },
      { component: "Session Store", status: sessionStore.ok ? "Healthy" : "Degraded", detail: sessionStore.detail ?? "OK" },
      { component: "Runtime State", status: runtimeStateStore.ok ? "Healthy" : "Degraded", detail: runtimeStateStore.detail ?? "OK" },
    ],
    metadata: {
      portfolioLabel: dashboard.selectedSiteLabel,
    },
  });
}

export async function buildSiteBenchmarkMatrix(
  request: AuthenticatedRequest,
  response: Response,
): Promise<SiteBenchmarkMatrixResponse> {
  const query = request.query as Record<string, unknown>;
  const selectedSites = readSitesFilter(query);
  const snapshot = siteConsumptionEngine.getSnapshot();
  const tokenSnapshot = await getManagementTokenAnalyticsSnapshot(request, response);
  const totalConsumption = snapshot.summary.reduce((total, entry) => total + entry.totalConsumption, 0);

  const rows = selectedSites.map<MixRow>((site) => {
    const consumption = snapshot.summary.find((entry) => entry.site === site)?.totalConsumption ?? 0;
    const revenue = tokenSnapshot.transactions
      .filter((entry) => normalizeKey(entry.siteId) === normalizeKey(site))
      .reduce((total, entry) => total + entry.amount, 0);

    return {
      site,
      totalKwh: round(consumption),
      revenue: round(revenue),
      sharePct: totalConsumption > 0 ? round((consumption / totalConsumption) * 100) : 0,
      revenuePerKwh: consumption > 0 ? round(revenue / consumption) : 0,
    };
  });

  return buildMixResponse({
    mixKey: "site-benchmark-matrix",
    title: "Site Benchmark Matrix",
    description: "Benchmarks verified site consumption against transaction-derived revenue density.",
    summary: [
      { key: "sites", label: "Tracked Sites", value: rows.length, tone: "info" },
      { key: "topSite", label: "Top Site", value: sortByNumericKey(rows, "totalKwh")[0]?.site ?? "N/A", tone: "success" },
      { key: "avgYield", label: "Avg Yield", value: round(average(rows.map((row) => Number(row.revenuePerKwh ?? 0)))), tone: "warning", unit: "NGN/kWh" },
    ],
    chart: {
      labels: rows.map((row) => String(row.site ?? "")),
      series: [
        { key: "totalKwh", label: "Consumption", values: rows.map((row) => Number(row.totalKwh ?? 0)), type: "bar" },
        { key: "revenuePerKwh", label: "Yield", values: rows.map((row) => Number(row.revenuePerKwh ?? 0)), type: "line" },
      ],
    },
    columns: [
      { key: "site", label: "Site" },
      { key: "totalKwh", label: "kWh", align: "end" },
      { key: "revenue", label: "Revenue", align: "end" },
      { key: "sharePct", label: "Share %", align: "end" },
      { key: "revenuePerKwh", label: "NGN/kWh", align: "end" },
    ],
    rows: sortByNumericKey(rows, "totalKwh"),
  });
}

export async function buildTopConsumerWatchlist(
  request: AuthenticatedRequest,
  response: Response,
): Promise<TopConsumerWatchlistResponse> {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query) ?? undefined;
  const limit = readLimit(query, 10, 30);
  const [meterRows, lowPurchaseRows] = await Promise.all([
    getManagementMeterConsumptionAnalytics(request, response, siteId ? { siteId } : {}),
    fetchRows(
      request,
      response,
      ["/API/PrepayReport/LowPurchaseSituation"],
      buildReportBody(query, { lowLimit: 500 }),
    ),
  ]);

  const lowPurchaseByMeter = new Map(
    lowPurchaseRows.map((row) => [readMeterId(row), readRemainingBalance(row)]),
  );
  const theftByMeter = new Map(
    theftIntelligenceService.listSignals().map((signal) => [signal.meterId, signal.score]),
  );
  const maxKwh = Math.max(1, ...meterRows.map((row) => row.totalKwh));

  const rows = meterRows.slice(0, limit).map<MixRow>((row) => {
    const theftScore = theftByMeter.get(row.meterSN) ?? 0;
    const lowBalance = lowPurchaseByMeter.get(row.meterSN) ?? null;
    const usageScore = Math.round((row.totalKwh / maxKwh) * 40);
    const watchScore =
      usageScore +
      Math.min(40, Math.round(theftScore / 2)) +
      (typeof lowBalance === "number" ? Math.max(0, Math.round((500 - lowBalance) / 25)) : 0);

    return {
      meterId: row.meterSN,
      customerName: row.customerName,
      site: row.siteId,
      totalKwh: round(row.totalKwh),
      theftScore,
      lowBalance,
      watchScore,
    };
  });

  return buildMixResponse({
    mixKey: "top-consumer-watchlist",
    title: "Top Consumer Watchlist",
    description: "Ranks high-consumption meters after overlaying theft and low-balance pressure.",
    summary: [
      { key: "tracked", label: "Tracked", value: rows.length, tone: "info" },
      { key: "highRisk", label: "High Risk", value: rows.filter((row) => Number(row.watchScore ?? 0) >= 60).length, tone: "danger" },
      { key: "avgWatch", label: "Avg Watch", value: round(average(rows.map((row) => Number(row.watchScore ?? 0)))), tone: "warning" },
    ],
    chart: buildRiskChart(sortByNumericKey(rows, "watchScore"), "watchScore"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "site", label: "Site" },
      { key: "totalKwh", label: "kWh", align: "end" },
      { key: "watchScore", label: "Watch", align: "end" },
    ],
    rows: sortByNumericKey(rows, "watchScore"),
  });
}

export async function buildCustomer360Lite(
  request: AuthenticatedRequest,
  response: Response,
): Promise<Customer360LiteResponse> {
  const query = request.query as Record<string, unknown>;
  const searchMeterId = typeof query.meterId === "string" ? query.meterId.trim() : "";
  const searchCustomerId = typeof query.customerId === "string" ? query.customerId.trim() : "";
  const customers = await fetchRows(request, response, ["/api/customer/read"], buildReadBody({}, {}));
  const accounts = await fetchRows(request, response, ["/api/account/read"], buildReadBody({}, {}));
  const meters = await fetchRows(request, response, ["/api/meter/read"], buildReadBody({}, {}));
  const snapshot = await getManagementTokenAnalyticsSnapshot(request, response);
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * DAY_MS;
  const byMeter = new Map<string, MixRow>();

  for (const transaction of snapshot.transactions) {
    if (
      (searchMeterId && transaction.meterSN !== searchMeterId) ||
      (searchCustomerId &&
        transaction.accountNo !== searchCustomerId &&
        transaction.customerName !== searchCustomerId)
    ) {
      continue;
    }

    const current = byMeter.get(transaction.meterSN) ?? {
      customerId: "",
      customerName: transaction.customerName,
      accountNo: transaction.accountNo,
      meterId: transaction.meterSN,
      site: transaction.siteId,
      lastVendAt: transaction.timestamp,
      vendCount90d: 0,
      totalVend90d: 0,
    };
    const timestamp = new Date(transaction.timestamp).getTime();
    if (!current.lastVendAt || String(current.lastVendAt) < transaction.timestamp) {
      current.lastVendAt = transaction.timestamp;
    }
    if (!Number.isNaN(timestamp) && timestamp >= ninetyDaysAgo) {
      current.vendCount90d = Number(current.vendCount90d ?? 0) + 1;
      current.totalVend90d = round(Number(current.totalVend90d ?? 0) + transaction.amount);
    }
    byMeter.set(transaction.meterSN, current);
  }

  for (const row of byMeter.values()) {
    const meterRow = meters.find((entry) => readMeterId(entry) === row.meterId);
    const accountRow = accounts.find(
      (entry) => readAccountNo(entry) === row.accountNo || readMeterId(entry) === row.meterId,
    );
    const customerRow = customers.find(
      (entry) =>
        readCustomerId(entry) === readCustomerId(accountRow ?? {}) ||
        readCustomerName(entry) === row.customerName,
    );
    row.customerId =
      readCustomerId(customerRow ?? accountRow ?? {}) || readCustomerId(meterRow ?? {}) || null;
    row.customerName =
      readCustomerName(customerRow ?? {}) ||
      (typeof row.customerName === "string" ? row.customerName : null);
    row.accountNo =
      readAccountNo(accountRow ?? {}) ||
      (typeof row.accountNo === "string" ? row.accountNo : null);
    row.site =
      readSite(meterRow ?? accountRow ?? {}) || (typeof row.site === "string" ? row.site : null);
  }

  const rows = sortByNumericKey(Array.from(byMeter.values()), "totalVend90d").slice(0, readLimit(query, 12, 50));

  return buildMixResponse({
    mixKey: "customer-360-lite",
    title: "Customer 360 Lite",
    description: "Creates a lightweight customer operating view by joining customer, account, meter, and recent vend activity.",
    summary: [
      { key: "customers", label: "Customers", value: rows.length, tone: "info" },
      { key: "active90d", label: "Active 90d", value: rows.filter((row) => Number(row.vendCount90d ?? 0) > 0).length, tone: "success" },
      { key: "avgVend90d", label: "Avg Vend 90d", value: round(average(rows.map((row) => Number(row.totalVend90d ?? 0)))), tone: "warning", unit: "NGN" },
    ],
    chart: {
      labels: rows.slice(0, 8).map((row) => String(row.meterId ?? "")),
      series: [
        {
          key: "totalVend90d",
          label: "90d Vend",
          values: rows.slice(0, 8).map((row) => Number(row.totalVend90d ?? 0)),
          type: "bar",
        },
      ],
    },
    columns: [
      { key: "customerName", label: "Customer" },
      { key: "accountNo", label: "Account" },
      { key: "meterId", label: "Meter" },
      { key: "site", label: "Site" },
      { key: "vendCount90d", label: "90d Count", align: "end" },
      { key: "totalVend90d", label: "90d Total", align: "end" },
    ],
    rows,
  });
}

export async function buildMeterPerformanceSheet(
  request: AuthenticatedRequest,
  response: Response,
): Promise<MeterPerformanceSheetResponse> {
  const query = request.query as Record<string, unknown>;
  const searchMeterId = typeof query.meterId === "string" ? query.meterId.trim() : "";
  const siteId = readSiteFilter(query);
  const [meterRows, gatewayRows, dailyRows, dlmsRows] = await Promise.all([
    fetchRows(request, response, ["/api/meter/read"], buildReadBody({}, {})),
    fetchRows(request, response, ["/api/gateway/read"], buildReadBody({}, {})),
    fetchRows(request, response, ["/api/DailyDataMeter/read"], buildReadBody({}, {})),
    fetchRows(request, response, ["/api/dlms/Read"], buildReadBody({}, {})),
  ]);

  const gatewaySet = new Set(gatewayRows.map((row) => readGatewayId(row)).filter(Boolean));
  const dlmsSet = new Set(dlmsRows.map((row) => readMeterId(row)).filter(Boolean));
  const latestReadByMeter = new Map<string, string>();

  for (const row of dailyRows) {
    const meterId = readMeterId(row);
    const timestamp = readTimestamp(row);
    if (!meterId || !timestamp) {
      continue;
    }
    if (!latestReadByMeter.has(meterId) || String(latestReadByMeter.get(meterId)) < timestamp) {
      latestReadByMeter.set(meterId, timestamp);
    }
  }

  const rows = meterRows
    .filter((row) => rowMatchesSite(row, siteId))
    .filter((row) => !searchMeterId || readMeterId(row) === searchMeterId)
    .map<MixRow>((row) => {
      const meterId = readMeterId(row);
      const gatewayId = readGatewayId(row);
      const lastReadAt = latestReadByMeter.get(meterId) ?? "";
      const readAgeHours = lastReadAt
        ? Math.max(0, Math.round((Date.now() - new Date(lastReadAt).getTime()) / (60 * 60 * 1000)))
        : 999;
      const gatewayLinked = gatewayId.length > 0 && gatewaySet.has(gatewayId);
      const protocolConfigured = dlmsSet.has(meterId);
      const performanceScore = Math.max(
        0,
        100 -
          Math.min(40, readAgeHours > 999 ? 40 : Math.round(readAgeHours / 6)) -
          (gatewayLinked ? 0 : 20) -
          (protocolConfigured ? 0 : 20),
      );

      return {
        meterId,
        gatewayId,
        site: readSite(row),
        lastReadAt,
        readAgeHours,
        gatewayLinked,
        protocolConfigured,
        performanceScore,
      };
    });

  const sorted = sortByNumericKey(rows, "performanceScore").reverse().slice(0, readLimit(query, 12, 50));

  return buildMixResponse({
    mixKey: "meter-performance-sheet",
    title: "Meter Performance Sheet",
    description: "Summarizes meter freshness, gateway linkage, and DLMS configuration health in one view.",
    summary: [
      { key: "meters", label: "Meters", value: sorted.length, tone: "info" },
      { key: "protocolOk", label: "Protocol OK", value: sorted.filter((row) => row.protocolConfigured === true).length, tone: "success" },
      { key: "avgScore", label: "Avg Score", value: round(average(sorted.map((row) => Number(row.performanceScore ?? 0)))), tone: "warning" },
    ],
    chart: buildRiskChart(sortByNumericKey(sorted, "performanceScore").reverse(), "performanceScore"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "gatewayId", label: "Gateway" },
      { key: "site", label: "Site" },
      { key: "readAgeHours", label: "Read Age (h)", align: "end" },
      { key: "performanceScore", label: "Score", align: "end" },
    ],
    rows: sorted,
  });
}

export async function buildTokenReconciliation(
  request: AuthenticatedRequest,
  response: Response,
): Promise<TokenReconciliationResponse> {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);
  const searchMeterId = typeof query.meterId === "string" ? query.meterId.trim() : "";
  const [snapshot, dailyRows, tariffRows] = await Promise.all([
    getManagementTokenAnalyticsSnapshot(request, response),
    fetchRows(request, response, ["/API/LoadProfile/DailyData"], buildReportBody(query)),
    fetchRows(request, response, ["/api/tariff/read"], buildReadBody({}, {})),
  ]);

  const actualByMeter = new Map<string, number>();
  for (const row of dailyRows) {
    const meterId = readMeterId(row);
    if (!meterId || !rowMatchesSite(row, siteId)) {
      continue;
    }
    actualByMeter.set(meterId, (actualByMeter.get(meterId) ?? 0) + readConsumptionValue(row));
  }

  const tariffSet = new Set(tariffRows.map((row) => readTariffId(row)).filter(Boolean));
  const soldByMeter = new Map<string, MixRow>();
  for (const transaction of snapshot.transactions) {
    if (
      (siteId && normalizeKey(transaction.siteId) !== normalizeKey(siteId)) ||
      (searchMeterId && transaction.meterSN !== searchMeterId)
    ) {
      continue;
    }

    const current = soldByMeter.get(transaction.meterSN) ?? {
      meterId: transaction.meterSN,
      customerName: transaction.customerName,
      tariffId: transaction.tariffRate,
      soldKwh: 0,
      actualKwh: 0,
      varianceKwh: 0,
      variancePct: 0,
      tariffKnown: tariffSet.has(transaction.tariffRate),
    };
    current.soldKwh = round(Number(current.soldKwh ?? 0) + transaction.kwh);
    soldByMeter.set(transaction.meterSN, current);
  }

  for (const row of soldByMeter.values()) {
    const actualKwh = round(actualByMeter.get(String(row.meterId)) ?? 0);
    const soldKwh = Number(row.soldKwh ?? 0);
    row.actualKwh = actualKwh;
    row.varianceKwh = round(actualKwh - soldKwh);
    row.variancePct = soldKwh > 0 ? round(((actualKwh - soldKwh) / soldKwh) * 100) : 0;
  }

  const rows: MixRow[] = sortByNumericKey(
    Array.from(soldByMeter.values()).map<MixRow>((row) => ({
      ...row,
      varianceAbs: Math.abs(Number(row.varianceKwh ?? 0)),
    })),
    "varianceAbs",
  ).slice(0, readLimit(query, 12, 50));

  return buildMixResponse({
    mixKey: "token-reconciliation",
    title: "Token Reconciliation",
    description: "Reconciles verified vend transactions against AMR consumption totals and tariff references.",
    summary: [
      { key: "meters", label: "Meters", value: rows.length, tone: "info" },
      { key: "variance", label: "Avg Variance", value: round(average(rows.map((row) => Math.abs(Number(row.varianceKwh ?? 0))))), tone: "warning", unit: "kWh" },
      { key: "tariffKnown", label: "Known Tariffs", value: rows.filter((row) => row.tariffKnown === true).length, tone: "success" },
    ],
    chart: {
      labels: rows.slice(0, 8).map((row) => String(row.meterId ?? "")),
      series: [
        { key: "soldKwh", label: "Sold", values: rows.slice(0, 8).map((row) => Number(row.soldKwh ?? 0)), type: "bar" },
        { key: "actualKwh", label: "Actual", values: rows.slice(0, 8).map((row) => Number(row.actualKwh ?? 0)), type: "line" },
      ],
    },
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "soldKwh", label: "Sold kWh", align: "end" },
      { key: "actualKwh", label: "Actual kWh", align: "end" },
      { key: "variancePct", label: "Variance %", align: "end" },
    ],
    rows,
  });
}

export async function buildCollectionsPriority(
  request: AuthenticatedRequest,
  response: Response,
): Promise<CollectionsPriorityResponse> {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);
  const [lowPurchaseRows, nonPurchaseRows, accountRows] = await Promise.all([
    fetchRows(request, response, ["/API/PrepayReport/LowPurchaseSituation"], buildReportBody(query, { lowLimit: 500 })),
    fetchRows(request, response, ["/API/PrepayReport/LongNonpurchaseSituation"], buildReportBody(query, { nonpurchaseDaysStart: 30, nonpurchaseDaysEnd: 90 })),
    fetchRows(request, response, ["/api/account/read"], buildReadBody({}, {})),
  ]);
  const openCases = theftIntelligenceService.listCases().filter((item) =>
    ["new", "active", "investigating"].includes(item.status),
  );
  const accountByMeter = new Map(accountRows.map((row) => [readMeterId(row), row]));
  const caseByMeter = new Map(openCases.map((item) => [item.meterId, item]));
  const rowMap = new Map<string, MixRow>();

  for (const row of lowPurchaseRows.filter((entry) => rowMatchesSite(entry, siteId) && rowMatchesText(entry, query))) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }
    const current = rowMap.get(meterId) ?? {
      customerName: readCustomerName(row),
      meterId,
      accountNo: readAccountNo(accountByMeter.get(meterId) ?? {}),
      lowBalance: readRemainingBalance(row),
      daysWithoutPurchase: 0,
      openCase: false,
      priority: 0,
      reasons: "",
    };
    current.priority = Number(current.priority ?? 0) + 30;
    current.reasons = [current.reasons, "Low purchase"].filter(Boolean).join(" | ");
    rowMap.set(meterId, current);
  }

  for (const row of nonPurchaseRows.filter((entry) => rowMatchesSite(entry, siteId) && rowMatchesText(entry, query))) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }
    const current = rowMap.get(meterId) ?? {
      customerName: readCustomerName(row),
      meterId,
      accountNo: readAccountNo(accountByMeter.get(meterId) ?? {}),
      lowBalance: null,
      daysWithoutPurchase: 0,
      openCase: false,
      priority: 0,
      reasons: "",
    };
    current.daysWithoutPurchase = readDaysWithoutPurchase(row);
    current.priority = Number(current.priority ?? 0) + 35;
    current.reasons = [current.reasons, "Long nonpurchase"].filter(Boolean).join(" | ");
    rowMap.set(meterId, current);
  }

  for (const [meterId, theftCase] of caseByMeter.entries()) {
    const current = rowMap.get(meterId) ?? {
      customerName: theftCase.customerName ?? "",
      meterId,
      accountNo: readAccountNo(accountByMeter.get(meterId) ?? {}),
      lowBalance: null,
      daysWithoutPurchase: 0,
      openCase: false,
      priority: 0,
      reasons: "",
    };
    current.openCase = true;
    current.priority = Number(current.priority ?? 0) + 40;
    current.reasons = [current.reasons, "Open theft case"].filter(Boolean).join(" | ");
    rowMap.set(meterId, current);
  }

  const rows = sortByNumericKey(Array.from(rowMap.values()), "priority").slice(0, readLimit(query, 12, 50));

  return buildMixResponse({
    mixKey: "collections-priority",
    title: "Collections Priority",
    description: "Ranks collection targets by combining low balance, extended nonpurchase, and open-case pressure.",
    summary: [
      { key: "targets", label: "Targets", value: rows.length, tone: "info" },
      { key: "urgent", label: "Urgent", value: rows.filter((row) => Number(row.priority ?? 0) >= 70).length, tone: "danger" },
      { key: "avgPriority", label: "Avg Priority", value: round(average(rows.map((row) => Number(row.priority ?? 0)))), tone: "warning" },
    ],
    chart: buildRiskChart(rows, "priority"),
    columns: [
      { key: "customerName", label: "Customer" },
      { key: "meterId", label: "Meter" },
      { key: "accountNo", label: "Account" },
      { key: "priority", label: "Priority", align: "end" },
      { key: "reasons", label: "Reasons" },
    ],
    rows,
  });
}

export async function buildTheftPrioritization(
  request: AuthenticatedRequest,
  response: Response,
): Promise<TheftPrioritizationResponse> {
  const query = request.query as Record<string, unknown>;
  const siteId = readSiteFilter(query);

  if (isSupabaseDbEnabled()) {
    const snapshot = await loadTheftRuntimeSnapshot();
    if (snapshot && snapshot.signals.length > 0) {
      const caseByMeter = new Map(snapshot.cases.map((item) => [item.meterId, item]));
      const rows = snapshot.signals
        .map<MixRow>((signal) => {
          const theftCase = caseByMeter.get(signal.meterId);
          const priority = signal.score + (theftCase ? 20 : 0);
          return {
            meterId: signal.meterId,
            customerName: signal.customerName ?? "",
            site: signal.siteId ?? "",
            signalScore: signal.score,
            caseStatus: theftCase?.status ?? "none",
            lastReadAt: signal.updatedAt,
            priority,
          };
        })
        .filter((row) => !siteId || normalizeKey(String(row.site ?? "")) === normalizeKey(siteId));

      const sorted = sortByNumericKey(rows, "priority").slice(0, readLimit(query, 12, 50));
      return buildMixResponse({
        mixKey: "theft-prioritization",
        title: "Theft Prioritization",
        description: "Prioritizes investigations using Supabase-backed theft signals and open cases.",
        summary: [
          { key: "signals", label: "Signals", value: sorted.length, tone: "warning" },
          { key: "openCases", label: "Open Cases", value: sorted.filter((row) => row.caseStatus !== "none").length, tone: "danger" },
          { key: "avgPriority", label: "Avg Priority", value: round(average(sorted.map((row) => Number(row.priority ?? 0)))), tone: "info" },
        ],
        chart: buildRiskChart(sorted, "priority"),
        columns: [
          { key: "meterId", label: "Meter" },
          { key: "customerName", label: "Customer" },
          { key: "caseStatus", label: "Case" },
          { key: "priority", label: "Priority", align: "end" },
          { key: "lastReadAt", label: "Updated" },
        ],
        rows: sorted,
      });
    }
  }

  const [dailyRows, meterRows] = await Promise.all([
    fetchRows(request, response, ["/api/DailyDataMeter/read"], buildReadBody({}, {})),
    fetchRows(request, response, ["/api/meter/read"], buildReadBody({}, {})),
  ]);
  const latestReadByMeter = new Map<string, string>();
  for (const row of dailyRows) {
    const meterId = readMeterId(row);
    const timestamp = readTimestamp(row);
    if (!meterId || !timestamp) {
      continue;
    }
    if (!latestReadByMeter.has(meterId) || String(latestReadByMeter.get(meterId)) < timestamp) {
      latestReadByMeter.set(meterId, timestamp);
    }
  }
  const meterById = new Map(meterRows.map((row) => [readMeterId(row), row]));
  const caseByMeter = new Map(theftIntelligenceService.listCases().map((item) => [item.meterId, item]));
  const rows = theftIntelligenceService.listSignals()
    .map<MixRow>((signal) => {
      const meterRow = meterById.get(signal.meterId) ?? {};
      const lastReadAt = latestReadByMeter.get(signal.meterId) ?? "";
      const readAgeHours = lastReadAt
        ? Math.max(0, Math.round((Date.now() - new Date(lastReadAt).getTime()) / (60 * 60 * 1000)))
        : 999;
      const theftCase = caseByMeter.get(signal.meterId);
      const priority = signal.score + (theftCase ? 20 : 0) + Math.min(20, Math.round(readAgeHours / 24));
      return {
        meterId: signal.meterId,
        customerName: signal.customerName ?? readCustomerName(meterRow),
        site: readSite(meterRow),
        signalScore: signal.score,
        caseStatus: theftCase?.status ?? "none",
        lastReadAt,
        priority,
      };
    })
    .filter((row) => !siteId || normalizeKey(String(row.site ?? "")) === normalizeKey(siteId))
    .slice(0, readLimit(query, 12, 50));

  const sorted = sortByNumericKey(rows, "priority");

  return buildMixResponse({
    mixKey: "theft-prioritization",
    title: "Theft Prioritization",
    description: "Prioritizes investigations using verified signals, case state, and stale-read pressure.",
    summary: [
      { key: "signals", label: "Signals", value: sorted.length, tone: "warning" },
      { key: "openCases", label: "Open Cases", value: sorted.filter((row) => row.caseStatus !== "none").length, tone: "danger" },
      { key: "avgPriority", label: "Avg Priority", value: round(average(sorted.map((row) => Number(row.priority ?? 0)))), tone: "info" },
    ],
    chart: buildRiskChart(sorted, "priority"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "customerName", label: "Customer" },
      { key: "caseStatus", label: "Case" },
      { key: "priority", label: "Priority", align: "end" },
      { key: "lastReadAt", label: "Last Read" },
    ],
    rows: sorted,
  });
}

export async function buildSiteLossExposure(
  request: AuthenticatedRequest,
  response: Response,
): Promise<SiteLossExposureResponse> {
  const query = request.query as Record<string, unknown>;
  const selectedSites = readSitesFilter(query);

  if (isSupabaseDbEnabled()) {
    const consumptionRows = await listSiteConsumptionSeries({
      granularity: "daily",
      limit: 1000,
    });

    if (consumptionRows.length > 0) {
      const theftSnapshot = await loadTheftRuntimeSnapshot();
      const openCaseCounts = new Map<string, number>();
      for (const theftCase of theftSnapshot?.cases ?? []) {
        const site = normalizeKey(theftCase.siteId);
        openCaseCounts.set(site, (openCaseCounts.get(site) ?? 0) + 1);
      }

      const totalsBySite = new Map<string, number>();
      for (const row of consumptionRows) {
        const site = normalizeKey(row.siteCode ?? "");
        totalsBySite.set(site, (totalsBySite.get(site) ?? 0) + row.totalKwh);
      }

      const rows = selectedSites.map<MixRow>((site) => {
        const normalizedSite = normalizeKey(site);
        const totalKwh = totalsBySite.get(normalizedSite) ?? 0;
        const openCases = openCaseCounts.get(normalizedSite) ?? 0;
        const exposureIndex = round(openCases * 10 + totalKwh / 100);
        return {
          site,
          totalKwh: round(totalKwh),
          lowPurchaseCount: 0,
          nonPurchaseCount: openCases,
          exposureIndex,
          riskBand: exposureIndex >= 80 ? "Critical" : exposureIndex >= 40 ? "Watch" : "Stable",
        };
      });

      return buildMixResponse({
        mixKey: "site-loss-exposure",
        title: "Site Loss Exposure",
        description: "Balances warehouse consumption against active theft-case pressure by site.",
        summary: [
          { key: "sites", label: "Sites", value: rows.length, tone: "info" },
          { key: "topRisk", label: "Top Risk", value: sortByNumericKey(rows, "exposureIndex")[0]?.site ?? "N/A", tone: "danger" },
          { key: "avgExposure", label: "Avg Exposure", value: round(average(rows.map((row) => Number(row.exposureIndex ?? 0)))), tone: "warning" },
        ],
        chart: {
          labels: rows.map((row) => String(row.site ?? "")),
          series: [
            { key: "totalKwh", label: "kWh", values: rows.map((row) => Number(row.totalKwh ?? 0)), type: "bar" },
            { key: "exposureIndex", label: "Exposure", values: rows.map((row) => Number(row.exposureIndex ?? 0)), type: "line" },
          ],
        },
        columns: [
          { key: "site", label: "Site" },
          { key: "totalKwh", label: "kWh", align: "end" },
          { key: "lowPurchaseCount", label: "Low Purchase", align: "end" },
          { key: "nonPurchaseCount", label: "Open Cases", align: "end" },
          { key: "exposureIndex", label: "Exposure", align: "end" },
        ],
        rows: sortByNumericKey(rows, "exposureIndex"),
      });
    }
  }

  const snapshot = siteConsumptionEngine.getSnapshot();
  const [lowPurchaseRows, nonPurchaseRows] = await Promise.all([
    fetchRows(request, response, ["/API/PrepayReport/LowPurchaseSituation"], buildReportBody(query, { lowLimit: 500 })),
    fetchRows(request, response, ["/API/PrepayReport/LongNonpurchaseSituation"], buildReportBody(query, { nonpurchaseDaysStart: 30, nonpurchaseDaysEnd: 90 })),
  ]);

  const rows = selectedSites.map<MixRow>((site) => {
    const totalKwh = snapshot.summary.find((entry) => entry.site === site)?.totalConsumption ?? 0;
    const lowCount = lowPurchaseRows.filter((row) => normalizeKey(readSite(row)) === normalizeKey(site)).length;
    const nonPurchaseCount = nonPurchaseRows.filter((row) => normalizeKey(readSite(row)) === normalizeKey(site)).length;
    const exposureIndex = round(lowCount + nonPurchaseCount * 1.5);
    return {
      site,
      totalKwh: round(totalKwh),
      lowPurchaseCount: lowCount,
      nonPurchaseCount,
      exposureIndex,
      riskBand: exposureIndex >= 80 ? "Critical" : exposureIndex >= 40 ? "Watch" : "Stable",
    };
  });

  return buildMixResponse({
    mixKey: "site-loss-exposure",
    title: "Site Loss Exposure",
    description: "Balances recent site consumption against verified low-purchase and long-nonpurchase pressure.",
    summary: [
      { key: "sites", label: "Sites", value: rows.length, tone: "info" },
      { key: "topRisk", label: "Top Risk", value: sortByNumericKey(rows, "exposureIndex")[0]?.site ?? "N/A", tone: "danger" },
      { key: "avgExposure", label: "Avg Exposure", value: round(average(rows.map((row) => Number(row.exposureIndex ?? 0)))), tone: "warning" },
    ],
    chart: {
      labels: rows.map((row) => String(row.site ?? "")),
      series: [
        { key: "totalKwh", label: "kWh", values: rows.map((row) => Number(row.totalKwh ?? 0)), type: "bar" },
        { key: "exposureIndex", label: "Exposure", values: rows.map((row) => Number(row.exposureIndex ?? 0)), type: "line" },
      ],
    },
    columns: [
      { key: "site", label: "Site" },
      { key: "totalKwh", label: "kWh", align: "end" },
      { key: "lowPurchaseCount", label: "Low Purchase", align: "end" },
      { key: "nonPurchaseCount", label: "Nonpurchase", align: "end" },
      { key: "exposureIndex", label: "Exposure", align: "end" },
    ],
    rows: sortByNumericKey(rows, "exposureIndex"),
  });
}

export async function buildNotificationsCorrelatedFeed(
  request: AuthenticatedRequest,
  response: Response,
): Promise<NotificationsCorrelatedFeedResponse> {
  const query = request.query as Record<string, unknown>;
  const limit = readLimit(query, 12, 50);
  const [dashboard, notifications] = await Promise.all([
    loadDashboardAggregate(request, response),
    analysisEngine.getUnreadNotifications(request.authSession?.user.id ?? null),
  ]);
  const signalsByMeter = new Map(theftIntelligenceService.listSignals().map((signal) => [signal.meterId, signal]));
  const rows = notifications
    .map<MixRow>((item) => {
      const linkedSignal = item.meterId ? signalsByMeter.get(item.meterId) : null;
      const linkedRiskScore = linkedSignal?.score ?? 0;
      const severity =
        linkedRiskScore >= 70 || item.type === "critical"
          ? "critical"
          : linkedRiskScore >= 40 || item.type === "warning"
            ? "warning"
            : "info";

      return {
        id: item.id,
        meterId: item.meterId ?? "",
        title: item.title,
        message: item.message,
        severity,
        linkedRiskScore,
        timestamp: item.timestamp,
      };
    })
    .slice(0, limit);

  return buildMixResponse({
    mixKey: "notifications-correlated-feed",
    title: "Correlated Notifications",
    description: "Augments unread notifications with theft-risk linkage and dashboard pressure context.",
    summary: [
      { key: "unread", label: "Unread", value: rows.length, tone: "warning" },
      { key: "critical", label: "Critical", value: rows.filter((row) => row.severity === "critical").length, tone: "danger" },
      { key: "linked", label: "Linked To Theft", value: rows.filter((row) => Number(row.linkedRiskScore ?? 0) > 0).length, tone: "info" },
    ],
    chart: {
      labels: ["Low Purchase", "Long Nonpurchase", "Inactive", "Unread"],
      series: [
        {
          key: "counts",
          label: "Counts",
          values: [
            dashboard.lowPurchaseCount,
            dashboard.longNonpurchaseCount,
            dashboard.inactiveMeterCount,
            rows.length,
          ],
          type: "bar",
        },
      ],
    },
    columns: [
      { key: "title", label: "Title" },
      { key: "meterId", label: "Meter" },
      { key: "severity", label: "Severity" },
      { key: "linkedRiskScore", label: "Risk", align: "end" },
      { key: "timestamp", label: "Time" },
    ],
    rows,
  });
}

export async function buildMasterDataConsistency(
  request: AuthenticatedRequest,
  response: Response,
): Promise<MasterDataConsistencyResponse> {
  const customers = await fetchRows(request, response, ["/api/customer/read"], buildReadBody({}, {}));
  const accounts = await fetchRows(request, response, ["/api/account/read"], buildReadBody({}, {}));
  const meters = await fetchRows(request, response, ["/api/meter/read"], buildReadBody({}, {}));
  const gateways = await fetchRows(request, response, ["/api/gateway/read"], buildReadBody({}, {}));
  const tariffs = await fetchRows(request, response, ["/api/tariff/read"], buildReadBody({}, {}));
  const customerIds = new Set(customers.map((row) => readCustomerId(row)).filter(Boolean));
  const accountNos = new Set(accounts.map((row) => readAccountNo(row)).filter(Boolean));
  const gatewayIds = new Set(gateways.map((row) => readGatewayId(row)).filter(Boolean));
  const tariffIds = new Set(tariffs.map((row) => readTariffId(row)).filter(Boolean));

  const rows = meters.map<MixRow>((row) => {
    const customerId = readCustomerId(row);
    const accountNo = readAccountNo(row);
    const gatewayId = readGatewayId(row);
    const tariffId = readTariffId(row);
    const customerLinked = !customerId || customerIds.has(customerId);
    const accountLinked = !accountNo || accountNos.has(accountNo);
    const gatewayLinked = !gatewayId || gatewayIds.has(gatewayId);
    const tariffLinked = !tariffId || tariffIds.has(tariffId);
    const missingRelations = [customerLinked, accountLinked, gatewayLinked, tariffLinked].filter((value) => !value).length;

    return {
      meterId: readMeterId(row),
      site: readSite(row),
      customerLinked,
      accountLinked,
      gatewayLinked,
      tariffLinked,
      qualityScore: Math.max(0, 100 - missingRelations * 20),
    };
  });

  return buildMixResponse({
    mixKey: "master-data-consistency",
    title: "Master Data Consistency",
    description: "Checks whether verified meter records can resolve their customer, account, gateway, and tariff links.",
    summary: [
      { key: "meters", label: "Meters", value: rows.length, tone: "info" },
      { key: "orphans", label: "Orphan Meters", value: rows.filter((row) => Number(row.qualityScore ?? 0) < 100).length, tone: "danger" },
      { key: "avgScore", label: "Avg Score", value: round(average(rows.map((row) => Number(row.qualityScore ?? 0)))), tone: "success" },
    ],
    chart: buildRiskChart(sortByNumericKey(rows, "qualityScore").reverse(), "qualityScore"),
    columns: [
      { key: "meterId", label: "Meter" },
      { key: "site", label: "Site" },
      { key: "customerLinked", label: "Customer" },
      { key: "accountLinked", label: "Account" },
      { key: "gatewayLinked", label: "Gateway" },
      { key: "tariffLinked", label: "Tariff" },
      { key: "qualityScore", label: "Score", align: "end" },
    ],
    rows: rows.slice(0, 20),
  });
}
