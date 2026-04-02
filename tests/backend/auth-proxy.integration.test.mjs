import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

let upstreamServer;
let server;
let upstreamBaseUrl;
let baseUrl;

const upstreamState = {
  forceLoginFailure: false,
  userProfile: {
    username: "admin",
    displayName: "ACOB Admin",
    role: "Administrator",
    email: "admin@example.com",
  },
  lastRequestBodies: {},
  customers: createCustomers(),
};

function createCustomers() {
  return Array.from({ length: 40 }, (_, index) => ({
    id: `CUSTOMER-${String(index + 1).padStart(4, "0")}`,
    name: `Customer ${index + 1}`,
    stationId: "STATION-001",
    createTime: "2026-03-01 10:00",
  }));
}

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
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendUpstreamEnvelope(response, statusCode, result, reason = "OK", headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(
    JSON.stringify({
      code: statusCode >= 400 ? 1 : 0,
      reason,
      result,
    }),
  );
}

function hasUpstreamSessionCookie(request) {
  const cookie = request.headers.cookie;
  return typeof cookie === "string" && cookie.includes("JSESSIONID=upstream-session");
}

function getCookieByName(response, name) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];

  if (setCookies.length === 0) {
    const legacyHeader = response.headers.get("set-cookie");
    if (typeof legacyHeader === "string") {
      const first = legacyHeader.split(",").find((entry) => entry.trim().startsWith(`${name}=`));
      if (first) {
        return first.trim().split(";")[0] ?? null;
      }
    }
    return null;
  }

  const raw = setCookies.find((cookieValue) => cookieValue.startsWith(`${name}=`));
  return raw?.split(";")[0] ?? null;
}

function buildCookieHeader(...cookies) {
  return cookies.filter((value) => typeof value === "string" && value.length > 0).join("; ");
}

