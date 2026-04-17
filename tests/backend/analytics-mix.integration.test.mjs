import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import jwt from "../../backend/node_modules/jsonwebtoken/index.js";

let upstreamServer;
let server;
let baseUrl;

const SITE_NAMES = ["Musha", "Ogufa", "Umaisha", "Tunga", "Kyakale"];

const customerRows = [
  {
    customerId: "CUST-001",
    meterId: "MTR-001",
    customerName: "Alpha One",
    stationId: "Musha",
    certifiNo: "ACC-001",
    address: "Alpha Close",
  },
  {
    customerId: "CUST-002",
    meterId: "MTR-002",
    customerName: "Beta Two",
    stationId: "Ogufa",
    certifiNo: "ACC-002",
    address: "Beta Close",
  },
  {
    customerId: "CUST-003",
    meterId: "MTR-003",
    customerName: "Gamma Three",
    stationId: "Umaisha",
    certifiNo: "ACC-003",
    address: "Gamma Close",
  },
  {
    customerId: "CUST-004",
    meterId: "MTR-004",
    customerName: "Delta Four",
    stationId: "Tunga",
    certifiNo: "ACC-004",
    address: "Delta Close",
  },
  {
    customerId: "CUST-005",
    meterId: "MTR-005",
    customerName: "Epsilon Five",
    stationId: "Kyakale",
    certifiNo: "ACC-005",
    address: "Epsilon Close",
  },
];

const accountRows = [
  { customerId: "CUST-001", accountNo: "ACC-001", meterId: "MTR-001", stationId: "Musha" },
  { customerId: "CUST-002", accountNo: "ACC-002", meterId: "MTR-002", stationId: "Ogufa" },
  { customerId: "CUST-003", accountNo: "ACC-003", meterId: "MTR-003", stationId: "Umaisha" },
  { customerId: "CUST-004", accountNo: "ACC-004", meterId: "MTR-004", stationId: "Tunga" },
  { customerId: "CUST-005", accountNo: "ACC-005", meterId: "MTR-005", stationId: "Kyakale" },
];

const meterRows = [
  {
    customerId: "CUST-001",
    accountNo: "ACC-001",
    meterId: "MTR-001",
    gatewayId: "GTW-001",
    tariffId: "TAR-A",
    stationId: "Musha",
  },
  {
    customerId: "CUST-002",
    accountNo: "ACC-002",
    meterId: "MTR-002",
    gatewayId: "GTW-002",
    tariffId: "TAR-B",
    stationId: "Ogufa",
  },
  {
    customerId: "CUST-003",
    accountNo: "ACC-003",
    meterId: "MTR-003",
    gatewayId: "GTW-003",
    tariffId: "TAR-A",
    stationId: "Umaisha",
  },
  {
    customerId: "CUST-004",
    accountNo: "ACC-004",
    meterId: "MTR-004",
    gatewayId: "GTW-004",
    tariffId: "TAR-C",
    stationId: "Tunga",
  },
  {
    customerId: "CUST-005",
    accountNo: "ACC-005",
    meterId: "MTR-005",
    gatewayId: "GTW-999",
    tariffId: "TAR-X",
    stationId: "Kyakale",
  },
];

const gatewayRows = [
  { gatewayId: "GTW-001", stationId: "Musha" },
  { gatewayId: "GTW-002", stationId: "Ogufa" },
  { gatewayId: "GTW-003", stationId: "Umaisha" },
  { gatewayId: "GTW-004", stationId: "Tunga" },
];

const tariffRows = [
  { tariffId: "TAR-A", priceName: "Residential A" },
  { tariffId: "TAR-B", priceName: "Residential B" },
  { tariffId: "TAR-C", priceName: "Commercial C" },
];

const dlmsRows = [
  { meterId: "MTR-001" },
  { meterId: "MTR-002" },
  { meterId: "MTR-003" },
  { meterId: "MTR-004" },
];

