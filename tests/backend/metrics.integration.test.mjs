import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

let server;
let baseUrl;

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
  process.env.UPSTREAM_API_URL = "http://127.0.0.1:1";

  const { createApp } = await import("../../backend/dist/backend/src/app.js");
  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    server.close();
    await once(server, "close");
  }
});

test("health and metrics endpoints expose runtime snapshot", async () => {
  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  const healthPayload = await healthResponse.json();
  assert.equal(healthPayload.status, "ok");
  assert.equal(healthPayload.runtime.service, "acob-crm3-backend");
  assert.equal(healthPayload.runtime.sessionStoreMode, "memory");
  assert.equal(typeof healthPayload.runtime.backgroundServices.analysisEngine.enabled, "boolean");

  const metricsResponse = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsResponse.status, 200);
  const metricsPayload = await metricsResponse.json();

  assert.equal(metricsPayload.service, "acob-crm3-backend");
  assert.ok(metricsPayload.requests.total >= 1);
  assert.equal(typeof metricsPayload.requests.averageDurationMs, "number");
  assert.ok(metricsPayload.requests.statusCounts["200"] >= 1);
  assert.ok(Array.isArray(metricsPayload.requests.topEndpoints));
  assert.equal(typeof metricsPayload.process.rssBytes, "number");
});

test("dependency health endpoint reports degraded when upstream is unreachable", async () => {
  const response = await fetch(`${baseUrl}/health/dependencies`);
  assert.equal(response.status, 503);

  const payload = await response.json();
  assert.equal(payload.status, "degraded");
  assert.equal(payload.runtime.service, "acob-crm3-backend");
  assert.equal(payload.dependencies.sessionStore.ok, true);
  assert.equal(payload.dependencies.sessionStore.mode, "memory");
  assert.equal(payload.dependencies.upstream.ok, false);
});
