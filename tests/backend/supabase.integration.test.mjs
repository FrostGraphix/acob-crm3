import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

const shouldRunSupabaseIntegrationTests =
  process.env.RUN_SUPABASE_INTEGRATION_TESTS === "true";

const requiredEnv = {
  SUPABASE_AUTH_ENABLED: process.env.SUPABASE_AUTH_ENABLED,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_TEST_EMAIL: process.env.SUPABASE_TEST_EMAIL,
  SUPABASE_TEST_PASSWORD: process.env.SUPABASE_TEST_PASSWORD,
};

const missingEnv = Object.entries(requiredEnv)
  .filter(([, value]) => typeof value !== "string" || value.trim().length === 0)
  .map(([key]) => key);

const isAuthFlagEnabled = process.env.SUPABASE_AUTH_ENABLED === "true";
const supabaseTestsEnabled =
  shouldRunSupabaseIntegrationTests &&
  isAuthFlagEnabled &&
  missingEnv.length === 0;

const skipReason = shouldRunSupabaseIntegrationTests
  ? missingEnv.length > 0
    ? `Missing env values: ${missingEnv.join(", ")}`
    : "SUPABASE_AUTH_ENABLED must be true."
  : "RUN_SUPABASE_INTEGRATION_TESTS is not true.";

const testEmail = process.env.SUPABASE_TEST_EMAIL ?? "";
const testPassword = process.env.SUPABASE_TEST_PASSWORD ?? "";

let server;
let baseUrl;
const cookieJar = new Map();

function splitSetCookieHeader(value) {
  return value.split(/,(?=[^;,]+=[^;,]+)/g);
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    return [];
  }

  return splitSetCookieHeader(setCookie);
}

function updateCookieJar(response) {
  const setCookies = getSetCookieHeaders(response);

  for (const setCookie of setCookies) {
    const pair = setCookie.split(";")[0]?.trim();
    if (!pair) {
      continue;
    }

    const separatorIndex = pair.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);
    cookieJar.set(name, value);
  }
}

function buildCookieHeader(overrides = {}) {
  const merged = new Map(cookieJar);

  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) {
      merged.delete(name);
      continue;
    }

    merged.set(name, value);
  }

  return Array.from(merged.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function requestEnvelope(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  updateCookieJar(response);
  const payload = await response.json();

  return { response, payload };
}

test.before(async () => {
  if (!supabaseTestsEnabled) {
    return;
  }

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

test(
  "supabase login issues access and refresh cookies",
  { skip: supabaseTestsEnabled ? false : skipReason },
  async () => {
    const { response, payload } = await requestEnvelope("/api/user/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: testEmail,
        password: testPassword,
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(payload.code, 0);
    assert.ok(cookieJar.get("acob_session"));
    assert.ok(cookieJar.get("acob_refresh"));

    const userInfo = await requestEnvelope("/api/user/info", {
      method: "GET",
      headers: {
        Cookie: buildCookieHeader(),
      },
    });

    assert.equal(userInfo.response.status, 200);
    assert.equal(userInfo.payload.code, 0);
  },
);

test(
  "supabase refresh flow restores an invalid access token",
  { skip: supabaseTestsEnabled ? false : skipReason },
  async () => {
    const refreshToken = cookieJar.get("acob_refresh");
    assert.ok(refreshToken);

    const { response, payload } = await requestEnvelope("/api/user/info", {
      method: "GET",
      headers: {
        Cookie: buildCookieHeader({
          acob_session: "invalid-access-token",
        }),
      },
    });

    assert.equal(response.status, 200);
    assert.equal(payload.code, 0);
    assert.notEqual(cookieJar.get("acob_session"), "invalid-access-token");
  },
);
