import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  asRecord,
  asRecordArray,
  firstAvailableRows,
  readNumber,
  readString,
  type ReportRow,
} from "../lib/upstream-data.js";
import { SITE_CONSUMPTION_SITES } from "./site-consumption-store.js";
import { ensureUpstreamSession } from "./upstream-session.js";
import { forwardToUpstream, forwardToUpstreamGet } from "./upstream.js";

export interface ManagementTokenTransaction {
  meterSN: string;
  siteId: string;
  customerName: string;
  accountNo: string;
  amount: number;
  kwh: number;
  tariffRate: string;
  timestamp: string;
}

export interface ManagementConsumptionAnalytics {
  date: string;
  dayKwh: number;
  nightKwh: number;
  dayRevenue: number;
  nightRevenue: number;
  dayTransactions: number;
  nightTransactions: number;
  totalKwh: number;
  totalRevenue: number;
}

export interface ManagementMeterConsumptionAnalytics {
  meterSN: string;
  customerName: string;
  siteId: string;
  dayKwh: number;
  nightKwh: number;
  totalKwh: number;
}

export interface ManagementTokenAnalyticsSnapshot {
  availableSites: string[];
  fetchedAt: string;
  lastTransactionAt: string | null;
  sourceWindow: {
    fromDate: string;
    toDate: string;
  };
  transactions: ManagementTokenTransaction[];
}

