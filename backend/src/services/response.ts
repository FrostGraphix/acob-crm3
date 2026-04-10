import type { Response } from "express";
import type { AmrResponse } from "../../../common/types/index.js";

export function envelope<T>(
  result: T,
  reason = "OK",
  code = 0,
  meta?: {
    traceId?: string;
    serverTime?: string;
    policyDecision?: "allowed" | "denied";
  },
): AmrResponse<T> {
  return {
    code,
    reason,
    result,
    ...(meta ? { meta } : {}),
  };
}

export function sendEnvelope<T>(
  response: Response,
  statusCode: number,
  result: T,
  reason = "OK",
  code = 0,
  meta: {
    traceId?: string;
    serverTime?: string;
    policyDecision?: "allowed" | "denied";
  } = {},
) {
  const traceId =
    (response.locals && typeof response.locals.traceId === "string"
      ? response.locals.traceId
      : undefined) ?? meta.traceId;
  response
    .status(statusCode)
    .json(
      envelope(result, reason, code, {
        serverTime: new Date().toISOString(),
        ...meta,
        ...(traceId ? { traceId } : {}),
      }),
    );
}
