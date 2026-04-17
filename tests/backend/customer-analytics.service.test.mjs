import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";

const {
  buildCustomerForecastsFromFacts,
  buildCustomerSegmentsFromFacts,
} = await import("../../backend/dist/backend/src/services/customer-analytics.js");

test("customer analytics builders derive stable segments and depletion forecasts from fact rows", () => {
  const rechargeFacts = [
    {
      meter_sn: "MTR-001",
      fact_date: "2026-04-01",
      site_code: "musha",
      customer_name: "Alpha One",
      account_no: "ACC-001",
      recharge_amount: 12000,
      recharge_kwh: 60,
      recharge_count: 1,
      last_transaction_at: "2026-04-01T09:00:00.000Z",
    },
    {
      meter_sn: "MTR-001",
      fact_date: "2026-04-09",
      site_code: "musha",
      customer_name: "Alpha One",
      account_no: "ACC-001",
      recharge_amount: 15000,
      recharge_kwh: 75,
      recharge_count: 1,
      last_transaction_at: "2026-04-09T09:00:00.000Z",
    },
    {
      meter_sn: "MTR-002",
      fact_date: "2026-04-05",
      site_code: "ogufa",
      customer_name: "Beta Two",
      account_no: "ACC-002",
      recharge_amount: 4000,
      recharge_kwh: 18,
      recharge_count: 1,
      last_transaction_at: "2026-04-05T09:00:00.000Z",
    },
  ];

  const consumptionFacts = [
    {
      meter_sn: "MTR-001",
      fact_date: "2026-04-08",
      site_code: "musha",
      customer_name: "Alpha One",
      account_no: "ACC-001",
      consumption_kwh: 9,
      last_read_at: "2026-04-08T09:00:00.000Z",
    },
    {
      meter_sn: "MTR-001",
      fact_date: "2026-04-09",
      site_code: "musha",
      customer_name: "Alpha One",
      account_no: "ACC-001",
      consumption_kwh: 8,
      last_read_at: "2026-04-09T09:00:00.000Z",
    },
    {
      meter_sn: "MTR-001",
      fact_date: "2026-04-10",
      site_code: "musha",
      customer_name: "Alpha One",
      account_no: "ACC-001",
      consumption_kwh: 10,
      last_read_at: "2026-04-10T09:00:00.000Z",
    },
    {
      meter_sn: "MTR-002",
      fact_date: "2026-04-10",
      site_code: "ogufa",
      customer_name: "Beta Two",
      account_no: "ACC-002",
      consumption_kwh: 0.1,
      last_read_at: "2026-04-10T09:00:00.000Z",
    },
  ];

  const segments = buildCustomerSegmentsFromFacts(rechargeFacts, consumptionFacts);
  const forecasts = buildCustomerForecastsFromFacts(rechargeFacts, consumptionFacts);

  const alphaSegment = segments.find((row) => row.meterId === "MTR-001");
  const betaSegment = segments.find((row) => row.meterId === "MTR-002");
  assert.ok(alphaSegment);
  assert.ok(betaSegment);
  assert.equal(alphaSegment.segment, "active");
  assert.equal(betaSegment.segment, "erratic");
  assert.equal(alphaSegment.totalRechargeAmount30d, 27000);

  const alphaForecast = forecasts.find((row) => row.meterId === "MTR-001");
  const betaForecast = forecasts.find((row) => row.meterId === "MTR-002");
  assert.ok(alphaForecast);
  assert.ok(betaForecast);
  assert.ok(betaForecast.estimatedDaysCovered > alphaForecast.estimatedDaysCovered);
  assert.equal(alphaForecast.predictedNextRechargeDate, "2026-04-17");
  assert.equal(betaForecast.predictedNextRechargeDate, "2026-10-02");
});
