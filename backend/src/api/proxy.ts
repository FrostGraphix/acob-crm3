import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { resolveEndpointPolicy } from "../services/endpoint-registry.js";
import {
  mapRequestBodyByOperation,
  sanitizeRequestBody,
  validateRequestBodyByOperation,
} from "../services/request-validation.js";
import { sendEnvelope } from "../services/response.js";
import {
  forwardWithUpstreamSessionRecovery,
  UpstreamSessionError,
} from "../services/upstream-session.js";
import { buildUpstreamRequestPlan } from "../services/upstream-request-adapters.js";
import { forwardToUpstream } from "../services/upstream.js";

function getRequestPath(request: Request) {
  const originalUrl = request.originalUrl || request.url;
  return new URL(originalUrl, "http://localhost").pathname;
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

  const requestPlan = buildUpstreamRequestPlan(policy.pathname, mapped.body);

  try {
    const [firstCandidate, ...fallbackCandidates] = requestPlan.candidateBodies;

    const upstreamResult = await forwardWithUpstreamSessionRecovery(
      authRequest,
      response,
      async (upstreamCookie) => {
        let result = await forwardToUpstream(
          policy.pathname,
          firstCandidate ?? requestPlan.body,
          upstreamCookie,
          { timeoutMs: requestPlan.timeoutMs },
        );

        if (
          policy.pathname === "/API/PrepayReport/LongNonpurchaseSituation" ||
          policy.pathname === "/API/PrepayReport/ConsumptionStatistics" ||
          policy.pathname === "/api/DailyDataMeter/read"
        ) {
          for (const candidateBody of fallbackCandidates) {
            if (result.statusCode < 400 && result.payload.code === 0) {
              break;
            }

            result = await forwardToUpstream(
              policy.pathname,
              candidateBody,
              upstreamCookie,
              { timeoutMs: requestPlan.timeoutMs },
            );
          }
        }

        return result;
      },
    );

    response.status(upstreamResult.statusCode).json(upstreamResult.payload);
  } catch (error) {
    if (error instanceof UpstreamSessionError) {
      sendEnvelope(response, 401, null, error.message, 1);
      return;
    }

    const message = error instanceof Error ? error.message : "Upstream request failed";
    sendEnvelope(response, 502, null, message, 1);
  }
}
