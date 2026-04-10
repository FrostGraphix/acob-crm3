import assert from "node:assert/strict";
import test from "node:test";
import { buildUpstreamRequestPlan } from "../../backend/dist/backend/src/services/upstream-request-adapters.js";

test("remote reading request plan maps target and reading payload aliases", () => {
  const plan = buildUpstreamRequestPlan("/API/RemoteMeterTask/CreateReadingTask", {
    taskType: "reading",
    taskName: "Read phase energy",
    target: {
      meterId: "M-100",
      customerId: "C-200",
      stationId: "ST-10",
    },
    dataItem: "1.0.1.8.0.255",
    readMode: "single",
  });

  assert.equal(plan.candidateBodies.length, 2);
  assert.equal(plan.body.meterId, "M-100");
  assert.equal(plan.body.dataItem, "1.0.1.8.0.255");
  assert.ok(
    plan.candidateBodies.find(
      (candidate) =>
        candidate.meterNo === "M-100" &&
        candidate.customerNo === "C-200" &&
        candidate.itemCode === "1.0.1.8.0.255",
    ),
  );
});

test("transparent forwarding request plan emits redaction-safe alias body candidates", () => {
  const plan = buildUpstreamRequestPlan("/API/RemoteMeterTask/CreateTransparentForwardingTask", {
    taskType: "transparent-forwarding",
    target: {
      meterId: "M-500",
      customerId: "C-700",
      stationId: "ST-8",
    },
    protocolMode: "ascii",
    commandPayload: "READ",
    timeoutSeconds: 20,
  });

  assert.equal(plan.candidateBodies.length, 2);
  assert.equal(plan.body.commandPayload, "READ");
  assert.ok(
    plan.candidateBodies.find(
      (candidate) =>
        candidate.meterNo === "M-500" &&
        candidate.customerNo === "C-700" &&
        candidate.site === "ST-8" &&
        candidate.payload === "READ" &&
        candidate.timeout === 20,
    ),
  );
});
