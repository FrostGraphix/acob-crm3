import test from "node:test";
import assert from "node:assert/strict";
import { buildReportAnalytics } from "../../frontend/src/services/report-analytics.ts";
import type { DataPageConfig } from "../../frontend/src/types/index.ts";

const basePage: DataPageConfig = {
  kind: "data",
  path: "/data-report/consumption-statistics",
  title: "Consumption Statistics",
  menuLabel: "Consumption Statistics",
  description: "Test page",
  sectionKey: "data-report",
  readEndpoint: "/API/PrepayReport/ConsumptionStatistics",
  columns: [],
  filters: [],
};

test("report analytics groups consumption rows by month when monthly mode is selected", () => {
  const result = buildReportAnalytics(
    basePage,
    [
      { collectionDate: "2026-01-02", consumption: 12.5 },
      { collectionDate: "2026-01-18", consumption: 7.5 },
      { collectionDate: "2026-02-01", consumption: 3 },
    ],
    3,
    {},
    "monthly",
  );

  assert.deepEqual(result.chartData, {
    labels: ["2026-01", "2026-02"],
    values: [20, 3],
    type: "line",
  });
  assert.equal(result.stats[0]?.value, "3");
});

test("report analytics uses low limit filter to count critically low balances", () => {
  const lowPurchasePage: DataPageConfig = {
    ...basePage,
    path: "/data-report/low-purchase",
    title: "Low Purchase Situation",
    menuLabel: "Low Purchase",
    readEndpoint: "/API/PrepayReport/LowPurchaseSituation",
  };

  const result = buildReportAnalytics(
    lowPurchasePage,
    [
      { customerName: "A", remainingBalance: 100 },
      { customerName: "B", remainingBalance: 40 },
      { customerName: "C", remainingBalance: 10 },
    ],
    3,
    { lowLimit: "50" },
    "daily",
  );

  assert.equal(result.stats[2]?.value, "2");
  assert.deepEqual(result.chartData?.labels, ["A", "B", "C"]);
});
