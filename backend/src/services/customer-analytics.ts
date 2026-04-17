import type {
  CustomerConsumptionRechargeDailyResponse,
  CustomerConsumptionRechargeDailyRow,
  CustomerConsumptionRechargeSummaryResponse,
  CustomerConsumptionRechargeSummaryRow,
  CustomerForecastRow,
  CustomerForecastsResponse,
  CustomerLiveDailyConsumptionResponse,
  CustomerSegmentRow,
  CustomerSegmentsResponse,
} from "../../../common/types/index.js";
import type { Response } from "express";
import { loadUpstreamCandidates } from "../api/alias-utils.js";
import { extractRows, readNumber, readString, type ReportRow } from "../lib/upstream-data.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getManagementTokenAnalyticsSnapshot, type ManagementTokenAnalyticsSnapshot } from "./management-token-analytics.js";
import {
  isSupabaseDbEnabled,
  listCustomerDailyConsumptionFacts,
  listCustomerDailyRechargeFacts,
  listCustomerForecasts,
  listCustomerSegments,
} from "./supabase-db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

interface MasterMeterRow {
  customerId: string | null;
  customerName: string | null;
  accountNo: string | null;
  site: string | null;
}

interface RechargeFactLike {
  meter_sn: string;
  fact_date: string;
  site_code?: string | null;
  customer_name?: string | null;
  account_no?: string | null;
  recharge_amount: number;
  recharge_kwh: number;
  recharge_count: number;
  last_transaction_at?: string | null;
}

interface ConsumptionFactLike {
  meter_sn: string;
  fact_date: string;
  site_code?: string | null;
  customer_name?: string | null;
  account_no?: string | null;
  consumption_kwh: number;
  last_read_at?: string | null;
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

function toDayFirst(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function readWindow(query: Record<string, unknown>, fallbackDays = 30) {
  const today = new Date().toISOString().slice(0, 10);
  const fallbackFrom = new Date(Date.now() - fallbackDays * DAY_MS).toISOString().slice(0, 10);
  const fromIso = parseDate(query.fromDate ?? query.from) ?? fallbackFrom;
  const toIso = parseDate(query.toDate ?? query.to) ?? today;

  return {
    fromIso: fromIso <= toIso ? fromIso : toIso,
    toIso: toIso >= fromIso ? toIso : fromIso,
  };
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function readMeterId(row: ReportRow) {
  return readString(row, ["meterId", "meterSN", "meterNo", "meterCode"]) ?? "";
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

function readSite(row: ReportRow) {
  return readString(row, ["stationId", "siteId", "site", "station", "siteName"]) ?? "";
}

function readConsumptionValue(row: ReportRow) {
  return readNumber(row, ["consumption", "totalEnergy", "value", "kwh", "usage", "usedEnergy"]) ?? 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / DAY_MS));
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

async function loadMasterRows(request: AuthenticatedRequest, response: Response) {
  const [customerRows, accountRows, meterRows] = await Promise.all([
    fetchRows(request, response, ["/api/customer/read"], { pageNumber: 1, pageSize: 1000, page: 1, limit: 1000 }),
    fetchRows(request, response, ["/api/account/read"], { pageNumber: 1, pageSize: 1000, page: 1, limit: 1000 }),
    fetchRows(request, response, ["/api/meter/read"], { pageNumber: 1, pageSize: 1000, page: 1, limit: 1000 }),
  ]);

  const byMeter = new Map<string, MasterMeterRow>();

  for (const row of meterRows) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }
    byMeter.set(meterId, {
      customerId: readCustomerId(row) || null,
      customerName: readCustomerName(row) || null,
      accountNo: readAccountNo(row) || null,
      site: readSite(row) || null,
    });
  }

  for (const row of accountRows) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }
    const current = byMeter.get(meterId) ?? {
      customerId: null,
      customerName: null,
      accountNo: null,
      site: null,
    };
    byMeter.set(meterId, {
      customerId: current.customerId ?? (readCustomerId(row) || null),
      customerName: current.customerName,
      accountNo: current.accountNo ?? (readAccountNo(row) || null),
      site: current.site ?? (readSite(row) || null),
    });
  }

  for (const row of customerRows) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }
    const current = byMeter.get(meterId) ?? {
      customerId: null,
      customerName: null,
      accountNo: null,
      site: null,
    };
    byMeter.set(meterId, {
      customerId: current.customerId ?? (readCustomerId(row) || null),
      customerName: current.customerName ?? (readCustomerName(row) || null),
      accountNo: current.accountNo,
      site: current.site ?? (readSite(row) || null),
    });
  }

  return byMeter;
}

