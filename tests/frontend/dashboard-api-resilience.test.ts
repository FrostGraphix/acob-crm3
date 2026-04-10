import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_REQUEST_TIMEOUT_MS,
  isLikelyTimeoutError,
  resolveDashboardDataFromSettledResults,
} from "../../frontend/src/services/dashboard-resilience.ts";
import { mergeDashboardChartResults } from "../../frontend/src/services/api.ts";

test("loadDashboard mapping keeps panel data when chart request fails", () => {
  const dashboard = resolveDashboardDataFromSettledResults(
    {
      status: "fulfilled",
      value: {
        totalAccountCount: 7,
        totalPurchaseTimes: 5,
        totalPurchaseUnit: 123,
        totalPurchaseMoney: 6000,
        lowPurchaseCount: 4,
        longNonpurchaseCount: 2,
        inactiveMeterCount: 1,
      },
    },
    [
      {
        status: "rejected",
        reason: new Error("chart timeout"),
      },
      {
        status: "rejected",
        reason: new Error("chart timeout"),
      },
      {
        status: "rejected",
        reason: new Error("chart timeout"),
      },
      {
        status: "rejected",
        reason: new Error("chart timeout"),
      },
      {
        status: "rejected",
        reason: new Error("chart timeout"),
      },
      {
        status: "rejected",
        reason: new Error("chart timeout"),
      },
      {
        status: "rejected",
        reason: new Error("chart timeout"),
      },
    ],
    {},
  );

  assert.equal(dashboard.panels[0]?.value, "7");
  assert.deepEqual(dashboard.purchaseMoney.values, []);
  assert.deepEqual(dashboard.successRate.values, []);
  assert.deepEqual(dashboard.alarms, [
    { label: "Low Purchase", value: 4 },
    { label: "Long Nonpurchase", value: 2 },
    { label: "Inactive Meters", value: 1 },
  ]);
});

test("loadDashboard mapping keeps chart data when panel request fails", () => {
  const dashboard = resolveDashboardDataFromSettledResults(
    {
      status: "rejected",
      reason: new Error("panel timeout"),
    },
    [
      {
        status: "fulfilled",
        value: {
          xData: ["2026-03-10", "2026-03-11"],
          yData: [100, 250],
        },
      },
      {
        status: "fulfilled",
        value: {
          xData: ["Low Purchase"],
          yData: [3],
        },
      },
      {
        status: "fulfilled",
        value: {
          xData: ["2026-03-10"],
          yData: [75],
        },
      },
      {
        status: "fulfilled",
        value: {
          rows: [{ gatewayId: "GW-1", successRate: 98 }],
        },
      },
      {
        status: "rejected",
        reason: new Error("events timeout"),
      },
      {
        status: "rejected",
        reason: new Error("hourly timeout"),
      },
      {
        status: "rejected",
        reason: new Error("fallback timeout"),
      },
    ],
    {
      xData: ["2026-03-10", "2026-03-11"],
      yData: [100, 250],
      successRateXData: ["00:00", "01:00"],
      successRateYData: [98, 99],
      alarms: [{ label: "Low Purchase", value: 3 }],
    },
  );

  assert.equal(dashboard.panels[0]?.value, "0");
  assert.deepEqual(dashboard.purchaseMoney.values, [100, 250]);
  assert.deepEqual(dashboard.successRate.values, [98, 99]);
  assert.deepEqual(dashboard.alarms, [{ label: "Low Purchase", value: 3 }]);
});

test("dashboard chart merge maps abnormal alarm xData/yData into pie slices", () => {
  const merged = mergeDashboardChartResults({
    purchaseMoney: {
      xData: ["2026-03-10"],
      yData: [100],
    },
    alarms: {
      xData: ["Low Purchase", "Inactive Meters"],
      yData: ["4", 2],
    },
  });

  assert.deepEqual(merged.alarms, [
    { label: "Low Purchase", value: 4 },
    { label: "Inactive Meters", value: 2 },
  ]);
});

test("dashboard chart merge derives chart data from alias row payloads before falling back", () => {
  const merged = mergeDashboardChartResults(
    {
      purchaseMoney: {
        xData: ["2026-03-10"],
        yData: [100],
      },
    },
    {
      gprs: {
        rows: [
          { gatewayId: "GW-1", successRate: 98 },
          { gatewayId: "GW-2", successRate: 96 },
        ],
      },
      events: {
        rows: [
          { severity: "Critical" },
          { severity: "Critical" },
          { severity: "Warning" },
        ],
      },
      hourly: {
        rows: [
          { collectionDate: "2026-03-10 10:00", value: 4 },
          { collectionDate: "2026-03-10 11:00", value: 6 },
          { collectionDate: "2026-03-11 10:00", value: 5 },
        ],
      },
    },
  );

  assert.deepEqual(merged.successRateXData, ["GW-1", "GW-2"]);
  assert.deepEqual(merged.successRateYData, [98, 96]);
  assert.deepEqual(merged.alarms, [
    { label: "Critical", value: 2 },
    { label: "Warning", value: 1 },
  ]);
  assert.deepEqual(merged.dailyConsumptionXData, ["2026-03-10", "2026-03-11"]);
  assert.deepEqual(merged.dailyConsumptionYData, [10, 5]);
});

test("loadDashboard throws when both panel and chart requests fail", () => {
  assert.throws(
    () =>
      resolveDashboardDataFromSettledResults(
        {
          status: "rejected",
          reason: new Error("panel offline"),
        },
        [
          {
            status: "rejected",
            reason: new Error("chart offline"),
          },
          {
            status: "rejected",
            reason: new Error("chart offline"),
          },
          {
            status: "rejected",
            reason: new Error("chart offline"),
          },
          {
            status: "rejected",
            reason: new Error("chart offline"),
          },
          {
            status: "rejected",
            reason: new Error("chart offline"),
          },
          {
            status: "rejected",
            reason: new Error("chart offline"),
          },
          {
            status: "rejected",
            reason: new Error("chart offline"),
          },
        ],
        {},
      ),
    /Failed to load dashboard data from upstream endpoints/,
  );
});

test("timeout-like failures are classified for observability", () => {
  assert.equal(isLikelyTimeoutError(new Error("timeout of 15000ms exceeded")), true);
  assert.equal(isLikelyTimeoutError("The operation was aborted"), true);
  assert.equal(isLikelyTimeoutError(new Error("HTTP 502")), false);
  assert.equal(DASHBOARD_REQUEST_TIMEOUT_MS, 15_000);
});
