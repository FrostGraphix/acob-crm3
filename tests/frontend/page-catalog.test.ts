import test from "node:test";
import assert from "node:assert/strict";
import { allPages, navigationSections } from "../../frontend/src/config/pageCatalog.ts";
import type { DataPageConfig } from "../../frontend/src/types/index.ts";

function getDataPage(path: string) {
  const page = allPages.find((entry): entry is DataPageConfig => entry.kind === "data" && entry.path === path);
  assert.ok(page, `Expected page ${path} to exist`);
  return page;
}

test("navigation contains the expanded top-level sections", () => {
  assert.equal(navigationSections.length >= 7, true);
  assert.equal(navigationSections.some((section) => section.key === "dashboard"), true);
  assert.equal(navigationSections.some((section) => section.key === "data-report"), true);
  assert.equal(navigationSections.some((section) => section.key === "management"), true);
  assert.equal(navigationSections.some((section) => section.key === "runtime-ops"), true);
});

test("all pages are assigned to a navigation section", () => {
  const pagePaths = new Set(
    allPages
      .filter((page) => page.includeInNavigation !== false)
      .map((page) => page.path),
  );
  const sectionPaths = new Set(
    navigationSections.flatMap((section) => section.items.map((item) => item.path)),
  );

  assert.deepEqual(sectionPaths, pagePaths);
});

test("profile page exists but stays hidden from sidebar navigation", () => {
  const profilePage = allPages.find((page) => page.path === "/profile");
  assert.ok(profilePage);
  assert.equal(profilePage.includeInNavigation, false);

  const navigationPaths = new Set(
    navigationSections.flatMap((section) => section.items.map((item) => item.path)),
  );
  assert.equal(navigationPaths.has("/profile"), false);
});

test("critical pages exist in catalog", () => {
  const paths = new Set(allPages.map((page) => page.path));

  assert.equal(paths.has("/dashboard"), true);
  assert.equal(paths.has("/token-generate/credit-token"), true);
  assert.equal(paths.has("/management/analytics"), true);
  assert.equal(paths.has("/management/customer"), true);
  assert.equal(paths.has("/remote-operation/meter-reading"), true);
  assert.equal(paths.has("/data-report/interval-data"), true);
  assert.equal(paths.has("/data-report/site-consumption"), true);
  assert.equal(paths.has("/data-report/theft-signals"), true);
  assert.equal(paths.has("/data-report/theft-cases"), true);
  assert.equal(paths.has("/system/runtime"), true);
});

test("token generate pages match PDF action labels and quota visibility", () => {
  const creditTokenPage = getDataPage("/token-generate/credit-token");
  const clearTamperPage = getDataPage("/token-generate/clear-tamper-token");
  const clearCreditPage = getDataPage("/token-generate/clear-credit-token");
  const maximumPowerPage = getDataPage("/token-generate/set-max-power-limit-token");

  assert.equal(creditTokenPage.showQuota, true);
  assert.equal(creditTokenPage.rowActions?.[0]?.label, "Recharge");
  assert.equal(clearTamperPage.showQuota, false);
  assert.equal(clearTamperPage.rowActions?.[0]?.label, "Generate Token");
  assert.equal(clearCreditPage.rowActions?.[0]?.label, "Generate Token");
  assert.equal(maximumPowerPage.rowActions?.[0]?.label, "Generate Token");
});

test("management pages expose import/export and mapped customer/tariff/gateway columns", () => {
  const customerPage = getDataPage("/management/customer");
  const tariffPage = getDataPage("/management/tariff");
  const gatewayPage = getDataPage("/management/gateway");
  const itemPage = getDataPage("/management/item");

  assert.deepEqual(
    customerPage.columns.map((column) => column.key),
    [
      "id",
      "name",
      "phone",
      "address",
      "certifiName",
      "certifiNo",
      "remark",
      "createTime",
      "updateTime",
      "stationId",
    ],
  );
  assert.deepEqual(
    tariffPage.columns.map((column) => column.key),
    ["id", "name", "price", "remark", "createTime", "updateTime"],
  );
  assert.deepEqual(
    gatewayPage.columns.map((column) => column.key),
    ["status", "successRate", "id", "name"],
  );
  assert.equal(customerPage.toolbarActions?.some((action) => action.label === "Import"), true);
  assert.equal(customerPage.toolbarActions?.some((action) => action.label === "Export"), true);
  assert.equal(tariffPage.toolbarActions?.some((action) => action.label === "Import"), true);
  assert.equal(tariffPage.toolbarActions?.some((action) => action.label === "Export"), true);
  assert.equal(gatewayPage.toolbarActions?.some((action) => action.label === "Import"), true);
  assert.equal(gatewayPage.toolbarActions?.some((action) => action.label === "Export"), true);
  assert.equal(itemPage.readEndpoint, "/api/item/readItemList");
  assert.deepEqual(
    itemPage.toolbarActions?.map((action) => action.endpoint),
    ["/api/item/create", "/api/item/import", "/api/item/readItemList"],
  );
  assert.deepEqual(
    itemPage.rowActions?.map((action) => action.endpoint),
    ["/api/item/update", "/api/item/delete"],
  );
  assert.deepEqual(
    itemPage.bulkActions?.map((action) => action.endpoint),
    ["/api/item/delete"],
  );
});

