import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { resolveEndpointPolicy } from "../services/endpoint-registry.js";
import {
  mapRequestBodyByOperation,
  sanitizeRequestBody,
  validateRequestBodyByOperation,
} from "../services/request-validation.js";
import { sendEnvelope } from "../services/response.js";
import { forwardToUpstream } from "../services/upstream.js";

function getRequestPath(request: Request) {
  const originalUrl = request.originalUrl || request.url;
  return new URL(originalUrl, "http://localhost").pathname;
}

function applyUpstreamDefaults(pathname: string, body: Record<string, unknown>) {
  const nextBody = { ...body };
  const requiresLang =
    pathname.startsWith("/API/PrepayReport/") || pathname.startsWith("/api/DailyDataMeter/");
  const requiresTaskLang = pathname.startsWith("/API/RemoteMeterTask/Get");

  if (requiresLang || requiresTaskLang) {
    const currentLang = typeof nextBody.Lang === "string" ? nextBody.Lang.trim() : "";
    if (currentLang.length === 0) {
      nextBody.Lang = "en";
    }
  }

  return nextBody;
}

export async function proxyHandler(request: Request, response: Response) {
  const authRequest = request as AuthenticatedRequest;
  const pathname = getRequestPath(request);
  const policy = resolveEndpointPolicy(pathname);

  if (!policy) {
    sendEnvelope(response, 404, null, `Endpoint not registered: ${pathname}`, 1);
    return;
  }

  const sanitizedBody = sanitizeRequestBody(request.body);
  const mapped = mapRequestBodyByOperation(policy.operation, sanitizedBody);
  if (!mapped.validation.valid) {
    sendEnvelope(response, 400, null, mapped.validation.message ?? "Invalid payload", 1);
    return;
  }

  const validated = validateRequestBodyByOperation(policy.operation, mapped.body);
  if (!validated.valid) {
    sendEnvelope(response, 400, null, validated.message ?? "Invalid payload", 1);
    return;
  }

  const body = applyUpstreamDefaults(policy.pathname, mapped.body);
  if (!authRequest.upstreamCookie) {
    sendEnvelope(response, 401, null, "Upstream session expired or invalid", 1);
    return;
  }

  try {
    const upstreamResult = await forwardToUpstream(
      policy.pathname,
      body,
      authRequest.upstreamCookie,
    );

    response.status(upstreamResult.statusCode).json(upstreamResult.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream request failed";
    sendEnvelope(response, 502, null, message, 1);
  }
}
