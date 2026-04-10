import { Router } from "express";
import { extractRows } from "../lib/upstream-data.js";
import { proxyCanonicalPath } from "./proxy.js";
import {
  buildQueryBody,
  loadUpstreamCandidates,
  relayUpstreamResult,
  sendAliasFailure,
} from "./alias-utils.js";
import { sendEnvelope } from "../services/response.js";
import { siteConsumptionEngine } from "../services/site-consumption-engine.js";
import { SITE_CONSUMPTION_SITES } from "../services/site-consumption-store.js";

export const restAliasesRouter = Router();

const endpointAliases = [
  { method: "GET", path: "/api/endpoints", canonical: ["catalog"], group: "system" },
  { method: "GET", path: "/api/meters/stats/sites", canonical: ["/api/site-consumption/summary"], group: "meters" },
  { method: "GET", path: "/api/meters/:meterSN/consumption", canonical: ["/api/DailyDataMeter/read"], group: "meters" },
  { method: "GET", path: "/api/operations/tasks", canonical: ["/API/RemoteMeterTask/GetReadingTask", "/API/RemoteMeterTask/GetSettingTask", "/API/RemoteMeterTask/GetControlTask", "/API/RemoteMeterTask/GetTokenTask", "/API/RemoteMeterTask/GetTransparentForwardingTask"], group: "operations" },
  { method: "GET", path: "/api/dashboard", canonical: ["/api/dashboard"], group: "dashboard" },
  { method: "GET", path: "/api/dashboard/hourly", canonical: ["/api/DailyDataMeter/readHourly", "/DailyDataMeter/readHourly"], group: "dashboard" },
  { method: "GET", path: "/api/dashboard/gprs", canonical: ["/GPRSOnlineStatus/Read", "/api/GPRSOnlineStatus/Read"], group: "dashboard" },
  { method: "GET", path: "/api/dashboard/events", canonical: ["/API/EventNotification/Read"], group: "dashboard" },
  { method: "POST", path: "/api/dashboard/readPanelGroup", canonical: ["/api/dashboard/readPanelGroup"], group: "dashboard" },
  { method: "POST", path: "/api/dashboard/readLineChart", canonical: ["/api/dashboard/readLineChart"], group: "dashboard" },
  { method: "GET", path: "/api/reports/non-purchase", canonical: ["/API/PrepayReport/LongNonpurchaseSituation"], group: "reports" },
  { method: "GET", path: "/api/reports/low-purchase", canonical: ["/API/PrepayReport/LowPurchaseSituation"], group: "reports" },
  { method: "GET", path: "/api/reports/consumption", canonical: ["/API/PrepayReport/ConsumptionStatistics"], group: "reports" },
  { method: "GET", path: "/api/reports/daily-amr", canonical: ["/API/LoadProfile/DailyData"], group: "reports" },
  { method: "GET", path: "/api/reports/daily-amr/meter", canonical: ["/api/DailyDataMeter/read"], group: "reports" },
  { method: "GET", path: "/api/reports/monthly-amr", canonical: ["/API/LoadProfile/MonthlyData"], group: "reports" },
  { method: "GET", path: "/api/reports/energy-curve/single", canonical: ["/API/LoadProfile/ElectricEnergyCurve"], group: "reports" },
  { method: "GET", path: "/api/reports/energy-curve/three-phase", canonical: ["/API/LoadProfile/ElectricEnergyCurve"], group: "reports" },
  { method: "GET", path: "/api/reports/energy-curve/ct", canonical: ["/API/LoadProfile/ElectricEnergyCurve"], group: "reports" },
  { method: "GET", path: "/api/reports/daily-yield", canonical: ["/API/LoadProfile/DailyData"], group: "reports" },
  { method: "GET", path: "/api/reports/monthly-yield", canonical: ["/API/LoadProfile/MonthlyData"], group: "reports" },
  { method: "GET", path: "/api/reports/events", canonical: ["/API/EventNotification/Read"], group: "reports" },
  { method: "GET", path: "/api/reports/instantaneous", canonical: ["/API/LoadProfile/InstantaneousValueCurve"], group: "reports" },
  { method: "POST", path: "/api/DailyDataMeter/read", canonical: ["/api/DailyDataMeter/read"], group: "amr" },
  { method: "GET", path: "/api/DailyDataMeter/readHourly", canonical: ["/api/DailyDataMeter/readHourly", "/DailyDataMeter/readHourly"], group: "amr" },
  { method: "POST", path: "/api/DailyDataMeter/readMore", canonical: ["/api/DailyDataMeter/readMore"], group: "amr" },
  { method: "POST", path: "/api/DailyDataMeter/readMonthly", canonical: ["/api/DailyDataMeter/readMonthly"], group: "amr" },
] as const;

