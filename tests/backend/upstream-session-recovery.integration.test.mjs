import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createServer } from "node:http";

let supabaseServer;
let upstreamServer;
let server;
let baseUrl;

const upstreamState = {
  loginCount: 0,
  currentSessionCookie: "JSESSIONID=upstream-session-1",
};

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendUpstreamEnvelope(response, statusCode, result, reason = "OK", headers = {}) {
  sendJson(
    response,
    statusCode,
    {
      code: statusCode >= 400 ? 1 : 0,
      reason,
      result,
    },
    headers,
  );
}

function getCookieByName(response, name) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];

  if (setCookies.length === 0) {
    const legacyHeader = response.headers.get("set-cookie");
    if (typeof legacyHeader !== "string") {
      return null;
    }

    const match = legacyHeader
      .split(/,(?=[^;,]+=[^;,]+)/g)
      .find((entry) => entry.trim().startsWith(`${name}=`));
    return match?.trim().split(";")[0] ?? null;
  }

  const cookie = setCookies.find((entry) => entry.startsWith(`${name}=`));
  return cookie?.split(";")[0] ?? null;
}

function buildCookieHeader(...cookies) {
  return cookies.filter((value) => typeof value === "string" && value.length > 0).join("; ");
}

test.before(async () => {
  supabaseServer = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const authHeader = request.headers.authorization ?? "";

    if (request.method === "GET" && pathname === "/auth/v1/user") {
      if (authHeader === "Bearer valid-supabase-token") {
        sendJson(response, 200, {
          id: "supabase-user-1",
          email: "admin@example.com",
          user_metadata: {
            display_name: "Supabase Admin",
          },
          app_metadata: {
            role: "Administrator",
          },
        });
        return;
      }

      sendJson(response, 401, {
        error: "invalid_token",
        error_description: "JWT expired",
      });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  });

  upstreamServer = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const body = await parseJsonBody(request);

    if (request.method !== "POST") {
      sendUpstreamEnvelope(response, 404, null, "Not found");
      return;
    }

    if (pathname === "/api/user/login") {
      if (body.username !== "admin" || body.password !== "ACOB_admin") {
        sendUpstreamEnvelope(response, 401, null, "Invalid credentials");
        return;
      }

      upstreamState.loginCount += 1;
      upstreamState.currentSessionCookie = `JSESSIONID=upstream-session-${upstreamState.loginCount}`;
      sendUpstreamEnvelope(
        response,
        200,
        { username: "admin" },
        "OK",
        {
          "Set-Cookie": `${upstreamState.currentSessionCookie}; Path=/; HttpOnly`,
        },
      );
      return;
    }

    if (pathname === "/api/customer/read") {
      if (request.headers.cookie !== upstreamState.currentSessionCookie) {
        sendUpstreamEnvelope(response, 401, null, "Upstream session expired");
        return;
      }

      sendUpstreamEnvelope(response, 200, {
        rows: [{ id: "CUSTOMER-0001", name: "Recovered Customer" }],
        total: 1,
      });
      return;
    }

    sendUpstreamEnvelope(response, 404, null, "Not found");
  });

  supabaseServer.listen(0);
  upstreamServer.listen(0);
  await Promise.all([once(supabaseServer, "listening"), once(upstreamServer, "listening")]);

  const supabaseAddress = supabaseServer.address();
  const upstreamAddress = upstreamServer.address();
  if (!supabaseAddress || typeof supabaseAddress === "string") {
    throw new Error("Failed to resolve Supabase test server port");
  }
  if (!upstreamAddress || typeof upstreamAddress === "string") {
    throw new Error("Failed to resolve upstream test server port");
  }

  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.JWT_SECRET = "upstream-session-recovery-test-secret";
  process.env.SUPABASE_AUTH_ENABLED = "true";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
  process.env.SUPABASE_URL = `http://127.0.0.1:${supabaseAddress.port}`;
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_STORAGE_BUCKET = "";
  process.env.UPSTREAM_API_URL = `http://127.0.0.1:${upstreamAddress.port}`;
  process.env.UPSTREAM_USERNAME = "admin";
  process.env.UPSTREAM_PASSWORD = "ACOB_admin";

  const { createApp } = await import("../../backend/dist/backend/src/app.js");
  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve backend test server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    server.close();
    await once(server, "close");
  }

  if (supabaseServer) {
    supabaseServer.close();
    await once(supabaseServer, "close");
  }

  if (upstreamServer) {
    upstreamServer.close();
    await once(upstreamServer, "close");
  }
});

test.beforeEach(() => {
  upstreamState.loginCount = 0;
  upstreamState.currentSessionCookie = "JSESSIONID=upstream-session-1";
});

test("missing upstream session is recreated for supabase-authenticated requests", async () => {
  const response = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(
        "acob_session=valid-supabase-token",
        "acob_csrf=recovery-csrf-token",
      ),
      "x-csrf-token": "recovery-csrf-token",
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.code, 0);
  assert.equal(upstreamState.loginCount, 1);
  assert.ok(getCookieByName(response, "acob_upstream_session"));
});

test("stale upstream session is retried with a fresh upstream login", async () => {
  const { createSession, getSession } = await import(
    "../../backend/dist/backend/src/services/session-store.js"
  );

  await createSession("stale-upstream-session", {
    upstreamCookie: "JSESSIONID=stale-upstream-session",
    csrfToken: "stale-csrf-token",
  });

  const response = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(
        "acob_session=valid-supabase-token",
        "acob_upstream_session=stale-upstream-session",
        "acob_csrf=stale-csrf-token",
      ),
      "x-csrf-token": "stale-csrf-token",
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.code, 0);
  assert.equal(upstreamState.loginCount, 1);

  const refreshedSession = await getSession("stale-upstream-session");
  assert.equal(refreshedSession?.upstreamCookie, "JSESSIONID=upstream-session-1");
});

test("supabase upstream routes proactively refresh the upstream session on each request", async () => {
  const firstResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(
        "acob_session=valid-supabase-token",
        "acob_csrf=proactive-csrf-token",
      ),
      "x-csrf-token": "proactive-csrf-token",
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(firstResponse.status, 200);
  const upstreamSessionCookie = getCookieByName(firstResponse, "acob_upstream_session");
  assert.ok(upstreamSessionCookie);
  assert.equal(upstreamState.loginCount, 1);

  const secondResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(
        "acob_session=valid-supabase-token",
        upstreamSessionCookie,
        "acob_csrf=proactive-csrf-token",
      ),
      "x-csrf-token": "proactive-csrf-token",
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(secondResponse.status, 200);
  assert.equal(upstreamState.loginCount, 2);
});
