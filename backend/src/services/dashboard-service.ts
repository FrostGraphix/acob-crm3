import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { extractRows, readNumber, readString, type ReportRow } from "../lib/upstream-data.js";
import {
  getManagementTokenAnalyticsSnapshot,
  type ManagementTokenTransaction,
} from "./management-token-analytics.js";
import { buildUpstreamRequestPlan } from "./upstream-request-adapters.js";
import { forwardWithUpstreamSessionRecovery } from "./upstream-session.js";
import {
  forwardToUpstream,
  forwardToUpstreamGet,
  type UpstreamResult,
} from "./upstream.js";

interface DashboardLivePulseItem {
  timeLabel: string;
  message: string;
}

interface DashboardAggregatePayload {
  totalAccountCount: number;
  totalPurchaseTimes: number;
  totalPurchaseUnit: number;
  totalPurchaseMoney: number;
  lowPurchaseCount: number;
  longNonpurchaseCount: number;
  inactiveMeterCount: number;
  unreadEventCount: number;
  onlineGatewayCount: number;
  offlineGatewayCount: number;
  portfolioLabel: string;
  selectedSiteId: string | null;
  selectedSiteLabel: string;
  sourceWindow: {
    from: string;
    to: string;
  };
  lastUpdatedAt: string | null;
  livePulse: DashboardLivePulseItem[];
  alarms: Array<{ label: string; value: number }>;
}

interface DashboardLineChartPayload {
  xData: string[];
  yData: number[];
}

interface DashboardScope {
  siteId: string | null;
  selectedSiteLabel: string;
  sourceWindow: {
    from: string;
    to: string;
  };
  reportWindow: {
    fromDate: string;
    toDate: string;
  };
}

const DASHBOARD_ALL_TIME_FROM = "2000-01-01T00:00:00.000Z";
const DASHBOARD_SITE_SCOPED_ROW_LIMIT = 100_000;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function toNumberArray(value: unknown) {
  return Array.isArray(value)
    ? value
      .map((entry) => toFiniteNumber(entry))
      .filter((entry): entry is number => entry !== null)
    : [];
}

function alignChartSeries(labels: string[], values: number[]): DashboardLineChartPayload {
  const length = Math.min(labels.length, values.length);
  return {
    xData: labels.slice(0, length),
    yData: values.slice(0, length),
  };
}

function hasChartData(chart: DashboardLineChartPayload) {
  return chart.xData.length > 0 && chart.yData.length > 0;
}

function normalizeChartDate(value: string) {
  const trimmed = value.trim();
  const isoDay = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay) {
    return isoDay[1];
  }

  const dayFirst = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString().slice(0, 10);
}

function readChartLabel(entry: ReportRow) {
  return (
    readString(entry, ["label", "name", "date", "time", "x", "category", "type"]) ??
    null
  );
}

function readChartValue(entry: ReportRow) {
  return readNumber(entry, ["value", "count", "y", "total", "amount", "sum"]) ?? null;
}

function normalizeLineChartPayload(result: unknown): DashboardLineChartPayload {
  const root = asRecord(result);
  const candidates = [
    root,
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.chart),
  ];

  for (const candidate of candidates) {
    const labels = toStringArray(
      candidate.xData ??
        candidate.labels ??
        candidate.categoryList ??
        candidate.dateList ??
        candidate.nameList,
    );
    const values = toNumberArray(
      candidate.yData ??
        candidate.values ??
        candidate.valueList ??
        candidate.seriesData ??
        candidate.countList,
    );

    if (labels.length > 0 && values.length > 0) {
      return alignChartSeries(labels, values);
    }

    const rows = extractRows(candidate);
    if (rows.length > 0) {
      const normalizedRows = rows
        .map((entry) => {
          const label = readChartLabel(entry);
          const value = readChartValue(entry);
          return label !== null && value !== null ? { label, value } : null;
        })
        .filter((entry): entry is { label: string; value: number } => entry !== null);

      if (normalizedRows.length > 0) {
        return {
          xData: normalizedRows.map((entry) => entry.label),
          yData: normalizedRows.map((entry) => entry.value),
        };
      }
    }
  }

  return { xData: [], yData: [] };
}