const taskSources = [
  {
    key: "reading",
    label: "Reading Tasks",
    pathnames: ["/API/RemoteMeterTask/GetReadingTask"],
  },
  {
    key: "setting",
    label: "Setting Tasks",
    pathnames: ["/API/RemoteMeterTask/GetSettingTask"],
  },
  {
    key: "control",
    label: "Control Tasks",
    pathnames: ["/API/RemoteMeterTask/GetControlTask"],
  },
  {
    key: "token",
    label: "Token Tasks",
    pathnames: ["/API/RemoteMeterTask/GetTokenTask"],
  },
  {
    key: "transparent-forwarding",
    label: "Transparent Forwarding Tasks",
    pathnames: ["/API/RemoteMeterTask/GetTransparentForwardingTask"],
  },
] as const;

function addPagingDefaults(body: Record<string, unknown>, pageSize = 200) {
  const toNumber = (value: unknown, fallback: number) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  };

  const pageNumber = toNumber(body.pageNumber, 1);
  const normalizedPageSize = toNumber(body.pageSize, pageSize);
  const page = toNumber(body.page, pageNumber);
  const limit = toNumber(body.limit, normalizedPageSize);

  return {
    ...body,
    pageNumber,
    pageSize: normalizedPageSize,
    page,
    limit,
  };
}

async function proxyFromQuery(
  request: Parameters<typeof proxyCanonicalPath>[0],
  response: Parameters<typeof proxyCanonicalPath>[1],
  canonicalPath: string,
  extra: Record<string, unknown> = {},
) {
  return proxyCanonicalPath(request, response, canonicalPath, buildQueryBody(request, extra));
}

restAliasesRouter.get("/endpoints", (_request, response) => {
  sendEnvelope(
    response,
    200,
    {
      aliases: endpointAliases,
      groups: [...new Set(endpointAliases.map((entry) => entry.group))],
    },
    "success",
  );
});

restAliasesRouter.get("/meters/stats/sites", (_request, response) => {
  const snapshot = siteConsumptionEngine.getSnapshot();
  const status = siteConsumptionEngine.getStatus();

  sendEnvelope(
    response,
    200,
    {
      availableSites: SITE_CONSUMPTION_SITES,
      sourceWindow: snapshot.sourceWindow,
      lastUpdatedAt: status.lastUpdatedAt,
      refreshStatus: {
        inProgress: status.refreshing,
        lastAttemptAt: status.lastAttemptAt,
        lastError: status.lastError,
      },
      rows: snapshot.summary,
      total: snapshot.summary.length,
    },
    "success",
  );
});

restAliasesRouter.get("/meters/:meterSN/consumption", async (request, response) => {
  return proxyFromQuery(request, response, "/api/DailyDataMeter/read", {
    meterId: request.params.meterSN,
    meterSN: request.params.meterSN,
  });
});

restAliasesRouter.get("/operations/tasks", async (request, response) => {
  try {
    const body = addPagingDefaults(buildQueryBody(request), 100);
    const rows: Array<Record<string, unknown>> = [];
    const groups: Array<Record<string, unknown>> = [];

    for (const source of taskSources) {
      const result = await loadUpstreamCandidates(request, response, source.pathnames.slice(), body);
      const sourceRows =
        result.statusCode < 400 && result.payload.code === 0
          ? extractRows(result.payload.result)
          : [];

      rows.push(
        ...sourceRows.map((row) => ({
          taskCategory: source.key,
          ...row,
        })),
      );

      groups.push({
        key: source.key,
        label: source.label,
        endpoint: source.pathnames[0],
        count: sourceRows.length,
        statusCode: result.statusCode,
        reason: result.payload.reason,
      });
    }

    sendEnvelope(
      response,
      200,
      {
        rows,
        total: rows.length,
        groups,
      },
      "success",
    );
  } catch (error) {
    sendAliasFailure(response, error, "Failed to load operation tasks");
  }
});

