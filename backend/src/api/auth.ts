import { Router } from "express";
import jwt from "jsonwebtoken";
import type { AuthSessionToken, AuthUser } from "../../../common/types/index.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../services/env.js";
import { sendEnvelope } from "../services/response.js";

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

function createUser(username: string): AuthUser {
  return {
    username,
    displayName: username === "admin" ? "ACOB Admin" : username,
    role: "Administrator",
  };
}

function signSession(user: AuthUser) {
  const payload: AuthSessionToken = {
    user,
    issuedAt: Date.now(),
  };

  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: "8h",
  });
}

function readLoginBody(body: unknown): LoginBody {
  return typeof body === "object" && body !== null ? (body as LoginBody) : {};
}

export const authRouter = Router();

authRouter.post("/login", (request, response) => {
  const body = readLoginBody(request.body);
  const username = typeof body.username === "string" && body.username.trim().length > 0
    ? body.username.trim()
    : "admin";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!password) {
    sendEnvelope(response, 400, null, "Password is required", 1);
    return;
  }

  const credentialsConfigured = env.upstreamPassword.length > 0;
  const validCredentials = credentialsConfigured
    ? username === env.upstreamUsername && password === env.upstreamPassword
    : env.useMockOnly;

  if (!validCredentials) {
    sendEnvelope(response, 401, null, "Invalid credentials", 1);
    return;
  }

  const user = createUser(username);
  const token = signSession(user);

  response.cookie("acob_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });

  sendEnvelope(response, 200, { user, token });
});

authRouter.get("/info", requireAuth, (request, response) => {
  const authRequest = request as AuthenticatedRequest;

  if (!authRequest.authSession) {
    sendEnvelope(response, 401, null, "Not authenticated", 1);
    return;
  }

  sendEnvelope(response, 200, authRequest.authSession.user);
});

authRouter.post("/logout", (_request, response) => {
  response.clearCookie("acob_session", {
    path: "/",
  });
  sendEnvelope(response, 200, { success: true, message: "Logged out" });
});
