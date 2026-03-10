import type { NextFunction, Request, Response } from "express";
import { sendEnvelope } from "../services/response.js";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 240;
const buckets = new Map<string, RateLimitBucket>();

function getClientKey(request: Request) {
  const forwarded = request.headers["x-forwarded-for"];

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0] ?? "unknown";
  }

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return request.ip || "unknown";
}

export function rateLimitMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const now = Date.now();
  const key = getClientKey(request);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    next();
    return;
  }

  current.count += 1;

  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    sendEnvelope(response, 429, null, "Too many requests", 1);
    return;
  }

  next();
}