function transactionMatches(
  transaction: {
    meterSN: string;
    accountNo: string;
    customerName: string;
    siteId: string;
    timestamp: string;
  },
  query: Record<string, unknown>,
  window: { fromIso: string; toIso: string },
) {
  const searchMeterId = typeof query.meterId === "string" ? query.meterId.trim() : "";
  const searchAccountNo = typeof query.accountNo === "string" ? query.accountNo.trim() : "";
  const searchCustomerId = typeof query.customerId === "string" ? query.customerId.trim() : "";
  const searchSiteId = typeof query.siteId === "string" ? query.siteId.trim() : "";
  const transactionDate = parseDate(transaction.timestamp);

  if (!transactionDate || transactionDate < window.fromIso || transactionDate > window.toIso) {
    return false;
  }

  if (searchMeterId && transaction.meterSN !== searchMeterId) {
    return false;
  }

  if (searchAccountNo && transaction.accountNo !== searchAccountNo) {
    return false;
  }

  if (searchCustomerId) {
    const normalizedSearch = normalizeKey(searchCustomerId);
    if (
      normalizeKey(transaction.customerName) !== normalizedSearch &&
      normalizeKey(transaction.accountNo) !== normalizedSearch &&
      normalizeKey(transaction.meterSN) !== normalizedSearch
    ) {
      return false;
    }
  }

  if (searchSiteId && normalizeKey(transaction.siteId) !== normalizeKey(searchSiteId)) {
    return false;
  }

  return true;
}

function dailyReadMatches(row: ReportRow, query: Record<string, unknown>, window: { fromIso: string; toIso: string }) {
  const searchMeterId = typeof query.meterId === "string" ? query.meterId.trim() : "";
  const searchSiteId = typeof query.siteId === "string" ? query.siteId.trim() : "";
  const date = parseDate(
    readString(row, ["collectionDate", "collectDate", "dataDate", "readDate", "date", "currentDate"]) ??
      readString(row, ["createTime", "updateTime"]),
  );

  if (!date || date < window.fromIso || date > window.toIso) {
    return false;
  }

  if (searchMeterId && readMeterId(row) !== searchMeterId) {
    return false;
  }

  if (searchSiteId && normalizeKey(readSite(row)) !== normalizeKey(searchSiteId)) {
    return false;
  }

  return true;
}