function extractTotal(result: unknown): number | null {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return null;
  }

  const root = result as Record<string, unknown>;
  const page =
    typeof root.page === "object" && root.page !== null && !Array.isArray(root.page)
      ? (root.page as Record<string, unknown>)
      : null;

  for (const source of [root, page]) {
    if (!source) {
      continue;
    }

    for (const key of ["total", "count", "totalCount", "recordsTotal", "rowCount", "size"]) {
      const value = toFiniteNumber(source[key]);
      if (value !== null) {
        return Math.max(0, Math.floor(value));
      }
    }
  }

  return null;
}

function formatReportDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDashboardDateInput(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const dayFirst = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dayFirst) {
    return null;
  }

  const [, day, month, year] = dayFirst;
  const normalized = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function normalizeSiteKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function formatSelectedSiteLabel(value: string | null) {
  if (!value) {
    return "All Sites (Portfolio)";
  }

  return value
    .trim()
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function readSiteScope(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.toUpperCase() === "ALL" ? null : trimmed;
}

function createDashboardReportWindow(fromDate: Date, toDate: Date) {
  return {
    fromDate: formatReportDate(fromDate),
    toDate: formatReportDate(toDate),
  };
}

function resolveDashboardScope(args: {
  from?: unknown;
  to?: unknown;
  siteId?: unknown;
}) {
  const requestedTo = parseDashboardDateInput(args.to) ?? new Date();
  const requestedFrom = parseDashboardDateInput(args.from) ?? new Date(DASHBOARD_ALL_TIME_FROM);
  const fromDate = requestedFrom.getTime() <= requestedTo.getTime() ? requestedFrom : requestedTo;
  const siteId = readSiteScope(args.siteId);

  return {
    siteId,
    selectedSiteLabel: formatSelectedSiteLabel(siteId),
    sourceWindow: {
      from: fromDate.toISOString(),
      to: requestedTo.toISOString(),
    },
    reportWindow: createDashboardReportWindow(fromDate, requestedTo),
  } satisfies DashboardScope;
}

function formatTimeLabel(value: string | null) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return "00:00";
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readEventStatus(row: ReportRow) {
  return (
    readString(row, ["status", "eventStatus", "alarmStatus", "state"]) ?? "unknown"
  ).toLowerCase();
}

function readGatewayOnlineState(row: ReportRow) {
  const booleanValue = row.online ?? row.isOnline;
  if (typeof booleanValue === "boolean") {
    return booleanValue;
  }

  const numericValue = toFiniteNumber(row.online ?? row.isOnline ?? row.statusCode);
  if (numericValue !== null) {
    return numericValue > 0;
  }

  const status = (
    readString(row, ["status", "onlineStatus", "state", "gatewayStatus"]) ?? ""
  ).toLowerCase();

  if (["online", "connected", "active", "normal", "1", "true"].includes(status)) {
    return true;
  }

  if (["offline", "disconnected", "inactive", "0", "false"].includes(status)) {
    return false;
  }

  return null;
}

function readSiteLabel(row: ReportRow) {
  return (
    readString(row, ["stationId", "station", "site", "siteId", "sectionId"]) ??
    readString(row, ["customerName", "name"]) ??
    "Portfolio"
  );
}

function readAccountIdentifier(row: ReportRow) {
  return (
    readString(row, ["accountNo", "accountId", "certifiNo", "customerId", "meterId", "meterSN"]) ??
    null
  );
}

function rowMatchesSite(row: ReportRow, siteId: string) {
  const target = normalizeSiteKey(siteId);
  const siteLabels = [
    readSiteLabel(row),
    readString(row, ["siteName", "stationName", "addr", "customerAddress"]),
  ].filter((value): value is string => Boolean(value));

  return siteLabels.some((value) => {
    const candidate = normalizeSiteKey(value);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
}

function filterRowsBySite(rows: ReportRow[], siteId: string | null) {
  if (!siteId) {
    return rows;
  }

  return rows.filter((row) => rowMatchesSite(row, siteId));
}

function sumRows(rows: ReportRow[], valueKeys: string[]) {
  return rows.reduce((total, row) => total + (readNumber(row, valueKeys) ?? 0), 0);
}

function countUniqueAccounts(rows: ReportRow[]) {
  const identifiers = new Set<string>();

  for (const row of rows) {
    const identifier = readAccountIdentifier(row);
    if (identifier) {
      identifiers.add(identifier);
    }
  }

  return identifiers.size;
}

function filterTransactionsForScope(
  transactions: ManagementTokenTransaction[],
  scope: DashboardScope,
) {
  const fromTime = new Date(scope.sourceWindow.from).getTime();
  const toTime = new Date(scope.sourceWindow.to).getTime();
  const normalizedSiteId = scope.siteId ? normalizeSiteKey(scope.siteId) : null;

  return transactions.filter((transaction) => {
    if (
      normalizedSiteId &&
      normalizeSiteKey(transaction.siteId) !== normalizedSiteId
    ) {
      return false;
    }

    const timestamp = new Date(transaction.timestamp).getTime();
    if (Number.isNaN(timestamp)) {
      return true;
    }

    return timestamp >= fromTime && timestamp <= toTime;
  });
}

function summarizeTransactions(transactions: ManagementTokenTransaction[]) {
  return transactions.reduce(
    (summary, transaction) => {
      summary.totalPurchaseTimes += 1;
      summary.totalPurchaseUnit += transaction.kwh;
      summary.totalPurchaseMoney += transaction.amount;
      return summary;
    },
    {
      totalPurchaseTimes: 0,
      totalPurchaseUnit: 0,
      totalPurchaseMoney: 0,
    },
  );
}

function buildTransactionSeries(
  transactions: ManagementTokenTransaction[],
  valueSelector: (transaction: ManagementTokenTransaction) => number,
  limit = 28,
): DashboardLineChartPayload {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    const timestamp = new Date(transaction.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }

    const label = timestamp.toISOString().slice(0, 10);
    totals.set(label, (totals.get(label) ?? 0) + valueSelector(transaction));
  }

  const entries = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-limit);

  return {
    xData: entries.map(([label]) => label),
    yData: entries.map(([, value]) => Math.round(value * 100) / 100),
  };
}

function mapTransactionsToPaymentRows(transactions: ManagementTokenTransaction[]) {
  return transactions.map<ReportRow>((transaction) => ({
    accountNo: transaction.accountNo,
    customerName: transaction.customerName,
    meterId: transaction.meterSN,
    meterSN: transaction.meterSN,
    stationId: transaction.siteId,
    site: transaction.siteId,
    siteId: transaction.siteId,
    totalPaid: transaction.amount,
    amount: transaction.amount,
    totalPrice: transaction.amount,
    purchaseMoney: transaction.amount,
    totalUnit: transaction.kwh,
    TransactionKwh: transaction.kwh,
    transactionKwh: transaction.kwh,
    kwh: transaction.kwh,
    createTime: transaction.timestamp,
    purchaseTime: transaction.timestamp,
    timestamp: transaction.timestamp,
    tariffId: transaction.tariffRate,
  }));
}

function applyDashboardScope(
  body: Record<string, unknown>,
  scope: DashboardScope,
) {
  return {
    ...body,
    fromDate: scope.reportWindow.fromDate,
    toDate: scope.reportWindow.toDate,
    ...(scope.siteId
      ? {
          stationId: scope.siteId,
          station: scope.siteId,
          site: scope.siteId,
          siteId: scope.siteId,
          sectionId: scope.siteId,
        }
      : {}),
  };
}

function readRowDate(row: ReportRow) {
  const value = readString(row, [
    "createTime",
    "purchaseTime",
    "vendTime",
    "timestamp",
    "tradeTime",
    "payTime",
    "date",
    "readTime",
    "statDate",
    "reportDate",
    "day",
    "time",
  ]);

  return value ? normalizeChartDate(value) : null;
}

function buildDailySeries(
  rows: ReportRow[],
  options: {
    valueKeys: string[];
    limit?: number;
  },
): DashboardLineChartPayload {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const dateLabel = readRowDate(row);
    const value = readNumber(row, options.valueKeys);
    if (!dateLabel || value === undefined) {
      continue;
    }

    totals.set(dateLabel, (totals.get(dateLabel) ?? 0) + value);
  }

  const entries = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-(options.limit ?? 28));

  return {
    xData: entries.map(([label]) => label),
    yData: entries.map(([, value]) => Math.round(value * 100) / 100),
  };
}

