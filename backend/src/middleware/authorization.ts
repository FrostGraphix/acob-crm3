import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import { resolveAccessPolicy } from "../services/access-policy.js";
import { sendEnvelope } from "../services/response.js";

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function hasRequiredRole(request: AuthenticatedRequest, requiredRole: string | undefined) {
  if (!requiredRole) {
    return true;
  }

  const role = normalize(request.authSession?.user.role);
  return role.includes(normalize(requiredRole));
}

function hasRequiredPermission(
  request: AuthenticatedRequest,
  requiredPermissions: string[] | undefined,
) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  const permissions = new Set(
    (request.authSession?.user.permissions ?? []).map((permission) => normalize(permission)),
  );

  if (permissions.size === 0) {
    return false;
  }

  return requiredPermissions.some((permission) => permissions.has(normalize(permission)));
}

function getPathname(request: AuthenticatedRequest) {
  const originalUrl = request.originalUrl || request.url || "/";

  try {
    return new URL(originalUrl, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

export function requireRouteAccess(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const pathname = getPathname(request);
  const policy = resolveAccessPolicy(pathname);

  if (!policy) {
    next();
    return;
  }

  const roleAllowed = hasRequiredRole(request, policy.requiredRole);
  const permissionAllowed = hasRequiredPermission(request, policy.requiredPermissions);
  if (roleAllowed && permissionAllowed) {
    next();
    return;
  }

  const username = request.authSession?.user.username ?? "unknown";
  console.warn("[authorization] denied", {
    pathname,
    username,
    requiredRole: policy.requiredRole,
    requiredPermissions: policy.requiredPermissions ?? [],
    role: request.authSession?.user.role ?? "",
    permissionsCount: request.authSession?.user.permissions?.length ?? 0,
  });

  sendEnvelope(
    response,
    403,
    null,
    "Insufficient permissions for this route",
    1,
    { policyDecision: "denied" },
  );
}
