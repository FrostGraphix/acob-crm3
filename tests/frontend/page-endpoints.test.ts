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
      if (!swaggerPaths.has(endpoint)) {
        undocumentedEndpoints.push(`${page.path} -> ${endpoint}`);
      }
    }
  }

  assert.deepEqual(undocumentedEndpoints, []);
});
