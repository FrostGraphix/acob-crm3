import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import jwt from "../../backend/node_modules/jsonwebtoken/index.js";

let server;
let baseUrl;
let resetWalletDomainState;
let resetWalletPersistenceMirrorState;

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
  process.env.ENABLE_ANALYSIS_ENGINE = "false";
  process.env.ENABLE_SITE_CONSUMPTION_ENGINE = "false";
  process.env.UPSTREAM_PASSWORD = "";

  const [{ createApp }, walletStoreModule, walletPersistenceModule] = await Promise.all([
    import("../../backend/dist/backend/src/app.js"),
    import("../../backend/dist/backend/src/services/wallet-domain-store.js"),
    import("../../backend/dist/backend/src/services/wallet-persistence.js"),
  ]);
  resetWalletDomainState = walletStoreModule.resetWalletDomainState;
  resetWalletPersistenceMirrorState = walletPersistenceModule.resetWalletPersistenceMirrorState;

  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve wallet phase 0 guard test server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.beforeEach(() => {
  resetWalletDomainState();
  resetWalletPersistenceMirrorState();
});

test.after(async () => {
  if (server) {
    server.close();
    await once(server, "close");
  }
});

async function createAuthCookieHeader({
  username,
  displayName,
  role,
  id,
  vendor_id,
  site_code,
  app_role,
  forcePasswordChange,
}) {
  const [{ env }, { createSession }, { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME }] = await Promise.all([
    import("../../backend/dist/backend/src/services/env.js"),
    import("../../backend/dist/backend/src/services/session-store.js"),
    import("../../backend/dist/backend/src/services/auth-cookie.js"),
  ]);

  const sessionId = `${username}-session`;
  const csrfToken = `${username}-csrf`;
  await createSession(sessionId, { csrfToken });

  const token = jwt.sign(
    {
      user: {
        id,
        username,
        displayName,
        role,
        vendor_id,
        site_code,
        app_role,
        forcePasswordChange,
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

async function postJson(url, auth, body) {
  return fetch(url, {
    method: "POST",
    headers: {
      cookie: auth.cookie,
      "content-type": "application/json",
      "x-csrf-token": auth.csrfToken,
    },
    body: JSON.stringify(body),
  });
}

test("wallet route guard blocks vendor from admin-only onboarding approval actions", async () => {
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.phase0",
    displayName: "Vendor Phase0",
    role: "Vendor User",
    id: "vendor-phase0-1",
    vendor_id: "VENDOR_PHASE0",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  const approveResponse = await postJson(
    `${baseUrl}/api/vendor/VENDOR_PHASE0/approve`,
    vendorAuth,
    {},
  );

  assert.equal(approveResponse.status, 403);
  const payload = await approveResponse.json();
  assert.match(payload.reason, /Insufficient permissions/i);
});

test("wallet route guard blocks finance user from vendor purchase routes", async () => {
  const financeAuth = await createAuthCookieHeader({
    username: "finance.phase0",
    displayName: "Finance Phase0",
    role: "Finance",
    id: "finance-phase0-1",
    app_role: "finance",
  });

  const purchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    financeAuth,
    {
      idempotency_key: "phase0-deny-1",
      wallet_id: "wallet-001",
      meter_sn: "MTR-001",
      customer_ref: "CUST-001",
      amount: 1000,
      site_code: "SITE_001",
    },
  );

  assert.equal(purchaseResponse.status, 403);
  const payload = await purchaseResponse.json();
  assert.match(payload.reason, /Insufficient permissions/i);
});

test("wallet route guard blocks wallet access until vendor changes temporary password", async () => {
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.force-reset",
    displayName: "Vendor Force Reset",
    role: "Vendor User",
    id: "vendor-force-reset-1",
    vendor_id: "VENDOR_FORCE_RESET",
    site_code: "SITE_001",
    app_role: "vendor_user",
    forcePasswordChange: true,
  });

  const summaryResponse = await fetch(`${baseUrl}/api/wallet/summary`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });

  assert.equal(summaryResponse.status, 403);
  const payload = await summaryResponse.json();
  assert.equal(payload.reason, "FORCE_PASSWORD_CHANGE");
});

test("wallet route guard fails closed in production when wallet schema is not ready", async () => {
  const [{ env }] = await Promise.all([
    import("../../backend/dist/backend/src/services/env.js"),
  ]);
  const originalNodeEnv = env.nodeEnv;
  env.nodeEnv = "production";

  try {
    const financeAuth = await createAuthCookieHeader({
      username: "finance.production",
      displayName: "Finance Production",
      role: "Finance",
      id: "finance-production-1",
      app_role: "finance",
    });

    const response = await fetch(`${baseUrl}/api/wallet/summary`, {
      headers: {
        cookie: financeAuth.cookie,
      },
    });

    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.reason, "SCHEMA_NOT_READY");
  } finally {
    env.nodeEnv = originalNodeEnv;
  }
});
