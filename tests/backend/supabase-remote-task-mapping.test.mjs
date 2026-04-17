import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const {
  mapRemoteTaskType,
} = await import("../../backend/dist/backend/src/services/supabase-db.js");

test("remote task mapper collapses token and transparent tasks into supported enum values", () => {
  assert.equal(mapRemoteTaskType("credit-token"), "other");
  assert.equal(mapRemoteTaskType("clear-credit-token"), "other");
  assert.equal(mapRemoteTaskType("transparent-forwarding"), "other");
  assert.equal(mapRemoteTaskType("key-change"), "key_change");
});

test("remote task mapper preserves known remote operation families", () => {
  assert.equal(mapRemoteTaskType("reading"), "read_meter");
  assert.equal(mapRemoteTaskType("control"), "valve_control");
  assert.equal(mapRemoteTaskType("setting"), "set_parameter");
  assert.equal(mapRemoteTaskType("set-tariff"), "set_tariff");
  assert.equal(mapRemoteTaskType("clear-alarm"), "clear_alarm");
});