interface CustomerRegistryEntry {
  address: string;
  certifiNo: string;
  name: string;
  stationId: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const CUSTOMER_PAGE_SIZE = 100_000;
const TOKEN_TIMEOUT_MS = 45_000;

let cachedSnapshot: ManagementTokenAnalyticsSnapshot | null = null;
let cacheExpiresAt = 0;
let inFlightSnapshotPromise: Promise<ManagementTokenAnalyticsSnapshot> | null = null;

function isSuccessfulResult(result: { statusCode: number; payload: { code: number } }) {
  return result.statusCode < 400 && result.payload.code === 0;
}

function formatDayFirstDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function buildSnapshotWindow(referenceDate = new Date()) {
  const fromDate = new Date(referenceDate);
  fromDate.setFullYear(fromDate.getFullYear() - 1);

  return {
    fromDate: fromDate.toISOString(),
    toDate: referenceDate.toISOString(),
    fromDateDayFirst: formatDayFirstDate(fromDate),
    toDateDayFirst: formatDayFirstDate(referenceDate),
  };
}

function normalizeSiteName(siteId: string) {
  return (
    SITE_CONSUMPTION_SITES.find((entry) => entry.toLowerCase() === siteId.trim().toLowerCase()) ??
    siteId.trim()
  );
}

function readTransactionTimestamp(row: ReportRow) {
  return (
    readString(row, [
      "createDate",
      "purchaseTime",
      "vendTime",
      "timestamp",
      "tradeTime",
      "payTime",
      "date",
      "time",
      "CreatedAt",
      "Timestamp",
    ]) ?? ""
  );
}

function toNormalizedTimestamp(value: string) {
  if (!value) {
    return "";
  }

  if (value.length === 19 && value.includes(" ")) {
    return `${value.replace(" ", "T")}Z`;
  }

  return value;
}

function extractFlexibleRows(result: unknown): ReportRow[] {
  if (Array.isArray(result)) {
    return asRecordArray(result);
  }

  const root = asRecord(result);
  const page = asRecord(root.page);

  return firstAvailableRows([
    root.rows,
    root.list,
    root.data,
    root.records,
    root.items,
    root.payments,
    page.rows,
    page.list,
    page.data,
    page.records,
  ]);
}

function buildCustomerBodies() {
  const base = {
    pageNumber: 1,
    page: 1,
    pageSize: CUSTOMER_PAGE_SIZE,
    limit: CUSTOMER_PAGE_SIZE,
  };

  return [
    base,
    {
      ...base,
      size: CUSTOMER_PAGE_SIZE,
    },
  ];
}

function buildTokenBodies(
  siteId: string,
  window: ReturnType<typeof buildSnapshotWindow>,
) {
  const base = {
    siteId,
    site: siteId,
    stationId: siteId,
    SITE_ID: siteId,
    pageNumber: 1,
    page: 1,
    pageSize: CUSTOMER_PAGE_SIZE,
    limit: CUSTOMER_PAGE_SIZE,
    fromDate: window.fromDateDayFirst,
    toDate: window.toDateDayFirst,
  };

  return [
    {
      FROM: window.fromDate,
      TO: window.toDate,
      pageLimit: 100,
      SITE_ID: siteId,
    },
    base,
    {
      ...base,
      startDate: window.fromDateDayFirst,
      endDate: window.toDateDayFirst,
    },
  ];
}

function buildCustomerRegistry(rows: ReportRow[]) {
  const registry = new Map<string, CustomerRegistryEntry>();

  for (const row of rows) {
    const customerId = readString(row, ["customerId", "meterId", "meterSN"]);
    if (!customerId || customerId === "N/A" || customerId === "123") {
      continue;
    }

    const normalizedId = customerId.replace(/^47000/, "4700");
    const entry = {
      name:
        readString(row, ["customerName", "name"]) ??
        `Customer ${customerId.slice(-4)}`,
      address: readString(row, ["address"]) ?? "",
      stationId: readString(row, ["stationId", "siteId", "site"]) ?? "",
      certifiNo: readString(row, ["certifiNo", "accountNo"]) ?? "",
    } satisfies CustomerRegistryEntry;

    registry.set(customerId, entry);
    if (normalizedId !== customerId) {
      registry.set(normalizedId, entry);
    }
  }

  return registry;
}

async function fetchCustomerRegistry(
  request: AuthenticatedRequest,
  response: Parameters<typeof ensureUpstreamSession>[1],
) {
  const upstreamCookie = await ensureUpstreamSession(request, response);

  for (const body of buildCustomerBodies()) {
    const result = await forwardToUpstream(
      "/api/customer/read",
      body,
      upstreamCookie,
      { timeoutMs: TOKEN_TIMEOUT_MS },
    );

    if (!isSuccessfulResult(result)) {
      continue;
    }

    return buildCustomerRegistry(extractFlexibleRows(result.payload.result));
  }

  return new Map<string, CustomerRegistryEntry>();
}

async function fetchSiteTokenRows(
  request: AuthenticatedRequest,
  response: Parameters<typeof ensureUpstreamSession>[1],
  siteId: string,
  window: ReturnType<typeof buildSnapshotWindow>,
) {
  const upstreamCookie = await ensureUpstreamSession(request, response);
  const getResult = await forwardToUpstreamGet(
    "/api/token/creditTokenRecord/readMore",
    {
      FROM: window.fromDate,
      TO: window.toDate,
      pageLimit: 100,
      SITE_ID: siteId,
    },
    upstreamCookie,
    { timeoutMs: TOKEN_TIMEOUT_MS },
  );

  if (isSuccessfulResult(getResult)) {
    return extractFlexibleRows(getResult.payload.result);
  }

  for (const body of buildTokenBodies(siteId, window)) {
    const postResult = await forwardToUpstream(
      "/api/token/creditTokenRecord/readMore",
      body,
      upstreamCookie,
      { timeoutMs: TOKEN_TIMEOUT_MS },
    );

    if (isSuccessfulResult(postResult)) {
      return extractFlexibleRows(postResult.payload.result);
    }
  }

  throw new Error(`Failed to load token history for ${siteId}.`);
}

function buildTransactions(
  siteId: string,
  rows: ReportRow[],
  customerRegistry: Map<string, CustomerRegistryEntry>,
) {
  const transactions: ManagementTokenTransaction[] = [];

  for (const row of rows) {
    const meterSN = readString(row, ["meterId", "MeterSN", "meterSN", "meterNo"]) ?? "";
    if (!meterSN || meterSN === "N/A") {
      continue;
    }

    const registryEntry = customerRegistry.get(meterSN);
    const rowSite =
      readString(row, ["stationId", "siteId", "site", "station"]) ?? siteId;
    const customerNameFromRow = readString(row, ["customerName", "customer", "name"]);
    const customerName =
      customerNameFromRow && customerNameFromRow !== "N/A"
        ? customerNameFromRow
        : registryEntry?.name ?? `Customer ${meterSN.slice(-4)}`;
    const timestamp = toNormalizedTimestamp(readTransactionTimestamp(row));

    transactions.push({
      meterSN,
      siteId: normalizeSiteName(rowSite),
      customerName,
      accountNo: registryEntry?.certifiNo || `ACCT-${meterSN}`,
      amount: readNumber(row, ["totalPaid", "Amount", "amount"]) ?? 0,
      kwh: readNumber(row, ["totalUnit", "TransactionKwh", "transactionKwh", "kwh"]) ?? 0,
      tariffRate:
        readString(row, ["tariffId", "TariffRate", "tariffRate", "transactionType"]) ??
        "Standard",
      timestamp,
    });
  }

  return transactions;
}

async function buildSnapshot(
  request: AuthenticatedRequest,
  response: Parameters<typeof ensureUpstreamSession>[1],
) {
  const window = buildSnapshotWindow();
  const customerRegistry = await fetchCustomerRegistry(request, response);
  const siteResults = await Promise.allSettled(
    SITE_CONSUMPTION_SITES.map(async (siteId) => ({
      siteId,
      rows: await fetchSiteTokenRows(request, response, siteId, window),
    })),
  );

  const transactions = siteResults.flatMap((result) => {
    if (result.status !== "fulfilled") {
      return [];
    }

    return buildTransactions(result.value.siteId, result.value.rows, customerRegistry);
  });

  transactions.sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );

