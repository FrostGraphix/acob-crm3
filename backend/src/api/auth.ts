import { Router } from "express";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthSessionToken, AuthUser } from "../../../common/types/index.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import {
  buildCsrfCookieOptions,
  buildRefreshCookieOptions,
  buildSessionCookieOptions,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  UPSTREAM_SESSION_COOKIE_NAME,
} from "../services/auth-cookie.js";
import { env } from "../services/env.js";
import { sendEnvelope } from "../services/response.js";
import { createSession, deleteSession, getSession } from "../services/session-store.js";
import {
  isSupabaseAuthEnabled,
  revokeSupabaseSession,
  signInWithSupabasePassword,
} from "../services/supabase.js";
import { extractUpstreamPermissions } from "../services/upstream-permissions.js";
import { loginToUpstream, logoutFromUpstream } from "../services/upstream.js";

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

const LEGACY_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SUPABASE_REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CSRF_MAX_AGE_MS = LEGACY_SESSION_MAX_AGE_MS;

function createLegacyUser(username: string, permissions: string[] = []): AuthUser {
  return {
    username,
    displayName: username === "admin" ? "ACOB Admin" : username,
    role: "Administrator",
    permissions,
    email: username.includes("@") ? username : undefined,
  };
}

function signLegacySession(user: AuthUser, sessionId: string) {
  const payload: AuthSessionToken = {
    user,
    sessionId,
    issuedAt: Date.now(),
  };

  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: "8h",
  });
}

function readLoginBody(body: unknown): LoginBody {
  return typeof body === "object" && body !== null ? (body as LoginBody) : {};
}

function parseUsername(body: LoginBody, fallback: string) {
  return typeof body.username === "string" && body.username.trim().length > 0
    ? body.username.trim()
    : fallback;
}

