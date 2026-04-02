import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import jwt from "../../backend/node_modules/jsonwebtoken/index.js";

let server;
let baseUrl;

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
  process.env.ENABLE_ANALYSIS_ENGINE = "false";
  process.env.ENABLE_SITE_CONSUMPTION_ENGINE = "false";
  process.env.UPSTREAM_PASSWORD = "";

  const { createApp } = await import("../../backend/dist/backend/src/app.js");
  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve runtime admin test server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    server.close();
    await once(server, "close");
  }
});

async function createAdminCookieHeader() {
  const { env } = await import("../../backend/dist/backend/src/services/env.js");
  const { createSession } = await import("../../backend/dist/backend/src/services/session-store.js");
  const { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } = await import(
    "../../backend/dist/backend/src/services/auth-cookie.js"
  );

  const sessionId = "runtime-admin-session";
  const csrfToken = "runtime-admin-csrf";
  await createSession(sessionId, { csrfToken });

  const token = jwt.sign(
    {
      user: {
        username: "admin",
        displayName: "ACOB Admin",
        role: "Administrator",
      },
      sessionId,
      issuedAt: Date.now(),
    },
    env.jwtSecret,
  );

  return {
    cookie: `${SESSION_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
    csrfToken,
  };
}

test("runtime engine admin endpoints expose engine status and allow local scheduler control", async () => {
  const auth = await createAdminCookieHeader();

  const statusResponse = await fetch(`${baseUrl}/api/runtime/engines`, {
    headers: {
      cookie: auth.cookie,
    },
  });

  assert.equal(statusResponse.status, 200);
  const statusPayload = await statusResponse.json();
  assert.equal(statusPayload.result.engines.analysis.name, "analysis-engine");
  assert.equal(statusPayload.result.engines.siteConsumption.name, "site-consumption-engine");

  const startResponse = await fetch(`${baseUrl}/api/runtime/engines/analysis/start`, {
    method: "POST",
    headers: {
      cookie: auth.cookie,
      "content-type": "application/json",
      "x-csrf-token": auth.csrfToken,
    },
    body: JSON.stringify({}),
  });

  assert.equal(startResponse.status, 200);
  const startPayload = await startResponse.json();
  assert.equal(startPayload.result.status.schedulerRunning, true);

  const stopResponse = await fetch(`${baseUrl}/api/runtime/engines/analysis/stop`, {
    method: "POST",
    headers: {
      cookie: auth.cookie,
      "content-type": "application/json",
      "x-csrf-token": auth.csrfToken,
    },
    body: JSON.stringify({}),
  });

  assert.equal(stopResponse.status, 200);
  const stopPayload = await stopResponse.json();
  assert.equal(stopPayload.result.status.schedulerRunning, false);
});
