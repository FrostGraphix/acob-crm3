import assert from "node:assert/strict";
import test from "node:test";

test.before(() => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
});

test.after(async () => {
  const { deleteRuntimeState } = await import(
    "../../backend/dist/backend/src/services/runtime-state-store.js"
  );

  await deleteRuntimeState("site-consumption");
});

test("site consumption state survives reloads through the runtime state store", async () => {
  const {
    createEmptySiteConsumptionState,
    saveSiteConsumptionState,
  } = await import("../../backend/dist/backend/src/services/site-consumption-store.js");

  const state = createEmptySiteConsumptionState();
  state.snapshot.summary[0].totalConsumption = 42;
  state.lastUpdatedAt = "2026-03-31T00:00:00.000Z";
  state.lastAttemptAt = "2026-03-31T00:00:00.000Z";
  state.lastError = null;
  state.refreshing = false;

  await saveSiteConsumptionState(state);

  const { siteConsumptionEngine } = await import(
    `../../backend/dist/backend/src/services/site-consumption-engine.js?reload=${Date.now()}`
  );

  const snapshot = siteConsumptionEngine.getSnapshot();
  const status = siteConsumptionEngine.getStatus();

  assert.equal(snapshot.summary.find((item) => item.site === "Musha")?.totalConsumption, 42);
  assert.equal(status.lastUpdatedAt, "2026-03-31T00:00:00.000Z");
  assert.equal(status.lastError, null);
});