function mergeFactRows(
  rechargeRows: RechargeFactLike[],
  consumptionRows: ConsumptionFactLike[],
  masterByMeter: Map<string, MasterMeterRow>,
) {
  const summaryMap = new Map<string, CustomerConsumptionRechargeSummaryRow>();
  const dailyMap = new Map<string, CustomerConsumptionRechargeDailyRow>();

  for (const row of rechargeRows) {
    const meterId = row.meter_sn;
    const master = masterByMeter.get(meterId);
    const summary = summaryMap.get(meterId) ?? {
      customerId: master?.customerId ?? null,
      customerName: master?.customerName ?? row.customer_name ?? meterId,
      accountNo: master?.accountNo ?? row.account_no ?? null,
      meterId,
      site: master?.site ?? row.site_code ?? null,
      totalRechargeAmount: 0,
      totalRechargeKwh: 0,
      totalConsumptionKwh: 0,
      rechargeCount: 0,
      lastRechargeAt: null,
      varianceKwh: 0,
    };
    summary.totalRechargeAmount += row.recharge_amount;
    summary.totalRechargeKwh += row.recharge_kwh;
    summary.rechargeCount += row.recharge_count;
    if (!summary.lastRechargeAt || (row.last_transaction_at ?? "") > summary.lastRechargeAt) {
      summary.lastRechargeAt = row.last_transaction_at ?? summary.lastRechargeAt;
    }
    summaryMap.set(meterId, summary);

    const dailyKey = `${meterId}:${row.fact_date}`;
    const daily = dailyMap.get(dailyKey) ?? {
      date: row.fact_date,
      meterId,
      customerName: summary.customerName,
      rechargeAmount: 0,
      rechargeKwh: 0,
      consumptionKwh: 0,
      varianceKwh: 0,
    };
    daily.rechargeAmount += row.recharge_amount;
    daily.rechargeKwh += row.recharge_kwh;
    dailyMap.set(dailyKey, daily);
  }

  for (const row of consumptionRows) {
    const meterId = row.meter_sn;
    const master = masterByMeter.get(meterId);
    const summary = summaryMap.get(meterId) ?? {
      customerId: master?.customerId ?? null,
      customerName: master?.customerName ?? row.customer_name ?? meterId,
      accountNo: master?.accountNo ?? row.account_no ?? null,
      meterId,
      site: master?.site ?? row.site_code ?? null,
      totalRechargeAmount: 0,
      totalRechargeKwh: 0,
      totalConsumptionKwh: 0,
      rechargeCount: 0,
      lastRechargeAt: null,
      varianceKwh: 0,
    };
    summary.totalConsumptionKwh += row.consumption_kwh;
    summaryMap.set(meterId, summary);

    const dailyKey = `${meterId}:${row.fact_date}`;
    const daily = dailyMap.get(dailyKey) ?? {
      date: row.fact_date,
      meterId,
      customerName: summary.customerName,
      rechargeAmount: 0,
      rechargeKwh: 0,
      consumptionKwh: 0,
      varianceKwh: 0,
    };
    daily.consumptionKwh += row.consumption_kwh;
    dailyMap.set(dailyKey, daily);
  }

  const summaryRows = Array.from(summaryMap.values())
    .map((row) => ({
      ...row,
      totalRechargeAmount: round2(row.totalRechargeAmount),
      totalRechargeKwh: round2(row.totalRechargeKwh),
      totalConsumptionKwh: round2(row.totalConsumptionKwh),
      varianceKwh: round2(row.totalConsumptionKwh - row.totalRechargeKwh),
    }))
    .sort((left, right) => right.totalRechargeAmount - left.totalRechargeAmount);

  const dailyRows = Array.from(dailyMap.values())
    .map((row) => ({
      ...row,
      rechargeAmount: round2(row.rechargeAmount),
      rechargeKwh: round2(row.rechargeKwh),
      consumptionKwh: round2(row.consumptionKwh),
      varianceKwh: round2(row.consumptionKwh - row.rechargeKwh),
    }))
    .sort((left, right) => `${right.date}:${right.meterId}`.localeCompare(`${left.date}:${left.meterId}`));

  return { summaryRows, dailyRows };
}

async function buildDbBackedFactViews(
  request: AuthenticatedRequest,
  response: Response,
  query: Record<string, unknown>,
) {
  if (!isSupabaseDbEnabled()) {
    return null;
  }

  const window = readWindow(query);
  const [masterByMeter, rechargeRows, consumptionRows] = await Promise.all([
    loadMasterRows(request, response),
    listCustomerDailyRechargeFacts({
      meterId: typeof query.meterId === "string" ? query.meterId : null,
      accountNo: typeof query.accountNo === "string" ? query.accountNo : null,
      siteId: typeof query.siteId === "string" ? query.siteId : null,
      fromDate: window.fromIso,
      toDate: window.toIso,
      limit: 5000,
    }),
    listCustomerDailyConsumptionFacts({
      meterId: typeof query.meterId === "string" ? query.meterId : null,
      accountNo: typeof query.accountNo === "string" ? query.accountNo : null,
      siteId: typeof query.siteId === "string" ? query.siteId : null,
      fromDate: window.fromIso,
      toDate: window.toIso,
      limit: 5000,
    }),
  ]);

  if (rechargeRows.length === 0 && consumptionRows.length === 0) {
    return null;
  }

  return mergeFactRows(rechargeRows as RechargeFactLike[], consumptionRows as ConsumptionFactLike[], masterByMeter);
}

