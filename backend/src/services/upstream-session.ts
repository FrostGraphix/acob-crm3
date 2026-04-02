import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  buildCsrfCookieOptions,
  buildSessionCookieOptions,
  CSRF_COOKIE_NAME,
  UPSTREAM_SESSION_COOKIE_NAME,
} from "./auth-cookie.js";
import { env } from "./env.js";
import { createSession } from "./session-store.js";
import { loginToUpstream, type UpstreamResult } from "./upstream.js";

const UPSTREAM_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const CSRF_MAX_AGE_MS = UPSTREAM_SESSION_MAX_AGE_MS;

export class UpstreamSessionError extends Error {
  constructor(message = "Upstream session expired or invalid") {
    super(message);
    this.name = "UpstreamSessionError";
  }
}

interface EnsureUpstreamSessionOptions {
  forceRefresh?: boolean;
}

function createCsrfToken() {
  return randomUUID().replace(/-/g, "");
}

function hasServiceCredentials() {
  return env.upstreamUsername.trim().length > 0 && env.upstreamPassword.trim().length > 0;
}

function resolveCsrfToken(request: AuthenticatedRequest) {
  const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return {
      csrfToken: cookieToken,
      shouldSetCookie: false,
    };
  }

  if (typeof request.csrfToken === "string" && request.csrfToken.trim().length > 0) {
    return {
      csrfToken: request.csrfToken,
      shouldSetCookie: false,
    };
  }

  return {
    csrfToken: createCsrfToken(),
    shouldSetCookie: true,
  };
}

export function isUpstreamAuthFailure(result: UpstreamResult) {
  const reason = result.payload.reason.toLowerCase();

  return (
    result.statusCode === 401 ||
    result.statusCode === 403 ||
    reason.includes("session expired") ||
    reason.includes("session invalid") ||
    reason.includes("session missing") ||
    reason.includes("not authenticated")
  );
}

async function recoverUpstreamSession(
  request: AuthenticatedRequest,
  response: Response,
) {
  if (!hasServiceCredentials()) {
    throw new UpstreamSessionError();
  }

  const upstreamLogin = await loginToUpstream({
    username: env.upstreamUsername.trim(),
    password: env.upstreamPassword.trim(),
  });
  const authenticated =
    upstreamLogin.statusCode < 400 &&
    upstreamLogin.payload.code === 0 &&
    typeof upstreamLogin.upstreamCookie === "string";

  if (!authenticated || !upstreamLogin.upstreamCookie) {
    throw new UpstreamSessionError(
      upstreamLogin.payload.reason || "Upstream session expired or invalid",
    );
  }

  const sessionId =
    request.upstreamSessionId ??
    (request.cookies?.[UPSTREAM_SESSION_COOKIE_NAME] as string | undefined) ??
    randomUUID();
  const { csrfToken, shouldSetCookie } = resolveCsrfToken(request);

  await createSession(sessionId, {
    upstreamCookie: upstreamLogin.upstreamCookie,
    csrfToken,
  });

  response.cookie(
    UPSTREAM_SESSION_COOKIE_NAME,
    sessionId,
    buildSessionCookieOptions(UPSTREAM_SESSION_MAX_AGE_MS),
  );

  if (shouldSetCookie) {
    response.cookie(
      CSRF_COOKIE_NAME,
      csrfToken,
      buildCsrfCookieOptions(CSRF_MAX_AGE_MS),
    );
  }

  request.upstreamCookie = upstreamLogin.upstreamCookie;
  request.upstreamSessionId = sessionId;
  request.csrfToken = csrfToken;

  return upstreamLogin.upstreamCookie;
}

export async function ensureUpstreamSession(
  request: AuthenticatedRequest,
  response: Response,
  options: EnsureUpstreamSessionOptions = {},
) {
  if (request.upstreamCookie && !options.forceRefresh) {
    return request.upstreamCookie;
  }

  return recoverUpstreamSession(request, response);
}

export async function forwardWithUpstreamSessionRecovery(
  request: AuthenticatedRequest,
  response: Response,
  forward: (upstreamCookie: string) => Promise<UpstreamResult>,
) {
  let upstreamCookie = request.upstreamCookie;

  if (!upstreamCookie) {
    upstreamCookie = await ensureUpstreamSession(request, response);
  }

  let result = await forward(upstreamCookie);
  if (!isUpstreamAuthFailure(result)) {
    return result;
  }

  upstreamCookie = await recoverUpstreamSession(request, response);
  result = await forward(upstreamCookie);

  return result;
}