restAliasesRouter.get("/dashboard/hourly", async (request, response) => {
  try {
    const result = await loadUpstreamCandidates(
      request,
      response,
      ["/api/DailyDataMeter/readHourly", "/DailyDataMeter/readHourly"],
      addPagingDefaults(buildQueryBody(request), 200),
    );
    relayUpstreamResult(response, result);
  } catch (error) {
    sendAliasFailure(response, error, "Failed to load dashboard hourly data");
  }
});

restAliasesRouter.get("/dashboard/gprs", async (request, response) => {
  try {
    const result = await loadUpstreamCandidates(
      request,
      response,
      ["/GPRSOnlineStatus/Read", "/api/GPRSOnlineStatus/Read"],
      addPagingDefaults(buildQueryBody(request), 200),
    );
    relayUpstreamResult(response, result);
  } catch (error) {
    sendAliasFailure(response, error, "Failed to load dashboard gprs data");
  }
});

restAliasesRouter.get("/dashboard/events", async (request, response) => {
  return proxyCanonicalPath(
    request,
    response,
    "/API/EventNotification/Read",
    addPagingDefaults(buildQueryBody(request), 100),
  );
});

restAliasesRouter.get("/reports/non-purchase", async (request, response) => {
  return proxyFromQuery(request, response, "/API/PrepayReport/LongNonpurchaseSituation");
});

restAliasesRouter.get("/reports/low-purchase", async (request, response) => {
  return proxyFromQuery(request, response, "/API/PrepayReport/LowPurchaseSituation");
});

restAliasesRouter.get("/reports/consumption", async (request, response) => {
  return proxyFromQuery(request, response, "/API/PrepayReport/ConsumptionStatistics");
});

restAliasesRouter.get("/reports/daily-amr", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/DailyData");
});

restAliasesRouter.get("/reports/daily-amr/meter", async (request, response) => {
  return proxyFromQuery(request, response, "/api/DailyDataMeter/read");
});

restAliasesRouter.get("/reports/monthly-amr", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/MonthlyData");
});

restAliasesRouter.get("/reports/energy-curve/single", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/ElectricEnergyCurve", {
    curveVariant: "single",
  });
});

restAliasesRouter.get("/reports/energy-curve/three-phase", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/ElectricEnergyCurve", {
    curveVariant: "three-phase",
  });
});

restAliasesRouter.get("/reports/energy-curve/ct", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/ElectricEnergyCurve", {
    curveVariant: "ct",
  });
});

restAliasesRouter.get("/reports/daily-yield", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/DailyData", {
    reportType: "yield",
  });
});

restAliasesRouter.get("/reports/monthly-yield", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/MonthlyData", {
    reportType: "yield",
  });
});

restAliasesRouter.get("/reports/events", async (request, response) => {
  return proxyCanonicalPath(
    request,
    response,
    "/API/EventNotification/Read",
    addPagingDefaults(buildQueryBody(request), 100),
  );
});

restAliasesRouter.get("/reports/instantaneous", async (request, response) => {
  return proxyFromQuery(request, response, "/API/LoadProfile/InstantaneousValueCurve");
});

restAliasesRouter.get("/DailyDataMeter/readHourly", async (request, response) => {
  try {
    const result = await loadUpstreamCandidates(
      request,
      response,
      ["/api/DailyDataMeter/readHourly", "/DailyDataMeter/readHourly"],
      addPagingDefaults(buildQueryBody(request), 200),
    );
    relayUpstreamResult(response, result);
  } catch (error) {
    sendAliasFailure(response, error, "Failed to load hourly AMR data");
  }
});