function decodeJwtPayload(token) {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("Invalid JWT token");
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

test.before(async () => {
  upstreamServer = createServer(async (request, response) => {
    if (request.method !== "POST") {
      sendUpstreamEnvelope(response, 404, null, "Not found");
      return;
    }

    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const body = await parseJsonBody(request);

    if (pathname === "/api/user/login") {
      if (
        upstreamState.forceLoginFailure ||
        body.username !== "admin" ||
        body.password !== "ACOB_admin"
      ) {
        sendUpstreamEnvelope(response, 401, null, "Invalid credentials");
        return;
      }

      sendUpstreamEnvelope(
        response,
        200,
        upstreamState.userProfile,
        "OK",
        {
          "Set-Cookie": "JSESSIONID=upstream-session; Path=/; HttpOnly",
        },
      );
      return;
    }

    if (!hasUpstreamSessionCookie(request)) {
      sendUpstreamEnvelope(response, 401, null, "Upstream session missing");
      return;
    }

    if (pathname === "/api/user/logout") {
      sendUpstreamEnvelope(response, 200, { success: true });
      return;
    }

    if (pathname === "/api/user/updateInfo") {
      upstreamState.userProfile = {
        ...upstreamState.userProfile,
        displayName:
          typeof body.displayName === "string" && body.displayName.length > 0
            ? body.displayName
            : upstreamState.userProfile.displayName,
        username:
          typeof body.username === "string" && body.username.length > 0
            ? body.username
            : upstreamState.userProfile.username,
      };
      sendUpstreamEnvelope(response, 200, { success: true, user: upstreamState.userProfile });
      return;
    }

    if (pathname === "/api/customer/read") {
      const pageNumber = Number(body.pageNumber ?? 1);
      const pageSize = Number(body.pageSize ?? 20);
      const start = (Math.max(1, pageNumber) - 1) * Math.max(1, pageSize);
      const end = start + Math.max(1, pageSize);

      sendUpstreamEnvelope(response, 200, {
        rows: upstreamState.customers.slice(start, end),
        total: upstreamState.customers.length,
      });
      return;
    }

    if (
      pathname === "/API/PrepayReport/LowPurchaseSituation" ||
      pathname === "/API/PrepayReport/LongNonpurchaseSituation" ||
      pathname === "/api/DailyDataMeter/read" ||
      pathname === "/API/RemoteMeterTask/GetReadingTask"
    ) {
      upstreamState.lastRequestBodies[pathname] = body;

      if (typeof body.Lang !== "string" || body.Lang.length === 0) {
        response.writeHead(400, {
          "Content-Type": "application/json",
        });
        response.end(
          JSON.stringify({
            type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            title: "One or more validation errors occurred.",
            status: 400,
            errors: {
              Lang: ["The Lang field is required."],
            },
          }),
        );
        return;
      }

      if (pathname === "/API/PrepayReport/LongNonpurchaseSituation") {
        const hasExpectedAliases =
          typeof body.page === "number" &&
          typeof body.limit === "number" &&
          typeof body.consumerId === "string" &&
          typeof body.meterNo === "string" &&
          typeof body.daysStart === "number" &&
          typeof body.daysEnd === "number";

        if (!hasExpectedAliases) {
          response.writeHead(400, {
            "Content-Type": "application/json",
          });
          response.end(
            JSON.stringify({
              code: 1,
              reason: "LongNonpurchase payload mismatch",
              result: null,
            }),
          );
          return;
        }
      }

      sendUpstreamEnvelope(response, 200, {
        total: 1,
        data: [
          {
            customerId: "C-001",
            customerName: "Report Customer",
            meterId: "M-001",
          },
        ],
      });
      return;
    }

    if (pathname === "/api/customer/create") {
      const row = {
        id: `CUSTOMER-${String(upstreamState.customers.length + 1).padStart(4, "0")}`,
        name: typeof body.name === "string" ? body.name : "Created Customer",
        stationId: "STATION-001",
        createTime: "2026-03-10 12:00",
      };
      upstreamState.customers.unshift(row);
      sendUpstreamEnvelope(response, 200, { success: true, row, message: "Created" });
      return;
    }

    sendUpstreamEnvelope(response, 404, null, "Not found");
  });

  upstreamServer.listen(0);
  await once(upstreamServer, "listening");
  const upstreamAddress = upstreamServer.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") {
    throw new Error("Failed to resolve upstream test server port");
  }

  upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}`;
  process.env.NODE_ENV = "test";
  process.env.UPSTREAM_API_URL = upstreamBaseUrl;
  process.env.UPSTREAM_USERNAME = "admin";
  process.env.UPSTREAM_PASSWORD = "ACOB_admin";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.JWT_SECRET = "integration-test-secret";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_ANON_KEY = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_STORAGE_BUCKET = "";

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
  if (upstreamServer) {
    upstreamServer.close();
    await once(upstreamServer, "close");
  }

  if (server) {
    server.close();
    await once(server, "close");
  }
});

test("protected API returns 401 without auth cookie", async () => {
  const response = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(response.status, 401);
});

test("login issues cookie and allows authenticated proxy calls", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });

  assert.equal(loginResponse.status, 200);
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);

  const readResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(sessionCookie, csrfCookie),
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(readResponse.status, 200);
  const readPayload = await readResponse.json();
  assert.equal(readPayload.code, 0);
  assert.ok(Array.isArray(readPayload.result.rows));
});

test("legacy login falls back to configured local credentials when upstream auth fails", async () => {
  upstreamState.forceLoginFailure = true;

  try {
    const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "admin",
        password: "ACOB_admin",
      }),
    });

    assert.equal(loginResponse.status, 200);
    const loginPayload = await loginResponse.json();
    const csrfToken = loginPayload?.result?.csrfToken;
    assert.equal(typeof csrfToken, "string");
    assert.equal(loginPayload?.result?.user?.displayName, "ACOB Admin");

    const sessionCookie = getCookieByName(loginResponse, "acob_session");
    const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
    assert.ok(sessionCookie);
    assert.ok(csrfCookie);

    const infoResponse = await fetch(`${baseUrl}/api/user/info`, {
      headers: {
        Cookie: buildCookieHeader(sessionCookie, csrfCookie),
      },
    });
    assert.equal(infoResponse.status, 200);

    const readResponse = await fetch(`${baseUrl}/api/customer/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: buildCookieHeader(sessionCookie, csrfCookie),
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
    });
    assert.equal(readResponse.status, 401);
    const readPayload = await readResponse.json();
    assert.equal(readPayload.reason, "Invalid credentials");
  } finally {
    upstreamState.forceLoginFailure = false;
  }
});

test.beforeEach(() => {
  upstreamState.forceLoginFailure = false;
  upstreamState.userProfile = {
    username: "admin",
    displayName: "ACOB Admin",
    role: "Administrator",
    email: "admin@example.com",
  };
  upstreamState.lastRequestBodies = {};
  upstreamState.customers = createCustomers();
});

test("legacy proxy requests recover a stale upstream session when service credentials are configured", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });

  assert.equal(loginResponse.status, 200);
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);

  const token = sessionCookie.split("=")[1];
  const decoded = decodeJwtPayload(token);
  const { createSession, getSession } = await import(
    "../../backend/dist/backend/src/services/session-store.js"
  );

  await createSession(decoded.sessionId, {
    upstreamCookie: "JSESSIONID=stale-upstream-session",
    csrfToken,
  });

  const readResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(sessionCookie, csrfCookie),
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(readResponse.status, 200);
  const readPayload = await readResponse.json();
  assert.equal(readPayload.code, 0);

  const refreshedSession = await getSession(decoded.sessionId);
  assert.equal(refreshedSession?.upstreamCookie, "JSESSIONID=upstream-session");
});

test("csrf protection rejects authenticated requests with missing token", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });

  assert.equal(loginResponse.status, 200);
  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);

  const readResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(sessionCookie, csrfCookie),
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(readResponse.status, 403);
});

