import axios, { type AxiosError } from "axios";
import type {
  ActionResponse,
  ApiDataResponse,
  AuthUser,
  DashboardData,
  Envelope,
} from "../types";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}

const apiClient = axios.create({
  baseURL: "/",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function toErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<Envelope<null>>;
    return axiosError.response?.data?.reason ?? axiosError.message;
  }

  return error instanceof Error ? error.message : "Request failed";
}

async function request<T>(path: string, options: RequestOptions = {}) {
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

export function loadDashboard() {
  return request<DashboardData>("/api/dashboard/readPanelGroup", { body: {} });
}

export function loadTableData(path: string, body: Record<string, unknown>) {
  return request<ApiDataResponse>(path, { body });
}

export function runPageAction(path: string, body: Record<string, unknown>) {
  return request<ActionResponse>(path, { body });
}
