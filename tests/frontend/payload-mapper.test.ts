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
  const page: DataPageConfig = {
    ...basePage,
    filters: [
      { key: "fromDate", label: "From Date", placeholder: "From date", type: "date" },
      { key: "toDate", label: "To Date", placeholder: "To date", type: "date" },
    ],
  };

  const mapped = buildReadPayload(
    page,
    { fromDate: "2026-03-10", toDate: "2026-03-01" },
    1,
    20,
  );

  assert.equal(mapped.ok, false);
});

test("read payload mapper omits empty filters and coerces numeric filters", () => {
  const page: DataPageConfig = {
    ...basePage,
    filters: [
      { key: "customerId", label: "Customer Id", placeholder: "Customer id", type: "text" },
      { key: "meterId", label: "Meter Id", placeholder: "Meter id", type: "text" },
      { key: "lowLimit", label: "Low Limit", placeholder: "Low limit", type: "number" },
    ],
  };

  const mapped = buildReadPayload(
    page,
    { customerId: "", meterId: " M-100 ", lowLimit: "25" },
    2,
    50,
  );

  assert.equal(mapped.ok, true);
  assert.deepEqual(mapped.payload, {
    meterId: "M-100",
    lowLimit: 25,
    pageNumber: 2,
    pageSize: 50,
  });
});

test("read payload mapper rejects invalid numeric report filters", () => {
  const page: DataPageConfig = {
    ...basePage,
    filters: [
      { key: "lowLimit", label: "Low Limit", placeholder: "Low limit", type: "number" },
    ],
  };

  const mapped = buildReadPayload(
    page,
    { lowLimit: "abc" },
    1,
    20,
  );

  assert.equal(mapped.ok, false);
  assert.equal(mapped.message, "Low Limit must be a valid number");
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

test("management create preserves all filled form fields", () => {
  const action: ActionConfig = {
    key: "add",
    label: "Add Customer",
    endpoint: "/api/customer/create",
    operationKind: "management-create",
  };

  const result = buildActionPayload(action, {
    values: {
      id: "C-001",
      name: "Jane Doe",
      phone: "08000000000",
      address: "Lagos",
      remark: "",
      stationId: "STATION-001",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    id: "C-001",
    name: "Jane Doe",
    phone: "08000000000",
    address: "Lagos",
    stationId: "STATION-001",
  });
});

test("management update includes row and edited fields", () => {
  const action: ActionConfig = {
    key: "edit",
    label: "Edit Customer",
    endpoint: "/api/customer/update",
    operationKind: "management-update",
  };

  const row = {
    id: "C-001",
    name: "Jane Doe",
    phone: "08000000000",
  };

  const result = buildActionPayload(action, {
    row,
    values: {
      id: "C-001",
      name: "Jane Doe Updated",
      phone: "08011111111",
      address: "Abuja",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    id: "C-001",
    name: "Jane Doe Updated",
    phone: "08011111111",
    address: "Abuja",
    row,
  });
});

test("management import parses CSV rows into create payload records", () => {
  const action: ActionConfig = {
    key: "import",
    label: "Import Customers",
    endpoint: "/api/customer/create",
    operationKind: "management-import",
  };

  const result = buildActionPayload(action, {
    values: {
      importData: "id,name,phone\nC-001,Jane Doe,08000000000\nC-002,John Doe,09000000000",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    records: [
      {
        id: "C-001",
        name: "Jane Doe",
        phone: "08000000000",
      },
      {
        id: "C-002",
        name: "John Doe",
        phone: "09000000000",
      },
    ],
  });
});

test("management import parses JSON arrays into create payload records", () => {
  const action: ActionConfig = {
    key: "import",
    label: "Import Tariffs",
    endpoint: "/api/tariff/create",
    operationKind: "management-import",
  };

  const result = buildActionPayload(action, {
    values: {
      importData: JSON.stringify([
        { id: "RES", name: "Residential", price: 350 },
        { id: "COM", name: "Commercial", price: 450 },
      ]),
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    records: [
      { id: "RES", name: "Residential", price: 350 },
      { id: "COM", name: "Commercial", price: 450 },
    ],
  });
});
