import axios, { AxiosHeaders, type AxiosError } from "axios";
import type {
  ApiResponse as OdysseyApiResponse,
  CreditTokenRecord as OdysseyCreditTokenRecord,
  DashboardData as OdysseyDashboardData,
  HourlyMeterData as OdysseyHourlyMeterData,
  SiteId as OdysseySiteId,
} from "../../../common/types/odyssey";
import type {
  ActionResponse,
  ApiDataResponse,
  AuthUser,
  CustomerForecastsResponse,
  CustomerSegmentsResponse,
  DashboardData,
  DashboardQueryWindow,
  DashboardSiteOption,
  DataEngineCatalogResponse,
  Envelope,
  OperationalPriorityResponse,
  RevenueLeakageResponse,
  RuntimeEngineCollection,
} from "../types";
import {
  DASHBOARD_REQUEST_TIMEOUT_MS,
  resolveDashboardDataFromSettledResults,
} from "./dashboard-resilience.ts";
import { normalizeTableData } from "./table-data.ts";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

function toQueryParams(body: Record<string, unknown>) {
  return Object.entries(body).reduce<Record<string, string | number | boolean | undefined>>(
    (accumulator, [key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === undefined
      ) {
        accumulator[key] = value;
      }

      return accumulator;
    },
    {},
  );
}

function resolvePathParams(path: string, body: Record<string, unknown>) {
  const row =
    typeof body.row === "object" && body.row !== null
      ? (body.row as Record<string, unknown>)
      : null;

  return path.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const resolved = body[key] ?? row?.[key];
    if (resolved === null || resolved === undefined || String(resolved).trim().length === 0) {
      throw new Error(`Missing path parameter: ${key}`);
    }

    return encodeURIComponent(String(resolved).trim());
  });
}

export interface ProfileActionResult {
  success: boolean;
  message: string;
  user?: AuthUser;
}

export interface NotificationItem {
  id: string;
  type: "warning" | "critical" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  meterId?: string;
}

export interface DocumentRecord {
  id: string;
  bucket_name: string;
  storage_path: string;
  file_name: string;
  content_type?: string | null;
  size_bytes?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  site_code?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentUploadRequest {
  fileName: string;
  title?: string;
  category?: string;
  meterId?: string;
  customerId?: string;
  siteId?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface DocumentUploadResponse {
  upload: {
    path: string;
    token: string;
    signedUrl: string;
  };
  document?: DocumentRecord | null;
}

export interface GlobalSearchResult {
  entityType: "customer" | "meter" | "document" | "theft-case";
  id: string;
  title: string;
  subtitle: string;
  siteCode: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string | null;
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  counts: Record<string, number>;
  results: GlobalSearchResult[];
}

const httpClient = axios.create({
  baseURL: "/",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const key = `${name}=`;
  const parts = document.cookie.split(";");

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(key)) {
      return decodeURIComponent(trimmed.slice(key.length));
    }
  }

  return null;
}

httpClient.interceptors.request.use((config) => {
  const url = config.url ?? "";
  const isLoginPath = url.includes("/api/user/login");

  if (!isLoginPath) {
    const csrfToken = readCookieValue("beverly_csrf");
    if (csrfToken) {
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      config.headers.set("x-csrf-token", csrfToken);
    }
  }

  return config;
});

function toErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<Envelope<null>>;
    const reason = axiosError.response?.data?.reason;
    if (reason) {
      return reason;
    }

    const statusCode = axiosError.response?.status;
    const requestPath = typeof axiosError.config?.url === "string" ? axiosError.config.url : "";
    if (statusCode === 500 && requestPath.includes("/api/user/login")) {
      return "Sign-in service is unavailable. Restart the backend and try again.";
    }

    if (statusCode === 500) {
      return "Server error. Restart the backend and try again.";
    }

    return axiosError.message;
  }

  return error instanceof Error ? error.message : "Request failed";
}

export interface DashboardRequestOptions {
  siteId?: string | null;
  window: DashboardQueryWindow;
}