  const availableSites = Array.from(
    new Set(transactions.map((entry) => entry.siteId).filter((entry) => entry.length > 0)),
  ).sort((left, right) => left.localeCompare(right));
  const lastTransactionAt = transactions[0]?.timestamp ?? null;

  const snapshot = {
    availableSites: availableSites.length > 0 ? availableSites : [...SITE_CONSUMPTION_SITES],
    fetchedAt: new Date().toISOString(),
    lastTransactionAt,
    sourceWindow: {
      fromDate: window.fromDate.slice(0, 10),
      toDate: window.toDate.slice(0, 10),
    },
    transactions,
  } satisfies ManagementTokenAnalyticsSnapshot;

  cachedSnapshot = snapshot;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return snapshot;
}

export async function getManagementTokenAnalyticsSnapshot(
  request: AuthenticatedRequest,
  response: Parameters<typeof ensureUpstreamSession>[1],
  forceRefresh = false,
) {
  const now = Date.now();
  if (!forceRefresh && cachedSnapshot && now < cacheExpiresAt) {
    return cachedSnapshot;
  }

  if (!forceRefresh && inFlightSnapshotPromise) {
    return inFlightSnapshotPromise;
  }

  const snapshotPromise = buildSnapshot(request, response).finally(() => {
    inFlightSnapshotPromise = null;
  });
  inFlightSnapshotPromise = snapshotPromise;
  return snapshotPromise;
}

export async function getManagementConsumptionAnalytics(
  request: AuthenticatedRequest,
  response: Parameters<typeof ensureUpstreamSession>[1],
  filters: { siteId?: string; meterSN?: string } = {},
) {
  const snapshot = await getManagementTokenAnalyticsSnapshot(request, response);
  let transactions = snapshot.transactions.slice();

  if (filters.siteId && filters.siteId !== "ALL") {
    transactions = transactions.filter(
      (entry) => entry.siteId.toLowerCase() === filters.siteId?.toLowerCase(),
    );
  }

  if (filters.meterSN) {
    transactions = transactions.filter((entry) => entry.meterSN === filters.meterSN);
  }

  const dailyMap = new Map<string, ManagementConsumptionAnalytics>();

  for (const transaction of transactions) {
    if (!transaction.timestamp) {
      continue;
    }

    const date = new Date(transaction.timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const isDay = date.getHours() >= 6 && date.getHours() < 18;
    const entry =
      dailyMap.get(dateKey) ??
      {
        date: dateKey,
        dayKwh: 0,
        nightKwh: 0,
        dayRevenue: 0,
        nightRevenue: 0,
        dayTransactions: 0,
        nightTransactions: 0,
        totalKwh: 0,
        totalRevenue: 0,
      };

    if (isDay) {
      entry.dayKwh += transaction.kwh;
      entry.dayRevenue += transaction.amount;
      entry.dayTransactions += 1;
    } else {
      entry.nightKwh += transaction.kwh;
      entry.nightRevenue += transaction.amount;
      entry.nightTransactions += 1;
    }

    entry.totalKwh += transaction.kwh;
    entry.totalRevenue += transaction.amount;
    dailyMap.set(dateKey, entry);
  }

  return Array.from(dailyMap.values()).sort((left, right) => left.date.localeCompare(right.date));
}

export async function getManagementMeterConsumptionAnalytics(
  request: AuthenticatedRequest,
  response: Parameters<typeof ensureUpstreamSession>[1],
  filters: { siteId?: string } = {},
) {
  const snapshot = await getManagementTokenAnalyticsSnapshot(request, response);
  let transactions = snapshot.transactions.slice();

  if (filters.siteId && filters.siteId !== "ALL") {
    transactions = transactions.filter(
      (entry) => entry.siteId.toLowerCase() === filters.siteId?.toLowerCase(),
    );
  }

  const meterMap = new Map<string, ManagementMeterConsumptionAnalytics>();

  for (const transaction of transactions) {
    if (!transaction.timestamp) {
      continue;
    }

    const date = new Date(transaction.timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const isDay = date.getHours() >= 6 && date.getHours() < 18;
    const entry =
      meterMap.get(transaction.meterSN) ??
      {
        meterSN: transaction.meterSN,
        customerName: transaction.customerName,
        siteId: transaction.siteId,
        dayKwh: 0,
        nightKwh: 0,
        totalKwh: 0,
      };

    if (isDay) {
      entry.dayKwh += transaction.kwh;
    } else {
      entry.nightKwh += transaction.kwh;
    }

    entry.totalKwh += transaction.kwh;
    entry.customerName = entry.customerName || transaction.customerName;
    entry.siteId = entry.siteId || transaction.siteId;
    meterMap.set(transaction.meterSN, entry);
  }

  return Array.from(meterMap.values()).sort((left, right) => right.totalKwh - left.totalKwh);
}