function parsePassword(body: LoginBody) {
  return typeof body.password === "string" ? body.password.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function mapUpstreamUser(
  result: unknown,
  fallbackUsername: string,
  permissions: string[] = [],
): AuthUser {
  const root = asRecord(result);
  const nestedUser = asRecord(root.user);
  const source = Object.keys(nestedUser).length > 0 ? nestedUser : root;

  const username =
    firstString(source, ["username", "userName", "loginName", "account", "email"]) ??
    fallbackUsername;
  const displayName =
    firstString(source, ["displayName", "fullName", "realName", "name"]) ??
    username;
  const role =
    firstString(source, ["role", "roleName", "userRole"]) ??
    "Administrator";
  const email = firstString(source, ["email", "emailAddress", "mail"]);
  const phone = firstString(source, ["phone", "phoneNumber", "mobile", "mobilePhone"]);
  const address = firstString(source, ["address", "customerAddress", "location"]);
  const remark = firstString(source, ["remark", "note", "description"]);

  return {
    username,
    displayName,
    role,
    permissions,
    email: email ?? undefined,
    phone: phone ?? undefined,
    address: address ?? undefined,
    remark: remark ?? undefined,
  };
}

function createCsrfToken() {
  return randomUUID().replace(/-/g, "");
}

function canUseDegradedLegacyLogin(username: string, password: string) {
  const configuredUsername = env.upstreamUsername.trim();
  const configuredPassword = env.upstreamPassword.trim();

  return (
    !env.strictDependencyStartup &&
    configuredUsername.length > 0 &&
    configuredPassword.length > 0 &&
    username === configuredUsername &&
    password === configuredPassword
  );
}

async function sendLegacyLoginSuccess(
  response: Parameters<typeof sendEnvelope>[0],
  user: AuthUser,
  upstreamCookie?: string,
) {
  const sessionId = randomUUID();
  const csrfToken = createCsrfToken();

  try {
    await createSession(sessionId, {
      upstreamCookie,
      csrfToken,
    });
  } catch {
    sendEnvelope(response, 503, null, "Session store unavailable", 1);
    return;
  }

  const token = signLegacySession(user, sessionId);

  response.cookie(
    SESSION_COOKIE_NAME,
    token,
    buildSessionCookieOptions(LEGACY_SESSION_MAX_AGE_MS),
  );
  response.cookie(
    CSRF_COOKIE_NAME,
    csrfToken,
    buildCsrfCookieOptions(CSRF_MAX_AGE_MS),
  );
  response.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
  response.clearCookie(UPSTREAM_SESSION_COOKIE_NAME, { path: "/" });

  sendEnvelope(response, 200, { user, token, csrfToken });
}

function resolveSupabaseUpstreamCredentials(username: string, password: string) {
  const hasServiceCredentials =
    env.upstreamUsername.trim().length > 0 &&
    env.upstreamPassword.trim().length > 0;

  if (hasServiceCredentials) {
    return {
      username: env.upstreamUsername.trim(),
      password: env.upstreamPassword.trim(),
    };
  }

  return { username, password };
}

async function closeUpstreamSession(sessionId: string) {
  const existingSession = await getSession(sessionId);

  if (existingSession?.upstreamCookie) {
    try {
      await logoutFromUpstream(existingSession.upstreamCookie);
    } catch {
      // Cookie/session cleanup still happens locally.
    }
  }

  await deleteSession(sessionId);
}

export const authRouter = Router();

authRouter.post("/login", async (request, response) => {
  const body = readLoginBody(request.body);
  const password = parsePassword(body);

  if (!password) {
    sendEnvelope(response, 400, null, "Password is required", 1);
    return;
  }

  if (isSupabaseAuthEnabled()) {
    const username = parseUsername(body, "");

    if (!username) {
      sendEnvelope(response, 400, null, "Username or email is required", 1);
      return;
    }

    let supabaseSession: Awaited<ReturnType<typeof signInWithSupabasePassword>>;
    try {
      supabaseSession = await signInWithSupabasePassword({
        email: username,
        password,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid credentials";
      sendEnvelope(response, 401, null, message, 1);
      return;
    }

    let upstreamCookie: string;
    let upstreamPermissions: string[] = [];
    try {
      const upstreamCredentials = resolveSupabaseUpstreamCredentials(username, password);
      const upstreamLogin = await loginToUpstream(upstreamCredentials);
      const authenticated =
        upstreamLogin.statusCode < 400 &&
        upstreamLogin.payload.code === 0 &&
        typeof upstreamLogin.upstreamCookie === "string";

      if (!authenticated || !upstreamLogin.upstreamCookie) {
        sendEnvelope(
          response,
          502,
          null,
          upstreamLogin.payload.reason || "Unable to establish upstream session",
          1,
        );
        return;
      }

      upstreamCookie = upstreamLogin.upstreamCookie;
      upstreamPermissions = extractUpstreamPermissions(upstreamCookie);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upstream login failed";
      sendEnvelope(response, 502, null, message, 1);
      return;
    }

    const upstreamSessionId = randomUUID();
    const csrfToken = createCsrfToken();
    try {
      await createSession(upstreamSessionId, {
        upstreamCookie,
        csrfToken,
      });
    } catch {
      sendEnvelope(response, 503, null, "Session store unavailable", 1);
      return;
    }

    response.cookie(
      UPSTREAM_SESSION_COOKIE_NAME,
      upstreamSessionId,
      buildSessionCookieOptions(LEGACY_SESSION_MAX_AGE_MS),
    );
    response.cookie(
      CSRF_COOKIE_NAME,
      csrfToken,
      buildCsrfCookieOptions(CSRF_MAX_AGE_MS),
    );

    response.cookie(
      SESSION_COOKIE_NAME,
      supabaseSession.accessToken,
      buildSessionCookieOptions(supabaseSession.maxAgeMs),
    );

    if (supabaseSession.refreshToken) {
      response.cookie(
        REFRESH_COOKIE_NAME,
        supabaseSession.refreshToken,
        buildRefreshCookieOptions(SUPABASE_REFRESH_MAX_AGE_MS),
      );
    } else {
      response.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
    }

    sendEnvelope(response, 200, {
      user: {
        ...supabaseSession.user,
        permissions: upstreamPermissions,
      },
      token: supabaseSession.accessToken,
      csrfToken,
    });
    return;
  }

  const username = parseUsername(body, "admin");

  const degradedLoginAllowed = canUseDegradedLegacyLogin(username, password);
  let upstreamCookie: string | undefined;
  let upstreamPermissions: string[] = [];
  let upstreamLoginResult: unknown;
  try {
    const upstreamLogin = await loginToUpstream({ username, password });
    const authenticated =
      upstreamLogin.statusCode < 400 &&
      upstreamLogin.payload.code === 0 &&
      typeof upstreamLogin.upstreamCookie === "string";

    if (!authenticated || !upstreamLogin.upstreamCookie) {
      if (!degradedLoginAllowed) {
        sendEnvelope(
          response,
          401,
          null,
          upstreamLogin.payload.reason || "Invalid upstream credentials",
          1,
        );
        return;
      }
    } else {
      upstreamCookie = upstreamLogin.upstreamCookie;
      upstreamPermissions = extractUpstreamPermissions(upstreamCookie);
      upstreamLoginResult = upstreamLogin.payload.result;
    }
  } catch (error) {
    if (!degradedLoginAllowed) {
      const message = error instanceof Error ? error.message : "Upstream login failed";
      sendEnvelope(response, 502, null, message, 1);
      return;
    }
  }

  const user = upstreamLoginResult
    ? mapUpstreamUser(upstreamLoginResult, username, upstreamPermissions)
    : createLegacyUser(username, upstreamPermissions);
  await sendLegacyLoginSuccess(response, user, upstreamCookie);
});

authRouter.get("/info", requireAuth, (request, response) => {
  const authRequest = request as AuthenticatedRequest;

  if (!authRequest.authSession) {
    sendEnvelope(response, 401, null, "Not authenticated", 1);
    return;
  }

  sendEnvelope(response, 200, authRequest.authSession.user);
});

authRouter.post("/logout", requireAuth, requireCsrf, async (request, response) => {
  const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const upstreamSessionId = request.cookies?.[UPSTREAM_SESSION_COOKIE_NAME] as string | undefined;

  if (upstreamSessionId) {
    try {
      await closeUpstreamSession(upstreamSessionId);
    } catch {
      // Ignore upstream/session-store errors during logout cleanup.
    }
  }

  if (token) {
    try {
      const session = jwt.verify(token, env.jwtSecret) as AuthSessionToken;
      try {
        await closeUpstreamSession(session.sessionId);
      } catch {
        // Ignore upstream/session-store errors during logout cleanup.
      }
    } catch {
      // Ignore invalid tokens during logout.
    }

    if (isSupabaseAuthEnabled()) {
      try {
        await revokeSupabaseSession(token);
      } catch {
        // Cookie/session cleanup is sufficient for local logout.
      }
    }
  }

  response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  response.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
  response.clearCookie(UPSTREAM_SESSION_COOKIE_NAME, { path: "/" });
  response.clearCookie(CSRF_COOKIE_NAME, { path: "/" });

  sendEnvelope(response, 200, { success: true, message: "Logged out" });
});