function mapAlarmChartResult(alarms: Record<string, unknown>) {
  const structuredAlarms =
    alarms.alarms ??
    alarms.alarmData ??
    alarms.alarmList ??
    alarms.data ??
    alarms.rows;

  if (Array.isArray(structuredAlarms) && structuredAlarms.length > 0) {
    return structuredAlarms;
  }

  const labels = Array.isArray(alarms.xData)
    ? alarms.xData.filter((entry): entry is string => typeof entry === "string")
    : [];
  const values = Array.isArray(alarms.yData)
    ? alarms.yData
      .map((entry) => {
        if (typeof entry === "number" && Number.isFinite(entry)) {
          return entry;
        }
        if (typeof entry === "string" && entry.trim().length > 0) {
          const parsed = Number(entry);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })
      .filter((entry): entry is number => entry !== null)
    : [];

  const length = Math.min(labels.length, values.length);
  return length > 0
    ? labels.slice(0, length).map((label, index) => ({
        label,
        value: values[index] ?? 0,
      }))
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readStringField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readNumericField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function formatDateBucket(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
    const [, day, month, year] = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/) ?? [];
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  }

  return value.slice(0, 10);
}

function readDirectSeries(
  source: Record<string, unknown> | null | undefined,
  labelKeys: string[],
  valueKeys: string[],
) {
  if (!source) {
    return null;
  }

  for (const labelKey of labelKeys) {
    for (const valueKey of valueKeys) {
      const labels = Array.isArray(source[labelKey])
        ? source[labelKey].filter((entry): entry is string => typeof entry === "string")
        : [];
      const values = Array.isArray(source[valueKey])
        ? source[valueKey]
          .map((entry) => readNumericField({ value: entry }, ["value"]))
          .filter((entry): entry is number => entry !== null)
        : [];

      if (labels.length > 0 && values.length > 0) {
        return {
          labels,
          values,
        };
      }
    }
  }

  return null;
}

function toDashboardChartSeries(source: Record<string, unknown>) {
  const directSeries = readDirectSeries(source, ["xData", "labels"], ["yData", "values"]);
  return directSeries
    ? {
        xData: directSeries.labels,
        yData: directSeries.values,
      }
    : {
        xData: [],
        yData: [],
      };
}

function formatTimeBucket(value: string) {
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  if (/\d{4}-\d{2}-\d{2}/.test(value) || /\d{2}\/\d{2}\/\d{4}/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  const timeMatch = value.match(/\b(\d{2}:\d{2})/);
  return timeMatch?.[1] ?? value;
}

function normalizeSiteKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function formatSiteLabel(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function readSiteValue(source: Record<string, unknown>) {
  const site = readStringField(source, [
    "site",
    "siteId",
    "stationId",
    "station",
    "siteName",
    "stationName",
    "label",
    "name",
  ]);

  return site && site.toUpperCase() !== "ALL" ? site : null;
}

function buildSeriesFromRows(
  source: Record<string, unknown> | null | undefined,
  options: {
    labelKeys: string[];
    valueKeys: string[];
    labelFormatter?: (value: string) => string;
    aggregate?: "sum" | "average";
  },
) {
  if (!source) {
    return null;
  }

  const rows = normalizeTableData(source).rows;
  if (rows.length === 0) {
    return null;
  }

  const aggregate = options.aggregate ?? "sum";
  const buckets = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    const rawLabel = readStringField(record, options.labelKeys);
    const value = readNumericField(record, options.valueKeys);
    if (!rawLabel || value === null) {
      continue;
    }

    const label = options.labelFormatter ? options.labelFormatter(rawLabel) : rawLabel;
    const current = buckets.get(label) ?? { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    buckets.set(label, current);
  }

  const entries = Array.from(buckets.entries()).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return null;
  }

  return {
    labels: entries.map(([label]) => label),
    values: entries.map(([, entry]) =>
      aggregate === "average" ? entry.total / Math.max(entry.count, 1) : entry.total
    ),
  };
}

function buildAlarmSlicesFromRows(source: Record<string, unknown> | null | undefined) {
  if (!source) {
    return null;
  }

  const rows = normalizeTableData(source).rows;
  if (rows.length === 0) {
    return null;
  }

  const buckets = new Map<string, number>();

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    const label =
      readStringField(record, ["severity", "eventType", "alarmType", "status"]) ?? "Unknown";
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  const slices = Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);

  return slices.length > 0 ? slices : null;
}

