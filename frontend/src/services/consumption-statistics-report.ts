import { loadTableData } from "./api.ts";
import { buildReadPayload } from "./payload-mapper.ts";
import type { DataPageConfig, DataRow } from "../types/index.ts";

export type ConsumptionStatisticsMetric = "consumption" | "totalEnergy";
export type ConsumptionStatisticsChartGranularity = "daily" | "monthly";
export type ConsumptionStatisticsRangePreset = "thisMonth" | "thisYear" | "last30Days";

export interface ConsumptionStatisticsQuery {
  customerId: string;
  meterId: string;
  fromDate: string;
  toDate: string;
  metric: ConsumptionStatisticsMetric;
  chartGranularity: ConsumptionStatisticsChartGranularity;
}

export interface ConsumptionStatisticsRow {
  periodLabel: string;
  collectionDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  customerId: string;
  customerName: string;
  meterId: string;
  consumption: number | null;
  totalEnergy: number | null;
}

export interface ConsumptionStatisticsChartPoint {
  label: string;
  value: number;
}

export interface ConsumptionStatisticsSummaryMetric {
  totalValue: number;
  averageValue: number;
  peakPeriodLabel: string | null;
  peakPeriodValue: number | null;
}

export interface ConsumptionStatisticsReport {
  range: {
    fromDate: string;
    toDate: string;
  };
  totalRows: number;
  distinctMeters: number;
  distinctCustomers: number;
  metric: ConsumptionStatisticsMetric;
  chartGranularity: ConsumptionStatisticsChartGranularity;
  summary: ConsumptionStatisticsSummaryMetric;
  chart: {
    labels: string[];
    values: number[];
    averageValue: number;
  };
  ranking: ConsumptionStatisticsChartPoint[];
  topMeter: ConsumptionStatisticsChartPoint | null;
  rows: ConsumptionStatisticsRow[];
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
}

function startOfYear(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), 0, 1);
}

function addDays(referenceDate: Date, days: number) {
  const next = new Date(referenceDate);
  next.setDate(next.getDate() + days);
  return next;
}

