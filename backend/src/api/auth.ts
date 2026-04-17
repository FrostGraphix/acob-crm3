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
import { insertAuditLog, isSupabaseDbEnabled } from "../services/supabase-db.js";
import {
  isSupabaseAuthEnabled,
  revokeSupabaseSession,
  signInWithSupabasePassword,
} from "../services/supabase.js";
import { applyAdminIdentityOverrides } from "../services/admin-identities.js";
import { extractUpstreamPermissions } from "../services/upstream-permissions.js";
import { loginToUpstream, logoutFromUpstream } from "../services/upstream.js";
import { getWalletDomainState, normalizeCode } from "../services/wallet-domain-store.js";

interface LoginBody {
  username?: unknown;
  password?: unknown;
  upstreamUsername?: unknown;
  upstreamPassword?: unknown;
  portal?: unknown;
}

type LoginPortal = "staff" | "vendor";

const VENDOR_APP_ROLES = new Set(["vendor_user", "vendor_manager"]);

const LEGACY_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SUPABASE_REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CSRF_MAX_AGE_MS = LEGACY_SESSION_MAX_AGE_MS;

function createLegacyUser(username: string, permissions: string[] = []): AuthUser {
  return applyAdminIdentityOverrides({
    username,
    displayName: username === "admin" ? "ACOB Admin" : username,
    role: "Administrator",
    permissions,
    email: username.includes("@") ? username : undefined,
  });
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

function parseOptionalCredential(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function parsePortal(body: LoginBody): LoginPortal {
  return body.portal === "vendor" ? "vendor" : "staff";
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

  return applyAdminIdentityOverrides({
    username,
    displayName,
    role,
    permissions,
    email: email ?? undefined,
    phone: phone ?? undefined,
    address: address ?? undefined,
    remark: remark ?? undefined,
  });
}

function resolveConfiguredUpstreamServiceToken() {
  return env.upstreamBearerToken.trim();
}

function isVendorRole(value: string | null | undefined) {
  return typeof value === "string" && VENDOR_APP_ROLES.has(value.trim().toLowerCase());
}

function resolvePortalRoleError(
  portal: LoginPortal,
  user: Awaited<ReturnType<typeof signInWithSupabasePassword>>["user"],
) {
  const vendorRole = isVendorRole(user.appRole) || isVendorRole(user.role);
  if (portal === "vendor" && !vendorRole) {
    return "This portal is for vendors only. Please use the staff login.";
  }

  if (portal === "staff" && vendorRole) {
    return "Vendor accounts must use the vendor portal.";
  }

  return null;
}

function resolveVendorAccessError(
  user: Awaited<ReturnType<typeof signInWithSupabasePassword>>["user"],
) {
  const vendorRole = isVendorRole(user.appRole) || isVendorRole(user.role);
  if (!vendorRole) {
    return null;
  }

  const vendorId = typeof user.vendorId === "string" && user.vendorId.trim().length > 0
    ? normalizeCode(user.vendorId)
    : null;
  if (!vendorId) {
    return "Vendor account is missing an assigned vendor profile. Contact your ACOB administrator.";
  }

  const vendor = getWalletDomainState().vendors.get(vendorId);
  if (!vendor) {
    return "Vendor account is not linked to an active vendor profile. Contact your ACOB administrator.";
  }

  if (vendor.status === "suspended") {
    return "Your vendor account is suspended. Contact your ACOB administrator.";
  }

  if (vendor.status === "rejected") {
    return "Your onboarding application was rejected. Contact your ACOB administrator.";
  }

  return null;
}

function resolveVendorLoginIdentifier(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.includes("@")) {
    return normalized;
  }

  for (const invitation of getWalletDomainState().invitations.values()) {
    if (invitation.username.trim().toLowerCase() === normalized) {
      return invitation.loginIdentifier;
    }
  }

  return normalized;
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

function resolveSupabaseUpstreamCredentials(body: LoginBody, username: string, password: string) {
  const explicitUpstreamUsername = parseOptionalCredential(body.upstreamUsername);
  const explicitUpstreamPassword = parseOptionalCredential(body.upstreamPassword);

  if (explicitUpstreamUsername || explicitUpstreamPassword) {
    if (!explicitUpstreamUsername || !explicitUpstreamPassword) {
      throw new Error("Both upstream username and upstream password are required when using a direct upstream session.");
    }

    return {
      username: explicitUpstreamUsername,
      password: explicitUpstreamPassword,
    };
  }

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
  const portal = parsePortal(body);

  if (!password) {
    sendEnvelope(response, 400, null, "Password is required", 1);
    return;
  }

  if (isSupabaseAuthEnabled()) {
    const username = parseUsername(body, "");
    const loginIdentifier = portal === "vendor"
      ? resolveVendorLoginIdentifier(username)
      : username;

    if (!loginIdentifier) {
      sendEnvelope(response, 400, null, "Username or email is required", 1);
      return;
    }

    let supabaseSession: Awaited<ReturnType<typeof signInWithSupabasePassword>>;
    try {
      supabaseSession = await signInWithSupabasePassword({
        email: loginIdentifier,
        password,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid credentials";
      sendEnvelope(response, 401, null, message, 1);
      return;
    }

    const portalRoleError = resolvePortalRoleError(portal, supabaseSession.user);
    if (portalRoleError) {
      try {
        await revokeSupabaseSession(supabaseSession.accessToken);
      } catch {
        // Local rejection is sufficient if remote revoke fails.
      }
      sendEnvelope(response, 403, null, portalRoleError, 1);
      return;
    }

    const vendorAccessError = resolveVendorAccessError(supabaseSession.user);
    if (vendorAccessError) {
      try {
        await revokeSupabaseSession(supabaseSession.accessToken);
      } catch {
        // Local rejection is sufficient if remote revoke fails.
      }
      sendEnvelope(response, 403, null, vendorAccessError, 1);
      return;
    }

    let upstreamCookie: string | undefined;
    let upstreamPermissions: string[] = [];
    if (portal === "staff") {
      try {
        const upstreamCredentials = resolveSupabaseUpstreamCredentials(body, username, password);
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
    if (isSupabaseDbEnabled()) {
      void insertAuditLog({
        actor_user_id: supabaseSession.user.id ?? null,
        action: "login-success",
        entity_type: "auth-session",
        entity_id: supabaseSession.user.username,
        source: "auth",
        request_id:
          typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
        metadata: {
          portal,
          provider: "supabase",
          upstreamPermissionCount: upstreamPermissions.length,
        },
      });
    }
    return;
  }

  const username = parseUsername(body, "admin");

  const degradedLoginAllowed = canUseDegradedLegacyLogin(username, password);
  let upstreamCookie: string | undefined;
  let upstreamPermissions: string[] = [];
  let upstreamLoginResult: unknown;
  try {
    const configuredServiceToken = resolveConfiguredUpstreamServiceToken();
    if (configuredServiceToken) {
      upstreamCookie = configuredServiceToken;
      upstreamPermissions = extractUpstreamPermissions(upstreamCookie);
    } else {
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
  if (isSupabaseDbEnabled()) {
    void insertAuditLog({
      actor_user_id: user.id ?? null,
      action: "login-success",
      entity_type: "auth-session",
      entity_id: user.username,
      source: "auth",
      request_id:
        typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
      metadata: {
        provider: "legacy",
        degradedLogin: !upstreamCookie,
        upstreamPermissionCount: upstreamPermissions.length,
      },
    });
  }
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

  const authRequest = request as AuthenticatedRequest;
  if (isSupabaseDbEnabled()) {
    void insertAuditLog({
      actor_user_id: authRequest.authSession?.user.id ?? null,
      action: "logout",
      entity_type: "auth-session",
      entity_id: authRequest.authSession?.user.username ?? null,
      source: "auth",
      request_id:
        typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
    });
  }

  sendEnvelope(response, 200, { success: true, message: "Logged out" });
});


