import test from "node:test";
import assert from "node:assert/strict";
import { remotePages } from "../../frontend/src/config/remote-pages.ts";
import {
  buildRemoteTokenConfirmationLines,
  buildRemoteTokenReceipt,
  buildRemoteTokenSendPayload,
  createDefaultRemoteTokenForm,
} from "../../frontend/src/services/remote-token-flow.ts";
import { buildRechargeQuote } from "../../frontend/src/services/token-generate-flow.ts";

const selectedMeter = {
  meterId: "47005367801",
  customerId: "47005367801",
  customerName: "Abubakar Yakubu",
  stationId: "UMAISHA",
  tariffId: "LIFELINE",
};

test("meter token page is wired to the dedicated remote send endpoint", () => {
  const page = remotePages.find((entry) => entry.path === "/remote-operation/meter-token");
  const action = page?.toolbarActions?.[0];

  assert.equal(action?.endpoint, "/api/token/remote-send");
  assert.equal(action?.remoteTaskType, "token");
});

test("remote token smoke flow builds a send-credit payload from a selected meter", () => {
  const form = createDefaultRemoteTokenForm();
  form.operation = "send-credit";
  form.loadMode = "naira";
  form.amount = "5000";

  const result = buildRemoteTokenSendPayload(selectedMeter, form);

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    row: selectedMeter,
    operation: "send-credit",
    loadMode: "naira",
    amount: 5000,
  });
});

test("remote token smoke flow builds a clear-credit payload without an amount", () => {
  const form = createDefaultRemoteTokenForm();
  form.operation = "clear-credit";

  const result = buildRemoteTokenSendPayload(selectedMeter, form);

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    row: selectedMeter,
    operation: "clear-credit",
  });
});

test("remote token confirmation summary mirrors the row-click UX", () => {
  const form = createDefaultRemoteTokenForm();
  form.operation = "send-credit";
  form.loadMode = "unit";
  form.amount = "42";

  const lines = buildRemoteTokenConfirmationLines(selectedMeter, form);

  assert.deepEqual(lines, [
    "Target meter: 47005367801 (Abubakar Yakubu)",
    "Station: UMAISHA",
    "Operation: Send credit token",
    "Load by: Unit",
    "Entered value: 42 units",
    "Delivery: Generate token and push remotely",
  ]);
});

test("remote token confirmation summary shows translated quote details", () => {
  const form = createDefaultRemoteTokenForm();
  form.operation = "send-credit";
  form.loadMode = "naira";
  form.amount = "5000";

  const lines = buildRemoteTokenConfirmationLines(selectedMeter, form, {
    quote: buildRechargeQuote("naira", 5000, 250),
    tariffRate: 250,
  });

  assert.deepEqual(lines, [
    "Target meter: 47005367801 (Abubakar Yakubu)",
    "Station: UMAISHA",
    "Operation: Send credit token",
    "Load by: Naira",
    "Entered value: NGN 5000",
    "Translated units: 20 units",
    "Translated amount: ₦5,000",
    "Tariff rate: ₦250/unit",
    "Delivery: Generate token and push remotely",
  ]);
});

test("remote token success response builds a receipt for the success modal", () => {
  const form = createDefaultRemoteTokenForm();
  form.operation = "send-credit";
  form.loadMode = "naira";
  form.amount = "5000";

  const receipt = buildRemoteTokenReceipt(
    {
      success: true,
      message: "Remote token sent to meter 47005367801.",
      details: {
        receiptNumber: "RMT-47005367801-123",
        meterId: "47005367801",
        customerId: "47005367801",
        customerName: "Abubakar Yakubu",
        stationId: "UMAISHA",
        operation: "send-credit",
        loadMode: "naira",
        resolvedAmount: 5000,
        resolvedUnit: 20,
        tokenValue: "12345678901234567890",
        remoteSendRef: "TASK-1001",
        processedAt: "2026-04-15T10:20:00.000Z",
        pricingSource: "tariff-read",
      },
    },
    selectedMeter,
    form,
  );

  assert.deepEqual(receipt, {
    receiptNumber: "RMT-47005367801-123",
    customerId: "47005367801",
    customerName: "Abubakar Yakubu",
    meterId: "47005367801",
    stationId: "UMAISHA",
    operation: "send-credit",
    loadMode: "naira",
    amountNaira: 5000,
    units: 20,
    tokenValue: "12345678901234567890",
    remoteSendRef: "TASK-1001",
    processedAt: "2026-04-15T10:20:00.000Z",
    pricingSource: "tariff-read",
    message: "Remote token sent to meter 47005367801.",
    status: "success",
    deliveryPath: null,
    deliveryMode: null,
  });
});