async function loadLiveCustomerAnalyticsData(
  request: AuthenticatedRequest,
  response: Response,
  query: Record<string, unknown>,
) {
  const window = readWindow(query);
  const [snapshot, masterByMeter, dailyRows] = await Promise.all([
    getManagementTokenAnalyticsSnapshot(request, response),
    loadMasterRows(request, response),
    fetchRows(request, response, ["/api/DailyDataMeter/read"], {
      fromDate: toDayFirst(window.fromIso),
      toDate: toDayFirst(window.toIso),
      pageNumber: 1,
      pageSize: 1000,
      page: 1,
      limit: 1000,
    }),
  ]);

  return { snapshot, masterByMeter, dailyRows, window };
}

function buildRechargeFactsFromSnapshot(
  snapshot: ManagementTokenAnalyticsSnapshot,
  masterByMeter: Map<string, MasterMeterRow>,
  query: Record<string, unknown>,
  window: { fromIso: string; toIso: string },
) {
  const map = new Map<string, RechargeFactLike>();

  for (const transaction of snapshot.transactions.filter((entry) => transactionMatches(entry, query, window))) {
    const date = parseDate(transaction.timestamp);
    if (!date) {
      continue;
    }
    const key = `${transaction.meterSN}:${date}`;
    const master = masterByMeter.get(transaction.meterSN);
    const current = map.get(key) ?? {
      meter_sn: transaction.meterSN,
      fact_date: date,
      site_code: master?.site ?? transaction.siteId ?? null,
      customer_name: master?.customerName ?? transaction.customerName ?? null,
      account_no: master?.accountNo ?? transaction.accountNo ?? null,
      recharge_amount: 0,
      recharge_kwh: 0,
      recharge_count: 0,
      last_transaction_at: null,
    };
    current.recharge_amount += transaction.amount;
    current.recharge_kwh += transaction.kwh;
    current.recharge_count += 1;
    if (!current.last_transaction_at || current.last_transaction_at < transaction.timestamp) {
      current.last_transaction_at = transaction.timestamp;
    }
    map.set(key, current);
  }

  return Array.from(map.values());
}

function buildConsumptionFactsFromRows(
  rows: ReportRow[],
  masterByMeter: Map<string, MasterMeterRow>,
  query: Record<string, unknown>,
  window: { fromIso: string; toIso: string },
) {
  const accountFilter = typeof query.accountNo === "string" ? query.accountNo.trim() : "";
  const map = new Map<string, ConsumptionFactLike>();

  for (const row of rows.filter((entry) => dailyReadMatches(entry, query, window))) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }
    const master = masterByMeter.get(meterId);
    if (accountFilter && (master?.accountNo ?? "") !== accountFilter) {
      continue;
    }
    const date = parseDate(
      readString(row, ["collectionDate", "collectDate", "dataDate", "readDate", "date", "currentDate"]) ??
        readString(row, ["createTime", "updateTime"]),
    );
    if (!date) {
      continue;
    }
    const key = `${meterId}:${date}`;
    const current = map.get(key) ?? {
      meter_sn: meterId,
      fact_date: date,
      site_code: master?.site ?? readSite(row) ?? null,
      customer_name: master?.customerName ?? readCustomerName(row) ?? null,
      account_no: master?.accountNo ?? null,
      consumption_kwh: 0,
      last_read_at: null,
    };
    current.consumption_kwh += readConsumptionValue(row);
    current.last_read_at = new Date().toISOString();
    map.set(key, current);
  }

  return Array.from(map.values());
}

