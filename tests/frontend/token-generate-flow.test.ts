import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreditTokenPayload,
  buildRechargeQuote,
  inferTariffRate,
} from "../../frontend/src/services/token-generate-flow.ts";

test("inferTariffRate prefers the tariff table price for the selected account", () => {
  const resolution = inferTariffRate(
    { meterId: "M-1", tariffId: "123" },
    [{ tariffId: "123", tariffName: "Residential", price: "350" }],
  );

  assert.equal(resolution.pricePerUnit, 350);
  assert.equal(resolution.tariffName, "Residential");
  assert.equal(resolution.source, "tariff");
});

test("buildRechargeQuote converts naira input into units", () => {
  const quote = buildRechargeQuote("naira", 3500, 350);

  assert.ok(quote);
  assert.equal(quote?.amountNaira, 3500);
  assert.equal(quote?.units, 10);
});

test("buildRechargeQuote converts unit input into naira", () => {
  const quote = buildRechargeQuote("unit", 2.86, 350);

  assert.ok(quote);
  assert.equal(quote?.units, 2.86);
  assert.equal(quote?.amountNaira, 1001);
});

test("buildCreditTokenPayload sends the derived unit quantity and password aliases", () => {
  const quote = buildRechargeQuote("naira", 3500, 350);
  assert.ok(quote);

  const payload = buildCreditTokenPayload(
    { meterId: "M-1", customerName: "Jane" },
    quote,
    "123456",
  );

  assert.equal(payload.amount, 10);
  assert.equal(payload.unit, 10);
  assert.equal(payload.AuthorizationPassword, "123456");
  assert.equal(payload.password2, "123456");
});