function buildHourlySuccessChart(rows: ReportRow[]): DashboardLineChartPayload {
  const countsByDate = new Map<string, { total: number; successful: number }>();

  for (const row of rows) {
    const dateLabel = readRowDate(row);
    if (!dateLabel) {
      continue;
    }

    const current = countsByDate.get(dateLabel) ?? { total: 0, successful: 0 };
    current.total += 1;

    const hasUsefulReading =
      readNumber(row, ["consumption", "totalEnergy", "usage", "power", "value"]) !== undefined;
    if (hasUsefulReading) {
      current.successful += 1;
    }

    countsByDate.set(dateLabel, current);
  }

  const entries = [...countsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-28);

  return {
    xData: entries.map(([label]) => label),
    yData: entries.map(([, metrics]) =>
      metrics.total > 0 ? Math.round((metrics.successful / metrics.total) * 100) : 0,
    ),
  };
}

function buildTransactionPresenceChart(rows: ReportRow[]): DashboardLineChartPayload {
  const countsByDate = new Map<string, number>();

  for (const row of rows) {
    const dateLabel = readRowDate(row);
    if (!dateLabel) {
      continue;
    }

    countsByDate.set(dateLabel, (countsByDate.get(dateLabel) ?? 0) + 1);
  }

  const entries = [...countsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-30);

  return {
    xData: entries.map(([label]) => label),
    yData: entries.map(([, count]) => (count > 0 ? 100 : 0)),
  };
}

