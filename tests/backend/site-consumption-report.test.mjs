import test from "node:test";
import assert from "node:assert/strict";
import { buildSiteConsumptionReportResponse } from "../../backend/dist/backend/src/api/site-consumption.js";

const snapshot = {
  generatedAt: "2026-04-05T10:00:00.000Z",
  sourceWindow: {
    fromDate: "2026-04-01",
    toDate: "2026-04-05",
  },
  summary: [
    { site: "Musha", totalConsumption: 10 },
    { site: "Ogufa", totalConsumption: 8 },
    { site: "Umaisha", totalConsumption: 0 },
    { site: "Tunga", totalConsumption: 0 },
    { site: "Kyakale", totalConsumption: 0 },
  ],
  daily: {
    labels: ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"],
    series: [
      { site: "Musha", values: [1, 2, 3, 4, 0] },
      { site: "Ogufa", values: [0, 3, 0, 5, 0] },
      { site: "Umaisha", values: [0, 0, 0, 0, 0] },
      { site: "Tunga", values: [0, 0, 0, 0, 0] },
      { site: "Kyakale", values: [0, 0, 0, 0, 0] },
    ],
  },
  monthly: {
    labels: ["2026-04"],
    series: [
      { site: "Musha", values: [10] },
      { site: "Ogufa", values: [8] },
      { site: "Umaisha", values: [0] },
      { site: "Tunga", values: [0] },
      { site: "Kyakale", values: [0] },
    ],
  },
  yearly: {
    labels: ["2026"],
    series: [
      { site: "Musha", values: [10] },
      { site: "Ogufa", values: [8] },
      { site: "Umaisha", values: [0] },
      { site: "Tunga", values: [0] },
      { site: "Kyakale", values: [0] },
    ],
  },
};

const status = {
  refreshing: false,
  lastUpdatedAt: "2026-04-05T10:00:00.000Z",
  lastAttemptAt: "2026-04-05T10:00:00.000Z",
  lastError: null,
  sourceWindow: snapshot.sourceWindow,
};

test("site consumption report response clamps range and filters sites", () => {
  const report = buildSiteConsumptionReportResponse({
    snapshot,
    status,
    query: {
      fromDate: "2026-03-01",
      toDate: "2026-04-03",
      granularity: "daily",
      sites: "Musha,Unknown",
      compareMode: "compare",
    },
  });

  assert.deepEqual(report.range, {
    fromDate: "2026-04-01",
    toDate: "2026-04-03",
  });
  assert.deepEqual(report.selectedSites, ["Musha"]);
  assert.deepEqual(report.series.labels, ["2026-04-01", "2026-04-02", "2026-04-03"]);
  assert.deepEqual(report.summary, [{ site: "Musha", totalConsumption: 6 }]);
  assert.equal(report.topSite?.site, "Musha");
  assert.equal(report.rows.length, 3);
  assert.equal(report.issues.some((issue) => issue.includes("Ignored unknown sites")), true);
  assert.equal(report.issues.some((issue) => issue.includes("clamped")), true);
});

test("site consumption report response supports monthly projection", () => {
  const report = buildSiteConsumptionReportResponse({
    snapshot,
    status,
    query: {
      fromDate: "2026-04-01",
      toDate: "2026-04-05",
      granularity: "monthly",
      sites: "Musha,Ogufa",
      compareMode: "combined",
    },
  });

  assert.equal(report.granularity, "monthly");
  assert.equal(report.compareMode, "combined");
  assert.deepEqual(report.series.labels, ["2026-04"]);
  assert.deepEqual(
    report.summary,
    [
      { site: "Musha", totalConsumption: 10 },
      { site: "Ogufa", totalConsumption: 8 },
    ],
  );
});
