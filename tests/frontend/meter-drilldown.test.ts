import test from "node:test";
import assert from "node:assert/strict";
import { buildMeterDrilldownPayload, loadMeterDrilldownData } from "../../frontend/src/services/meter-drilldown.ts";
import type { DataPageConfig } from "../../frontend/src/types/index.ts";

const basePage: DataPageConfig = {
  kind: "data",
  path: "/load-profile/daily-data",
  title: "Daily Data",
  menuLabel: "Daily Data",
  description: "Load profile daily data aggregation.",
  sectionKey: "load-profile",
  readEndpoint: "/API/LoadProfile/DailyData",
  columns: [{ key: "meterId", label: "Meter Id" }],
  filters: [],
  meterDrilldown: {
    primaryEndpoint: "/API/LoadProfile/DailyData",
    fallbackEndpoint: "/api/DailyDataMeter/readHourly",
    refreshMs: 30_000,
  },
};

test("buildMeterDrilldownPayload includes meterId date range and bounded paging", () => {
  const payload = buildMeterDrilldownPayload("47005346136", {
    fromDate: "2026-01-01",
    toDate: "2026-01-31",
  });

  assert.deepEqual(payload, {
    meterId: "47005346136",
    fromDate: "2026-01-01",
    toDate: "2026-01-31",
    pageNumber: 1,
    pageSize: 50,
  });
});

test("loadMeterDrilldownData returns primary source when primary has rows", async () => {
  const calls: string[] = [];
  const result = await loadMeterDrilldownData(
    basePage,
    "47005346136",
    {},
    async (path) => {
      calls.push(path);
      return { rows: [{ meterId: "47005346136", value: 23 }], total: 1 };
    },
  );

  assert.equal(result.source, "primary");
  assert.equal(result.rows.length, 1);
  assert.deepEqual(calls, ["/API/LoadProfile/DailyData"]);
});

test("loadMeterDrilldownData falls back when primary returns empty rows", async () => {
  const calls: string[] = [];
  const result = await loadMeterDrilldownData(
    basePage,
    "47005346136",
    {},
    async (path) => {
      calls.push(path);
      if (path === "/API/LoadProfile/DailyData") {
        return { rows: [], total: 0 };
      }
      return { rows: [{ meterId: "47005346136", value: 11 }], total: 1 };
    },
  );

  assert.equal(result.source, "fallback");
  assert.equal(result.rows.length, 1);
  assert.equal(result.error, null);
  assert.deepEqual(calls, ["/API/LoadProfile/DailyData", "/api/DailyDataMeter/readHourly"]);
});

test("loadMeterDrilldownData reports combined error when primary and fallback fail", async () => {
  const result = await loadMeterDrilldownData(
    basePage,
    "47005346136",
    {},
    async (path) => {
      if (path === "/API/LoadProfile/DailyData") {
        throw new Error("Forbidden");
      }
      throw new Error("Fallback timeout");
    },
  );

  assert.equal(result.source, null);
  assert.equal(result.rows.length, 0);
  assert.equal(result.error, "Forbidden. Fallback failed: Fallback timeout");
});