function buildChartResult(
  source: Record<string, unknown> | null | undefined,
  labelKeys: string[],
  valueKeys: string[],
) {
  if (!source) {
    return null;
  }

  const directSeries = readDirectSeries(source, labelKeys, valueKeys);
  return directSeries
    ? {
        labels: directSeries.labels,
        values: directSeries.values,
      }
    : null;
}

export function mergeDashboardChartResults(
  primaryResults: {
    purchaseMoney?: Record<string, unknown> | null;
    successRate?: Record<string, unknown> | null;
    alarms?: Record<string, unknown> | null;
    dailyConsumption?: Record<string, unknown> | null;
  },
  fallbackResults: {
    gprs?: Record<string, unknown> | null;
    events?: Record<string, unknown> | null;
    hourly?: Record<string, unknown> | null;
  } = {},
) {
  const purchaseMoney = primaryResults.purchaseMoney ?? null;
  const primarySuccessRate = buildChartResult(
    primaryResults.successRate,
    ["xData", "labels", "successRateLabels", "hourLabels"],
    ["yData", "values", "successRateValues", "hourValues"],
  );
  const primaryAlarms = primaryResults.alarms ? mapAlarmChartResult(primaryResults.alarms) : undefined;
  const primaryDailyConsumption = buildChartResult(
    primaryResults.dailyConsumption,
    ["xData", "labels", "dailyConsumptionXData", "dailyLabels"],
    ["yData", "values", "dailyConsumptionYData", "dailyValues"],
  );

  const successRateSeries = buildSeriesFromRows(fallbackResults.gprs, {
    labelKeys: [
      "collectionDate",
      "updateTime",
      "createTime",
      "gatewayId",
      "id",
      "name",
      "meterId",
      "stationId",
      "site",
    ],
    valueKeys: [
      "successRate",
      "succRate",
      "successRatio",
      "successPercent",
      "onlineRate",
      "communicationSuccessRate",
    ],
    labelFormatter: formatTimeBucket,
    aggregate: "average",
  });
  const fallbackSuccessRate = readDirectSeries(
    fallbackResults.gprs,
    ["xData", "labels", "successRateLabels", "hourLabels"],
    ["yData", "values", "successRateValues", "hourValues"],
  );
  const alarmSlices = buildAlarmSlicesFromRows(fallbackResults.events);
  const directAlarmSlices = fallbackResults.events
    ? mapAlarmChartResult(fallbackResults.events)
    : undefined;
  const hourlyConsumptionSeries = buildSeriesFromRows(fallbackResults.hourly, {
    labelKeys: ["collectionDate", "currentDate", "readDate", "updateTime"],
    valueKeys: ["value", "consumption", "totalEnergy", "energy", "usage", "usage1"],
    labelFormatter: formatDateBucket,
  });
  const directHourlyConsumptionSeries = readDirectSeries(
    fallbackResults.hourly,
    ["xData", "labels", "dailyConsumptionXData", "dailyLabels"],
    ["yData", "values", "dailyConsumptionYData", "dailyValues"],
  );

  return {
    ...(purchaseMoney ?? {}),
    ...(primarySuccessRate ?? successRateSeries ?? fallbackSuccessRate
      ? {
          successRateXData:
            (primarySuccessRate ?? successRateSeries ?? fallbackSuccessRate)?.labels ?? [],
          successRateYData:
            (primarySuccessRate ?? successRateSeries ?? fallbackSuccessRate)?.values ?? [],
        }
      : {}),
    ...(primaryAlarms ?? alarmSlices ?? directAlarmSlices
      ? {
          alarms: primaryAlarms ?? alarmSlices ?? directAlarmSlices,
        }
      : {}),
    ...(primaryDailyConsumption ?? hourlyConsumptionSeries ?? directHourlyConsumptionSeries
      ? {
          dailyConsumptionXData:
            (primaryDailyConsumption ?? hourlyConsumptionSeries ?? directHourlyConsumptionSeries)
              ?.labels ?? [],
          dailyConsumptionYData:
            (primaryDailyConsumption ?? hourlyConsumptionSeries ?? directHourlyConsumptionSeries)
              ?.values ?? [],
        }
      : {}),
  } satisfies Record<string, unknown>;
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  try {
    const response = await httpClient.request<Envelope<T>>({
      url: path,
      method: options.method ?? "POST",
      data: options.method === "GET" ? undefined : options.body ?? {},
      params: options.query,
      timeout: options.timeoutMs,
    });

    const envelope = response.data;

    if (envelope.code !== 0) {
      throw new Error(envelope.reason || "Request failed");
    }

    if (typeof envelope.result === "object" && envelope.result !== null) {
      const resultRecord = envelope.result as Record<string, unknown>;
      if (envelope.meta?.traceId) {
        resultRecord.__metaTraceId = envelope.meta.traceId;
      }
      if (envelope.meta?.serverTime) {
        resultRecord.__metaServerTime = envelope.meta.serverTime;
      }
    }

    return envelope.result;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}

export function getUserInfo() {
  return request<AuthUser>("/api/user/info", { method: "GET" });
}

export async function loginRequest(credentials: {
  username: string;
  password: string;
  portal?: "staff" | "vendor";
  upstreamUsername?: string;
  upstreamPassword?: string;
}) {
  const result = await request<{ user: AuthUser }>("/api/user/login", {
    body: credentials,
  });

  return result.user;
}

export function logoutRequest() {
  return request<{ success: boolean }>("/api/user/logout");
}

export function updateProfileInfo(payload: Record<string, unknown>) {
  return request<ProfileActionResult>("/api/user/updateInfo", {
    body: payload,
  });
}

export function changeLoginPassword(payload: Record<string, unknown>) {
  return request<ActionResponse>("/api/user/modifyLoginPassword", {
    body: payload,
  });
}

export function changeAuthorizationPassword(payload: Record<string, unknown>) {
  return request<ActionResponse>("/api/user/modifyAuthorizationPassword", {
    body: payload,
  });
}

export function listNotifications() {
  return request<NotificationItem[]>("/api/notifications", {
    method: "GET",
  });
}

export function dismissNotifications(ids: string[]) {
  return request<{ dismissedCount: number }>("/api/notifications/dismiss", {
    body: { ids },
  });
}

export function dismissAllNotifications() {
  return request<{ dismissedCount: number }>("/api/notifications/dismiss-all", {
    body: {},
  });
}

export async function loadDashboardSites(): Promise<DashboardSiteOption[]> {
  const result = await request<unknown>("/api/meters/stats/sites", {
    method: "GET",
    timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
  });
  const source = typeof result === "object" && result !== null
    ? (result as Record<string, unknown>)
    : {};
  const preferredSites = Array.isArray(source.availableSites)
    ? source.availableSites
        .filter((site): site is string => typeof site === "string" && site.trim().length > 0)
        .map((site) => ({
          value: site,
          label: formatSiteLabel(site),
        }))
    : [];

  if (preferredSites.length > 0) {
    return preferredSites;
  }

  const rows = normalizeTableData(result, "/api/meters/stats/sites").rows;
  const seen = new Set<string>();
  const options: DashboardSiteOption[] = [];

  for (const row of rows) {
    const site = readSiteValue(row);
    if (!site) {
      continue;
    }

    const key = normalizeSiteKey(site);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    options.push({
      value: site,
      label: formatSiteLabel(site),
    });
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export async function loadDashboard(options: DashboardRequestOptions): Promise<DashboardData> {
  const siteId =
    options.siteId && options.siteId.trim().length > 0 && options.siteId.toUpperCase() !== "ALL"
      ? options.siteId
      : undefined;
  const scope = {
    from: options.window.from,
    to: options.window.to,
    ...(siteId ? { siteId } : {}),
  };

  const [
    summaryResult,
    purchaseMoneyResult,
    successRateResult,
    alarmsResult,
    dailyConsumptionResult,
    gprsResult,
    eventsResult,
    hourlyResult,
  ] = await Promise.allSettled([
    request<Record<string, unknown>>("/api/dashboard", {
      method: "GET",
      query: scope,
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
    request<Record<string, unknown>>("/api/dashboard/readLineChart", {
      body: { ...scope, type: 1 },
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
    request<Record<string, unknown>>("/api/dashboard/readLineChart", {
      body: { ...scope, type: 2 },
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
    request<Record<string, unknown>>("/api/dashboard/readLineChart", {
      body: { ...scope, type: 3 },
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
    request<Record<string, unknown>>("/api/dashboard/readLineChart", {
      body: { ...scope, type: 4 },
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
    request<Record<string, unknown>>("/api/dashboard/gprs", {
      method: "GET",
      query: { ...scope, pageNumber: 1, pageSize: 24 },
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
    request<Record<string, unknown>>("/api/dashboard/events", {
      method: "GET",
      query: { ...scope, pageNumber: 1, pageSize: 100 },
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
    request<Record<string, unknown>>("/api/dashboard/hourly", {
      method: "GET",
      query: { ...scope, pageNumber: 1, pageSize: 200 },
      timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
    }),
  ]);

  const chartResults = [
    purchaseMoneyResult,
    successRateResult,
    alarmsResult,
    dailyConsumptionResult,
    gprsResult,
    eventsResult,
    hourlyResult,
  ];

  const mergedChartResult = mergeDashboardChartResults(
    {
      purchaseMoney: purchaseMoneyResult.status === "fulfilled" ? purchaseMoneyResult.value : null,
      successRate: successRateResult.status === "fulfilled" ? successRateResult.value : null,
      alarms: alarmsResult.status === "fulfilled" ? alarmsResult.value : null,
      dailyConsumption:
        dailyConsumptionResult.status === "fulfilled" ? dailyConsumptionResult.value : null,
    },
    {
      gprs: gprsResult.status === "fulfilled" ? gprsResult.value : null,
      events: eventsResult.status === "fulfilled" ? eventsResult.value : null,
      hourly: hourlyResult.status === "fulfilled" ? hourlyResult.value : null,
    },
  );

  return resolveDashboardDataFromSettledResults(
    summaryResult,
    chartResults,
    mergedChartResult,
  );
}

function mapDashboardSummaryRecord(record: Record<string, unknown>): OdysseyDashboardData {
  return {
    sites: [],
    portfolioRevenue: 0,
    portfolioEnergyKwh: 0,
    portfolioActiveMeters: 0,
    recentTokens: [],
    recentEvents: [],
    lastUpdated: typeof record.lastUpdatedAt === "string" ? record.lastUpdatedAt : new Date().toISOString(),
    accountCount: readNumericField(record, ["totalAccountCount", "accountCount"]) ?? 0,
    purchaseTimes: readNumericField(record, ["totalPurchaseTimes", "purchaseTimes"]) ?? 0,
    purchaseUnit: readNumericField(record, ["totalPurchaseUnit", "purchaseUnit"]) ?? 0,
    purchaseMoney: readNumericField(record, ["totalPurchaseMoney", "purchaseMoney"]) ?? 0,
  };
}

function toOdysseySiteId(value: unknown, fallback: OdysseySiteId = "UMAISHA") {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (
    raw === "KYAKALE" ||
    raw === "MUSHA" ||
    raw === "UMAISHA" ||
    raw === "TUNGA" ||
    raw === "OGUFA"
      ? raw
      : fallback
  ) as OdysseySiteId;
}

export const apiClient = {
  async getDashboard(from: string, to: string, siteId?: OdysseySiteId): Promise<OdysseyDashboardData> {
    const scope = {
      from,
      to,
      ...(siteId ? { siteId } : {}),
    };
    const result = await request<Record<string, unknown>>("/api/dashboard", {
      method: "GET",
      query: scope,
    });
    return mapDashboardSummaryRecord(result);
  },
  dashboard: {
    async readPanelGroup() {
      const result = await request<Record<string, unknown>>("/api/dashboard/readPanelGroup", {
        body: {},
        timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
      });
      return {
        totalAccountCount: Number(result.totalAccountCount ?? 0),
        totalPurchaseTimes: Number(result.totalPurchaseTimes ?? 0),
        totalPurchaseUnit: Number(result.totalPurchaseUnit ?? 0),
        totalPurchaseMoney: Number(result.totalPurchaseMoney ?? 0),
      };
    },
    async readLineChart(req: {
      from: string;
      to: string;
      siteId?: OdysseySiteId;
      type: number;
      days?: number;
    }) {
      const result = await request<Record<string, unknown>>("/api/dashboard/readLineChart", {
        body: req,
        timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS,
      });
      return toDashboardChartSeries(result);
    },
  },
  async getHourlyData(siteId: OdysseySiteId | "ALL", from: string, to: string): Promise<OdysseyHourlyMeterData[]> {
    const result = await request<unknown>("/api/dashboard/hourly", {
      method: "GET",
      query: {
        siteId,
        from,
        to,
      },
    });
    const rows = normalizeTableData(result, "/api/dashboard/hourly").rows;
    const fallbackSite = siteId === "ALL" ? "UMAISHA" : siteId;

    return rows.map((row, index) => ({
      id: String(row.id ?? `${index}`),
      meterSN: String(row.meterId ?? row.meterSN ?? ""),
      timestamp: String(row.collectionDate ?? row.timestamp ?? row.updateTime ?? new Date().toISOString()),
      hour: Number(row.hour ?? 0),
      activeEnergyImport: Number(row.consumption ?? row.activeEnergyImport ?? row.totalEnergy ?? 0),
      activeEnergyExport: Number(row.activeEnergyExport ?? 0),
      reactiveEnergyImport: Number(row.reactiveEnergyImport ?? 0),
      reactiveEnergyExport: Number(row.reactiveEnergyExport ?? 0),
      voltage: typeof row.voltage === "number" ? row.voltage : undefined,
      current: typeof row.current === "number" ? row.current : undefined,
      powerFactor: typeof row.powerFactor === "number" ? row.powerFactor : undefined,
      siteId: toOdysseySiteId(row.stationId ?? row.siteId ?? row.site, fallbackSite),
    }));
  },
  async getGprsStatus(): Promise<OdysseyApiResponse<unknown[]>> {
    const result = await request<unknown[]>("/api/dashboard/gprs", {
      method: "GET",
    });
    return {
      success: true,
      data: result,
    };
  },
  async getTokenRecords(
    siteId: OdysseySiteId | "ALL",
    from: string,
    to: string,
  ): Promise<OdysseyCreditTokenRecord[]> {
    const result = await request<unknown>("/api/token/creditTokenRecord/readMore", {
      body: {
        from,
        to,
        ...(siteId !== "ALL" ? { siteId } : {}),
        pageNumber: 1,
        pageSize: 100,
      },
    });
    const rows = normalizeTableData(result, "/api/token/creditTokenRecord/readMore").rows;
    const fallbackSite = siteId === "ALL" ? "UMAISHA" : siteId;

    return rows.map((row, index) => ({
      id: String(row.receiptId ?? row.id ?? `${index}`),
      meterSN: String(row.meterId ?? row.meterSN ?? ""),
      tokenValue: String(row.token ?? row.tokenValue ?? ""),
      amount: Number(row.totalPaid ?? row.amount ?? 0),
      energyUnits: typeof row.totalUnit === "number" ? row.totalUnit : undefined,
      kwh: typeof row.totalUnit === "number" ? row.totalUnit : undefined,
      timestamp: String(row.createTime ?? row.timestamp ?? new Date().toISOString()),
      customerId: typeof row.customerId === "string" ? row.customerId : undefined,
      customerName: typeof row.customerName === "string" ? row.customerName : undefined,
      accountNo: typeof row.accountNo === "string" ? row.accountNo : undefined,
      tariffRate: typeof row.tariffId === "string" ? row.tariffId : undefined,
      siteId: toOdysseySiteId(row.stationId ?? row.siteId ?? row.site, fallbackSite),
      operatorId: typeof row.operatorId === "string" ? row.operatorId : undefined,
      status: "ACTIVE",
    }));
  },
};

export async function loadTableData(
  path: string,
  body: Record<string, unknown>,
  method: "GET" | "POST" = "POST",
) {
  const result = await request<unknown>(path, method === "GET"
    ? {
        method,
        query: toQueryParams(body),
      }
    : {
        body,
      });
  return normalizeTableData(result, path) satisfies ApiDataResponse;
}

export function runPageAction(path: string, body: Record<string, unknown>) {
  return request<ActionResponse>(resolvePathParams(path, body), { body });
}

export function loadRuntimeEngines() {
  return request<{ engines: RuntimeEngineCollection }>("/api/runtime/engines", {
    method: "GET",
  });
}

export function loadRuntimeEngineCatalog() {
  return request<DataEngineCatalogResponse>("/api/runtime/engine-catalog", {
    method: "GET",
  });
}

export function startRuntimeEngine(
  engine: "analysis" | "site-consumption" | "customer-facts" | "revenue-leakage" | "operational-priority",
) {
  return request<{ status: unknown }>(`/api/runtime/engines/${engine}/start`, {
    body: {},
  });
}

export function stopRuntimeEngine(
  engine: "analysis" | "site-consumption" | "customer-facts" | "revenue-leakage" | "operational-priority",
) {
  return request<{ status: unknown }>(`/api/runtime/engines/${engine}/stop`, {
    body: {},
  });
}

export function runRuntimeEngine(
  engine: "analysis" | "site-consumption" | "customer-facts" | "revenue-leakage" | "operational-priority",
) {
  return request<{ status: unknown; runResult: { accepted: boolean; reason: string } }>(
    `/api/runtime/engines/${engine}/run`,
    {
      body: {},
    },
  );
}

export function loadCustomerSegments(params: { siteId?: string; limit?: number } = {}) {
  return request<CustomerSegmentsResponse>("/api/customer/segments", {
    method: "GET",
    query: params,
  });
}

export function loadCustomerForecasts(params: { siteId?: string; limit?: number } = {}) {
  return request<CustomerForecastsResponse>("/api/customer/forecasts", {
    method: "GET",
    query: params,
  });
}

export function loadRevenueLeakage(params: { siteId?: string } = {}) {
  return request<RevenueLeakageResponse>("/api/runtime/revenue-leakage", {
    method: "GET",
    query: params,
  });
}

export function loadOperationalPriority(params: { siteId?: string } = {}) {
  return request<OperationalPriorityResponse>("/api/runtime/operational-priority", {
    method: "GET",
    query: params,
  });
}

export function listDocuments(params: {
  category?: string;
  meterId?: string;
  customerId?: string;
  siteId?: string;
  limit?: number;
} = {}) {
  return request<DocumentRecord[]>("/api/documents", {
    method: "GET",
    query: params,
  });
}

export function createDocumentUploadUrl(payload: DocumentUploadRequest) {
  return request<DocumentUploadResponse>("/api/documents/upload-url", {
    body: payload as unknown as Record<string, unknown>,
  });
}

export function createDocumentDownloadUrl(payload: {
  storagePath: string;
  expiresIn?: number;
}) {
  return request<{ path: string; signedUrl: string }>("/api/documents/download-url", {
    body: payload,
  });
}

export function searchGlobal(params: {
  query: string;
  siteId?: string;
  limit?: number;
}) {
  return request<GlobalSearchResponse>("/api/search/global", {
    method: "GET",
    query: {
      q: params.query,
      siteId: params.siteId,
      limit: params.limit,
    },
  });
}
