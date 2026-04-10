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

test("low purchase request plan adds paging, date aliases, and low balance aliases", () => {
  const plan = buildUpstreamRequestPlan("/API/PrepayReport/LowPurchaseSituation", {
    customerId: "C-150",
    meterId: "M-250",
    fromDate: "2026-03-01",
    toDate: "2026-03-31",
    lowLimit: "50",
  });

  assert.equal(plan.body.Lang, "en");
  assert.equal(plan.candidateBodies.length >= 4, true);

  const aliasedCandidate = plan.candidateBodies.find(
    (candidate) =>
      candidate.consumerId === "C-150" &&
      candidate.meterNo === "M-250" &&
      candidate.page === 1 &&
      candidate.limit === 10 &&
      candidate.startDate === "2026-03-01" &&
      candidate.endDate === "2026-03-31" &&
      candidate.lowBalance === 50,
  );
  assert.ok(aliasedCandidate);

  const dayFirstCandidate = plan.candidateBodies.find(
    (candidate) =>
      candidate.fromDate === "01/03/2026" &&
      candidate.toDate === "31/03/2026",
  );
  assert.ok(dayFirstCandidate);
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

test("load profile daily/monthly request plan adds language, date aliases, and meter fallbacks", () => {
  const dailyPlan = buildUpstreamRequestPlan("/API/LoadProfile/DailyData", {
    searchTerm: "47005346136",
    fromDate: "2026-04-01",
    toDate: "2026-04-07",
  });
  const monthlyPlan = buildUpstreamRequestPlan("/API/LoadProfile/MonthlyData", {
    meterId: "47005346136",
    fromDate: "2026-01-01",
    toDate: "2026-04-07",
  });

  assert.equal(dailyPlan.body.Lang, "en");
  assert.equal(monthlyPlan.body.Lang, "en");
  assert.equal(dailyPlan.timeoutMs, 45_000);
  assert.equal(monthlyPlan.timeoutMs, 45_000);
  assert.equal(dailyPlan.candidateBodies.length >= 4, true);
  assert.equal(monthlyPlan.candidateBodies.length >= 4, true);

  const dailyAliasedCandidate = dailyPlan.candidateBodies.find(
    (candidate) =>
      candidate.meterNo === "47005346136" &&
      candidate.keyword === "47005346136" &&
      candidate.startDate === "2026-04-01" &&
      candidate.endDate === "2026-04-07" &&
      candidate.periodType === "daily",
  );
  assert.ok(dailyAliasedCandidate);

  const monthlyDayFirstCandidate = monthlyPlan.candidateBodies.find(
    (candidate) =>
      candidate.fromDate === "01/01/2026" &&
      candidate.toDate === "07/04/2026" &&
      candidate.periodType === "monthly",
  );
  assert.ok(monthlyDayFirstCandidate);
});

test("item list request plan adds paging and null-safe search aliases", () => {
  const plan = buildUpstreamRequestPlan("/api/item/readItemList", {});

  assert.equal(plan.candidateBodies.length >= 3, true);

  const aliasedCandidate = plan.candidateBodies.find(
    (candidate) =>
      candidate.pageNumber === 1 &&
      candidate.pageSize === 10 &&
      candidate.page === 1 &&
      candidate.limit === 10 &&
      candidate.keyword === "" &&
      candidate.searchWord === "" &&
      candidate.itemName === "",
  );
  assert.ok(aliasedCandidate);
});
