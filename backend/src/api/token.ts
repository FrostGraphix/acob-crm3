import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { buildTokenReconciliation } from "../services/analytics-mix.js";
import { executeRemoteTokenSend } from "../services/remote-token-send.js";
import { sendEnvelope } from "../services/response.js";
import { buildUpstreamRequestPlan } from "../services/upstream-request-adapters.js";
import { forwardWithUpstreamSessionRecovery } from "../services/upstream-session.js";
import { forwardToUpstream, type UpstreamResult } from "../services/upstream.js";
import { proxyHandler } from "./proxy.js";

export const tokenRouter = Router();

type UpstreamTaskResult = {
  path: string;
  label: string;
  rows: Array<Record<string, unknown>>;
  total: number;
  statusCode: number;
  reason: string | null;
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result.map((entry) => asRecord(entry));
  }

  const root = asRecord(result);
  for (const key of ["rows", "data", "list", "records", "items"]) {
    if (Array.isArray(root[key])) {
      return (root[key] as unknown[]).map((entry) => asRecord(entry));
    }
  }

  if (root.result !== undefined) {
    return extractRows(root.result);
  }

  return [];
}

function extractTotal(result: unknown, rows: Array<Record<string, unknown>>) {
  const root = asRecord(result);

  for (const key of ["total", "count", "totalCount", "recordsTotal", "rowCount", "size"]) {
    const value = root[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.floor(value));
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }
  }

  return rows.length;
}

async function runTaskRead(
  request: AuthenticatedRequest,
  response: Response,
  path: string,
  body: Record<string, unknown>,
  label: string,
): Promise<UpstreamTaskResult> {
  const plan = buildUpstreamRequestPlan(path, body);

  const upstreamResult = await forwardWithUpstreamSessionRecovery(
    request,
    response,
    async (upstreamCookie) => {
      let lastResult: UpstreamResult = {
        statusCode: 500,
        payload: {
          code: 1,
          reason: "No upstream candidate bodies provided",
          result: null,
        },
      };

      for (const candidate of plan.candidateBodies) {
        lastResult = await forwardToUpstream(path, candidate, upstreamCookie, {
          timeoutMs: plan.timeoutMs,
        });

        if (lastResult.statusCode < 400 && lastResult.payload.code === 0) {
          return lastResult;
        }
      }

      return lastResult;
    },
  );

  const rows =
    upstreamResult.statusCode < 400 && upstreamResult.payload.code === 0
      ? extractRows(upstreamResult.payload.result)
      : [];

  return {
    path,
    label,
    rows,
    total: extractTotal(upstreamResult.payload.result, rows),
    statusCode: upstreamResult.statusCode,
    reason: upstreamResult.payload.reason || null,
  };
}

async function readCombinedTokenTasks(request: AuthenticatedRequest, response: Response) {
  const body = typeof request.body === "object" && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {};

  const [gprs, remote] = await Promise.all([
    runTaskRead(request, response, "/API/GPRSMeterTask/GPRSGetTokenTask", body, "gprs-task"),
    runTaskRead(request, response, "/API/RemoteMeterTask/GetTokenTask", body, "remote-task"),
  ]);

  const rows = [
    ...gprs.rows.map((row) => ({ ...row, __taskSource: "gprs-task" })),
    ...remote.rows.map((row) => ({ ...row, __taskSource: "remote-task" })),
  ];

  return {
    rows,
    total: rows.length,
    sources: [gprs, remote].map((entry) => ({
      path: entry.path,
      label: entry.label,
      total: entry.total,
      ok: entry.statusCode < 400,
      reason: entry.reason,
    })),
  };
}

