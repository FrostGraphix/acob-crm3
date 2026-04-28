import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  isSupabaseDbEnabled,
  listCustomerDailyConsumptionFacts,
} from "./supabase-db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

type Period = "day" | "week" | "month" | "year" | "overall";

interface ConsumptionFactRow {
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

  const dayFirstMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dayFirstMatch) {
    return `${dayFirstMatch[3]}-${dayFirstMatch[2]}-${dayFirstMatch[1]}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function defaultWindow() {
  const today = new Date();
  return {
    fromDate: addDays(today, -365).toISOString().slice(0, 10),
    toDate: today.toISOString().slice(0, 10),
  };
}

function readWindow(query: Record<string, unknown>) {
  const fallback = defaultWindow();
  const fromDate = parseDate(query.fromDate ?? query.from) ?? fallback.fromDate;
  const toDate = parseDate(query.toDate ?? query.to) ?? fallback.toDate;

  return {
    fromDate: fromDate <= toDate ? fromDate : toDate,
    toDate: toDate >= fromDate ? toDate : fromDate,
  };
}

function startOfIsoWeek(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}

function periodKey(date: string, period: Period) {
  if (period === "day") {
    return date;
  }
  if (period === "week") {
    return startOfIsoWeek(date);
  }
  if (period === "month") {
    return date.slice(0, 7);
  }
  if (period === "year") {
    return date.slice(0, 4);
  }
  return "overall";
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeLimit(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : 5000;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5000;
  }

  return Math.min(Math.floor(parsed), 20000);
}

function buildRows(facts: ConsumptionFactRow[], period: Period) {
  const grouped = new Map<string, {
    meterSn: string;
    accountNo: string | null;
    customerName: string | null;
    siteCode: string | null;
    period: string;
    consumptionKwh: number;
    days: Set<string>;
    lastReadAt: string | null;
  }>();

  for (const fact of facts) {
    const date = parseDate(fact.fact_date);
    if (!date) {
      continue;
    }

    const key = `${fact.meter_sn}:${periodKey(date, period)}`;
    const existing = grouped.get(key) ?? {
      meterSn: fact.meter_sn,
      accountNo: fact.account_no ?? null,
      customerName: fact.customer_name ?? null,
      siteCode: fact.site_code ?? null,
      period: periodKey(date, period),
      consumptionKwh: 0,
      days: new Set<string>(),
      lastReadAt: null,
    };

    existing.consumptionKwh += Number.isFinite(fact.consumption_kwh) ? fact.consumption_kwh : 0;
    existing.days.add(date);
    if (fact.last_read_at && (!existing.lastReadAt || existing.lastReadAt < fact.last_read_at)) {
      existing.lastReadAt = fact.last_read_at;
    }
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((row) => ({
      meterSn: row.meterSn,
      accountNo: row.accountNo,
      customerName: row.customerName,
      siteCode: row.siteCode,
      period: row.period,
      consumptionKwh: round3(row.consumptionKwh),
      averageDailyKwh: round3(row.consumptionKwh / Math.max(row.days.size, 1)),
      observedDays: row.days.size,
      unit: "kWh",
      lastReadAt: row.lastReadAt,
    }))
    .sort((left, right) => `${right.period}:${right.consumptionKwh}`.localeCompare(`${left.period}:${left.consumptionKwh}`));
}

export async function buildConsumptionUseAnalysis(request: AuthenticatedRequest) {
  const query = request.query as Record<string, unknown>;
  const periodParam = String(query.period ?? "day").toLowerCase();
  const period: Period =
    periodParam === "week" ||
    periodParam === "month" ||
    periodParam === "year" ||
    periodParam === "overall"
      ? periodParam
      : "day";
  const window = readWindow(query);

  if (!isSupabaseDbEnabled()) {
    return {
      source: "supabase-disabled",
      period,
      range: window,
      unit: "kWh",
      rows: [],
      totalConsumptionKwh: 0,
      issues: ["Consumption facts are unavailable because the Supabase database integration is disabled."],
    };
  }

  const facts = await listCustomerDailyConsumptionFacts({
    meterId: typeof query.meterId === "string" ? query.meterId : null,
    accountNo: typeof query.accountNo === "string" ? query.accountNo : null,
    siteId: typeof query.siteId === "string" ? query.siteId : null,
    fromDate: window.fromDate,
    toDate: window.toDate,
    limit: normalizeLimit(query.limit),
  });
  const rows = buildRows(facts as ConsumptionFactRow[], period);
  const totalConsumptionKwh = round3(rows.reduce((total, row) => total + row.consumptionKwh, 0));

  return {
    source: "customer_daily_consumption_facts",
    period,
    range: window,
    unit: "kWh",
    rows,
    totalConsumptionKwh,
    meterCount: new Set(rows.map((row) => row.meterSn)).size,
    issues: [
      "These are meter-level consumption facts. Exact appliance-level usage requires appliance submeters or device-level telemetry.",
    ],
  };
}