const dailyDataRows = [
  { meterId: "MTR-001", stationId: "Musha", collectionDate: "2026-04-10T08:00:00.000Z", value: 60 },
  { meterId: "MTR-002", stationId: "Ogufa", collectionDate: "2026-04-10T07:00:00.000Z", value: 42 },
  { meterId: "MTR-003", stationId: "Umaisha", collectionDate: "2026-04-09T10:00:00.000Z", value: 33 },
  { meterId: "MTR-004", stationId: "Tunga", collectionDate: "2026-04-08T11:00:00.000Z", value: 22 },
  { meterId: "MTR-005", stationId: "Kyakale", collectionDate: "2026-04-05T11:00:00.000Z", value: 18 },
];

const hourlyRows = [
  { meterId: "MTR-001", stationId: "Musha", collectionDate: "2026-04-10T09:00:00.000Z", value: 10 },
  { meterId: "MTR-002", stationId: "Ogufa", collectionDate: "2026-04-10T09:00:00.000Z", value: 9 },
  { meterId: "MTR-003", stationId: "Umaisha", collectionDate: "2026-04-10T09:00:00.000Z", value: 7 },
];

const lowPurchaseRows = [
  { meterId: "MTR-001", customerName: "Alpha One", stationId: "Musha", remainingBalance: 90 },
  { meterId: "MTR-003", customerName: "Gamma Three", stationId: "Umaisha", remainingBalance: 310 },
  { meterId: "MTR-005", customerName: "Epsilon Five", stationId: "Kyakale", remainingBalance: 450 },
];

const longNonpurchaseRows = [
  { meterId: "MTR-001", customerName: "Alpha One", stationId: "Musha", daysWithoutPurchase: 67 },
  { meterId: "MTR-002", customerName: "Beta Two", stationId: "Ogufa", daysWithoutPurchase: 42 },
  { meterId: "MTR-005", customerName: "Epsilon Five", stationId: "Kyakale", daysWithoutPurchase: 84 },
];

const eventRows = [
  {
    meterId: "MTR-001",
    stationId: "Musha",
    status: "unread",
    createTime: "2026-04-10T08:30:00.000Z",
    title: "Tamper warning",
  },
  {
    meterId: "MTR-002",
    stationId: "Ogufa",
    status: "resolved",
    createTime: "2026-04-10T08:40:00.000Z",
    title: "Voltage restored",
  },
];

const gprsRows = [
  { gatewayId: "GTW-001", stationId: "Musha", online: true },
  { gatewayId: "GTW-002", stationId: "Ogufa", online: true },
  { gatewayId: "GTW-003", stationId: "Umaisha", online: false },
  { gatewayId: "GTW-004", stationId: "Tunga", online: true },
];

const tokenRows = [
  {
    meterId: "MTR-001",
    customerName: "Alpha One",
    stationId: "Musha",
    accountNo: "ACC-001",
    totalPaid: 14000,
    totalUnit: 70,
    tariffId: "TAR-A",
    createTime: "2026-04-01 09:00:00",
    createDate: "2026-04-01 09:00:00",
  },
  {
    meterId: "MTR-001",
    customerName: "Alpha One",
    stationId: "Musha",
    accountNo: "ACC-001",
    totalPaid: 12000,
    totalUnit: 60,
    tariffId: "TAR-A",
    createTime: "2026-04-09 20:00:00",
    createDate: "2026-04-09 20:00:00",
  },
  {
    meterId: "MTR-002",
    customerName: "Beta Two",
    stationId: "Ogufa",
    accountNo: "ACC-002",
    totalPaid: 11000,
    totalUnit: 50,
    tariffId: "TAR-B",
    createTime: "2026-04-04 11:30:00",
    createDate: "2026-04-04 11:30:00",
  },
  {
    meterId: "MTR-003",
    customerName: "Gamma Three",
    stationId: "Umaisha",
    accountNo: "ACC-003",
    totalPaid: 9000,
    totalUnit: 45,
    tariffId: "TAR-A",
    createTime: "2026-04-05 14:15:00",
    createDate: "2026-04-05 14:15:00",
  },
  {
    meterId: "MTR-004",
    customerName: "Delta Four",
    stationId: "Tunga",
    accountNo: "ACC-004",
    totalPaid: 7500,
    totalUnit: 36,
    tariffId: "TAR-C",
    createTime: "2026-04-07 07:00:00",
    createDate: "2026-04-07 07:00:00",
  },
  {
    meterId: "MTR-005",
    customerName: "Epsilon Five",
    stationId: "Kyakale",
    accountNo: "ACC-005",
    totalPaid: 6000,
    totalUnit: 28,
    tariffId: "TAR-X",
    createTime: "2026-04-08 19:00:00",
    createDate: "2026-04-08 19:00:00",
  },
];

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

