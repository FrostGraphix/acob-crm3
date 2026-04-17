import assert from "node:assert/strict";
import test from "node:test";

const CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

function buildToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

const {
  extractUpstreamPermissions,
  hasUpstreamPermission,
} = await import("../../backend/dist/backend/src/services/upstream-permissions.js");

test("extractUpstreamPermissions reads array claims from upstream JWT tokens", () => {
  const token = buildToken({
    [CLAIM]: [
      "RemoteMeterTask.CreateTokenTask",
      "GPRSMeterTask.GPRSCreateTokenTask",
    ],
  });

  assert.deepEqual(extractUpstreamPermissions(token), [
    "RemoteMeterTask.CreateTokenTask",
    "GPRSMeterTask.GPRSCreateTokenTask",
  ]);
});

test("hasUpstreamPermission works with decoded JWT tokens and permission arrays", () => {
  const token = buildToken({
    [CLAIM]: ["RemoteMeterTask.CreateTokenTask"],
  });

  assert.equal(hasUpstreamPermission(token, "RemoteMeterTask.CreateTokenTask"), true);
  assert.equal(hasUpstreamPermission(token, "GPRSMeterTask.GPRSCreateTokenTask"), false);
  assert.equal(
    hasUpstreamPermission(["GPRSMeterTask.GPRSCreateTokenTask"], "gprsmetertask.gprscreatetokentask"),
    true,
  );
});
