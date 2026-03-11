import axios, { AxiosHeaders, type AxiosError } from "axios";
import type {
  ActionResponse,
  ApiDataResponse,
  AuthUser,
  DashboardData,
  Envelope,
} from "../types";
import { mapDashboardData } from "./dashboard-mapper";
import { normalizeTableData } from "./table-data";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
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

const apiClient = axios.create({
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

apiClient.interceptors.request.use((config) => {
  const url = config.url ?? "";
  const isLoginPath = url.includes("/api/user/login");

  if (!isLoginPath) {
    const csrfToken = readCookieValue("acob_csrf");
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
    return axiosError.response?.data?.reason ?? axiosError.message;
  }

  return error instanceof Error ? error.message : "Request failed";
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  try {
    const response = await apiClient.request<Envelope<T>>({
      url: path,
      method: options.method ?? "POST",
      data: options.method === "GET" ? undefined : options.body ?? {},
    });

    const envelope = response.data;

    if (envelope.code !== 0) {
      throw new Error(envelope.reason || "Request failed");
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

export async function loadDashboard(): Promise<DashboardData> {
  const [panelResult, chartResult] = await Promise.all([
    request<Record<string, unknown>>("/api/dashboard/readPanelGroup", { body: {} }),
    request<Record<string, unknown>>("/api/dashboard/readLineChart", { body: {} }),
  ]);

  return mapDashboardData(panelResult, chartResult);
}

export async function loadTableData(path: string, body: Record<string, unknown>) {
  const result = await request<unknown>(path, { body });
  return normalizeTableData(result, path) satisfies ApiDataResponse;
}

export function runPageAction(path: string, body: Record<string, unknown>) {
  return request<ActionResponse>(path, { body });
}
