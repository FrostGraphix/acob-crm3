import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import { CSRF_COOKIE_NAME } from "../services/auth-cookie.js";
import { sendEnvelope } from "../services/response.js";

function resolvePathname(request: AuthenticatedRequest) {
  const originalUrl = request.originalUrl || request.url || "/";

  try {
    return new URL(originalUrl, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function isCsrfExemptPath(pathname: string) {
  return pathname === "/api/user/login";
}

export function requireCsrf(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  if (request.method !== "POST") {
    next();
    return;
  }

  const pathname = resolvePathname(request);
  if (isCsrfExemptPath(pathname)) {
    next();
    return;
  }

  const sessionToken = request.csrfToken;
  const headerToken = request.headers["x-csrf-token"];
  const cookieToken = request.cookies?.[CSRF_COOKIE_NAME] as string | undefined;

  const normalizedHeader = Array.isArray(headerToken)
    ? headerToken[0]
    : headerToken;

  if (
    typeof sessionToken !== "string" ||
    typeof normalizedHeader !== "string" ||
    typeof cookieToken !== "string" ||
    normalizedHeader !== sessionToken ||
    cookieToken !== sessionToken
  ) {
    sendEnvelope(response, 403, null, "Invalid CSRF token", 1);
    return;
  }

  next();
}

