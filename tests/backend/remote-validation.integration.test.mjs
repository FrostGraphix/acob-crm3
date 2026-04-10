import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeRequestBody,
  validateRequestBodyByOperation,
  validateRequestBodyByPathname,
} from "../../backend/dist/backend/src/services/request-validation.js";

test("remote create validation rejects missing target meter and invalid control command", () => {
  const body = sanitizeRequestBody({
    taskType: "control",
    controlCommand: "reboot",
    target: {},
  });

  assert.equal(validateRequestBodyByOperation("task-create", body).valid, true);
  assert.deepEqual(validateRequestBodyByPathname("/API/RemoteMeterTask/CreateControlTask", body), {
    valid: false,
    message: "target.meterId is required",
  });

  const withMeter = sanitizeRequestBody({
    taskType: "control",
    controlCommand: "reboot",
    target: { meterId: "M-1" },
  });

  assert.deepEqual(validateRequestBodyByPathname("/API/RemoteMeterTask/CreateControlTask", withMeter), {
    valid: false,
    message: "controlCommand is invalid",
  });
});

test("remote create validation accepts valid transparent forwarding payload", () => {
  const body = sanitizeRequestBody({
    taskType: "transparent-forwarding",
    protocolMode: "hex",
    commandPayload: "A1B2",
    timeoutSeconds: 30,
    reviewConfirmed: true,
    operatorReason: "Validated raw command for secure diagnostic",
    target: { meterId: "M-2" },
  });

  assert.equal(validateRequestBodyByOperation("task-create", body).valid, true);
  assert.deepEqual(
    validateRequestBodyByPathname("/API/RemoteMeterTask/CreateTransparentForwardingTask", body),
    { valid: true },
  );
});