test("token record, interval, and task pages expose mapped columns and client actions", () => {
  const creditRecordPage = getDataPage("/token-record/credit-token-record");
  const clearCreditRecordPage = getDataPage("/token-record/clear-credit-record");
  const intervalPage = getDataPage("/data-report/interval-data");
  const meterReadingTaskPage = getDataPage("/remote-operation-task/meter-reading-task");

  assert.equal(creditRecordPage.columns.some((column) => column.key === "createId"), true);
  assert.deepEqual(
    clearCreditRecordPage.columns.map((column) => column.key),
    [
      "receiptId",
      "customerId",
      "customerName",
      "meterId",
      "tokenRecharge",
      "createTime",
      "stationId",
    ],
  );
  assert.deepEqual(
    intervalPage.columns.map((column) => column.key),
    [
      "meterId",
      "gatewayId",
      "collectionDate",
      "customerId",
      "customerName",
      "sectionId",
      "totalEnergy",
      "lastHourUsage",
      "creditBalance",
      "maximumDemand",
      "power",
      "relayStatus",
      "energyStatus",
      "magneticStatus",
      "terminalCover",
      "upperOpen",
      "currentReverse",
      "currentUnbalance",
      "updateTime",
    ],
  );
  assert.deepEqual(
    meterReadingTaskPage.columns.map((column) => column.key),
    [
      "customerId",
      "customerName",
      "meterId",
      "dataItem",
      "stationId",
      "dataValue",
      "status",
      "createTime",
      "updateTime",
    ],
  );
  assert.equal(intervalPage.rowActions?.some((action) => action.label === "Hourly"), true);
  assert.equal(creditRecordPage.toolbarActions?.some((action) => action.label === "Export"), true);
  assert.equal(creditRecordPage.rowActions?.some((action) => action.label === "Print"), true);
  assert.equal(creditRecordPage.rowActions?.some((action) => action.label === "Cancel"), true);
  assert.equal(clearCreditRecordPage.rowActions?.some((action) => action.label === "Print"), true);
  assert.equal(meterReadingTaskPage.toolbarActions?.some((action) => action.label === "Export"), true);
  assert.deepEqual(
    meterReadingTaskPage.rowActions?.map((action) => action.label),
    ["Retry"],
  );
});

