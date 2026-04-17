import cron from "node-cron";
import type { CustomerForecastRow, CustomerSegmentRow } from "../../../common/types/index.js";
import { extractRows, readNumber, readString, type ReportRow } from "../lib/upstream-data.js";
import { env } from "./env.js";
import { SITE_CONSUMPTION_SITES } from "./site-consumption-store.js";
import { SchedulerLeader, type SchedulerLeaderStatus } from "./scheduler-leader.js";
import {
  createAnalysisRun,
  isSupabaseDbEnabled,
  updateAnalysisRun,
  upsertCustomerDailyConsumptionFacts,
  upsertCustomerDailyRechargeFacts,
  upsertCustomerForecasts,
  upsertCustomerSegments,
  upsertWarehouseAccounts,
  upsertWarehouseCustomers,
  upsertWarehouseMeters,
  type DbWarehouseAccount,
  type DbWarehouseCustomer,
  type DbWarehouseMeter,
} from "./supabase-db.js";
import { forwardToUpstream, forwardToUpstreamGet, loginToUpstream } from "./upstream.js";
import {
  buildCustomerForecastsFromFacts,
  buildCustomerSegmentsFromFacts,
  type ConsumptionFactLike,
  type RechargeFactLike,
} from "./customer-analytics.js";

interface MasterRow {
  customerId: string | null;
  customerName: string | null;
  accountNo: string | null;
  site: string | null;
}

export interface ManagedCustomerFactEngineStatus {
  name: string;
  enabledByConfig: boolean;
  schedulerRunning: boolean;
  leader: SchedulerLeaderStatus;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRunDurationMs: number | null;
  lastError: string | null;
  rowMetrics: {
    rechargeFacts: number;
    consumptionFacts: number;
    segments: number;
    forecasts: number;
  };
}

