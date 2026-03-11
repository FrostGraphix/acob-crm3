import test from "node:test";
import assert from "node:assert/strict";
import { mapDashboardData } from "../../frontend/src/services/dashboard-mapper.ts";

test("dashboard mapper keeps only upstream data that is actually present", () => {
  const dashboard = mapDashboardData(
    {
      totalAccountCount: "12",
      totalPurchaseTimes: 9,
      totalPurchaseUnit: "48.6",
      totalPurchaseMoney: "10250",
    },
    {
      xData: ["2026-03-09", "2026-03-10"],
      yData: ["1200", 980],
    },
  );

  assert.equal(dashboard.panels[0]?.value, "12");
  assert.deepEqual(dashboard.purchaseMoney.labels, ["2026-03-09", "2026-03-10"]);
  assert.deepEqual(dashboard.purchaseMoney.values, [1200, 980]);
  assert.deepEqual(dashboard.successRate.labels, []);
  assert.deepEqual(dashboard.successRate.values, []);
  assert.deepEqual(dashboard.consumption.labels, []);
  assert.deepEqual(dashboard.consumption.daily, []);
  assert.deepEqual(dashboard.consumption.monthly, []);
});

test("dashboard mapper supports structured alarm and consumption series when upstream provides them", () => {
  const dashboard = mapDashboardData(
    {
      totalAccountCount: 3,
      totalPurchaseTimes: 4,
      totalPurchaseUnit: 5,
      totalPurchaseMoney: 6,
      alarms: [
        { name: "Battery Low", count: 2 },
        { label: "Magnetic Interference", value: 1 },
      ],
    },
    {
      xData: ["Mon"],
      yData: [10],
      dailyConsumptionXData: ["Mon", "Tue"],
      dailyConsumptionYData: [4, 5],
      monthlyConsumptionXData: ["Jan", "Feb"],
      monthlyConsumptionYData: [20, 30],
      successRateLabels: ["00:00", "01:00"],
      successRateValues: [98, 99],
    },
  );

  assert.deepEqual(dashboard.alarms, [
    { label: "Battery Low", value: 2 },
    { label: "Magnetic Interference", value: 1 },
  ]);
  assert.deepEqual(dashboard.successRate.labels, ["00:00", "01:00"]);
  assert.deepEqual(dashboard.successRate.values, [98, 99]);
  assert.deepEqual(dashboard.consumption.labels, ["Mon", "Tue"]);
  assert.deepEqual(dashboard.consumption.daily, [4, 5]);
  assert.deepEqual(dashboard.consumption.monthly, [20, 30]);
});
