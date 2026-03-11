import type { DataPageConfig, DataRow } from "../types";

export interface ReportStat {
  label: string;
  value: string;
  accent: "teal" | "blue" | "green" | "orange";
}

export interface ReportChartData {
  labels: string[];
  values: number[];
  type: "line" | "bar";
}

function toNumber(value: DataRow[string]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toLabel(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "Unknown";
}

function toFixedValue(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function readNumberFromKeys(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const numericValue = toNumber(row[key]);
    if (numericValue !== null) {
      return numericValue;
    }
  }

  return null;
}

function sumNumbers(rows: DataRow[], keyOrKeys: string | string[]) {
  const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
  return rows.reduce((total, row) => total + (readNumberFromKeys(row, keys) ?? 0), 0);
}

function averageNumbers(rows: DataRow[], keyOrKeys: string | string[]) {
  const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
  const values = rows
    .map((row) => readNumberFromKeys(row, keys))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function extractDateLabel(value: DataRow[string], mode: "daily" | "monthly") {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  return mode === "monthly" ? trimmed.slice(0, 7) : trimmed.slice(0, 10);
}

function groupSeries(
  rows: DataRow[],
  labelKeys: string[],
  valueKeyOrKeys: string | string[],
  options: {
    limit?: number;
    dateMode?: "daily" | "monthly";
    chartType?: "line" | "bar";
  } = {},
): ReportChartData | null {
  const { limit = 10, dateMode, chartType = "bar" } = options;
  const buckets = new Map<string, number>();
  const valueKeys = Array.isArray(valueKeyOrKeys) ? valueKeyOrKeys : [valueKeyOrKeys];

  for (const row of rows) {
    const label = dateMode
      ? extractDateLabel(
          labelKeys.map((key) => row[key]).find((value) => value !== null) ?? null,
          dateMode,
        )
      : toLabel(row, labelKeys);
    const value = readNumberFromKeys(row, valueKeys);

    if (!label || value === null) {
      continue;
    }

    buckets.set(label, (buckets.get(label) ?? 0) + value);
  }

  const entries = Array.from(buckets.entries()).slice(0, limit);

  if (entries.length === 0) {
    return null;
  }

  return {
    labels: entries.map(([label]) => label),
    values: entries.map(([, value]) => value),
    type: chartType,
  };
}

export function buildReportAnalytics(
  page: DataPageConfig | undefined,
  rows: DataRow[],
  total: number,
  appliedFilters: Record<string, string>,
  trendMode: "daily" | "monthly",
): {
  stats: ReportStat[];
  chartData: ReportChartData | null;
} {
  if (!page) {
    return { stats: [], chartData: null };
  }

  if (page.path === "/data-report/interval-data") {
    return {
      stats: [
        { label: "Total Readings", value: String(total), accent: "blue" },
        { label: "Total Energy", value: toFixedValue(sumNumbers(rows, "totalEnergy")), accent: "teal" },
        { label: "Avg Hour Usage", value: toFixedValue(averageNumbers(rows, "lastHourUsage")), accent: "orange" },
      ],
      chartData: groupSeries(rows, ["collectionDate", "meterId"], "totalEnergy", {
        limit: 8,
        chartType: "line",
      }),
    };
  }

  if (page.path === "/data-report/consumption-statistics") {
    return {
      stats: [
        { label: "Total Records", value: String(total), accent: "blue" },
        { label: "Total Consumption", value: toFixedValue(sumNumbers(rows, ["consumption", "totalEnergy"])), accent: "teal" },
        { label: "Avg Consumption", value: toFixedValue(averageNumbers(rows, ["consumption", "totalEnergy"])), accent: "green" },
      ],
      chartData: groupSeries(rows, ["collectionDate", "periodStart", "periodEnd"], ["consumption", "totalEnergy"], {
        limit: 12,
        dateMode: trendMode,
        chartType: "line",
      }),
    };
  }

  if (page.path === "/data-report/low-purchase") {
    const lowLimit = Number(appliedFilters.lowLimit ?? "");
    const criticalCount = Number.isFinite(lowLimit)
      ? rows.filter((row) => (toNumber(row.remainingBalance) ?? Number.POSITIVE_INFINITY) <= lowLimit)
          .length
      : rows.filter((row) => (toNumber(row.remainingBalance) ?? Number.POSITIVE_INFINITY) <= 0).length;

    return {
      stats: [
        { label: "Accounts at Risk", value: String(total), accent: "orange" },
        { label: "Avg Balance", value: toFixedValue(averageNumbers(rows, "remainingBalance")), accent: "teal" },
        { label: "Critically Low", value: String(criticalCount), accent: "blue" },
      ],
      chartData: groupSeries(rows, ["customerName", "meterId"], "remainingBalance"),
    };
  }

  if (page.path === "/data-report/long-nonpurchase") {
    const maxDays = rows.reduce((max, row) => Math.max(max, toNumber(row.daysWithoutPurchase) ?? 0), 0);

    return {
      stats: [
        { label: "Accounts Flagged", value: String(total), accent: "orange" },
        { label: "Avg Days", value: toFixedValue(averageNumbers(rows, "daysWithoutPurchase")), accent: "teal" },
        { label: "Max Days", value: String(maxDays), accent: "blue" },
      ],
      chartData: groupSeries(rows, ["customerName", "meterId"], "daysWithoutPurchase"),
    };
  }

  return {
    stats: [
      { label: "Total Records", value: String(total), accent: "blue" },
      { label: "Current Rows", value: String(rows.length), accent: "green" },
    ],
    chartData: null,
  };
}
