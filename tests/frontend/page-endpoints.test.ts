import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allPages } from "../../frontend/src/config/pageCatalog.ts";

function loadSwaggerPaths() {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(testDirectory, "..", "..", "swagger_paths.txt");
  return new Set(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("/")),
  );
}

test("all configured data page endpoints are backed by documented upstream paths", () => {
  const swaggerPaths = loadSwaggerPaths();
  const undocumentedEndpoints: string[] = [];

  for (const page of allPages) {
    if (page.kind !== "data") {
      continue;
    }

    const endpoints = [
      page.readEndpoint,
      ...(page.toolbarActions ?? []).map((action) => action.endpoint),
      ...(page.rowActions ?? []).map((action) => action.endpoint),
      ...(page.bulkActions ?? []).map((action) => action.endpoint),
    ];

    for (const endpoint of endpoints) {
      if (endpoint.startsWith("/api/site-consumption")) {
        continue;
      }

      if (endpoint.startsWith("/api/theft")) {
        continue;
      }

      if (endpoint.startsWith("/api/reports/")) {
        continue;
      }

      if (
        endpoint === "/api/token/remote-send" ||
        endpoint === "/api/token/remote-task/read" ||
        endpoint === "/api/token/remote-task/update"
      ) {
        continue;
      }

      if (
        endpoint === "/api/vendor/onboarding/queue" ||
        endpoint === "/api/vendor/approval/approve" ||
        endpoint === "/api/wallet/funding/pending" ||
        endpoint === "/api/wallet/funding/approve" ||
        endpoint === "/api/wallet/funding/reject" ||
        endpoint === "/api/wallet/finance/kpis" ||
        endpoint === "/api/wallet/commission/rules" ||
        endpoint === "/api/wallet/commission/rules-update" ||
        endpoint === "/api/wallet/settlement/batches" ||
        endpoint === "/api/wallet/settlement/preview" ||
        endpoint === "/api/wallet/settlement/run" ||
        endpoint === "/api/reconciliation/summary" ||
        endpoint === "/api/reconciliation/run" ||
        endpoint === "/api/reconciliation/exceptions" ||
        endpoint === "/api/reconciliation/exceptions/assign" ||
        endpoint === "/api/reconciliation/exceptions/escalate" ||
        endpoint === "/api/reconciliation/exceptions/resolve" ||
        endpoint === "/api/reconciliation/settlement/latest"
      ) {
        continue;
      }

      if (!swaggerPaths.has(endpoint)) {
        undocumentedEndpoints.push(`${page.path} -> ${endpoint}`);
      }
    }
  }

  assert.deepEqual(undocumentedEndpoints, []);
});
