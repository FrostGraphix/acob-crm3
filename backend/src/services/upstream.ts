import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import type { AmrResponse } from "../../../common/types/index.js";
import { env } from "./env.js";

export interface UpstreamResult {
  statusCode: number;
  payload: AmrResponse<unknown>;
}

const upstreamClient: AxiosInstance = axios.create({
  baseURL: env.upstreamApiUrl,
  timeout: 12_000,
  headers: {
    "Content-Type": "application/json",
  },
});

function normalizePayload(
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

export async function forwardToUpstream(
  pathname: string,
  body: Record<string, unknown>,
  cookieHeader: string | undefined,
): Promise<UpstreamResult> {
  const response = await upstreamClient.post(pathname, body, {
    headers: cookieHeader
      ? {
          Cookie: cookieHeader,
        }
      : undefined,
    validateStatus: () => true,
  });

  return {
    statusCode: response.status,
    payload: normalizePayload(response),
  };
}