const WINDOW_DAYS = 35;
const PAGE_SIZE = 5000;

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

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDayFirst(isoDate: string) {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`;
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

function readSite(row: ReportRow) {
  return readString(row, ["stationId", "siteId", "site", "station", "siteName"]) ?? "";
}

function readConsumptionValue(row: ReportRow) {
  return readNumber(row, ["consumption", "totalEnergy", "value", "kwh", "usage", "usedEnergy"]) ?? 0;
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

function readReadingTimestamp(row: ReportRow) {
  return (
    readString(row, [
      "updateTime",
      "collectionDate",
      "currentDate",
      "readDate",
      "createTime",
      "date",
      "timestamp",
    ]) ?? ""
  );
}

function normalizeTimestamp(value: string) {
  if (!value) {
    return "";
  }
  if (value.length === 19 && value.includes(" ")) {
    return `${value.replace(" ", "T")}Z`;
  }
  return value;
}

async function fetchRows(pathname: string, body: Record<string, unknown>, authToken: string) {
  const result = await forwardToUpstream(pathname, body, authToken, { timeoutMs: 45_000 });
  if (result.statusCode >= 400 || result.payload.code !== 0) {
    return [] as ReportRow[];
  }

  return extractRows(result.payload.result);
}

async function fetchGetRows(pathname: string, params: Record<string, unknown>, authToken: string) {
  const result = await forwardToUpstreamGet(pathname, params, authToken, { timeoutMs: 45_000 });
  if (result.statusCode >= 400 || result.payload.code !== 0) {
    return [] as ReportRow[];
  }

  return extractRows(result.payload.result);
}

async function loadMasterRows(authToken: string) {
  const [customerRows, accountRows, meterRows] = await Promise.all([
    fetchRows("/api/customer/read", { pageNumber: 1, pageSize: PAGE_SIZE, page: 1, limit: PAGE_SIZE }, authToken),
    fetchRows("/api/account/read", { pageNumber: 1, pageSize: PAGE_SIZE, page: 1, limit: PAGE_SIZE }, authToken),
    fetchRows("/api/meter/read", { pageNumber: 1, pageSize: PAGE_SIZE, page: 1, limit: PAGE_SIZE }, authToken),
  ]);

  const byMeter = new Map<string, MasterRow>();
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
  return {
    byMeter,
    customerRows,
    accountRows,
    meterRows,
  };
}

function mapWarehouseCustomerRow(row: ReportRow): DbWarehouseCustomer | null {
  const customerId = readCustomerId(row) || readAccountNo(row) || readMeterId(row);
  const customerName = readCustomerName(row);
  if (!customerId || !customerName) {
    return null;
  }

  return {
    upstream_customer_id: customerId,
    customer_name: customerName,
    account_no: readAccountNo(row) || null,
    phone: readString(row, ["phone", "mobile", "telephone", "tel"]),
    email: readString(row, ["email", "mail"]),
    address: readString(row, ["address", "customerAddress", "addr"]),
    site_code: readSite(row) || null,
    source: "customer-fact-engine",
    raw_payload: row,
  };
}

function mapWarehouseAccountRow(row: ReportRow): DbWarehouseAccount | null {
  const accountNo = readAccountNo(row);
  if (!accountNo) {
    return null;
  }

  return {
    upstream_account_id: readString(row, ["accountId", "accountNo", "certifiNo"]) ?? accountNo,
    customer_id: readCustomerId(row) || null,
    account_no: accountNo,
    status: readString(row, ["status", "accountStatus", "state"]),
    site_code: readSite(row) || null,
    opened_at: readString(row, ["openedAt", "openTime", "createTime"]),
    closed_at: readString(row, ["closedAt", "closeTime"]),
    raw_payload: row,
  };
}

function mapWarehouseMeterRow(row: ReportRow): DbWarehouseMeter | null {
  const meterSn = readMeterId(row);
  if (!meterSn) {
    return null;
  }

  return {
    upstream_meter_id: meterSn,
    meter_sn: meterSn,
    site_code: readSite(row) || null,
    status: readString(row, ["status", "meterStatus", "state"]),
    meter_type: readString(row, ["meterType", "type", "meterCategory"]),
    tariff_id: readString(row, ["tariffId", "priceId", "tariffCode"]),
    gateway_id: readString(row, ["gatewayId", "gatewayNo", "collectorId"]),
    installed_at: readString(row, ["installedAt", "installTime", "installDate"]),
    last_seen_at: readString(row, ["lastSeenAt", "lastReadAt", "updateTime", "createTime"]),
    raw_payload: row,
  };
}

async function loadDailyRows(authToken: string, fromIso: string, toIso: string) {
  if (fromIso > toIso) {
    return [] as ReportRow[];
  }

  return fetchRows(
    "/api/DailyDataMeter/read",
    {
      fromDate: toDayFirst(fromIso),
      toDate: toDayFirst(toIso),
      pageNumber: 1,
      pageSize: PAGE_SIZE,
      page: 1,
      limit: PAGE_SIZE,
    },
    authToken,
  );
}

async function loadHourlyTodayRows(authToken: string, todayIso: string) {
  const allRows: ReportRow[] = [];

  for (const siteId of SITE_CONSUMPTION_SITES) {
    const rows = await fetchGetRows(
      "/api/DailyDataMeter/readHourly",
      {
        siteId,
        SITE_ID: siteId,
        from: `${todayIso}T00:00:00.000Z`,
        to: `${todayIso}T23:59:59.999Z`,
        FROM: `${todayIso}T00:00:00.000Z`,
        TO: `${todayIso}T23:59:59.999Z`,
        fromDate: toDayFirst(todayIso),
        toDate: toDayFirst(todayIso),
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        page: 1,
        limit: PAGE_SIZE,
      },
      authToken,
    );
    allRows.push(...rows);
  }

  return allRows;
}

async function loadTokenRows(authToken: string, fromIso: string, toIso: string) {
  const allRows: ReportRow[] = [];
  for (const siteId of SITE_CONSUMPTION_SITES) {
    const getRows = await fetchGetRows(
      "/api/token/creditTokenRecord/readMore",
      {
        FROM: `${fromIso}T00:00:00.000Z`,
        TO: `${toIso}T23:59:59.999Z`,
        pageLimit: 100,
        SITE_ID: siteId,
      },
      authToken,
    );
    if (getRows.length > 0) {
      allRows.push(...getRows);
      continue;
    }

    const postRows = await fetchRows(
      "/api/token/creditTokenRecord/readMore",
      {
        siteId,
        pageNumber: 1,
        page: 1,
        pageSize: PAGE_SIZE,
        limit: PAGE_SIZE,
        fromDate: toDayFirst(fromIso),
        toDate: toDayFirst(toIso),
      },
      authToken,
    );
    allRows.push(...postRows);
  }

  return allRows;
}

function buildRechargeFacts(tokenRows: ReportRow[], masterByMeter: Map<string, MasterRow>) {
  const map = new Map<string, RechargeFactLike>();
  for (const row of tokenRows) {
    const meterId = readMeterId(row);
    const timestamp = normalizeTimestamp(readTransactionTimestamp(row));
    const factDate = parseDate(timestamp);
    if (!meterId || !factDate) {
      continue;
    }
    const master = masterByMeter.get(meterId);
    const key = `${meterId}:${factDate}`;
    const current = map.get(key) ?? {
      meter_sn: meterId,
      fact_date: factDate,
      site_code: master?.site ?? readSite(row) ?? null,
      customer_name: master?.customerName ?? readCustomerName(row) ?? null,
      account_no: master?.accountNo ?? readAccountNo(row) ?? null,
      recharge_amount: 0,
      recharge_kwh: 0,
      recharge_count: 0,
      last_transaction_at: null,
    };
    current.recharge_amount += readNumber(row, ["totalPaid", "Amount", "amount"]) ?? 0;
    current.recharge_kwh += readNumber(row, ["totalUnit", "TransactionKwh", "transactionKwh", "kwh"]) ?? 0;
    current.recharge_count += 1;
    if (!current.last_transaction_at || current.last_transaction_at < timestamp) {
      current.last_transaction_at = timestamp;
    }
    map.set(key, current);
  }
  return Array.from(map.values());
}

function buildConsumptionFacts(dailyRows: ReportRow[], masterByMeter: Map<string, MasterRow>) {
  const map = new Map<string, ConsumptionFactLike>();
  for (const row of dailyRows) {
    const meterId = readMeterId(row);
    const factDate = parseDate(
      readString(row, ["collectionDate", "collectDate", "dataDate", "readDate", "date", "currentDate"]) ??
        readString(row, ["createTime", "updateTime"]),
    );
    if (!meterId || !factDate) {
      continue;
    }
    const master = masterByMeter.get(meterId);
    const key = `${meterId}:${factDate}`;
    const current = map.get(key) ?? {
      meter_sn: meterId,
      fact_date: factDate,
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

function buildHourlyTodayConsumptionFacts(hourlyRows: ReportRow[], masterByMeter: Map<string, MasterRow>, todayIso: string) {
  const map = new Map<string, ConsumptionFactLike>();

  for (const row of hourlyRows) {
    const meterId = readMeterId(row);
    if (!meterId) {
      continue;
    }

    const factDate =
      parseDate(
        readString(row, ["collectionDate", "currentDate", "readDate", "date", "updateTime"]) ??
          readReadingTimestamp(row),
      ) ?? todayIso;
    if (factDate !== todayIso) {
      continue;
    }

    const master = masterByMeter.get(meterId);
    const key = `${meterId}:${factDate}`;
    const current = map.get(key) ?? {
      meter_sn: meterId,
      fact_date: factDate,
      site_code: master?.site ?? readSite(row) ?? null,
      customer_name: master?.customerName ?? readCustomerName(row) ?? null,
      account_no: master?.accountNo ?? null,
      consumption_kwh: 0,
      last_read_at: null,
    };

    current.consumption_kwh += readConsumptionValue(row);
    const timestamp = normalizeTimestamp(readReadingTimestamp(row));
    if (!current.last_read_at || current.last_read_at < timestamp) {
      current.last_read_at = timestamp || current.last_read_at;
    }
    map.set(key, current);
  }

  return Array.from(map.values());
}

function mergeConsumptionFacts(
  historicalFacts: ConsumptionFactLike[],
  liveTodayFacts: ConsumptionFactLike[],
) {
  const map = new Map<string, ConsumptionFactLike>();

  for (const fact of historicalFacts) {
    map.set(`${fact.meter_sn}:${fact.fact_date}`, fact);
  }

  for (const fact of liveTodayFacts) {
    map.set(`${fact.meter_sn}:${fact.fact_date}`, fact);
  }

  return Array.from(map.values());
}

function mapSegmentRows(rows: CustomerSegmentRow[]) {
  return rows.map((row) => ({
    meter_sn: row.meterId,
    customer_name: row.customerName,
    account_no: row.accountNo,
    site_id: row.site,
    segment: row.segment,
    recharge_count_30d: row.rechargeCount30d,
    total_recharge_amount_30d: row.totalRechargeAmount30d,
    avg_daily_consumption_7d: row.avgDailyConsumption7d,
    metadata: {},
  }));
}

function mapForecastRows(rows: CustomerForecastRow[]) {
  return rows.map((row) => ({
    meter_sn: row.meterId,
    customer_name: row.customerName,
    site_id: row.site,
    avg_daily_consumption_7d: row.avgDailyConsumption7d,
    avg_recharge_kwh_30d: row.avgRechargeKwh30d,
    estimated_days_covered: row.estimatedDaysCovered,
    predicted_next_recharge_date: row.predictedNextRechargeDate,
    metadata: {},
  }));
}

class CustomerFactEngine {
  private cronJob: cron.ScheduledTask | null = null;
  private refreshPromise: Promise<void> | null = null;
  private schedulerRunning = false;
  private lastRunStartedAt: string | null = null;
  private lastRunCompletedAt: string | null = null;
  private lastRunDurationMs: number | null = null;
  private lastError: string | null = null;
  private rowMetrics = {
    rechargeFacts: 0,
    consumptionFacts: 0,
    segments: 0,
    forecasts: 0,
  };
  private readonly leader = new SchedulerLeader("customer-fact-engine", {
    onLeadershipAcquired: () => {
      this.ensureCronSchedule();
      this.scheduleImmediateRefresh(2_000);
    },
    onLeadershipLost: () => {
      this.stopCronSchedule();
    },
  });

  private async refresh() {
    if (this.refreshPromise || !isSupabaseDbEnabled()) {
      return this.refreshPromise ?? Promise.resolve();
    }

    this.refreshPromise = (async () => {
      const startedAt = Date.now();
      this.lastRunStartedAt = new Date(startedAt).toISOString();
      this.lastError = null;
      let runRecord: { id?: string } | null = null;

      try {
        runRecord = await createAnalysisRun({
          engine_name: "customer-fact-engine",
          metadata: { schedule: "*/1 * * * *" },
        });

        const login = await loginToUpstream({
          username: env.upstreamUsername,
          password: env.upstreamPassword,
        });
        if (login.statusCode >= 400 || !login.upstreamCookie) {
          throw new Error("Unable to authenticate customer fact engine against upstream.");
        }

        const today = new Date().toISOString().slice(0, 10);
        const fromIso = addDays(today, -WINDOW_DAYS);
        const historicalToIso = addDays(today, -1);
        const authToken = login.upstreamCookie;
        const [{ byMeter: masterByMeter, customerRows, accountRows, meterRows }, dailyRows, hourlyTodayRows, tokenRows] = await Promise.all([
          loadMasterRows(authToken),
          loadDailyRows(authToken, fromIso, historicalToIso),
          loadHourlyTodayRows(authToken, today),
          loadTokenRows(authToken, fromIso, today),
        ]);

        const rechargeFacts = buildRechargeFacts(tokenRows, masterByMeter);
        const consumptionFacts = mergeConsumptionFacts(
          buildConsumptionFacts(dailyRows, masterByMeter),
          buildHourlyTodayConsumptionFacts(hourlyTodayRows, masterByMeter, today),
        );
        const segments = buildCustomerSegmentsFromFacts(rechargeFacts, consumptionFacts);
        const forecasts = buildCustomerForecastsFromFacts(rechargeFacts, consumptionFacts);

        await Promise.all([
          upsertWarehouseCustomers(
            customerRows
              .map(mapWarehouseCustomerRow)
              .filter((row): row is DbWarehouseCustomer => row !== null),
          ),
          upsertWarehouseAccounts(
            accountRows
              .map(mapWarehouseAccountRow)
              .filter((row): row is DbWarehouseAccount => row !== null),
          ),
          upsertWarehouseMeters(
            meterRows
              .map(mapWarehouseMeterRow)
              .filter((row): row is DbWarehouseMeter => row !== null),
          ),
          upsertCustomerDailyRechargeFacts(rechargeFacts.map((row) => ({
            meter_sn: row.meter_sn,
            fact_date: row.fact_date,
            site_id: row.site_code,
            customer_name: row.customer_name,
            account_no: row.account_no,
            recharge_amount: row.recharge_amount,
            recharge_kwh: row.recharge_kwh,
            recharge_count: row.recharge_count,
            last_transaction_at: row.last_transaction_at,
          }))),
          upsertCustomerDailyConsumptionFacts(consumptionFacts.map((row) => ({
            meter_sn: row.meter_sn,
            fact_date: row.fact_date,
            site_id: row.site_code,
            customer_name: row.customer_name,
            account_no: row.account_no,
            consumption_kwh: row.consumption_kwh,
            last_read_at: row.last_read_at,
          }))),
          upsertCustomerSegments(mapSegmentRows(segments)),
          upsertCustomerForecasts(mapForecastRows(forecasts)),
        ]);

        this.rowMetrics = {
          rechargeFacts: rechargeFacts.length,
          consumptionFacts: consumptionFacts.length,
          segments: segments.length,
          forecasts: forecasts.length,
        };
        this.lastRunCompletedAt = new Date().toISOString();
        this.lastRunDurationMs = Date.now() - startedAt;

        if (runRecord?.id) {
          void updateAnalysisRun(runRecord.id, {
            status: "completed",
            completed_at: this.lastRunCompletedAt,
            duration_ms: this.lastRunDurationMs,
            metadata: this.rowMetrics,
          });
        }
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : "Customer fact refresh failed";
        this.lastRunCompletedAt = new Date().toISOString();
        this.lastRunDurationMs = Date.now() - startedAt;
        if (runRecord?.id) {
          void updateAnalysisRun(runRecord.id, {
            status: "failed",
            completed_at: this.lastRunCompletedAt,
            duration_ms: this.lastRunDurationMs,
            error_message: this.lastError,
          });
        }
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
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

  public getStatus(): ManagedCustomerFactEngineStatus {
    return {
      name: "customer-fact-engine",
      enabledByConfig: isSupabaseDbEnabled(),
      schedulerRunning: this.schedulerRunning,
      leader: this.leader.getStatus(),
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunCompletedAt: this.lastRunCompletedAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.lastError,
      rowMetrics: this.rowMetrics,
    };
  }

  public async runNow() {
    if (!this.leader.currentlyLeads()) {
      return {
        accepted: false,
        reason: "This replica is not the active leader for customer-fact-engine.",
      };
    }
    await this.refresh();
    return {
      accepted: true,
      reason: "Customer facts refreshed on the active leader.",
    };
  }

  private ensureCronSchedule() {
    if (this.cronJob) {
      return;
    }
    this.cronJob = cron.schedule("* * * * *", () => {
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

export const customerFactEngine = new CustomerFactEngine();