test("report pages use PDF-specific filters and columns", () => {
  const siteConsumptionPage = getDataPage("/data-report/site-consumption");
  const theftSignalsPage = getDataPage("/data-report/theft-signals");
  const theftCasesPage = getDataPage("/data-report/theft-cases");
  const consumptionPage = getDataPage("/data-report/consumption-statistics");
  const lowPurchasePage = getDataPage("/data-report/low-purchase");
  const longNonpurchasePage = getDataPage("/data-report/long-nonpurchase");
  const intervalPage = getDataPage("/data-report/interval-data");
  const dailyLoadProfilePage = getDataPage("/load-profile/daily-data");
  const monthlyLoadProfilePage = getDataPage("/load-profile/monthly-data");

  assert.equal(siteConsumptionPage.reportDisplayMode, "analytics");
  assert.equal(siteConsumptionPage.reportAnalyticsKey, "site-consumption");
  assert.deepEqual(
    siteConsumptionPage.filters.map((filter) => filter.key),
    ["fromDate", "toDate", "granularity", "sites", "compareMode"],
  );
  assert.deepEqual(
    siteConsumptionPage.columns.map((column) => column.key),
    ["periodLabel", "site", "consumption", "unitLabel"],
  );
  assert.equal(consumptionPage.reportDisplayMode, "analytics");
  assert.equal(consumptionPage.reportAnalyticsKey, "consumption-statistics");
  assert.deepEqual(
    theftSignalsPage.columns.map((column) => column.key),
    ["meterId", "customerName", "severity", "score", "signalTypes", "title", "status", "updatedAt"],
  );
  assert.deepEqual(
    theftCasesPage.columns.map((column) => column.key),
    ["id", "meterId", "customerName", "severity", "score", "status", "owner", "updatedAt", "notes"],
  );
  assert.deepEqual(
    consumptionPage.filters.map((filter) => filter.key),
    ["customerId", "meterId", "fromDate", "toDate"],
  );
  assert.deepEqual(
    consumptionPage.columns.map((column) => column.key),
    ["periodLabel", "customerId", "customerName", "meterId", "consumption", "totalEnergy"],
  );
  assert.equal(longNonpurchasePage.readEndpoint, "/api/reports/non-purchase");
  assert.equal(longNonpurchasePage.readMethod, "GET");
  assert.equal(lowPurchasePage.readEndpoint, "/api/reports/low-purchase");
  assert.equal(lowPurchasePage.readMethod, "GET");
  assert.equal(consumptionPage.readEndpoint, "/api/reports/consumption");
  assert.equal(consumptionPage.readMethod, "GET");
  assert.equal(dailyLoadProfilePage.readEndpoint, "/api/reports/daily-amr");
  assert.equal(dailyLoadProfilePage.readMethod, "GET");
  assert.equal(monthlyLoadProfilePage.readEndpoint, "/api/reports/monthly-amr");
  assert.equal(monthlyLoadProfilePage.readMethod, "GET");
  assert.deepEqual(
    lowPurchasePage.filters.map((filter) => filter.key),
    ["customerId", "meterId", "fromDate", "toDate", "lowLimit"],
  );
  assert.deepEqual(
    lowPurchasePage.columns.map((column) => column.key),
    [
      "customerId",
      "customerName",
      "meterId",
      "tariff",
      "totalUnit",
      "totalPaid",
      "remainingBalance",
      "customerAddress",
    ],
  );
  assert.deepEqual(
    longNonpurchasePage.filters.map((filter) => filter.key),
    ["customerId", "meterId", "fromDate", "toDate", "nonpurchaseDaysStart", "nonpurchaseDaysEnd"],
  );
  assert.deepEqual(
    longNonpurchasePage.columns.map((column) => column.key),
    ["customerId", "customerName", "meterId", "tariff"],
  );
  assert.deepEqual(
    intervalPage.columns.map((column) => column.key),
    [
      "meterId",
      "gatewayId",
      "collectionDate",
      "customerId",
      "customerName",
      "sectionId",
      "totalEnergy",
      "lastHourUsage",
      "creditBalance",
      "maximumDemand",
      "power",
      "relayStatus",
      "energyStatus",
      "magneticStatus",
      "terminalCover",
      "upperOpen",
      "currentReverse",
      "currentUnbalance",
      "updateTime",
    ],
  );
  assert.deepEqual(dailyLoadProfilePage.meterDrilldown, {
    primaryEndpoint: "/API/LoadProfile/DailyData",
    fallbackEndpoint: "/api/DailyDataMeter/readHourly",
    refreshMs: 30_000,
  });
  assert.deepEqual(monthlyLoadProfilePage.meterDrilldown, {
    primaryEndpoint: "/API/LoadProfile/MonthlyData",
    fallbackEndpoint: "/api/DailyDataMeter/readMonthly",
    refreshMs: 30_000,
  });
});

test("removed modules are no longer present in the catalog", () => {
  const paths = new Set(allPages.map((page) => page.path));

  assert.equal(paths.has("/management/storage"), false);
  assert.equal(paths.has("/management/station"), false);
  assert.equal(paths.has("/management/role"), false);
  assert.equal(paths.has("/management/user"), false);
  assert.equal(paths.has("/data-report/daily-data"), false);
  assert.equal(paths.has("/data-report/gprs-online-status"), false);
  assert.equal(paths.has("/remote-operation/gprs-meter-reading"), false);
  assert.equal(paths.has("/remote-operation/gprs-meter-setting"), false);
  assert.equal(paths.has("/remote-operation/gprs-meter-control"), false);
  assert.equal(paths.has("/remote-operation/gprs-meter-token"), false);
  assert.equal(paths.has("/remote-operation-task/gprs-meter-reading-task"), false);
  assert.equal(paths.has("/remote-operation-task/gprs-meter-setting-task"), false);
  assert.equal(paths.has("/remote-operation-task/gprs-meter-control-task"), false);
  assert.equal(paths.has("/remote-operation-task/gprs-meter-token-task"), false);
  assert.equal(paths.has("/remote-operation-task/firmware-update-task"), false);
});