function classifySegment(metrics: {
  rechargeCount30d: number;
  totalRechargeAmount30d: number;
  avgDailyConsumption7d: number;
}) {
  if (metrics.rechargeCount30d === 0 && metrics.avgDailyConsumption7d < 0.2) {
    return "dormant";
  }
  if (metrics.totalRechargeAmount30d >= 20_000 && metrics.rechargeCount30d >= 4 && metrics.avgDailyConsumption7d >= 8) {
    return "high-value-stable";
  }
  if (metrics.rechargeCount30d >= 2 && metrics.avgDailyConsumption7d >= 2) {
    return "active";
  }
  if (metrics.rechargeCount30d >= 1 && metrics.avgDailyConsumption7d < 1) {
    return "erratic";
  }
  return "recovering";
}

export function buildCustomerSegmentsFromFacts(
  rechargeFacts: RechargeFactLike[],
  consumptionFacts: ConsumptionFactLike[],
): CustomerSegmentRow[] {
  const cutoff30 = addDays(new Date().toISOString().slice(0, 10), -30);
  const cutoff7 = addDays(new Date().toISOString().slice(0, 10), -7);
  const rechargeByMeter = new Map<string, RechargeFactLike[]>();
  const consumptionByMeter = new Map<string, ConsumptionFactLike[]>();

  for (const row of rechargeFacts) {
    const current = rechargeByMeter.get(row.meter_sn) ?? [];
    current.push(row);
    rechargeByMeter.set(row.meter_sn, current);
  }
  for (const row of consumptionFacts) {
    const current = consumptionByMeter.get(row.meter_sn) ?? [];
    current.push(row);
    consumptionByMeter.set(row.meter_sn, current);
  }

  const meterIds = new Set([...rechargeByMeter.keys(), ...consumptionByMeter.keys()]);
  return Array.from(meterIds)
    .map((meterId) => {
      const rechargeRows = (rechargeByMeter.get(meterId) ?? []).filter((row) => row.fact_date >= cutoff30);
      const consumptionRows = (consumptionByMeter.get(meterId) ?? []).filter((row) => row.fact_date >= cutoff7);
      const rechargeCount30d = rechargeRows.reduce((sum, row) => sum + row.recharge_count, 0);
      const totalRechargeAmount30d = rechargeRows.reduce((sum, row) => sum + row.recharge_amount, 0);
      const avgDailyConsumption7d = average(consumptionRows.map((row) => row.consumption_kwh));
      const sample = rechargeRows[0] ?? consumptionRows[0];
      return {
        meterId,
        customerName: sample?.customer_name ?? meterId,
        accountNo: sample?.account_no ?? null,
        site: sample?.site_code ?? null,
        segment: classifySegment({
          rechargeCount30d,
          totalRechargeAmount30d,
          avgDailyConsumption7d,
        }),
        rechargeCount30d,
        totalRechargeAmount30d: round2(totalRechargeAmount30d),
        avgDailyConsumption7d: round2(avgDailyConsumption7d),
      } satisfies CustomerSegmentRow;
    })
    .sort((left, right) => right.totalRechargeAmount30d - left.totalRechargeAmount30d);
}

