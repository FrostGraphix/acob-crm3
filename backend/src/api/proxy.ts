import type { Request, Response } from "express";
import { env } from "../services/env.js";
import { resolveEndpointPolicy } from "../services/endpoint-registry.js";
import { mockApiResponse } from "../services/mock-data.js";
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

function shouldUseMock(statusCode: number) {
  return env.mockFallbackOnError && statusCode >= 500;
}

export async function proxyHandler(request: Request, response: Response) {
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

  const body = mapped.body;

  if (env.useMockOnly) {
    const payload = mockApiResponse(pathname, body);
    response.status(200).json(payload);
    return;
  }

  try {
    const upstreamResult = await forwardToUpstream(
      policy.pathname,
      body,
      request.headers.cookie,
    );

    if (shouldUseMock(upstreamResult.statusCode)) {
      const payload = mockApiResponse(policy.pathname, body);
      response.status(200).json(payload);
      return;
    }

    response.status(upstreamResult.statusCode).json(upstreamResult.payload);
  } catch (error) {
    if (env.mockFallbackOnError) {
      const payload = mockApiResponse(policy.pathname, body);
      response.status(200).json(payload);
      return;
    }

    const message = error instanceof Error ? error.message : "Upstream request failed";
    sendEnvelope(response, 502, null, message, 1);
  }
}
