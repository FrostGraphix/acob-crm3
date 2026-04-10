import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendEnvelope } from "../services/response.js";
import { buildUpstreamRequestPlan } from "../services/upstream-request-adapters.js";
import { forwardWithUpstreamSessionRecovery } from "../services/upstream-session.js";
import { forwardToUpstream, type UpstreamResult } from "../services/upstream.js";

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
      accumulator[key] = normalizeValue(entry);
      return accumulator;
    }, {});
  }

  return typeof value === "string" ? value.trim() : value;
}

export function buildQueryBody(
  request: Request,
  extra: Record<string, unknown> = {},
) {
  const query = request.query as Record<string, unknown>;
  return {
    ...Object.entries(query).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
      accumulator[key] = normalizeValue(value);
      return accumulator;
    }, {}),
    ...extra,
  };
}

export async function loadUpstreamCandidates(
  request: Request,
  response: Response,
  pathnames: string[],
  body: Record<string, unknown>,
) {
  const authRequest = request as AuthenticatedRequest;

  return forwardWithUpstreamSessionRecovery(authRequest, response, async (upstreamCookie) => {
    let lastResult: UpstreamResult | null = null;

    for (const pathname of pathnames) {
      const requestPlan = buildUpstreamRequestPlan(pathname, body);

      for (const candidateBody of requestPlan.candidateBodies) {
        const result = await forwardToUpstream(pathname, candidateBody, upstreamCookie, {
          timeoutMs: requestPlan.timeoutMs,
        });

        lastResult = result;
        if (result.statusCode < 400 && result.payload.code === 0) {
          return result;
        }
      }
    }

    return (
      lastResult ?? {
        statusCode: 502,
        payload: {
          code: 1,
          reason: "Upstream request failed",
          result: null,
        },
      }
    );
  });
}

export function relayUpstreamResult(response: Response, result: UpstreamResult) {
  response.status(result.statusCode).json(result.payload);
}

export function sendAliasFailure(
  response: Response,
  error: unknown,
  fallbackMessage: string,
) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  sendEnvelope(response, 502, null, message, 1);
}