export function buildCustomerForecastsFromFacts(
  rechargeFacts: RechargeFactLike[],
  consumptionFacts: ConsumptionFactLike[],
): CustomerForecastRow[] {
  const cutoff30 = addDays(new Date().toISOString().slice(0, 10), -30);
  const cutoff7 = addDays(new Date().toISOString().slice(0, 10), -7);
  const rechargeByMeter = new Map<string, RechargeFactLike[]>();
  const consumptionByMeter = new Map<string, ConsumptionFactLike[]>();

  for (const row of rechargeFacts) {
    const current = rechargeByMeter.get(row.meter_sn) ?? [];
    current.push(row);
    rechargeByMeter.set(row.meter_sn, current);
  }
  for (const row of consumptionFacts) {
    const current = consumptionByMeter.get(row.meter_sn) ?? [];
    current.push(row);
    consumptionByMeter.set(row.meter_sn, current);
  }

  const meterIds = new Set([...rechargeByMeter.keys(), ...consumptionByMeter.keys()]);
  return Array.from(meterIds)
    .map((meterId) => {
      const rechargeRows = (rechargeByMeter.get(meterId) ?? [])
        .filter((row) => row.fact_date >= cutoff30)
        .sort((left, right) => left.fact_date.localeCompare(right.fact_date));
      const consumptionRows = (consumptionByMeter.get(meterId) ?? []).filter((row) => row.fact_date >= cutoff7);
      const avgDailyConsumption7d = average(consumptionRows.map((row) => row.consumption_kwh));
      const totalRechargeKwh30d = rechargeRows.reduce((sum, row) => sum + row.recharge_kwh, 0);
      const rechargeDays = rechargeRows.flatMap((row) => Array.from({ length: Math.max(1, row.recharge_count) }).map(() => row.fact_date));
      const avgRechargeKwh30d =
        rechargeRows.length > 0 ? totalRechargeKwh30d / Math.max(rechargeRows.length, 1) : 0;
      const estimatedDaysCovered =
        avgDailyConsumption7d > 0 ? avgRechargeKwh30d / avgDailyConsumption7d : 0;

      let predictedNextRechargeDate: string | null = null;
      if (rechargeDays.length >= 2) {
        const gaps: number[] = [];
        for (let index = 1; index < rechargeDays.length; index += 1) {
          const previous = rechargeDays[index - 1];
          const current = rechargeDays[index];
          if (previous && current) {
            gaps.push(daysBetween(previous, current));
          }
        }
        const averageGap = Math.max(1, Math.round(average(gaps)));
        predictedNextRechargeDate = addDays(rechargeDays[rechargeDays.length - 1]!, averageGap);
      } else if (rechargeDays.length === 1 && estimatedDaysCovered > 0) {
        predictedNextRechargeDate = addDays(rechargeDays[0]!, Math.max(1, Math.round(estimatedDaysCovered)));
      }

      const sample = rechargeRows[0] ?? consumptionRows[0];
      return {
        meterId,
        customerName: sample?.customer_name ?? meterId,
        site: sample?.site_code ?? null,
        avgDailyConsumption7d: round2(avgDailyConsumption7d),
        avgRechargeKwh30d: round2(avgRechargeKwh30d),
        estimatedDaysCovered: round2(estimatedDaysCovered),
        predictedNextRechargeDate,
      } satisfies CustomerForecastRow;
    })
    .sort((left, right) => left.estimatedDaysCovered - right.estimatedDaysCovered);
}

export async function buildCustomerConsumptionRechargeSummary(
  request: AuthenticatedRequest,
  response: Response,
): Promise<CustomerConsumptionRechargeSummaryResponse> {
  const query = request.query as Record<string, unknown>;
  const dbViews = await buildDbBackedFactViews(request, response, query);
  const rows = dbViews?.summaryRows;

  if (rows && rows.length > 0) {
    return {
      summary: {
        customers: rows.length,
        totalRechargeAmount: round2(rows.reduce((sum, row) => sum + row.totalRechargeAmount, 0)),
        totalRechargeKwh: round2(rows.reduce((sum, row) => sum + row.totalRechargeKwh, 0)),
        totalConsumptionKwh: round2(rows.reduce((sum, row) => sum + row.totalConsumptionKwh, 0)),
      },
      rows,
    };
  }

  const { snapshot, masterByMeter, dailyRows, window } = await loadLiveCustomerAnalyticsData(request, response, query);
  const rechargeFacts = buildRechargeFactsFromSnapshot(snapshot, masterByMeter, query, window);
  const consumptionFacts = buildConsumptionFactsFromRows(dailyRows, masterByMeter, query, window);
  const merged = mergeFactRows(rechargeFacts, consumptionFacts, masterByMeter);

  return {
    summary: {
      customers: merged.summaryRows.length,
      totalRechargeAmount: round2(merged.summaryRows.reduce((sum, row) => sum + row.totalRechargeAmount, 0)),
      totalRechargeKwh: round2(merged.summaryRows.reduce((sum, row) => sum + row.totalRechargeKwh, 0)),
      totalConsumptionKwh: round2(merged.summaryRows.reduce((sum, row) => sum + row.totalConsumptionKwh, 0)),
    },
    rows: merged.summaryRows,
  };
}

