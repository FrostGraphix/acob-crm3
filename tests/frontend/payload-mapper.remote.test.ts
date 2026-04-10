import test from "node:test";
import assert from "node:assert/strict";
import { buildActionPayload } from "../../frontend/src/services/payload-mapper.ts";
import type { ActionConfig } from "../../frontend/src/types/index.ts";

function createRemoteAction(
  key: NonNullable<ActionConfig["payloadBuilderKey"]>,
  remoteTaskType: NonNullable<ActionConfig["remoteTaskType"]>,
): ActionConfig {
  return {
    key,
    label: `Remote ${key}`,
    endpoint: "/API/RemoteMeterTask/CreateTask",
    operationKind: "task-create",
    payloadBuilderKey: key,
    remoteTaskType,
  };
}

const row = {
  meterId: "M-100",
  customerId: "C-200",
  customerName: "Jane Doe",
  stationId: "ST-10",
};

test("reading task payload requires a selected target and data item", () => {
  const action = createRemoteAction("reading", "reading");

  const missingTarget = buildActionPayload(action, {
    values: { dataItem: "1.0.1.8.0.255" },
  });
  assert.equal(missingTarget.ok, false);

  const missingDataItem = buildActionPayload(action, {
    row,
    values: {},
  });
  assert.equal(missingDataItem.ok, false);

  const valid = buildActionPayload(action, {
    row,
    values: { dataItem: "1.0.1.8.0.255", readMode: "single" },
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.payload?.taskType, "reading");
  assert.deepEqual(
    {
      meterId: valid.payload?.target?.meterId,
      customerId: valid.payload?.target?.customerId,
      customerName: valid.payload?.target?.customerName,
      stationId: valid.payload?.target?.stationId,
    },
    {
      meterId: row.meterId,
      customerId: row.customerId,
      customerName: row.customerName,
      stationId: row.stationId,
    },
  );
});

test("control task payload rejects invalid commands", () => {
  const action = createRemoteAction("control", "control");

  const invalid = buildActionPayload(action, {
    row,
    values: { controlCommand: "reboot", operatorReason: "Investigating abnormal operation", reviewConfirmed: "true" },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.message, "Control Command is invalid");

  const valid = buildActionPayload(action, {
    row,
    values: {
      controlCommand: "disconnect",
      reason: "Debt recovery",
      operatorReason: "Debt control action with supervisor approval",
      reviewConfirmed: "true",
    },
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.payload?.controlCommand, "disconnect");
});

test("transparent forwarding task payload validates protocol and timeout", () => {
  const action = createRemoteAction("transparent-forwarding", "transparent-forwarding");

  const missingPayload = buildActionPayload(action, {
    row,
    values: {
      protocolMode: "hex",
      operatorReason: "Raw diagnostic command for meter verification",
      reviewConfirmed: "true",
    },
  });
  assert.equal(missingPayload.ok, false);
  assert.equal(missingPayload.message, "Command Payload is required");

  const invalidTimeout = buildActionPayload(action, {
    row,
    values: {
      protocolMode: "hex",
      commandPayload: "A1B2",
      timeoutSeconds: "0",
      operatorReason: "Raw diagnostic command for meter verification",
      reviewConfirmed: "true",
    },
  });
  assert.equal(invalidTimeout.ok, false);
  assert.equal(invalidTimeout.message, "Timeout (Seconds) must be between 1 and 300");

  const valid = buildActionPayload(action, {
    row,
    values: {
      protocolMode: "ascii",
      commandPayload: "READ",
      timeoutSeconds: "15",
      operatorReason: "Raw diagnostic command for meter verification",
      reviewConfirmed: "true",
    },
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.payload?.protocolMode, "ascii");
  assert.equal(valid.payload?.timeoutSeconds, 15);
});
