import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const { siteConsumptionEngine } = await import(
  "../../backend/dist/backend/src/services/site-consumption-engine.js"
);

test("site consumption engine aggregates total1-based daily rows into site totals", () => {
  const snapshot = siteConsumptionEngine.accumulateRangeData(
    new Map([
      [
        "Musha",
        [
          {
            stationId: "MUSHA",
            collectionDate: "2026-03-01",
            total1: 12.5,
          },
          {
            customerAddress: "Musha Village",
            collectionDate: "2026-03-02",
            usage: "7.5",
          },
        ],
      ],
      [
        "Tunga",
        [
          {
            addr: "Tunga Maje",
            collectionDate: "2026-03-01",
            kwh: 4,
          },
          {
            stationCode: "TUNGA",
            collectionDate: "2026-03-02",
            totalEnergy: -1,
          },
        ],
      ],
    ]),
    "2026-03-01",
    "2026-03-02",
  );

  assert.equal(snapshot.summary.find((item) => item.site === "Musha")?.totalConsumption, 20);
  assert.equal(snapshot.summary.find((item) => item.site === "Tunga")?.totalConsumption, 4);
  assert.deepEqual(snapshot.daily.labels, ["2026-03-01", "2026-03-02"]);
  assert.deepEqual(
    snapshot.daily.series.find((entry) => entry.site === "Musha")?.values,
    [12.5, 7.5],
  );
});