function sendUpstreamEnvelope(response, result, reason = "OK", statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
  });
  response.end(
    JSON.stringify({
      code: statusCode >= 400 ? 1 : 0,
      reason,
      result,
    }),
  );
}

function filterBySite(rows, siteId) {
  if (!siteId || String(siteId).toUpperCase() === "ALL") {
    return rows;
  }

  return rows.filter((row) =>
    String(row.stationId ?? row.siteId ?? row.site ?? "").toLowerCase() === String(siteId).toLowerCase(),
  );
}

function readSiteId(method, body, requestUrl) {
  if (method === "GET") {
    return requestUrl.searchParams.get("SITE_ID") ?? requestUrl.searchParams.get("siteId") ?? requestUrl.searchParams.get("stationId");
  }

  return body.SITE_ID ?? body.siteId ?? body.stationId ?? body.site ?? null;
}

function createSiteConsumptionState() {
  const summaryValues = {
    Musha: 120,
    Ogufa: 96,
    Umaisha: 80,
    Tunga: 44,
    Kyakale: 31,
  };
  const labels = ["2026-04-08", "2026-04-09", "2026-04-10"];

  return {
    snapshot: {
      generatedAt: "2026-04-10T10:00:00.000Z",
      sourceWindow: {
        fromDate: "2026-04-08",
        toDate: "2026-04-10",
      },
      summary: SITE_NAMES.map((site) => ({
        site,
        totalConsumption: summaryValues[site],
      })),
      daily: {
        labels,
        series: [
          { site: "Musha", values: [32, 40, 48] },
          { site: "Ogufa", values: [28, 32, 36] },
          { site: "Umaisha", values: [20, 25, 35] },
          { site: "Tunga", values: [12, 14, 18] },
          { site: "Kyakale", values: [8, 11, 12] },
        ],
      },
      monthly: {
        labels: ["2026-04"],
        series: [
          { site: "Musha", values: [120] },
          { site: "Ogufa", values: [96] },
          { site: "Umaisha", values: [80] },
          { site: "Tunga", values: [44] },
          { site: "Kyakale", values: [31] },
        ],
      },
      yearly: {
        labels: ["2026"],
        series: [
          { site: "Musha", values: [120] },
          { site: "Ogufa", values: [96] },
          { site: "Umaisha", values: [80] },
          { site: "Tunga", values: [44] },
          { site: "Kyakale", values: [31] },
        ],
      },
    },
    lastUpdatedAt: "2026-04-10T10:00:00.000Z",
    lastAttemptAt: "2026-04-10T10:00:00.000Z",
    lastError: null,
    refreshing: false,
  };
}

