import test from "node:test";
import assert from "node:assert/strict";
import { allPages, navigationSections } from "../../frontend/src/config/pageCatalog.ts";
import type { DataPageConfig } from "../../frontend/src/types/index.ts";

function getDataPage(path: string) {
  const page = allPages.find((entry): entry is DataPageConfig => entry.kind === "data" && entry.path === path);
  assert.ok(page, `Expected page ${path} to exist`);
  return page;
}

test("navigation contains all seven top-level sections", () => {
  assert.equal(navigationSections.length, 7);
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
  assert.equal(paths.has("/management/customer"), true);
  assert.equal(paths.has("/remote-operation/meter-setting"), true);
  assert.equal(paths.has("/data-report/interval-data"), true);
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
  assert.equal(meterReadingTaskPage.rowActions?.length ?? 0, 0);
});

test("report pages use PDF-specific filters and columns", () => {
  const consumptionPage = getDataPage("/data-report/consumption-statistics");
  const lowPurchasePage = getDataPage("/data-report/low-purchase");
  const longNonpurchasePage = getDataPage("/data-report/long-nonpurchase");
  const intervalPage = getDataPage("/data-report/interval-data");

  assert.deepEqual(
    consumptionPage.filters.map((filter) => filter.key),
    ["customerId", "meterId", "fromDate", "toDate"],
  );
  assert.deepEqual(
    consumptionPage.columns.map((column) => column.key),
    ["collectionDate", "consumption"],
  );
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
      "tariffId",
      "totalUnit",
      "totalPaid",
      "customerAddress",
    ],
  );
  assert.deepEqual(
    longNonpurchasePage.filters.map((filter) => filter.key),
    ["customerId", "meterId", "nonpurchaseDaysStart", "nonpurchaseDaysEnd"],
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