function buildAlarmChart(lowPurchaseRows: ReportRow[], longNonpurchaseRows: ReportRow[]) {
  let longNonpurchaseCount = 0;
  let inactiveMeterCount = 0;

  for (const row of longNonpurchaseRows) {
    const days = readNumber(row, [
      "daysWithoutPurchase",
      "nonpurchaseDays",
      "noPurchaseDays",
      "inactiveDays",
      "days",
    ]);

    if (days === undefined || days < 30) {
      continue;
    }

    if (days >= 60) {
      inactiveMeterCount += 1;
    } else {
      longNonpurchaseCount += 1;
    }
  }

  const slices = [
    { label: "Low Purchase", value: lowPurchaseRows.length },
    { label: "Long Nonpurchase", value: longNonpurchaseCount },
    { label: "Inactive Meters", value: inactiveMeterCount },
  ].filter((entry) => entry.value > 0);

  return {
    xData: slices.map((entry) => entry.label),
    yData: slices.map((entry) => entry.value),
  };
}

function buildLivePulse(args: {
  serverTime: string | null;
  purchaseRows: ReportRow[];
  hourlyRows: ReportRow[];
  eventRows: ReportRow[];
  onlineGatewayCount: number;
  offlineGatewayCount: number;
}) {
  const timeLabel = formatTimeLabel(args.serverTime);
  const items: DashboardLivePulseItem[] = [];

  const latestPurchaseRow = args.purchaseRows[0];
  const latestPurchaseAmount = latestPurchaseRow
    ? readNumber(latestPurchaseRow, ["totalPrice", "purchaseMoney", "amount", "totalPaid"])
    : undefined;
  const latestPurchaseSite = latestPurchaseRow ? readSiteLabel(latestPurchaseRow) : "Portfolio";
  if (latestPurchaseAmount !== undefined) {
    items.push({
      timeLabel,
      message: `${latestPurchaseSite}: Latest vend ₦${latestPurchaseAmount.toLocaleString("en-NG")}`,
    });
  }

  const peakHourlyRow = args.hourlyRows.reduce<ReportRow | null>((best, row) => {
    const currentValue = readNumber(row, ["consumption", "totalEnergy", "usage", "power"]);
    const bestValue = best ? readNumber(best, ["consumption", "totalEnergy", "usage", "power"]) : undefined;
    return (currentValue ?? -1) > (bestValue ?? -1) ? row : best;
  }, null);

  if (peakHourlyRow) {
    const site = readSiteLabel(peakHourlyRow);
    const value = readNumber(peakHourlyRow, ["consumption", "totalEnergy", "usage", "power"]) ?? 0;
    items.push({
      timeLabel,
      message: `${site}: High consumption at ${value.toLocaleString()} kWh`,
    });
  }

  const latestEventRow = args.eventRows[0];
  if (latestEventRow) {
    const site = readSiteLabel(latestEventRow);
    const eventType =
      readString(latestEventRow, ["eventType", "alarmType", "eventName", "type"]) ??
      "Recent alarm";
    items.push({
      timeLabel,
      message: `${site}: ${eventType}`,
    });
  }

  items.push({
    timeLabel,
    message: `${args.onlineGatewayCount} online gateways, ${args.offlineGatewayCount} offline`,
  });

  return items.slice(0, 3);
}

