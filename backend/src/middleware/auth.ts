import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthSessionToken } from "../../../common/types/index.js";
import { env } from "../services/env.js";
import { sendEnvelope } from "../services/response.js";

export interface AuthenticatedRequest extends Request {
  authSession?: AuthSessionToken;
}

function isPublicPath(pathname: string) {
  return pathname === "/api/user/login";
}

export function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  if (isPublicPath(request.path)) {
    next();
    return;
  }

  const token = request.cookies?.acob_session as string | undefined;

  if (!token) {
    sendEnvelope(response, 401, null, "Not authenticated", 1);
    return;
  }

  try {
    const session = jwt.verify(token, env.jwtSecret) as AuthSessionToken;
    request.authSession = session;
    next();
  } catch {
    sendEnvelope(response, 401, null, "Session expired or invalid", 1);
  }
}
