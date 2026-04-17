import test from "node:test";
import assert from "node:assert/strict";
import { remotePages } from "../../frontend/src/config/remote-pages.ts";
import { buildMeterReadingChoices } from "../../frontend/src/services/meter-reading-options.ts";

test("remote operation pages declare specialized remote task metadata", () => {
  const createPages = remotePages.filter(
    (page) => page.kind === "data" && page.sectionKey === "remote-operation",
  );

  assert.equal(createPages.length, 5);

  const expectations = new Map([
    ["/remote-operation/meter-reading", { type: "reading", risk: "low", review: false }],
    ["/remote-operation/meter-setting", { type: "setting", risk: "medium", review: true }],
    ["/remote-operation/meter-control", { type: "control", risk: "high", review: true }],
    ["/remote-operation/meter-token", { type: "token", risk: "high", review: true }],
    ["/remote-operation/transparent-forwarding", { type: "transparent-forwarding", risk: "high", review: true }],
  ]);

  for (const page of createPages) {
    const action = page.toolbarActions?.[0];
    const expectation = expectations.get(page.path);
    assert.ok(action, `${page.path} is missing its remote action`);
    assert.ok(expectation, `${page.path} is missing an expectation`);
    assert.equal(action?.remoteTaskType, expectation?.type);
    assert.equal(action?.dangerLevel, expectation?.risk);
    assert.equal(action?.requiresReviewStep ?? false, expectation?.review);
    assert.ok(action?.successRedirectPath);
  }
});

test("remote task monitor pages expose update actions only where upstream supports them", () => {
  const taskPages = remotePages.filter(
    (page) => page.kind === "data" && page.sectionKey === "remote-operation-task",
  );

  const pageByPath = new Map(taskPages.map((page) => [page.path, page]));

  assert.equal(pageByPath.get("/remote-operation-task/meter-reading-task")?.rowActions?.[0]?.endpoint, "/API/RemoteMeterTask/UpdateReadingTask");
  assert.equal(pageByPath.get("/remote-operation-task/meter-setting-task")?.rowActions?.[0]?.endpoint, "/API/RemoteMeterTask/UpdateSettingTask");
  assert.equal(pageByPath.get("/remote-operation-task/meter-control-task")?.rowActions?.[0]?.endpoint, "/API/RemoteMeterTask/UpdateControlTask");
  assert.equal(pageByPath.get("/remote-operation-task/meter-token-task")?.rowActions?.[0]?.endpoint, "/api/token/remote-task/update");
  assert.equal(pageByPath.get("/remote-operation-task/transparent-forwarding-task")?.rowActions, undefined);
});

test("friendly meter reading choices map common catalog labels into a simple dropdown", () => {
  const choices = buildMeterReadingChoices(
    [
      { label: "Forward Active Energy (00010000)", value: "00010000" },
      { label: "Credit Balance", value: "BAL-01" },
      { label: "Voltage Reading (1.0.32.7.0.255)", value: "1.0.32.7.0.255" },
      { label: "Instantaneous Power", value: "1.0.16.7.0.255" },
    ],
    "DLMS",
  );

  assert.deepEqual(
    choices.map((choice) => [choice.key, choice.label, choice.value]),
    [
      ["units", "Units", "00010000"],
      ["balance", "Balance", "BAL-01"],
      ["voltage", "Voltage", "1.0.32.7.0.255"],
      ["current", "Current", "1.0.31.7.0.255"],
      ["power", "Power", "1.0.16.7.0.255"],
    ],
  );
});

test("generic reading choice builder recognizes common item catalog names", () => {
  const choices = buildMeterReadingChoices(
    [
      { label: "Voltage", value: "ITEM-VOLTAGE" },
      { label: "Current", value: "ITEM-CURRENT" },
      { label: "Power", value: "ITEM-POWER" },
      { label: "Relay Status", value: "ITEM-RELAY" },
      { label: "Credit Balance", value: "ITEM-BALANCE" },
    ],
    "2.2",
  );

  assert.deepEqual(
    choices.map((choice) => [choice.key, choice.value]),
    [
      ["units", "Units"],
      ["balance", "ITEM-BALANCE"],
      ["voltage", "ITEM-VOLTAGE"],
      ["current", "ITEM-CURRENT"],
      ["power", "ITEM-POWER"],
      ["relay-status", "ITEM-RELAY"],
    ],
  );
});

test("protocol 2.2 falls back to friendly reading names when the catalog is unavailable", () => {
  const choices = buildMeterReadingChoices([], "2.2");

  assert.deepEqual(
    choices.map((choice) => [choice.key, choice.label, choice.value]),
    [
      ["units", "Units", "Units"],
      ["balance", "Balance", "Balance"],
      ["voltage", "Voltage", "Voltage"],
      ["current", "Current", "Current"],
      ["power", "Power", "Power"],
      ["relay-status", "Relay Status", "Relay Status"],
    ],
  );
});