async function postToUpstreamCandidates(
  request: AuthenticatedRequest,
  response: Response,
  pathnames: string[],
  body: Record<string, unknown>,
) {
  return forwardWithUpstreamSessionRecovery(request, response, async (upstreamCookie) => {
    let lastResult: UpstreamResult | null = null;

    for (const pathname of pathnames) {
      const requestPlan = buildUpstreamRequestPlan(pathname, body);

      for (const candidateBody of requestPlan.candidateBodies) {
        const result = await forwardToUpstream(pathname, candidateBody, upstreamCookie, {
          timeoutMs: requestPlan.timeoutMs,
        });

        lastResult = result;
        if (result.statusCode < 400 && result.payload.code === 0) {
          return result;
        }
      }
    }

    return (
      lastResult ?? {
        statusCode: 502,
        payload: {
          code: 1,
          reason: "Dashboard upstream request failed",
          result: null,
        },
      }
    );
  });
}

async function getFromUpstreamCandidates(
  request: AuthenticatedRequest,
  response: Response,
  pathnames: string[],
  params: Record<string, unknown>,
) {
  return forwardWithUpstreamSessionRecovery(request, response, async (upstreamCookie) => {
    let lastResult: UpstreamResult | null = null;

    for (const pathname of pathnames) {
      const result = await forwardToUpstreamGet(pathname, params, upstreamCookie, {
        timeoutMs: 30_000,
      });

      lastResult = result;
      if (result.statusCode < 400 && result.payload.code === 0) {
        return result;
      }
    }

    return (
      lastResult ?? {
        statusCode: 502,
        payload: {
          code: 1,
          reason: "Dashboard upstream request failed",
          result: null,
        },
      }
    );
  });
}

function buildTokenHistoryQuery(
  scope: DashboardScope,
  options: {
    pageLimit?: number;
  } = {},
) {
  return {
    FROM: scope.sourceWindow.from,
    TO: scope.sourceWindow.to,
    from: scope.sourceWindow.from,
    to: scope.sourceWindow.to,
    pageLimit: options.pageLimit ?? 500,
    ...(scope.siteId
      ? {
          SITE_ID: scope.siteId,
          siteId: scope.siteId,
        }
      : {}),
  };
}