function sanitizeText(value: DataRow[string]) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function toNullableNumber(value: DataRow[string]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseDate(value: DataRow[string]) {
  const rawValue = sanitizeText(value);
  if (!rawValue) {
    return null;
  }

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const dayFirstMatch = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeRow(row: DataRow): ConsumptionStatisticsRow {
  const collectionDate =
    parseDate(row.collectionDate) ??
    parseDate(row.periodStart) ??
    parseDate(row.periodEnd);
  const periodStart = parseDate(row.periodStart);
  const periodEnd = parseDate(row.periodEnd);

  return {
    periodLabel:
      collectionDate ??
      periodStart ??
      periodEnd ??
      "Unknown Period",
    collectionDate,
    periodStart,
    periodEnd,
    customerId: sanitizeText(row.customerId),
    customerName: sanitizeText(row.customerName),
    meterId: sanitizeText(row.meterId),
    consumption: toNullableNumber(row.consumption),
    totalEnergy: toNullableNumber(row.totalEnergy),
  };
}

function getMetricValue(row: ConsumptionStatisticsRow, metric: ConsumptionStatisticsMetric) {
  const preferred = row[metric];
  if (typeof preferred === "number" && Number.isFinite(preferred)) {
    return preferred;
  }

  const fallback = row[metric === "consumption" ? "totalEnergy" : "consumption"];
  return typeof fallback === "number" && Number.isFinite(fallback) ? fallback : null;
}

function getPeriodKey(label: string, granularity: ConsumptionStatisticsChartGranularity) {
  return granularity === "monthly" ? label.slice(0, 7) : label.slice(0, 10);
}

function sortRows(rows: ConsumptionStatisticsRow[], metric: ConsumptionStatisticsMetric) {
  return [...rows].sort((left, right) => {
    const leftDate = left.collectionDate ?? left.periodStart ?? left.periodEnd ?? "";
    const rightDate = right.collectionDate ?? right.periodStart ?? right.periodEnd ?? "";

    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }

    return (getMetricValue(right, metric) ?? 0) - (getMetricValue(left, metric) ?? 0);
  });
}

function buildRanking(
  rows: ConsumptionStatisticsRow[],
  metric: ConsumptionStatisticsMetric,
  preferredKeys: Array<"meterId" | "customerName" | "customerId" | "periodLabel">,
) {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    const label =
      preferredKeys
        .map((key) => row[key])
        .find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
    const metricValue = getMetricValue(row, metric);

    if (!label || metricValue === null) {
      continue;
    }

    buckets.set(label, (buckets.get(label) ?? 0) + metricValue);
  }

  return Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

export function createDefaultConsumptionStatisticsQuery(referenceDate = new Date()): ConsumptionStatisticsQuery {
  return {
    customerId: "",
    meterId: "",
    fromDate: `${referenceDate.getFullYear()}-01-01`,
    toDate: formatLocalDate(referenceDate),
    metric: "consumption",
    chartGranularity: "daily",
  };
}

export function createConsumptionStatisticsRange(
  preset: ConsumptionStatisticsRangePreset,
  referenceDate = new Date(),
) {
  const toDate = formatLocalDate(referenceDate);
  const fromDate =
    preset === "thisMonth"
      ? formatLocalDate(startOfMonth(referenceDate))
      : preset === "last30Days"
        ? formatLocalDate(addDays(referenceDate, -29))
        : formatLocalDate(startOfYear(referenceDate));

  return {
    fromDate,
    toDate,
  };
}

export function applyConsumptionStatisticsRangePreset(
  query: ConsumptionStatisticsQuery,
  preset: ConsumptionStatisticsRangePreset,
  referenceDate = new Date(),
): ConsumptionStatisticsQuery {
  return {
    ...query,
    ...createConsumptionStatisticsRange(preset, referenceDate),
  };
}

export function buildConsumptionStatisticsReport(
  sourceRows: DataRow[],
  query: ConsumptionStatisticsQuery,
): ConsumptionStatisticsReport {
  const normalizedRows = sortRows(sourceRows.map(normalizeRow), query.metric);
  const filteredRows = normalizedRows.filter((row) => {
    const label = row.collectionDate ?? row.periodStart ?? row.periodEnd;
    return label ? label >= query.fromDate && label <= query.toDate : true;
  });
  const chartBuckets = new Map<string, number>();
  const periodBuckets = new Map<string, number>();
  let totalValue = 0;
  let valuedRowCount = 0;

  for (const row of filteredRows) {
    const metricValue = getMetricValue(row, query.metric);
    const periodLabel = row.collectionDate ?? row.periodStart ?? row.periodEnd ?? row.periodLabel;

    if (metricValue === null || !periodLabel) {
      continue;
    }

    totalValue += metricValue;
    valuedRowCount += 1;

    const chartKey = getPeriodKey(periodLabel, query.chartGranularity);
    chartBuckets.set(chartKey, (chartBuckets.get(chartKey) ?? 0) + metricValue);
    periodBuckets.set(periodLabel, (periodBuckets.get(periodLabel) ?? 0) + metricValue);
  }

  const chartPoints = Array.from(chartBuckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const peakPeriod = Array.from(periodBuckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)[0] ?? null;
  const meterRanking = buildRanking(filteredRows, query.metric, ["meterId"]);
  const customerRanking = buildRanking(filteredRows, query.metric, ["customerName", "customerId"]);
  const periodRanking = buildRanking(filteredRows, query.metric, ["periodLabel"]);
  const ranking =
    (meterRanking.length > 0 ? meterRanking : null) ??
    (customerRanking.length > 0 ? customerRanking : null) ??
    periodRanking;

  return {
    range: {
      fromDate: query.fromDate,
      toDate: query.toDate,
    },
    totalRows: filteredRows.length,
    distinctMeters: new Set(filteredRows.map((row) => row.meterId).filter(Boolean)).size,
    distinctCustomers: new Set(
      filteredRows
        .map((row) => row.customerId || row.customerName)
        .filter(Boolean),
    ).size,
    metric: query.metric,
    chartGranularity: query.chartGranularity,
    summary: {
      totalValue,
      averageValue: valuedRowCount > 0 ? totalValue / valuedRowCount : 0,
      peakPeriodLabel: peakPeriod?.label ?? null,
      peakPeriodValue: peakPeriod?.value ?? null,
    },
    chart: {
      labels: chartPoints.map((entry) => entry.label),
      values: chartPoints.map((entry) => entry.value),
      averageValue: chartPoints.length > 0 ? totalValue / chartPoints.length : 0,
    },
    ranking: ranking.slice(0, 8),
    topMeter: meterRanking[0] ?? null,
    rows: filteredRows,
  };
}

export async function loadConsumptionStatisticsReport(
  page: DataPageConfig,
  query: ConsumptionStatisticsQuery,
) {
  const mapping = buildReadPayload(
    page,
    {
      customerId: query.customerId,
      meterId: query.meterId,
      fromDate: query.fromDate,
      toDate: query.toDate,
    },
    1,
    10,
  );

  if (!mapping.ok || !mapping.payload) {
    throw new Error(mapping.message ?? "Invalid consumption statistics query.");
  }

  const response = await loadTableData(
    page.readEndpoint,
    mapping.payload,
    page.readMethod ?? "POST",
  );
  return buildConsumptionStatisticsReport(response.rows, query);
}
