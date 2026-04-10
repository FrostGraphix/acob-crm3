import assert from "node:assert/strict";
import test from "node:test";
import {
  attemptLazyImportRecovery,
  clearLazyImportRecovery,
  getLazyImportRecoveryKey,
  isRecoverableLazyImportError,
  loadLazyPage,
} from "../../frontend/src/services/lazy-page.ts";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

test("detects recoverable dynamic import failures", () => {
  assert.equal(
    isRecoverableLazyImportError(
      new TypeError(
        "Failed to fetch dynamically imported module: http://localhost:5173/src/pages/DashboardPage.tsx?t=123",
      ),
    ),
    true,
  );
  assert.equal(isRecoverableLazyImportError(new Error("Request failed with status 401")), false);
});

test("recovery only reloads once per page key", () => {
  const storage = createMemoryStorage();
  let reloadCount = 0;

  const firstAttempt = attemptLazyImportRecovery(
    "DashboardPage",
    new Error("Failed to fetch dynamically imported module"),
    {
      storage,
      reload: () => {
        reloadCount += 1;
      },
    },
  );
  const secondAttempt = attemptLazyImportRecovery(
    "DashboardPage",
    new Error("Failed to fetch dynamically imported module"),
    {
      storage,
      reload: () => {
        reloadCount += 1;
      },
    },
  );

  assert.equal(firstAttempt, true);
  assert.equal(secondAttempt, false);
  assert.equal(reloadCount, 1);
  assert.equal(storage.getItem(getLazyImportRecoveryKey("DashboardPage")), "1");
});

test("successful lazy imports clear any prior recovery flag", async () => {
  const storage = createMemoryStorage();
  storage.setItem(getLazyImportRecoveryKey("DashboardPage"), "1");

  const module = await loadLazyPage(
    "DashboardPage",
    async () => ({ DashboardPage: "dashboard-component" }),
    "DashboardPage",
    {
      storage,
      reload: () => {
        throw new Error("reload should not be called for successful imports");
      },
    },
  );

  assert.equal(module.default, "dashboard-component");
  assert.equal(storage.getItem(getLazyImportRecoveryKey("DashboardPage")), null);
});

test("failed lazy imports trigger a single recovery reload and stay pending", async () => {
  const storage = createMemoryStorage();
  let reloadCount = 0;

  const pendingImport = loadLazyPage(
    "DashboardPage",
    async () => {
      throw new Error("Failed to fetch dynamically imported module");
    },
    "DashboardPage",
    {
      storage,
      reload: () => {
        reloadCount += 1;
      },
    },
  );

  const state = await Promise.race([
    pendingImport.then(
      () => "resolved",
      () => "rejected",
    ),
    Promise.resolve("pending"),
  ]);

  assert.equal(state, "pending");
  assert.equal(reloadCount, 1);
  clearLazyImportRecovery("DashboardPage", { storage, reload: null });
  assert.equal(storage.getItem(getLazyImportRecoveryKey("DashboardPage")), null);
});
