import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthSessionToken, AuthUser } from "../../../common/types/index.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  REFRESH_COOKIE_NAME,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "../services/auth-cookie.js";
import { env } from "../services/env.js";
import { sendEnvelope } from "../services/response.js";
import { sanitizeRequestBody } from "../services/request-validation.js";
import { activateVendorCredentials } from "../services/wallet-persistence.js";
import {
  getSupabaseUserFromAccessToken,
  updateSupabaseCurrentUserPassword,
} from "../services/supabase.js";
import {
  forwardWithUpstreamSessionRecovery,
  UpstreamSessionError,
} from "../services/upstream-session.js";
import { forwardToUpstream } from "../services/upstream.js";
import { createBulkImportHandler } from "./bulk-import.js";
import { proxyHandler } from "./proxy.js";

export const userRouter = Router();

const LEGACY_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

userRouter.post("/read", proxyHandler);
userRouter.post("/create", proxyHandler);
userRouter.post("/update", proxyHandler);
userRouter.post("/delete", proxyHandler);
userRouter.post("/reset", proxyHandler);
userRouter.post("/import", createBulkImportHandler("/api/user/import", "user"));

function pickFirstString(
  source: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function buildUpdatedUser(
  currentUser: AuthUser,
  body: Record<string, unknown>,
): AuthUser {
  const username =
    pickFirstString(body, ["username", "loginName", "account", "email"]) ??
    currentUser.username;
  const displayName =
    pickFirstString(body, [
      "displayName",
      "fullName",
      "realName",
      "name",
      "nickName",
      "nickname",
    ]) ??
    currentUser.displayName;
  const email =
    pickFirstString(body, ["email", "emailAddress", "mail"]) ??
    currentUser.email ??
    undefined;
  const phone =
    pickFirstString(body, ["phone", "phoneNumber", "mobile", "mobilePhone"]) ??
    currentUser.phone ??
    undefined;
  const address =
    pickFirstString(body, ["address", "customerAddress", "location"]) ??
    currentUser.address ??
    undefined;
  const remark =
    pickFirstString(body, ["remark", "note", "description"]) ??
    currentUser.remark ??
    undefined;

  return {
    id: currentUser.id,
    username,
    displayName,
    role: currentUser.role,
    appRole: currentUser.appRole,
    siteCode: currentUser.siteCode ?? null,
    vendorId: currentUser.vendorId ?? null,
    forcePasswordChange: currentUser.forcePasswordChange,
    permissions: currentUser.permissions,
    email,
    phone,
    address,
    remark,
  };
}

function refreshLegacySessionCookie(
  request: AuthenticatedRequest,
  response: Response,
  user: AuthUser,
) {
  const sessionCookie = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

  if (!sessionCookie) {
    return;
  }

  try {
    jwt.verify(sessionCookie, env.jwtSecret);
    const session: AuthSessionToken = {
      user,
      sessionId: request.authSession?.sessionId ?? "",
      issuedAt: Date.now(),
    };

    const nextToken = jwt.sign(session, env.jwtSecret, {
      expiresIn: "8h",
    });

    response.cookie(
      SESSION_COOKIE_NAME,
      nextToken,
      buildSessionCookieOptions(LEGACY_SESSION_MAX_AGE_MS),
    );
  } catch {
    // Supabase tokens or invalid legacy tokens are left untouched.
  }
}

async function forwardUserMutation(
  request: AuthenticatedRequest,
  response: Response,
  pathname: string,
  options: {
    refreshUserFromBody?: boolean;
    successMessage: string;
  },
) {
  const body = sanitizeRequestBody(request.body);
  if (Object.keys(body).length === 0) {
    sendEnvelope(response, 400, null, "At least one field is required", 1);
    return;
  }

  try {
    const upstreamResult = await forwardWithUpstreamSessionRecovery(
      request,
      response,
      (upstreamCookie) => forwardToUpstream(pathname, body, upstreamCookie),
    );

    let user: AuthUser | undefined;
    if (
      options.refreshUserFromBody &&
      upstreamResult.payload.code === 0 &&
      request.authSession?.user
    ) {
      user = buildUpdatedUser(request.authSession.user, body);
      refreshLegacySessionCookie(request, response, user);
    }

    sendEnvelope(
      response,
      upstreamResult.statusCode,
      {
        success: upstreamResult.payload.code === 0,
        message: upstreamResult.payload.reason || options.successMessage,
        user,
      },
      upstreamResult.payload.reason || options.successMessage,
      upstreamResult.payload.code,
    );
  } catch (error) {
    if (error instanceof UpstreamSessionError) {
      sendEnvelope(response, 401, null, error.message, 1);
      return;
    }

    const message = error instanceof Error ? error.message : "Upstream request failed";
    sendEnvelope(response, 502, null, message, 1);
  }
}

userRouter.post("/updateInfo", async (request, response) => {
  await forwardUserMutation(
    request as AuthenticatedRequest,
    response,
    "/api/user/updateInfo",
    {
      refreshUserFromBody: true,
      successMessage: "Profile updated",
    },
  );
});

userRouter.post("/modifyLoginPassword", async (request, response) => {
  const authRequest = request as AuthenticatedRequest;
  if (authRequest.authProvider === "supabase") {
    const body = sanitizeRequestBody(request.body);
    const newPassword = pickFirstString(body, ["newPassword", "password", "new_password"]);
    const confirmPassword = pickFirstString(body, ["confirmPassword", "confirm_password"]);
    const accessToken =
      authRequest.supabaseAccessToken ??
      (request.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
    const refreshToken =
      authRequest.supabaseRefreshToken ??
      (request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);

    if (!newPassword || !confirmPassword) {
      sendEnvelope(response, 400, null, "New password and confirmation are required", 1);
      return;
    }

    if (newPassword !== confirmPassword) {
      sendEnvelope(response, 400, null, "Password confirmation does not match", 1);
      return;
    }

    if (newPassword.length < 12) {
      sendEnvelope(response, 400, null, "New password must be at least 12 characters", 1);
      return;
    }

    if (!accessToken) {
      sendEnvelope(response, 401, null, "Not authenticated", 1);
      return;
    }

    try {
      const user = await updateSupabaseCurrentUserPassword({
        accessToken,
        refreshToken,
        password: newPassword,
        userMetadata: {
          force_password_change: false,
          forcePasswordChange: false,
        },
      });
      if (user.id) {
        activateVendorCredentials(user.id);
      }

      sendEnvelope(
        response,
        200,
        {
          success: true,
          message: "Login password updated",
          user: {
            ...user,
            forcePasswordChange: false,
          },
        },
        "Login password updated",
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password";
      sendEnvelope(response, 400, null, message, 1);
      return;
    }
  }

  await forwardUserMutation(
    authRequest,
    response,
    "/api/user/modifyLoginPassword",
    {
      successMessage: "Login password updated",
    },
  );
});

userRouter.post("/modifyAuthorizationPassword", async (request, response) => {
  await forwardUserMutation(
    request as AuthenticatedRequest,
    response,
    "/api/user/modifyAuthorizationPassword",
    {
      successMessage: "Authorization password updated",
    },
  );
});
