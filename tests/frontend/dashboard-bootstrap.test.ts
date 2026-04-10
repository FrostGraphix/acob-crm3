import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_BOOTSTRAP_TIMEOUT_MS,
  resolveDashboardFailureState,
  shouldForceDashboardBootstrapFallback,
} from "../../frontend/src/services/dashboard-resilience.ts";

test("bootstrap fallback is not forced before 90 seconds", () => {
  const startedAt = 1000;
  const now = startedAt + DASHBOARD_BOOTSTRAP_TIMEOUT_MS - 1;

  assert.equal(shouldForceDashboardBootstrapFallback(false, startedAt, now), false);
});

test("bootstrap fallback is forced at 90 seconds when no successful dashboard sync exists", () => {
  const startedAt = 1000;
  const now = startedAt + DASHBOARD_BOOTSTRAP_TIMEOUT_MS;

  assert.equal(shouldForceDashboardBootstrapFallback(false, startedAt, now), true);
  assert.equal(shouldForceDashboardBootstrapFallback(true, startedAt, now), false);
});

test("initial failures remain in loading mode before timeout and auto-retry window", () => {
  const startedAt = 1000;
  const beforeTimeout = startedAt + 30_000;
  const failure = resolveDashboardFailureState({
    isBackground: false,
    hasDashboard: false,
    bootstrapStartedAt: startedAt,
    now: beforeTimeout,
  });

  assert.equal(failure.loadState, "initial-loading");
  assert.equal(
    failure.statusMessage,
    "Still attempting live dashboard synchronization with upstream services.",
  );
});

test("initial failures degrade to empty state after timeout window", () => {
  const startedAt = 1000;
  const atTimeout = startedAt + DASHBOARD_BOOTSTRAP_TIMEOUT_MS;
  const failure = resolveDashboardFailureState({
    isBackground: true,
    hasDashboard: false,
    bootstrapStartedAt: startedAt,
    now: atTimeout,
  });

  assert.equal(failure.loadState, "empty");
  assert.match(failure.statusMessage ?? "", /Retrying in the background/);
});

test("background refresh failures after success move to stale mode", () => {
  const failure = resolveDashboardFailureState({
    isBackground: true,
    hasDashboard: true,
    bootstrapStartedAt: 1000,
    now: 2000,
  });

  assert.equal(failure.loadState, "stale");
  assert.equal(
    failure.statusMessage,
    "Showing the last successful dashboard sync while upstream refresh retries.",
  );
});
