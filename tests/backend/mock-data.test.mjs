import test from "node:test";
import assert from "node:assert/strict";
import { mockApiResponse, resetMockState } from "../../backend/dist/backend/src/services/mock-data.js";

test("mock data supports create and delete flow for customer records", () => {
  resetMockState();

  const initialRead = mockApiResponse("/api/customer/read", {
    pageNumber: 1,
    pageSize: 20,
  });
  const initialTotal = initialRead.result.total;

  const createResult = mockApiResponse("/api/customer/create", {
    name: "Integration Test Customer",
    remark: "Created in test",
  });
  assert.equal(createResult.result.success, true);

  const afterCreate = mockApiResponse("/api/customer/read", {
    pageNumber: 1,
    pageSize: 20,
  });
  assert.equal(afterCreate.result.total, initialTotal + 1);

  const createdRow = afterCreate.result.rows[0];
  assert.ok(createdRow.id);

  const deleteResult = mockApiResponse("/api/customer/delete", {
    selectedKeys: [createdRow.id],
  });
  assert.equal(deleteResult.result.success, true);

  const afterDelete = mockApiResponse("/api/customer/read", {
    pageNumber: 1,
    pageSize: 20,
  });
  assert.equal(afterDelete.result.total, initialTotal);
});

test("token generation appends records", () => {
  resetMockState();

  const before = mockApiResponse("/api/token/creditTokenRecord/read", {
    pageNumber: 1,
    pageSize: 20,
  });
  const beforeTotal = before.result.total;

  const generateResult = mockApiResponse("/api/token/creditToken/generate", {
    row: {
      customerId: "CUSTOMER-1000",
      customerName: "Token Test User",
      meterId: "METER-1000",
      tariffId: "TARIFF-001",
      stationId: "STATION-001",
    },
    amount: "2500",
    unit: "140",
  });
  assert.equal(generateResult.result.success, true);

  const after = mockApiResponse("/api/token/creditTokenRecord/read", {
    pageNumber: 1,
    pageSize: 20,
  });
  assert.equal(after.result.total, beforeTotal + 1);
});
