import test from "node:test";
import assert from "node:assert/strict";
import {
  applyConsumptionStatisticsRangePreset,
  buildConsumptionStatisticsReport,
  createConsumptionStatisticsRange,
  createDefaultConsumptionStatisticsQuery,
} from "../../frontend/src/services/consumption-statistics-report.ts";

test("consumption statistics report groups endpoint rows by chart granularity and ranks meters", () => {
  const report = buildConsumptionStatisticsReport(
    [
      {
        collectionDate: "2026-01-02",
        customerId: "C-1",
        customerName: "Alice",
        meterId: "M-1",
        consumption: 12.5,
      },
      {
        collectionDate: "2026-01-18",
        customerId: "C-2",
        customerName: "Bob",
        meterId: "M-1",
        consumption: 7.5,
      },
      {
        collectionDate: "2026-02-01",
        customerId: "C-3",
        customerName: "Cara",
        meterId: "M-2",
        consumption: 3,
      },
    ],
    {
      ...createDefaultConsumptionStatisticsQuery(new Date("2026-04-02T09:00:00Z")),
      fromDate: "2026-01-01",
      toDate: "2026-02-28",
      chartGranularity: "monthly",
    },
  );

  assert.deepEqual(report.chart.labels, ["2026-01", "2026-02"]);
  assert.deepEqual(report.chart.values, [20, 3]);
  assert.equal(report.summary.totalValue, 23);
  assert.equal(report.summary.peakPeriodLabel, "2026-01-02");
  assert.equal(report.topMeter?.label, "M-1");
  assert.equal(report.topMeter?.value, 20);
  assert.equal(report.distinctMeters, 2);
  assert.equal(report.distinctCustomers, 3);
});

test("consumption statistics report falls back to total energy when consumption is missing", () => {
  const report = buildConsumptionStatisticsReport(
    [
      {
        collectionDate: "2026-03-01",
        meterId: "M-9",
        totalEnergy: "14.5",
      },
      {
        collectionDate: "2026-03-02",
        meterId: "M-9",
        totalEnergy: 5.5,
      },
    ],
    {
      ...createDefaultConsumptionStatisticsQuery(new Date("2026-04-02T09:00:00Z")),
      fromDate: "2026-03-01",
      toDate: "2026-03-31",
      metric: "consumption",
    },
  );

  assert.equal(report.summary.totalValue, 20);
  assert.deepEqual(report.chart.labels, ["2026-03-01", "2026-03-02"]);
  assert.deepEqual(report.chart.values, [14.5, 5.5]);
  assert.equal(report.rows[0]?.meterId, "M-9");
});

test("consumption statistics range presets create child-friendly quick date windows", () => {
  const referenceDate = new Date("2026-04-08T09:00:00Z");

  assert.deepEqual(createConsumptionStatisticsRange("thisMonth", referenceDate), {
    fromDate: "2026-04-01",
    toDate: "2026-04-08",
  });
  assert.deepEqual(createConsumptionStatisticsRange("last30Days", referenceDate), {
    fromDate: "2026-03-10",
    toDate: "2026-04-08",
  });
  assert.deepEqual(createConsumptionStatisticsRange("thisYear", referenceDate), {
    fromDate: "2026-01-01",
    toDate: "2026-04-08",
  });
});

test("consumption statistics range presets keep the current query simple while changing only dates", () => {
  const baseQuery = {
    ...createDefaultConsumptionStatisticsQuery(new Date("2026-04-08T09:00:00Z")),
    customerId: "C-44",
    meterId: "M-88",
    metric: "totalEnergy" as const,
    chartGranularity: "monthly" as const,
  };

  assert.deepEqual(
    applyConsumptionStatisticsRangePreset(baseQuery, "thisMonth", new Date("2026-04-08T09:00:00Z")),
    {
      ...baseQuery,
      fromDate: "2026-04-01",
      toDate: "2026-04-08",
    },
  );
});
