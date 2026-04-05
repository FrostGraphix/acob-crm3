import test from "node:test";
import assert from "node:assert/strict";
import { pagesByPath } from "../../frontend/src/config/pageCatalog.ts";
import { createInitialFilters } from "../../frontend/src/services/filter-defaults.ts";
import type { DataPageConfig } from "../../frontend/src/types/index.ts";

function getDataPage(path: string) {
  const page = pagesByPath[path];
  assert.ok(page && page.kind === "data");
  return page as DataPageConfig;
}

test("low purchase report requires a complete date range and sends report-friendly dates", () => {
  const page = getDataPage("/data-report/low-purchase");

  assert.deepEqual(page.requiredReadFilters, ["fromDate", "toDate"]);
  assert.equal(page.omitReadPaging, true);
  assert.equal(page.requestDateFormat, "day-first");
});

test("consumption statistics report requires a complete date range and sends report-friendly dates", () => {
  const page = getDataPage("/data-report/consumption-statistics");

  assert.deepEqual(page.requiredReadFilters, ["fromDate", "toDate"]);
  assert.equal(page.omitReadPaging, true);
  assert.equal(page.requestDateFormat, "day-first");
});

test("date-filtered pages default from January 1, 2025 through the current day", () => {
  const lowPurchasePage = getDataPage("/data-report/low-purchase");
  const eventPage = getDataPage("/event-notification");
  const referenceDate = new Date("2026-04-02T09:00:00Z");

  assert.deepEqual(createInitialFilters(lowPurchasePage, referenceDate), {
    customerId: "",
    meterId: "",
    fromDate: "2025-01-01",
    toDate: "2026-04-02",
    lowLimit: "",
  });

  assert.deepEqual(createInitialFilters(eventPage, referenceDate), {
    searchTerm: "",
    fromDate: "2025-01-01",
    toDate: "2026-04-02",
  });
});