async function loadDashboardPaymentRows(
  request: AuthenticatedRequest,
  response: Response,
  scope: DashboardScope,
  options: {
    pageLimit?: number;
  } = {},
) {
  if (scope.siteId) {
    const snapshot = await getManagementTokenAnalyticsSnapshot(request, response);
    return mapTransactionsToPaymentRows(
      filterTransactionsForScope(snapshot.transactions, scope),
    );
  }

  const result = await getFromUpstreamCandidates(
    request,
    response,
    [
      "/api/token/creditTokenRecord/readMore",
      "/token/creditTokenRecord/readMore",
    ],
    buildTokenHistoryQuery(scope, options),
  );

  return extractRows(result.payload.result);
}

function getRowsAndTotal(result: UpstreamResult | null) {
  if (!result || result.statusCode >= 400 || result.payload.code !== 0) {
    return { rows: [] as ReportRow[], total: 0 };
  }

  const rows = extractRows(result.payload.result);
  const total = extractTotal(result.payload.result) ?? rows.length;
  return {
    rows,
    total: Math.max(0, total),
  };
}

export async function loadDashboardAggregate(
  request: AuthenticatedRequest,
  response: Response,
): Promise<DashboardAggregatePayload> {
  const scope = resolveDashboardScope({
    from: request.query.from,
    to: request.query.to,
    siteId: request.query.siteId ?? request.query.site ?? request.query.stationId,
  });

  const [
    purchaseResult,
    hourlyResult,
    eventResult,
    longNonpurchaseResult,
    lowPurchaseResult,
    panelGroupResult,
    gprsResult,
    accountResult,
  ] = await Promise.all([
    postToUpstreamCandidates(request, response, [
      "/token/creditTokenRecord/readMore",
      "/api/token/creditTokenRecord/readMore",
    ], applyDashboardScope({
      pageNumber: 1,
      pageSize: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 10,
      page: 1,
      limit: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 10,
    }, scope)),
    postToUpstreamCandidates(request, response, [
      "/DailyDataMeter/readHourly",
      "/api/DailyDataMeter/readHourly",
    ], applyDashboardScope({
      pageNumber: 1,
      pageSize: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 50,
      page: 1,
      limit: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 50,
    }, scope)),
    postToUpstreamCandidates(request, response, [
      "/EventNotification/Read",
      "/API/EventNotification/Read",
    ], applyDashboardScope({
      pageNumber: 1,
      pageSize: 20,
      page: 1,
      limit: 20,
    }, scope)),
    postToUpstreamCandidates(request, response, [
      "/PrepayReport/LongNonpurchaseSituation",
      "/API/PrepayReport/LongNonpurchaseSituation",
    ], applyDashboardScope({
      nonpurchaseDaysStart: 30,
      nonpurchaseDaysEnd: 90,
      pageNumber: 1,
      pageSize: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
      page: 1,
      limit: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
    }, scope)),
    postToUpstreamCandidates(request, response, [
      "/PrepayReport/LowPurchaseSituation",
      "/API/PrepayReport/LowPurchaseSituation",
    ], applyDashboardScope({
      lowLimit: 500,
      pageNumber: 1,
      pageSize: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
      page: 1,
      limit: scope.siteId ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
    }, scope)),
    postToUpstreamCandidates(request, response, [
      "/dashboard/readPanelGroup",
      "/api/dashboard/readPanelGroup",
    ], applyDashboardScope({}, scope)),
    postToUpstreamCandidates(request, response, [
      "/GPRSOnlineStatus/Read",
      "/api/GPRSOnlineStatus/Read",
    ], applyDashboardScope({
      pageNumber: 1,
      pageSize: 200,
      page: 1,
      limit: 200,
    }, scope)),
    scope.siteId
      ? postToUpstreamCandidates(request, response, [
        "/account/read",
        "/api/account/read",
      ], applyDashboardScope({
        pageNumber: 1,
        pageSize: 1,
        page: 1,
        limit: 1,
      }, scope)).catch(() => null)
      : Promise.resolve(null),
  ]);

  const purchaseData = getRowsAndTotal(purchaseResult);
  const purchaseRows = filterRowsBySite(purchaseData.rows, scope.siteId);
  const hourlyRows = filterRowsBySite(getRowsAndTotal(hourlyResult).rows, scope.siteId);
  const eventRows = filterRowsBySite(getRowsAndTotal(eventResult).rows, scope.siteId);
  const longNonpurchaseRows = filterRowsBySite(
    getRowsAndTotal(longNonpurchaseResult).rows,
    scope.siteId,
  );
  const lowPurchaseRows = filterRowsBySite(getRowsAndTotal(lowPurchaseResult).rows, scope.siteId);
  const gprsRows = filterRowsBySite(getRowsAndTotal(gprsResult).rows, scope.siteId);
  const accountCountFromUpstream =
    accountResult && accountResult.statusCode < 400 && accountResult.payload.code === 0
      ? extractTotal(accountResult.payload.result)
      : null;

  let longNonpurchaseCount = 0;
  let inactiveMeterCount = 0;
  for (const row of longNonpurchaseRows) {
    const days = readNumber(row, [
      "daysWithoutPurchase",
      "nonpurchaseDays",
      "noPurchaseDays",
      "inactiveDays",
      "days",
    ]);

    if (days === undefined || days < 30) {
      continue;
    }

    if (days >= 60) {
      inactiveMeterCount += 1;
    } else {
      longNonpurchaseCount += 1;
    }
  }

  let onlineGatewayCount = 0;
  let offlineGatewayCount = 0;
  for (const row of gprsRows) {
    const isOnline = readGatewayOnlineState(row);
    if (isOnline === true) {
      onlineGatewayCount += 1;
    } else if (isOnline === false) {
      offlineGatewayCount += 1;
    }
  }

  const unreadEventCount = eventRows.filter(
    (row) => !["read", "resolved", "closed"].includes(readEventStatus(row)),
  ).length;
  const panel = asRecord(panelGroupResult.payload.result);
  const tokenFallbackRows = purchaseRows.length > 0
    ? purchaseRows
    : await loadDashboardPaymentRows(request, response, scope, { pageLimit: 2_000 });
  const lastUpdatedAt = response.locals?.traceId
    ? new Date().toISOString()
    : new Date().toISOString();
  const siteScopedTotals = scope.siteId
    ? {
        totalAccountCount: accountCountFromUpstream ?? countUniqueAccounts(tokenFallbackRows),
        totalPurchaseTimes: tokenFallbackRows.length,
        totalPurchaseUnit: sumRows(tokenFallbackRows, ["totalUnit", "TransactionKwh", "transactionKwh", "kwh", "transactionKwh"]),
        totalPurchaseMoney: sumRows(tokenFallbackRows, ["totalPrice", "purchaseMoney", "amount", "totalPaid"]),
      }
    : null;

  return {
    totalAccountCount: siteScopedTotals?.totalAccountCount ?? (toFiniteNumber(panel.totalAccountCount) ?? 0),
    totalPurchaseTimes: siteScopedTotals?.totalPurchaseTimes ?? (toFiniteNumber(panel.totalPurchaseTimes) ?? 0),
    totalPurchaseUnit: siteScopedTotals?.totalPurchaseUnit ?? (toFiniteNumber(panel.totalPurchaseUnit) ?? 0),
    totalPurchaseMoney: siteScopedTotals?.totalPurchaseMoney ?? (toFiniteNumber(panel.totalPurchaseMoney) ?? 0),
    lowPurchaseCount: lowPurchaseRows.length,
    longNonpurchaseCount,
    inactiveMeterCount,
    unreadEventCount,
    onlineGatewayCount,
    offlineGatewayCount,
    portfolioLabel: scope.selectedSiteLabel,
    selectedSiteId: scope.siteId,
    selectedSiteLabel: scope.selectedSiteLabel,
    sourceWindow: scope.sourceWindow,
    lastUpdatedAt,
    livePulse: buildLivePulse({
      serverTime: lastUpdatedAt,
      purchaseRows: tokenFallbackRows,
      hourlyRows,
      eventRows,
      onlineGatewayCount,
      offlineGatewayCount,
    }),
    alarms: [
      { label: "Low Purchase", value: lowPurchaseRows.length },
      { label: "Long Nonpurchase", value: longNonpurchaseCount },
      { label: "Inactive Meters", value: inactiveMeterCount },
    ].filter((slice) => slice.value > 0),
  };
}

