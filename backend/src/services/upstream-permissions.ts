const UPSTREAM_PERMISSION_CLAIM =
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

function normalizePermissionEntry(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function decodeJwtPayload(token: string) {
  const segments = token.split(".");
  const payloadSegment = segments[1];
  if (!payloadSegment) {
    return null;
  }

  try {
    const payload = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const parsed = JSON.parse(payload) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function extractUpstreamPermissions(token: string | undefined) {
  if (!token) {
    return [];
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return [];
  }

  const permissionClaim = payload[UPSTREAM_PERMISSION_CLAIM];
  if (Array.isArray(permissionClaim)) {
    return permissionClaim
      .map((entry) => normalizePermissionEntry(entry))
      .filter((entry): entry is string => entry !== null);
  }

  const singlePermission = normalizePermissionEntry(permissionClaim);
  return singlePermission ? [singlePermission] : [];
}