async function createAdminCookieHeader() {
  const { env } = await import("../../backend/dist/backend/src/services/env.js");
  const { createSession } = await import("../../backend/dist/backend/src/services/session-store.js");
  const { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } = await import(
    "../../backend/dist/backend/src/services/auth-cookie.js"
  );

  const sessionId = "analytics-mix-admin-session";
  const csrfToken = "analytics-mix-csrf";
  await createSession(sessionId, {
    upstreamCookie: "JSESSIONID=upstream-session",
    csrfToken,
  });

  const token = jwt.sign(
    {
      user: {
        username: "admin",
        displayName: "ACOB Admin",
        role: "Administrator",
        permissions: ["*"],
      },
      sessionId,
      issuedAt: Date.now(),
    },
    env.jwtSecret,
  );

  return `${SESSION_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrfToken}`;
}

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.RUNTIME_STATE_STORE_MODE = "file";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.ENABLE_ANALYSIS_ENGINE = "false";
  process.env.ENABLE_SITE_CONSUMPTION_ENGINE = "false";
  process.env.SCHEDULER_COORDINATION_MODE = "single-instance";
  process.env.UPSTREAM_USERNAME = "admin";
  process.env.UPSTREAM_PASSWORD = "ACOB_admin";

  upstreamServer = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = requestUrl.pathname;
    const method = request.method ?? "GET";
    const body = method === "POST" ? await parseJsonBody(request) : {};

    const siteId = readSiteId(method, body, requestUrl);
    const filteredTokenRows = filterBySite(tokenRows, siteId);
    const filteredLowPurchaseRows = filterBySite(lowPurchaseRows, siteId);
    const filteredLongNonpurchaseRows = filterBySite(longNonpurchaseRows, siteId);
    const filteredDailyRows = filterBySite(dailyDataRows, siteId);
    const filteredHourlyRows = filterBySite(hourlyRows, siteId);
    const filteredEventRows = filterBySite(eventRows, siteId);
    const filteredGprsRows = filterBySite(gprsRows, siteId);

    const routes = new Map([
      ["/api/customer/read", { rows: customerRows, total: customerRows.length }],
      ["/api/account/read", { rows: accountRows, total: accountRows.length }],
      ["/api/meter/read", { rows: meterRows, total: meterRows.length }],
      ["/api/gateway/read", { rows: gatewayRows, total: gatewayRows.length }],
      ["/api/tariff/read", { rows: tariffRows, total: tariffRows.length }],
      ["/api/dlms/Read", { rows: dlmsRows, total: dlmsRows.length }],
      ["/api/DailyDataMeter/read", { rows: filteredDailyRows, total: filteredDailyRows.length }],
      ["/DailyDataMeter/readHourly", { rows: filteredHourlyRows, total: filteredHourlyRows.length }],
      ["/api/DailyDataMeter/readHourly", { rows: filteredHourlyRows, total: filteredHourlyRows.length }],
      ["/API/LoadProfile/DailyData", { rows: filteredDailyRows, total: filteredDailyRows.length }],
      ["/API/PrepayReport/LowPurchaseSituation", { rows: filteredLowPurchaseRows, total: filteredLowPurchaseRows.length }],
      ["/PrepayReport/LowPurchaseSituation", { rows: filteredLowPurchaseRows, total: filteredLowPurchaseRows.length }],
      ["/API/PrepayReport/LongNonpurchaseSituation", { rows: filteredLongNonpurchaseRows, total: filteredLongNonpurchaseRows.length }],
      ["/PrepayReport/LongNonpurchaseSituation", { rows: filteredLongNonpurchaseRows, total: filteredLongNonpurchaseRows.length }],
      ["/API/EventNotification/Read", { rows: filteredEventRows, total: filteredEventRows.length }],
      ["/EventNotification/Read", { rows: filteredEventRows, total: filteredEventRows.length }],
      ["/GPRSOnlineStatus/Read", { rows: filteredGprsRows, total: filteredGprsRows.length }],
      ["/api/GPRSOnlineStatus/Read", { rows: filteredGprsRows, total: filteredGprsRows.length }],
      ["/api/token/creditTokenRecord/readMore", { rows: filteredTokenRows, total: filteredTokenRows.length }],
      ["/token/creditTokenRecord/readMore", { rows: filteredTokenRows, total: filteredTokenRows.length }],
      [
        "/dashboard/readPanelGroup",
        {
          totalAccountCount: accountRows.length,
          totalPurchaseTimes: tokenRows.length,
          totalPurchaseUnit: tokenRows.reduce((total, row) => total + row.totalUnit, 0),
          totalPurchaseMoney: tokenRows.reduce((total, row) => total + row.totalPaid, 0),
        },
      ],
      [
        "/api/dashboard/readPanelGroup",
        {
          totalAccountCount: accountRows.length,
          totalPurchaseTimes: tokenRows.length,
          totalPurchaseUnit: tokenRows.reduce((total, row) => total + row.totalUnit, 0),
          totalPurchaseMoney: tokenRows.reduce((total, row) => total + row.totalPaid, 0),
        },
      ],
    ]);

    if (pathname === "/api/token/creditTokenRecord/readMore" || pathname === "/token/creditTokenRecord/readMore") {
      sendUpstreamEnvelope(response, { rows: filteredTokenRows, total: filteredTokenRows.length });
      return;
    }

    const matched = routes.get(pathname);
    if (matched) {
      sendUpstreamEnvelope(response, matched);
      return;
    }

    sendUpstreamEnvelope(response, null, "Not found", 404);
  });

  upstreamServer.listen(0);
  await once(upstreamServer, "listening");

  const upstreamAddress = upstreamServer.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") {
    throw new Error("Failed to resolve analytics mix upstream port");
  }

  process.env.UPSTREAM_API_URL = `http://127.0.0.1:${upstreamAddress.port}`;

  const runtimeStateStore = await import("../../backend/dist/backend/src/services/runtime-state-store.js");
  await runtimeStateStore.deleteRuntimeState("analysis");
  await runtimeStateStore.deleteRuntimeState("theft-intelligence");
  await runtimeStateStore.deleteRuntimeState("site-consumption");

  await runtimeStateStore.saveRuntimeState("analysis", {
    notifications: [
      {
        id: "notif-1",
        type: "critical",
        title: "Tamper warning",
        message: "Meter MTR-001 needs attention.",
        timestamp: "2026-04-10T08:45:00.000Z",
        read: false,
        meterId: "MTR-001",
      },
      {
        id: "notif-2",
        type: "warning",
        title: "Collection follow-up",
        message: "Meter MTR-005 has prolonged nonpurchase.",
        timestamp: "2026-04-10T09:15:00.000Z",
        read: false,
        meterId: "MTR-005",
      },
    ],
    knownAlerts: [],
    savedAt: "2026-04-10T10:00:00.000Z",
  });

  await runtimeStateStore.saveRuntimeState("theft-intelligence", {
    signals: [
      {
        id: "signal-1",
        meterId: "MTR-001",
        customerName: "Alpha One",
        severity: "critical",
        score: 85,
        signalTypes: ["tamper"],
        title: "Critical theft risk",
        message: "Tamper pattern detected.",
        status: "active",
        createdAt: "2026-04-10T08:00:00.000Z",
        updatedAt: "2026-04-10T08:00:00.000Z",
      },
      {
        id: "signal-2",
        meterId: "MTR-002",
        customerName: "Beta Two",
        severity: "suspect",
        score: 55,
        signalTypes: ["usage-drift"],
        title: "Usage drift",
        message: "Consumption profile drifted.",
        status: "active",
        createdAt: "2026-04-10T08:10:00.000Z",
        updatedAt: "2026-04-10T08:10:00.000Z",
      },
      {
        id: "signal-3",
        meterId: "MTR-005",
        customerName: "Epsilon Five",
        severity: "suspect",
        score: 48,
        signalTypes: ["nonpurchase"],
        title: "Extended inactivity",
        message: "No purchase activity observed.",
        status: "active",
        createdAt: "2026-04-10T08:20:00.000Z",
        updatedAt: "2026-04-10T08:20:00.000Z",
      },
    ],
    cases: [
      {
        id: "case-1",
        meterId: "MTR-001",
        customerName: "Alpha One",
        severity: "critical",
        score: 85,
        status: "active",
        signalIds: ["signal-1"],
        createdAt: "2026-04-10T08:05:00.000Z",
        updatedAt: "2026-04-10T08:05:00.000Z",
      },
    ],
    signalKeys: [],
    savedAt: "2026-04-10T10:00:00.000Z",
  });

  await runtimeStateStore.saveRuntimeState("site-consumption", createSiteConsumptionState());

  const { createApp } = await import("../../backend/dist/backend/src/app.js");
  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve analytics mix server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  const runtimeStateStore = await import("../../backend/dist/backend/src/services/runtime-state-store.js");
  await runtimeStateStore.deleteRuntimeState("analysis");
  await runtimeStateStore.deleteRuntimeState("theft-intelligence");
  await runtimeStateStore.deleteRuntimeState("site-consumption");

  if (server) {
    server.close();
    await once(server, "close");
  }

  if (upstreamServer) {
    upstreamServer.close();
    await once(upstreamServer, "close");
  }
});

