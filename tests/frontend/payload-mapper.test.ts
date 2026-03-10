import test from "node:test";
import assert from "node:assert/strict";
import { buildActionPayload, buildReadPayload } from "../../frontend/src/services/payload-mapper.ts";
import type { ActionConfig, DataPageConfig } from "../../frontend/src/types/index.ts";

const basePage: DataPageConfig = {
  kind: "data",
  path: "/test",
  title: "Test",
  menuLabel: "Test",
  description: "Test page",
  sectionKey: "management",
  readEndpoint: "/api/customer/read",
  readOperationKind: "report-read",
  columns: [],
  filters: [],
};

test("read payload mapper rejects invalid report date range", () => {
  const mapped = buildReadPayload(
    basePage,
    { fromDate: "2026-03-10", toDate: "2026-03-01" },
    1,
    20,
  );

  assert.equal(mapped.ok, false);
});

test("action payload mapper validates token generation numbers", () => {
  const action: ActionConfig = {
    key: "generate",
    label: "Generate",
    endpoint: "/api/token/creditToken/generate",
    operationKind: "token-generate",
  };

  const invalid = buildActionPayload(action, {
    row: { meterId: "M-1" },
    values: { amount: "0", unit: "12" },
  });
  assert.equal(invalid.ok, false);

  const valid = buildActionPayload(action, {
    row: { meterId: "M-1" },
    values: { amount: "2500", unit: "120" },
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.payload?.amount, 2500);
});

test("bulk delete requires selected keys", () => {
  const action: ActionConfig = {
    key: "bulk-delete",
    label: "Delete Selected",
    endpoint: "/api/customer/delete",
    operationKind: "bulk-delete",
  };

  const invalid = buildActionPayload(action, { selectedKeys: [] });
  assert.equal(invalid.ok, false);

  const valid = buildActionPayload(action, { selectedKeys: ["C-001"] });
  assert.equal(valid.ok, true);
});
