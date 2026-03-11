import type { CookieOptions } from "express";
import { env } from "./env.js";

export const SESSION_COOKIE_NAME = "acob_session";
export const REFRESH_COOKIE_NAME = "acob_refresh";
export const UPSTREAM_SESSION_COOKIE_NAME = "acob_upstream_session";
export const CSRF_COOKIE_NAME = "acob_csrf";

export function buildSessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: maxAgeMs,
    path: "/",
  };
}

export function buildRefreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: maxAgeMs,
    path: "/",
  };
}

export function buildCsrfCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: false,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: maxAgeMs,
    path: "/",
  };
}
