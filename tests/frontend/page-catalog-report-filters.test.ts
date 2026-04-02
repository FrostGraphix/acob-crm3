import test from "node:test";
import assert from "node:assert/strict";
import { pagesByPath } from "../../frontend/src/config/pageCatalog.ts";
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