async function buildCustomerConsumptionRechargeDailyFromQuery(
  request: AuthenticatedRequest,
  response: Response,
  query: Record<string, unknown>,
): Promise<CustomerConsumptionRechargeDailyResponse> {
  const dbViews = await buildDbBackedFactViews(request, response, query);
  const rows = dbViews?.dailyRows;

  if (rows && rows.length > 0) {
    return {
      summary: {
        totalRechargeAmount: round2(rows.reduce((sum, row) => sum + row.rechargeAmount, 0)),
        totalRechargeKwh: round2(rows.reduce((sum, row) => sum + row.rechargeKwh, 0)),
        totalConsumptionKwh: round2(rows.reduce((sum, row) => sum + row.consumptionKwh, 0)),
        totalVarianceKwh: round2(rows.reduce((sum, row) => sum + row.varianceKwh, 0)),
      },
      rows,
    };
  }

  const { snapshot, masterByMeter, dailyRows, window } = await loadLiveCustomerAnalyticsData(request, response, query);
  const rechargeFacts = buildRechargeFactsFromSnapshot(snapshot, masterByMeter, query, window);
  const consumptionFacts = buildConsumptionFactsFromRows(dailyRows, masterByMeter, query, window);
  const merged = mergeFactRows(rechargeFacts, consumptionFacts, masterByMeter);

  return {
    summary: {
      totalRechargeAmount: round2(merged.dailyRows.reduce((sum, row) => sum + row.rechargeAmount, 0)),
      totalRechargeKwh: round2(merged.dailyRows.reduce((sum, row) => sum + row.rechargeKwh, 0)),
      totalConsumptionKwh: round2(merged.dailyRows.reduce((sum, row) => sum + row.consumptionKwh, 0)),
      totalVarianceKwh: round2(merged.dailyRows.reduce((sum, row) => sum + row.varianceKwh, 0)),
    },
    rows: merged.dailyRows,
  };
}

export async function buildCustomerConsumptionRechargeDaily(
  request: AuthenticatedRequest,
  response: Response,
): Promise<CustomerConsumptionRechargeDailyResponse> {
  return buildCustomerConsumptionRechargeDailyFromQuery(
    request,
    response,
    request.query as Record<string, unknown>,
  );
}

