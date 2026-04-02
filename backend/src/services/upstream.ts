import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import type { AmrResponse } from "../../../common/types/index.js";
import { env } from "./env.js";

export interface UpstreamResult {
  statusCode: number;
  payload: AmrResponse<unknown>;
}

export interface UpstreamLoginResult extends UpstreamResult {
  upstreamCookie?: string;
}

export interface UpstreamHealth {
  ok: boolean;
  detail: string;
}

const upstreamClient: AxiosInstance = axios.create({
  baseURL: env.upstreamApiUrl,
  timeout: 12_000,
  headers: {
    "Content-Type": "application/json",
  },
});

export function normalizePayload(
  response: AxiosResponse<unknown>,
): AmrResponse<unknown> {
  const payload = response.data;

  if (
    typeof payload === "object" &&
    payload !== null &&
    "code" in payload &&
    "reason" in payload &&
    "result" in payload
  ) {
    return payload as AmrResponse<unknown>;
  }

  return {
    code: response.status >= 400 ? 1 : 0,
    reason: response.statusText || "OK",
    result: payload,
  };
}

function extractCookieHeader(setCookieHeader: string | string[] | undefined) {
  if (!setCookieHeader) {
    return undefined;
  }

  const setCookieValues = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const pairs = setCookieValues
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter((cookiePair): cookiePair is string => Boolean(cookiePair));

  if (pairs.length === 0) {
    return undefined;
  }

  return pairs.join("; ");
}

function isCookieHeaderValue(authToken: string) {
  return authToken.includes("=");
}

export async function forwardToUpstream(
  pathname: string,
  body: Record<string, unknown>,
  authToken: string | undefined,
  options: { timeoutMs?: number } = {},
): Promise<UpstreamResult> {
  const headers: Record<string, string> = {};
  if (authToken) {
    if (isCookieHeaderValue(authToken)) {
      headers.Cookie = authToken;
    } else {
      headers.Authorization = `Bearer ${authToken}`;
    }
  }

  const response = await upstreamClient.post(pathname, body, {
    headers,
    timeout: options.timeoutMs,
    validateStatus: () => true,
  });

  return {
    statusCode: response.status,
    payload: normalizePayload(response),
  };
}

function extractUpstreamToken(payload: AmrResponse<unknown>): string | undefined {
  if (
    payload.code === 0 &&
    typeof payload.result === "object" &&
    payload.result !== null &&
    "token" in payload.result
  ) {
    const token = (payload.result as Record<string, unknown>).token;
    return typeof token === "string" ? token : undefined;
  }
  return undefined;
}

export async function loginToUpstream(
  credentials: { username: string; password: string },
): Promise<UpstreamLoginResult> {
  const username = credentials.username;
  const response = await upstreamClient.post("/api/user/login", {
    userId: username,
    username,
    password: credentials.password,
  }, {
    validateStatus: () => true,
  });

  const payload = normalizePayload(response);
  const cookieFromHeader = extractCookieHeader(response.headers["set-cookie"]);
  const tokenFromBody = extractUpstreamToken(payload);

  return {
    statusCode: response.status,
    payload,
    upstreamCookie: tokenFromBody ?? cookieFromHeader,
  };
}

export async function logoutFromUpstream(authToken: string | undefined) {
  if (!authToken) {
    return;
  }

  const headers: Record<string, string> = {};
  if (isCookieHeaderValue(authToken)) {
    headers.Cookie = authToken;
  } else {
    headers.Authorization = `Bearer ${authToken}`;
  }

  await upstreamClient.post(
    "/api/user/logout",
    {},
    {
      headers,
      validateStatus: () => true,
    },
  );
}

export async function checkUpstreamHealth(): Promise<UpstreamHealth> {
  try {
    const response = await upstreamClient.get("/", {
      timeout: 5_000,
      validateStatus: () => true,
    });

    return {
      ok: true,
      detail: `reachable (${response.status})`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unreachable";
    return {
      ok: false,
      detail: message,
    };
  }
}