test("authenticated create request mutates dataset", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);
  const cookieHeader = buildCookieHeader(sessionCookie, csrfCookie);

  const beforeResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 20 }),
  });
  const beforePayload = await beforeResponse.json();
  const beforeTotal = beforePayload.result.total;

  const createResponse = await fetch(`${baseUrl}/api/customer/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ name: "Proxy Integration User", remark: "integration-test" }),
  });
  assert.equal(createResponse.status, 200);

  const afterResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 20 }),
  });
  const afterPayload = await afterResponse.json();
  assert.equal(afterPayload.result.total, beforeTotal + 1);
});

test("management import batches records through the backend import endpoint", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);
  const cookieHeader = buildCookieHeader(sessionCookie, csrfCookie);

  const beforeResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 50 }),
  });
  const beforePayload = await beforeResponse.json();
  const beforeTotal = beforePayload.result.total;

  const importResponse = await fetch(`${baseUrl}/api/customer/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({
      records: [
        { name: "Imported Customer 1", remark: "bulk-import" },
        { name: "Imported Customer 2", remark: "bulk-import" },
      ],
    }),
  });
  assert.equal(importResponse.status, 200);
  const importPayload = await importResponse.json();
  assert.equal(importPayload.result.importedCount, 2);

  const afterResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 50 }),
  });
  const afterPayload = await afterResponse.json();
  assert.equal(afterPayload.result.total, beforeTotal + 2);
});

test("profile update refreshes the authenticated user session", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);

  const updateResponse = await fetch(`${baseUrl}/api/user/updateInfo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buildCookieHeader(sessionCookie, csrfCookie),
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({
      displayName: "Updated Integration Admin",
      email: "updated@example.com",
      phone: "08000000000",
      address: "12 Marina Road",
      remark: "Updated from integration test",
    }),
  });

  assert.equal(updateResponse.status, 200);
  const updatePayload = await updateResponse.json();
  assert.equal(updatePayload.result.success, true);

  const refreshedSessionCookie = getCookieByName(updateResponse, "acob_session") ?? sessionCookie;
  const infoResponse = await fetch(`${baseUrl}/api/user/info`, {
    method: "GET",
    headers: {
      Cookie: buildCookieHeader(refreshedSessionCookie, csrfCookie),
    },
  });

  assert.equal(infoResponse.status, 200);
  const infoPayload = await infoResponse.json();
  assert.equal(infoPayload.result.displayName, "Updated Integration Admin");
  assert.equal(infoPayload.result.email, "updated@example.com");
  assert.equal(infoPayload.result.phone, "08000000000");
  assert.equal(infoPayload.result.address, "12 Marina Road");
  assert.equal(infoPayload.result.remark, "Updated from integration test");
});

test("logout clears session and protected endpoint returns 401", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);
  const cookieHeader = buildCookieHeader(sessionCookie, csrfCookie);

  const logoutResponse = await fetch(`${baseUrl}/api/user/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({}),
  });
  assert.equal(logoutResponse.status, 200);

  const readResponse = await fetch(`${baseUrl}/api/customer/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });

  assert.equal(readResponse.status, 401);
});

test("report and daily data proxy requests inject upstream Lang parameter", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);
  const cookieHeader = buildCookieHeader(sessionCookie, csrfCookie);

  const reportResponse = await fetch(`${baseUrl}/API/PrepayReport/LowPurchaseSituation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });
  assert.equal(reportResponse.status, 200);
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LowPurchaseSituation"].Lang, "en");

  const dailyDataResponse = await fetch(`${baseUrl}/api/DailyDataMeter/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });
  assert.equal(dailyDataResponse.status, 200);
  assert.equal(upstreamState.lastRequestBodies["/api/DailyDataMeter/read"].Lang, "en");

  const readingTaskResponse = await fetch(`${baseUrl}/API/RemoteMeterTask/GetReadingTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({ pageNumber: 1, pageSize: 10 }),
  });
  assert.equal(readingTaskResponse.status, 200);
  assert.equal(upstreamState.lastRequestBodies["/API/RemoteMeterTask/GetReadingTask"].Lang, "en");
});

test("long nonpurchase report retries with paging and upstream field aliases", async () => {
  const loginResponse = await fetch(`${baseUrl}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "ACOB_admin",
    }),
  });
  const loginPayload = await loginResponse.json();
  const csrfToken = loginPayload?.result?.csrfToken;
  assert.equal(typeof csrfToken, "string");

  const sessionCookie = getCookieByName(loginResponse, "acob_session");
  const csrfCookie = getCookieByName(loginResponse, "acob_csrf");
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);
  const cookieHeader = buildCookieHeader(sessionCookie, csrfCookie);

  const reportResponse = await fetch(`${baseUrl}/API/PrepayReport/LongNonpurchaseSituation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({
      customerId: "C-001",
      meterId: "M-001",
      nonpurchaseDaysStart: 30,
      nonpurchaseDaysEnd: 90,
      pageNumber: 1,
      pageSize: 10,
    }),
  });

  assert.equal(reportResponse.status, 200);
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LongNonpurchaseSituation"].Lang, "en");
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LongNonpurchaseSituation"].page, 1);
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LongNonpurchaseSituation"].limit, 10);
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LongNonpurchaseSituation"].consumerId, "C-001");
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LongNonpurchaseSituation"].meterNo, "M-001");
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LongNonpurchaseSituation"].daysStart, 30);
  assert.equal(upstreamState.lastRequestBodies["/API/PrepayReport/LongNonpurchaseSituation"].daysEnd, 90);
});
