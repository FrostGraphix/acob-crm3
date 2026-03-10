import type { Response } from "express";
import type { AmrResponse } from "../../../common/types/index.js";

export function envelope<T>(
  result: T,
  reason = "OK",
  code = 0,
): AmrResponse<T> {
  return {
    code,
    reason,
    result,
  };
}

export function sendEnvelope<T>(
  response: Response,
  statusCode: number,
  result: T,
  reason = "OK",
  code = 0,
) {
  response.status(statusCode).json(envelope(result, reason, code));
}
