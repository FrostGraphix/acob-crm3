import assert from "node:assert/strict";
import test from "node:test";
import { buildUpstreamRequestPlan } from "../../backend/dist/backend/src/services/upstream-request-adapters.js";

test("consumption statistics request plan adds language, paging, and date alias fallbacks", () => {
  const plan = buildUpstreamRequestPlan("/API/PrepayReport/ConsumptionStatistics", {
    customerId: "C-100",
    meterId: "M-200",
    fromDate: "2026-03-01",
    toDate: "2026-03-31",
  });

  assert.equal(plan.body.Lang, "en");
  assert.equal(plan.candidateBodies.length >= 4, true);

  const aliasedCandidate = plan.candidateBodies.find(
    (candidate) =>
      candidate.consumerId === "C-100" &&
      candidate.meterNo === "M-200" &&
      candidate.startDate === "2026-03-01" &&
      candidate.endDate === "2026-03-31",
  );
  assert.ok(aliasedCandidate);

  const dayFirstCandidate = plan.candidateBodies.find(
    (candidate) =>
      candidate.fromDate === "01/03/2026" &&
      candidate.toDate === "31/03/2026",
  );
  assert.ok(dayFirstCandidate);
});

test("long nonpurchase request plan normalizes numeric filters and paging aliases", () => {
  const plan = buildUpstreamRequestPlan("/API/PrepayReport/LongNonpurchaseSituation", {
    customerId: "C-300",
    meterId: "M-400",
    nonpurchaseDaysStart: "7",
    nonpurchaseDaysEnd: "21",
  });

  assert.equal(plan.body.Lang, "en");
  assert.equal(plan.candidateBodies.length >= 2, true);

  const aliasedCandidate = plan.candidateBodies.find(
    (candidate) =>
      candidate.consumerId === "C-300" &&
      candidate.meterCode === "M-400" &&
      candidate.daysStart === 7 &&
      candidate.daysEnd === 21 &&
      candidate.pageNumber === 1 &&
      candidate.limit === 10,
  );
  assert.ok(aliasedCandidate);
});

test("daily data meter request plan derives site aliases and extended timeout", () => {
  const plan = buildUpstreamRequestPlan("/api/DailyDataMeter/read", {
    customerId: "C-500",
    meterId: "M-600",
    site: "ST-9",
    fromDate: "15/03/2026",
    toDate: "16/03/2026",
  });

  assert.equal(plan.body.Lang, "en");
  assert.equal(plan.timeoutMs, 45_000);
  assert.equal(plan.candidateBodies.length >= 4, true);

  const aliasedCandidate = plan.candidateBodies.find(
    (candidate) =>
      candidate.stationId === "ST-9" &&
      candidate.siteId === "ST-9" &&
      candidate.sectionId === "ST-9" &&
      candidate.startDate === "2026-03-15" &&
      candidate.endDate === "2026-03-16",
  );
  assert.ok(aliasedCandidate);
});
