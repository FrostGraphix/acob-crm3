import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthSessionToken } from "../../../common/types/index.js";
import {
  buildRefreshCookieOptions,
  buildSessionCookieOptions,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UPSTREAM_SESSION_COOKIE_NAME,
} from "../services/auth-cookie.js";
import { env } from "../services/env.js";
import { sendEnvelope } from "../services/response.js";
import { getSession } from "../services/session-store.js";
import {
  getSupabaseUserFromAccessToken,
  isSupabaseAuthEnabled,
  refreshSupabaseAccessToken,
} from "../services/supabase.js";

export interface AuthenticatedRequest extends Request {
  authSession?: AuthSessionToken;
  upstreamCookie?: string;
  csrfToken?: string;
}

function isPublicPath(pathname: string) {
  return pathname === "/api/user/login";
}

const SUPABASE_REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setRefreshedSupabaseCookies(
  response: Response,
  refreshedSession: NonNullable<Awaited<ReturnType<typeof refreshSupabaseAccessToken>>>,
) {
  response.cookie(
    SESSION_COOKIE_NAME,
    refreshedSession.accessToken,
    buildSessionCookieOptions(refreshedSession.maxAgeMs),
  );

  if (refreshedSession.refreshToken) {
    response.cookie(
      REFRESH_COOKIE_NAME,
      refreshedSession.refreshToken,
      buildRefreshCookieOptions(SUPABASE_REFRESH_MAX_AGE_MS),
    );
  }
}

export async function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  if (isPublicPath(request.path)) {
    next();
    return;
  }

  const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

  if (!token) {
    sendEnvelope(response, 401, null, "Not authenticated", 1);
    return;
  }

  let legacySession: AuthSessionToken | null = null;
  try {
    legacySession = jwt.verify(token, env.jwtSecret) as AuthSessionToken;
  } catch {
    // Try Supabase flow below when enabled.
  }

  if (legacySession) {
    let storedSession = null;
    try {
      storedSession = await getSession(legacySession.sessionId);
    } catch {
      sendEnvelope(response, 503, null, "Session store unavailable", 1);
      return;
    }

    if (!storedSession) {
      sendEnvelope(response, 401, null, "Session expired or invalid", 1);
      return;
    }

    request.authSession = legacySession;
    request.upstreamCookie = storedSession.upstreamCookie;
    request.csrfToken = storedSession.csrfToken;
    next();
    return;
  }

  if (!isSupabaseAuthEnabled()) {
    sendEnvelope(response, 401, null, "Session expired or invalid", 1);
    return;
  }

  const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  let user = await getSupabaseUserFromAccessToken(token);
  if (!user && refreshToken) {
    const refreshedSession = await refreshSupabaseAccessToken(refreshToken);
    if (refreshedSession) {
      setRefreshedSupabaseCookies(response, refreshedSession);
      user = refreshedSession.user;
    }
  }

  if (!user) {
    sendEnvelope(response, 401, null, "Session expired or invalid", 1);
    return;
  }

  const upstreamSessionId =
    request.cookies?.[UPSTREAM_SESSION_COOKIE_NAME] as string | undefined;
  let upstreamSession = null;
  if (upstreamSessionId) {
    try {
      upstreamSession = await getSession(upstreamSessionId);
    } catch {
      sendEnvelope(response, 503, null, "Session store unavailable", 1);
      return;
    }
  }

  if (upstreamSessionId && !upstreamSession) {
    sendEnvelope(response, 401, null, "Upstream session expired or invalid", 1);
    return;
  }

  if (!upstreamSession?.upstreamCookie) {
    sendEnvelope(response, 401, null, "Upstream session expired or invalid", 1);
    return;
  }

  request.authSession = {
    user,
    sessionId: upstreamSessionId ?? `supabase:${user.username}`,
    issuedAt: Date.now(),
  };
  request.upstreamCookie = upstreamSession?.upstreamCookie;
  request.csrfToken = upstreamSession?.csrfToken;

  next();
}
