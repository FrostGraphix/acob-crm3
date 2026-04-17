import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import { sendEnvelope } from "../services/response.js";
import {
  createWalletRequestContext,
  type WalletActorRole,
} from "../services/wallet-domain-store.js";
import {
  ensureWalletReadModelHydrated,
  getWalletPersistenceReadiness,
} from "../services/wallet-persistence.js";
import {
  isWalletRoleAllowed,
  resolveWalletRoutePolicy,
} from "../services/wallet-access-control.js";
import { env } from "../services/env.js";
import { getWalletHardeningService } from "../services/wallet-hardening.js";

function getPathname(request: AuthenticatedRequest) {
  const originalUrl = request.originalUrl || request.url || "/";

  try {
    return new URL(originalUrl, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function canBypassWalletRoleChecks(role: WalletActorRole) {
  return role === "super_admin";
}

export async function requireWalletRouteAccess(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const pathname = getPathname(request);
  const policy = resolveWalletRoutePolicy(request.method, pathname);

  if (!policy) {
    next();
    return;
  }

  if (env.nodeEnv === "production") {
    const readiness = await getWalletPersistenceReadiness();
    if (readiness.mode !== "ready") {
      sendEnvelope(
        response,
        503,
        {
          walletPersistence: readiness,
        },
        "SCHEMA_NOT_READY",
        1,
      );
      return;
    }
  }

  await ensureWalletReadModelHydrated();

  const context = createWalletRequestContext(request);
  if (
    context.appRole === "vendor_user" &&
    request.authSession?.user.forcePasswordChange === true &&
    pathname.startsWith("/api/wallet")
  ) {
    sendEnvelope(
      response,
      403,
      null,
      "FORCE_PASSWORD_CHANGE",
      1,
      { policyDecision: "denied" },
    );
    return;
  }

  if (
    !canBypassWalletRoleChecks(context.appRole) &&
    !isWalletRoleAllowed(context.appRole, policy.allowedRoles)
  ) {
    sendEnvelope(
      response,
      403,
      null,
      `Insufficient permissions for ${policy.description}`,
      1,
      { policyDecision: "denied" },
    );
    return;
  }

  const activityDecision = getWalletHardeningService().recordRequestActivity(request, context, pathname);
  if (!activityDecision.allowed) {
    sendEnvelope(
      response,
      activityDecision.statusCode,
      null,
      activityDecision.reason,
      1,
      { policyDecision: "denied" },
    );
    return;
  }

  next();
}