export async function loadDashboardLineChart(
  request: AuthenticatedRequest,
  response: Response,
  body: Record<string, unknown>,
): Promise<DashboardLineChartPayload> {
  const scope = resolveDashboardScope({
    from: body.from,
    to: body.to,
    siteId: body.siteId ?? body.site ?? body.stationId,
  });
  const typeValue = toFiniteNumber(body.type) ?? 0;
  const chartType = Math.max(0, Math.floor(typeValue));
  const useDerivedSiteChart = true;
  let primaryChart: DashboardLineChartPayload = { xData: [], yData: [] };

  if (chartType === 1) {
    const purchaseRows = await loadDashboardPaymentRows(request, response, scope, { pageLimit: 2_000 });
    return buildDailySeries(purchaseRows, {
      valueKeys: ["totalPrice", "purchaseMoney", "amount", "totalPaid"],
      limit: 30,
    });
  }

  if (chartType === 2) {
    const purchaseRows = await loadDashboardPaymentRows(request, response, scope, { pageLimit: 2_000 });
    return buildTransactionPresenceChart(purchaseRows);
  }

  if (chartType === 3) {
    const [lowPurchaseResult, longNonpurchaseResult] = await Promise.all([
      postToUpstreamCandidates(request, response, [
        "/PrepayReport/LowPurchaseSituation",
        "/API/PrepayReport/LowPurchaseSituation",
      ], applyDashboardScope({
        lowLimit: 500,
        pageNumber: 1,
        pageSize: useDerivedSiteChart ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
        page: 1,
        limit: useDerivedSiteChart ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
      }, scope)),
      postToUpstreamCandidates(request, response, [
        "/PrepayReport/LongNonpurchaseSituation",
        "/API/PrepayReport/LongNonpurchaseSituation",
      ], applyDashboardScope({
        nonpurchaseDaysStart: 30,
        nonpurchaseDaysEnd: 90,
        pageNumber: 1,
        pageSize: useDerivedSiteChart ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
        page: 1,
        limit: useDerivedSiteChart ? DASHBOARD_SITE_SCOPED_ROW_LIMIT : 200,
      }, scope)),
    ]);

    return buildAlarmChart(
      filterRowsBySite(extractRows(lowPurchaseResult.payload.result), scope.siteId),
      filterRowsBySite(extractRows(longNonpurchaseResult.payload.result), scope.siteId),
    );
  }

  if (chartType === 4) {
    const purchaseRows = await loadDashboardPaymentRows(request, response, scope, { pageLimit: 2_000 });
    return buildDailySeries(purchaseRows, {
      valueKeys: ["TransactionKwh", "transactionKwh", "totalUnit", "kwh", "usage"],
      limit: 30,
    });
  }

  const primaryResult = await postToUpstreamCandidates(
    request,
    response,
    ["/dashboard/readLineChart", "/api/dashboard/readLineChart"],
    applyDashboardScope({ ...body, type: chartType }, scope),
  );
  primaryChart = normalizeLineChartPayload(primaryResult.payload.result);

  return hasChartData(primaryChart) ? primaryChart : { xData: [], yData: [] };
}
