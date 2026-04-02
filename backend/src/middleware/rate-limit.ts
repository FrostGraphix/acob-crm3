import type { NextFunction, Request, Response } from "express";
import { env } from "../services/env.js";
import { sendEnvelope } from "../services/response.js";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = env.rateLimitWindowMs;
const MAX_REQUESTS_PER_WINDOW = env.rateLimitMaxRequestsPerWindow;
const buckets = new Map<string, RateLimitBucket>();
const MAX_TRACKED_BUCKETS = 10_000;

function normalizeClientKey(value: string) {
  return value.trim().slice(0, 128);
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function trimBucketCache() {
  while (buckets.size > MAX_TRACKED_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) {
      return;
    }

    buckets.delete(oldestKey);
  }
}

function getClientKey(request: Request) {
  if (env.rateLimitTrustForwardedFor) {
    const forwarded = request.headers["x-forwarded-for"];

    if (Array.isArray(forwarded) && forwarded.length > 0) {
      const candidate = forwarded[0] ?? "";
      const normalized = normalizeClientKey(candidate.split(",")[0] ?? "");
      if (normalized.length > 0) {
        return normalized;
      }
    }

    if (typeof forwarded === "string" && forwarded.length > 0) {
      const normalized = normalizeClientKey(forwarded.split(",")[0] ?? "");
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return normalizeClientKey(request.ip || "unknown");
}

export function rateLimitMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const now = Date.now();
  pruneExpiredBuckets(now);
  const key = getClientKey(request);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    trimBucketCache();
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