tokenRouter.post("/remote-send", async (request, response) => {
  try {
    const body = typeof request.body === "object" && request.body !== null
      ? (request.body as Record<string, unknown>)
      : {};
    const operation =
      body.operation === "clear-credit" ? "clear-credit" : "send-credit";
    const loadMode =
      body.loadMode === "unit" ? "unit" : "naira";
    const amount =
      typeof body.amount === "number"
        ? body.amount
        : typeof body.amount === "string" && body.amount.trim().length > 0
          ? Number(body.amount)
          : undefined;

    const result = await executeRemoteTokenSend(
      request as AuthenticatedRequest,
      response,
      {
        row:
          typeof body.row === "object" && body.row !== null
            ? (body.row as Record<string, unknown>)
            : undefined,
        operation,
        loadMode,
        amount,
      },
    );

    sendEnvelope(response, 200, result, result.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remote token delivery failed";
    sendEnvelope(response, 502, null, message, 1);
  }
});

tokenRouter.post("/remote-task/read", async (request, response) => {
  try {
    const result = await readCombinedTokenTasks(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load remote token tasks";
    sendEnvelope(response, 502, null, message, 1);
  }
});

tokenRouter.post("/remote-task/update", async (request, response) => {
  try {
    const body = typeof request.body === "object" && request.body !== null
      ? (request.body as Record<string, unknown>)
      : {};
    const row = typeof body.row === "object" && body.row !== null
      ? (body.row as Record<string, unknown>)
      : {};
    const source = typeof row.__taskSource === "string"
      ? row.__taskSource
      : typeof body.__taskSource === "string"
        ? body.__taskSource
        : "gprs-task";
    const path = source === "remote-task"
      ? "/API/RemoteMeterTask/UpdateTokenTask"
      : "/API/GPRSMeterTask/GPRSUpdateTokenTask";
    const plan = buildUpstreamRequestPlan(path, body);

    const upstreamResult = await forwardWithUpstreamSessionRecovery(
      request as AuthenticatedRequest,
      response,
      async (upstreamCookie) => {
        let lastResult: UpstreamResult = {
          statusCode: 500,
          payload: {
            code: 1,
            reason: "No upstream candidate bodies provided",
            result: null,
          },
        };

        for (const candidate of plan.candidateBodies) {
          lastResult = await forwardToUpstream(path, candidate, upstreamCookie, {
            timeoutMs: plan.timeoutMs,
          });

          if (lastResult.statusCode < 400 && lastResult.payload.code === 0) {
            return lastResult;
          }
        }

        return lastResult;
      },
    );

    sendEnvelope(
      response,
      upstreamResult.statusCode < 400 && upstreamResult.payload.code === 0 ? 200 : 502,
      upstreamResult.payload.result,
      upstreamResult.payload.reason || "success",
      upstreamResult.payload.code,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update remote token task";
    sendEnvelope(response, 502, null, message, 1);
  }
});

tokenRouter.get("/reconciliation", async (request, response) => {
  try {
    const result = await buildTokenReconciliation(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load token reconciliation";
    sendEnvelope(response, 502, null, message, 1);
  }
});

// Credit Token
tokenRouter.post("/creditToken/generate", proxyHandler);
tokenRouter.post("/creditTokenRecord/read", proxyHandler);
tokenRouter.post("/creditTokenRecord/readMore", proxyHandler);
tokenRouter.post("/creditTokenRecord/cancel", proxyHandler);
tokenRouter.post("/creditTokenCancelRecord/read", proxyHandler);

// Clear Tamper Token
tokenRouter.post("/clearTamperToken/generate", proxyHandler);
tokenRouter.post("/clearTamperTokenRecord/read", proxyHandler);

// Clear Credit Token
tokenRouter.post("/clearCreditToken/generate", proxyHandler);
tokenRouter.post("/clearCreditTokenRecord/read", proxyHandler);

// Set Maximum Power Limit Token
tokenRouter.post("/setMaximumPowerLimitToken/generate", proxyHandler);
tokenRouter.post("/setMaximumPowerLimitTokenRecord/read", proxyHandler);

// Set Maximum Phase Power Unbalance Limit Token
tokenRouter.post("/setMaximumPhasePowerUnbalanceLimitToken/generate", proxyHandler);
tokenRouter.post("/setMaximumPhasePowerUnbalanceLimitTokenRecord/read", proxyHandler);

// Meter Test Token
tokenRouter.post("/meterTestToken/read", proxyHandler);

// Meter Key
tokenRouter.post("/meterKey/update", proxyHandler);

// Change Meter Key Token
tokenRouter.post("/changeMeterKeyToken/generate", proxyHandler);
tokenRouter.post("/changeMeterKeyTokenRecord/read", proxyHandler);

// Set Maximum Overdraft Limit Token
tokenRouter.post("/setMaximumOverdraftLimitToken/generate", proxyHandler);
tokenRouter.post("/setMaximumOverdraftLimitTokenRecord/read", proxyHandler);

