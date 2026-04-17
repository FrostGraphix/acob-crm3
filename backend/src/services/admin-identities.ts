import type { AuthUser } from "../../../common/types/index.js";
import { env } from "./env.js";

function normalizeIdentity(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isConfiguredAdminIdentity(user: AuthUser) {
  const username = normalizeIdentity(user.username);
  const email = normalizeIdentity(user.email);

  const adminUsernames = new Set(
    env.adminUsernames
      .map((value) => normalizeIdentity(value))
      .filter((value) => value.length > 0),
  );
  const adminEmails = new Set(
    env.adminEmails
      .map((value) => normalizeIdentity(value))
      .filter((value) => value.length > 0),
  );

  return adminUsernames.has(username) || adminEmails.has(email);
}

export function applyAdminIdentityOverrides(user: AuthUser): AuthUser {
  if (!isConfiguredAdminIdentity(user)) {
    return user;
  }

  return {
    ...user,
    role: "Administrator",
  };
}