export async function buildCustomerLiveDailyConsumption(
  request: AuthenticatedRequest,
  response: Response,
): Promise<CustomerLiveDailyConsumptionResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const daily = await buildCustomerConsumptionRechargeDailyFromQuery(request, response, {
    ...(request.query as Record<string, unknown>),
    fromDate: today,
    toDate: today,
  });
  const firstRow = daily.rows[0];

  if (!firstRow) {
    return {
      meterId: typeof request.query.meterId === "string" ? request.query.meterId : "",
      customerName: null,
      site: null,
      date: today,
      todayRechargeAmount: 0,
      todayRechargeKwh: 0,
      todayConsumptionKwh: 0,
      varianceKwh: 0,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  const masterByMeter = await loadMasterRows(request, response);
  const master = masterByMeter.get(firstRow.meterId);

  return {
    meterId: firstRow.meterId,
    customerName: firstRow.customerName,
    site: master?.site ?? null,
    date: today,
    todayRechargeAmount: firstRow.rechargeAmount,
    todayRechargeKwh: firstRow.rechargeKwh,
    todayConsumptionKwh: firstRow.consumptionKwh,
    varianceKwh: firstRow.varianceKwh,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export async function buildCustomerSegments(
  request: AuthenticatedRequest,
  response: Response,
): Promise<CustomerSegmentsResponse> {
  const siteId = typeof request.query.siteId === "string" ? request.query.siteId : null;
  const limit = typeof request.query.limit === "string" ? Number(request.query.limit) : 100;

  if (isSupabaseDbEnabled()) {
    const rows = await listCustomerSegments({ siteId, limit: Number.isFinite(limit) ? limit : 100 });
    if (rows.length > 0) {
      return {
        generatedAt: new Date().toISOString(),
        rows: rows.map((row) => ({
          meterId: row.meter_sn,
          customerName: row.customer_name ?? row.meter_sn,
          accountNo: row.account_no ?? null,
          site: row.site_code ?? null,
          segment: row.segment,
          rechargeCount30d: row.recharge_count_30d ?? 0,
          totalRechargeAmount30d: round2(Number(row.total_recharge_amount_30d ?? 0)),
          avgDailyConsumption7d: round2(Number(row.avg_daily_consumption_7d ?? 0)),
        })),
      };
    }
  }

  const query = request.query as Record<string, unknown>;
  const { snapshot, masterByMeter, dailyRows, window } = await loadLiveCustomerAnalyticsData(request, response, {
    ...query,
    fromDate: addDays(new Date().toISOString().slice(0, 10), -35),
    toDate: new Date().toISOString().slice(0, 10),
  });
  const rechargeFacts = buildRechargeFactsFromSnapshot(snapshot, masterByMeter, query, window);
  const consumptionFacts = buildConsumptionFactsFromRows(dailyRows, masterByMeter, query, window);

  return {
    generatedAt: new Date().toISOString(),
    rows: buildCustomerSegmentsFromFacts(rechargeFacts, consumptionFacts).slice(0, Number.isFinite(limit) ? limit : 100),
  };
}

export async function buildCustomerForecasts(
  request: AuthenticatedRequest,
  response: Response,
): Promise<CustomerForecastsResponse> {
  const siteId = typeof request.query.siteId === "string" ? request.query.siteId : null;
  const limit = typeof request.query.limit === "string" ? Number(request.query.limit) : 100;

  if (isSupabaseDbEnabled()) {
    const rows = await listCustomerForecasts({ siteId, limit: Number.isFinite(limit) ? limit : 100 });
    if (rows.length > 0) {
      return {
        generatedAt: new Date().toISOString(),
        rows: rows.map((row) => ({
          meterId: row.meter_sn,
          customerName: row.customer_name ?? row.meter_sn,
          site: row.site_code ?? null,
          avgDailyConsumption7d: round2(Number(row.avg_daily_consumption_7d ?? 0)),
          avgRechargeKwh30d: round2(Number(row.avg_recharge_kwh_30d ?? 0)),
          estimatedDaysCovered: round2(Number(row.estimated_days_covered ?? 0)),
          predictedNextRechargeDate: row.predicted_next_recharge_date ?? null,
        })),
      };
    }
  }

  const query = request.query as Record<string, unknown>;
  const { snapshot, masterByMeter, dailyRows, window } = await loadLiveCustomerAnalyticsData(request, response, {
    ...query,
    fromDate: addDays(new Date().toISOString().slice(0, 10), -35),
    toDate: new Date().toISOString().slice(0, 10),
  });
  const rechargeFacts = buildRechargeFactsFromSnapshot(snapshot, masterByMeter, query, window);
  const consumptionFacts = buildConsumptionFactsFromRows(dailyRows, masterByMeter, query, window);

  return {
    generatedAt: new Date().toISOString(),
    rows: buildCustomerForecastsFromFacts(rechargeFacts, consumptionFacts).slice(0, Number.isFinite(limit) ? limit : 100),
  };
}

export type { MasterMeterRow, RechargeFactLike, ConsumptionFactLike };

