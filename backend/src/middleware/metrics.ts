import type { NextFunction, Request, Response } from "express";
import { recordRequestMetric } from "../services/metrics.js";

function resolvePathname(request: Request) {
  const originalUrl = request.originalUrl || request.url || "/";

  try {
    return new URL(originalUrl, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

export function metricsMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const startedAt = process.hrtime.bigint();

  response.on("finish", () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNs) / 1_000_000;
    recordRequestMetric(resolvePathname(request), response.statusCode, durationMs);
  });

  next();
}

