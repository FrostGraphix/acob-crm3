import type { DashboardData, PieSlice } from "../types";

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

export function mapDashboardData(
  panelResult: Record<string, unknown> | null | undefined,
  chartResult: Record<string, unknown> | null | undefined,
): DashboardData {
  const panel = panelResult ?? {};
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

  return {
    panels: [
      { label: "Account Count", value: accountCount.toLocaleString(), accent: "teal" },
      { label: "Purchase Times", value: purchaseTimes.toLocaleString(), accent: "blue" },
      { label: "Purchase Unit", value: Math.round(purchaseUnit).toLocaleString(), accent: "green" },
      {
        label: "Purchase Money",
        value: `NGN ${purchaseMoneyTotal.toLocaleString()}`,
        accent: "orange",
      },
    ],
    purchaseMoney,
    successRate,
    alarms: readAlarmSlices(panel),
    consumption: {
      labels: dailyConsumption.labels.length > 0
        ? dailyConsumption.labels
        : monthlyConsumption.labels,
      daily: dailyConsumption.values,
      monthly: monthlyConsumption.values,
    },
  };
}
