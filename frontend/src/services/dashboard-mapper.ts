import type { DashboardData, PieSlice } from "../types";
import { formatNairaCompact } from "./currency.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
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
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toNumberArray(value: unknown) {
  return Array.isArray(value)
    ? value
      .map((entry) => toFiniteNumber(entry))
      .filter((entry): entry is number => entry !== null)
    : [];
}

function toIsoDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-CA");
}

function toIsoWindowValue(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const dayFirstMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const normalized = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return Number.isNaN(normalized.getTime()) ? null : normalized.toISOString();
  }

  return null;
}

function formatTimeLabel(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSummaryCount(value: unknown) {
  const parsed = toFiniteNumber(value);
  return parsed === null ? 0 : Math.max(0, Math.floor(parsed));
}

function readSeries(
  source: Record<string, unknown>,
  labelKeys: string[],
  valueKeys: string[],
) {
  for (const labelKey of labelKeys) {
    for (const valueKey of valueKeys) {
      const labels = toStringArray(source[labelKey]);
      const values = toNumberArray(source[valueKey]);

      if (labels.length > 0 && values.length > 0) {
        return {
          labels,
          values,
        };
      }
    }
  }

  return {
    labels: [],
    values: [],
  };
}

function readAlarmSlices(source: Record<string, unknown>) {
  const candidates = [
    source.alarms,
    source.alarmData,
    source.alarmList,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    const slices = candidate
      .map((entry) => {
        const record = asRecord(entry);
        const label = typeof record.label === "string"
          ? record.label
          : typeof record.name === "string"
            ? record.name
            : null;
        const value = toFiniteNumber(record.value ?? record.count);

        return label && value !== null
          ? ({
              label,
              value,
            } satisfies PieSlice)
          : null;
      })
      .filter((entry): entry is PieSlice => entry !== null);

    if (slices.length > 0) {
      return slices;
    }
  }

  return [];
}

function readLivePulseItems(source: Record<string, unknown>) {
  if (!Array.isArray(source.livePulse)) {
    return [];
  }

  return source.livePulse
    .map((entry) => {
      const record = asRecord(entry);
      const timeLabel =
        typeof record.timeLabel === "string" && record.timeLabel.trim().length > 0
          ? record.timeLabel
          : null;
      const message =
        typeof record.message === "string" && record.message.trim().length > 0
          ? record.message
          : null;

      return timeLabel && message
        ? {
            timeLabel,
            message,
          }
        : null;
    })
    .filter((entry): entry is DashboardData["livePulse"][number] => entry !== null);
}

function formatCompactNumber(value: number, minimumFractionDigits = 0, maximumFractionDigits = 1) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

function buildLivePulse(args: {
  serverTime: string | null;
  purchaseMoney: { labels: string[]; values: number[] };
  lowPurchaseCount: number;
  longNonpurchaseCount: number;
  inactiveMeterCount: number;
}) {
  const timeLabel = formatTimeLabel(args.serverTime);
  const items: DashboardData["livePulse"] = [];

  const maxPurchaseValue = args.purchaseMoney.values.reduce(
    (best, value, index) =>
      value > best.value
        ? {
            value,
            label: args.purchaseMoney.labels[index] ?? "",
          }
        : best,
    { value: 0, label: "" },
  );

  if (maxPurchaseValue.value > 0) {
    items.push({
      timeLabel,
      message: `Portfolio purchase peak: ${formatNairaCompact(maxPurchaseValue.value, 0)} on ${toIsoDateLabel(maxPurchaseValue.label)}.`,
    });
  }

  if (args.inactiveMeterCount > 0 || args.longNonpurchaseCount > 0 || args.lowPurchaseCount > 0) {
    items.push({
      timeLabel,
      message:
        `${args.lowPurchaseCount} low purchase, ${args.longNonpurchaseCount} long nonpurchase, ` +
        `${args.inactiveMeterCount} inactive meters.`,
    });
  }

  if (items.length === 0) {
    items.push({
      timeLabel,
      message: "Portfolio telemetry synchronized. Awaiting the next upstream delta.",
    });
  }

  return items;
}

export function mapDashboardData(
  summaryResult: Record<string, unknown> | null | undefined,
  chartResult: Record<string, unknown> | null | undefined,
): DashboardData {
  const panel = summaryResult ?? {};
  const chart = chartResult ?? {};

  const purchaseMoney = readSeries(
    chart,
    ["xData", "labels", "purchaseMoneyLabels"],
    ["yData", "values", "purchaseMoneyValues"],
  );
  const successRate = readSeries(
    chart,
    ["successRateXData", "hourLabels", "successRateLabels"],
    ["successRateYData", "hourValues", "successRateValues"],
  );
  const dailyConsumption = readSeries(
    chart,
    ["dailyConsumptionXData", "consumptionLabels", "dailyLabels"],
    ["dailyConsumptionYData", "consumptionValues", "dailyValues"],
  );
  const monthlyConsumption = readSeries(
    chart,
    ["monthlyConsumptionXData", "monthlyLabels"],
    ["monthlyConsumptionYData", "monthlyValues"],
  );

  const accountCount = toFiniteNumber(panel.totalAccountCount) ?? 0;
  const purchaseTimes = toFiniteNumber(panel.totalPurchaseTimes) ?? 0;
  const purchaseUnit = toFiniteNumber(panel.totalPurchaseUnit) ?? 0;
  const purchaseMoneyTotal = toFiniteNumber(panel.totalPurchaseMoney) ?? 0;
  const lowPurchaseCount = toSummaryCount(panel.lowPurchaseCount);
  const longNonpurchaseCount = toSummaryCount(panel.longNonpurchaseCount);
  const inactiveMeterCount = toSummaryCount(panel.inactiveMeterCount);
  const riskBreakdown = readAlarmSlices(chart);
  const fallbackRiskBreakdown =
    lowPurchaseCount > 0 || longNonpurchaseCount > 0 || inactiveMeterCount > 0
      ? [
          { label: "Low Purchase", value: lowPurchaseCount },
          { label: "Long Nonpurchase", value: longNonpurchaseCount },
          { label: "Inactive Meters", value: inactiveMeterCount },
        ].filter((slice) => slice.value > 0)
      : readAlarmSlices(panel);
  const lastUpdatedAt =
    typeof panel.lastUpdatedAt === "string"
      ? panel.lastUpdatedAt
      : typeof chart.__metaServerTime === "string"
      ? chart.__metaServerTime
      : typeof panel.__metaServerTime === "string"
        ? panel.__metaServerTime
        : null;
  const selectedSiteId =
    typeof panel.selectedSiteId === "string" && panel.selectedSiteId.trim().length > 0
      ? panel.selectedSiteId
      : null;
  const selectedSiteLabel =
    typeof panel.selectedSiteLabel === "string" && panel.selectedSiteLabel.trim().length > 0
      ? panel.selectedSiteLabel
      : selectedSiteId
        ? selectedSiteId
        : "All Sites (Portfolio)";
  const sourceWindow =
    typeof panel.sourceWindow === "object" &&
    panel.sourceWindow !== null &&
    !Array.isArray(panel.sourceWindow)
      ? (() => {
          const window = panel.sourceWindow as Record<string, unknown>;
          const from = toIsoWindowValue(window.from);
          const to = toIsoWindowValue(window.to);
          return from && to ? { from, to } : null;
        })()
      : null;
  const livePulse = readLivePulseItems(panel);

  return {
    panels: [
      {
        label: "Account Count",
        value: accountCount.toLocaleString(),
        accent: "teal",
        icon: "accounts",
      },
      {
        label: "Purchase Times",
        value: purchaseTimes.toLocaleString(),
        accent: "blue",
        icon: "refresh",
      },
      {
        label: "Purchase Unit",
        value: formatCompactNumber(purchaseUnit),
        accent: "green",
        unit: "kWh",
        icon: "energy",
      },
      {
        label: "Purchase Money",
        value: formatNairaCompact(purchaseMoneyTotal, 0),
        accent: "orange",
        icon: "revenue",
      },
    ],
    purchaseMoney,
    successRate,
    alarms: riskBreakdown.length > 0 ? riskBreakdown : fallbackRiskBreakdown,
    consumption: {
      labels: dailyConsumption.labels.length > 0
        ? dailyConsumption.labels
        : monthlyConsumption.labels,
      daily: dailyConsumption.values,
      monthly: monthlyConsumption.values,
    },
    portfolioLabel:
      typeof panel.portfolioLabel === "string" && panel.portfolioLabel.trim().length > 0
        ? panel.portfolioLabel
        : "All Sites (Portfolio)",
    selectedSiteId,
    selectedSiteLabel,
    sourceWindow,
    lastUpdatedAt,
    livePulse:
      livePulse.length > 0
        ? livePulse
        : buildLivePulse({
            serverTime: lastUpdatedAt,
            purchaseMoney,
            lowPurchaseCount,
            longNonpurchaseCount,
            inactiveMeterCount,
          }),
  };
}
