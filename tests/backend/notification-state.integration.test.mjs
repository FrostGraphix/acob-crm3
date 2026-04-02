import assert from "node:assert/strict";
import test from "node:test";

test.before(() => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
});

test.after(async () => {
  const { deleteRuntimeState } = await import(
    "../../backend/dist/backend/src/services/runtime-state-store.js"
  );

  await deleteRuntimeState("analysis");
});

test("analysis state survives reload and dismissals persist", async () => {
  const { saveRuntimeState } = await import(
    "../../backend/dist/backend/src/services/runtime-state-store.js"
  );

  await saveRuntimeState("analysis", {
    notifications: [
      {
        id: "notification-1",
        type: "warning",
        title: "Low Balance Alert",
        message: "Meter M-001 is low.",
        timestamp: "2026-03-31T00:00:00.000Z",
        read: false,
        meterId: "M-001",
      },
      {
        id: "notification-2",
        type: "info",
        title: "Info",
        message: "Already read item.",
        timestamp: "2026-03-31T01:00:00.000Z",
        read: true,
      },
    ],
    knownAlerts: ["low-balance:M-001:2026-03-31"],
    savedAt: "2026-03-31T01:00:00.000Z",
  });

  const cacheBust = `?t=${Date.now()}`;
  const { analysisEngine } = await import(
    `../../backend/dist/backend/src/services/analysis-engine.js${cacheBust}`
  );

  assert.equal(analysisEngine.getUnreadNotifications().length, 1);

  const dismissed = analysisEngine.dismissNotifications(["notification-1"]);
  assert.equal(dismissed, 1);

  const reloaded = await import(
    `../../backend/dist/backend/src/services/analysis-engine.js?t=${Date.now() + 1}`
  );
  assert.equal(reloaded.analysisEngine.getUnreadNotifications().length, 0);
});