test("analytics mix routes return shaped composite payloads", async (t) => {
  const authCookie = await createAdminCookieHeader();

  const endpointExpectations = [
    {
      path: "/api/dashboard/risk-overlay",
      mixKey: "dashboard-risk-overlay",
      assertResult: (result) => {
        assert.equal(result.rows[0].meterId, "MTR-001");
        assert.equal(result.summary[0].value >= 1, true);
      },
    },
    {
      path: "/api/dashboard/revenue-vs-usage",
      mixKey: "dashboard-revenue-vs-usage",
      assertResult: (result) => {
        assert.equal(result.rows.some((row) => Number(row.nairaPerKwh) > 0), true);
      },
    },
    {
      path: "/api/management/analytics/site-benchmark",
      mixKey: "site-benchmark-matrix",
      assertResult: (result) => {
        assert.equal(result.rows.length, 5);
        assert.equal(result.rows[0].site, "Musha");
      },
    },
    {
      path: "/api/management/analytics/top-consumer-watchlist",
      mixKey: "top-consumer-watchlist",
      assertResult: (result) => {
        assert.equal(result.rows.some((row) => Number(row.watchScore) >= 60), true);
      },
    },
    {
      path: "/api/customer/360-lite",
      mixKey: "customer-360-lite",
      assertResult: (result) => {
        assert.equal(result.rows.some((row) => row.accountNo === "ACC-001"), true);
      },
    },
    {
      path: "/api/meter/performance-sheet",
      mixKey: "meter-performance-sheet",
      assertResult: (result) => {
        assert.equal(result.rows.some((row) => row.protocolConfigured === false), true);
      },
    },
    {
      path: "/api/token/reconciliation?fromDate=2026-04-01&toDate=2026-04-10",
      mixKey: "token-reconciliation",
      assertResult: (result) => {
        assert.equal(result.rows.some((row) => Number(row.variancePct) !== 0), true);
      },
    },
    {
      path: "/api/reports/collections-priority?fromDate=2026-04-01&toDate=2026-04-10",
      mixKey: "collections-priority",
      assertResult: (result) => {
        assert.equal(result.rows[0].reasons.includes("Open theft case"), true);
      },
    },
    {
      path: "/api/theft/prioritization",
      mixKey: "theft-prioritization",
      assertResult: (result) => {
        assert.equal(result.rows[0].meterId, "MTR-001");
      },
    },
    {
      path: "/api/site-consumption/loss-exposure",
      mixKey: "site-loss-exposure",
      assertResult: (result) => {
        assert.equal(result.rows.length, 5);
        assert.equal(result.rows.some((row) => Number(row.exposureIndex) > 0), true);
      },
    },
    {
      path: "/api/notifications/correlated-feed",
      mixKey: "notifications-correlated-feed",
      assertResult: (result) => {
        assert.equal(result.rows.length >= 1, true);
        assert.equal(Number(result.rows[0].linkedRiskScore) > 0, true);
      },
    },
    {
      path: "/api/master-data/consistency",
      mixKey: "master-data-consistency",
      assertResult: (result) => {
        assert.equal(result.rows.some((row) => Number(row.qualityScore) < 100), true);
      },
    },
  ];

  for (const endpoint of endpointExpectations) {
    await t.test(endpoint.path, async () => {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        headers: {
          cookie: authCookie,
        },
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.code, 0);
      assert.equal(payload.result.mixKey, endpoint.mixKey);
      assert.equal(typeof payload.result.title, "string");
      assert.equal(typeof payload.result.description, "string");
      assert.equal(Array.isArray(payload.result.summary), true);
      assert.equal(payload.result.summary.length >= 1, true);
      assert.equal(Array.isArray(payload.result.columns), true);
      assert.equal(payload.result.columns.length >= 1, true);
      assert.equal(Array.isArray(payload.result.rows), true);
      assert.equal(payload.result.rows.length >= 1, true);

      if (payload.result.chart) {
        assert.equal(Array.isArray(payload.result.chart.labels), true);
        assert.equal(Array.isArray(payload.result.chart.series), true);
        assert.equal(payload.result.chart.series.length >= 1, true);
      }

      endpoint.assertResult(payload.result);
    });
  }
});
