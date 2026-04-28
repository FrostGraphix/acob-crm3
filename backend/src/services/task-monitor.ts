import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { insertAuditLog, isSupabaseDbEnabled } from "./supabase-db.js";
import { buildUpstreamRequestPlan } from "./upstream-request-adapters.js";
import { forwardWithUpstreamSessionRecovery } from "./upstream-session.js";
import { forwardToUpstream, type UpstreamResult } from "./upstream.js";

export type TaskCategory = "reading" | "setting" | "control" | "token" | "transparent-forwarding";
export type TaskSource = "remote-task" | "gprs-task";

interface TaskEndpoint {
  path: string;
  source: TaskSource;
}

export interface UpstreamTaskResult {
  path: string;
  source: TaskSource;
  rows: Array<Record<string, unknown>>;
  total: number;
  statusCode: number;
  reason: string | null;
}

const readEndpoints: Record<TaskCategory, TaskEndpoint[]> = {
  reading: [
    { path: "/API/GPRSMeterTask/GPRSGetReadingTask", source: "gprs-task" },
    { path: "/API/RemoteMeterTask/GetReadingTask", source: "remote-task" },
  ],
  setting: [
    { path: "/API/GPRSMeterTask/GPRSGetSettingTask", source: "gprs-task" },
    { path: "/API/RemoteMeterTask/GetSettingTask", source: "remote-task" },
  ],
  control: [
    { path: "/API/GPRSMeterTask/GPRSGetControlTask", source: "gprs-task" },
    { path: "/API/RemoteMeterTask/GetControlTask", source: "remote-task" },
  ],
  token: [
    { path: "/API/GPRSMeterTask/GPRSGetTokenTask", source: "gprs-task" },
    { path: "/API/RemoteMeterTask/GetTokenTask", source: "remote-task" },
  ],
  "transparent-forwarding": [
    { path: "/API/RemoteMeterTask/GetTransparentForwardingTask", source: "remote-task" },
  ],
};

const updateEndpoints: Record<TaskCategory, Record<TaskSource, string | null>> = {
  reading: {
    "gprs-task": "/API/GPRSMeterTask/GPRSUpdateReadingTask",
    "remote-task": "/API/RemoteMeterTask/UpdateReadingTask",
  },
  setting: {
    "gprs-task": "/API/GPRSMeterTask/GPRSUpdateSettingTask",
    "remote-task": "/API/RemoteMeterTask/UpdateSettingTask",
  },
  control: {
    "gprs-task": "/API/GPRSMeterTask/GPRSUpdateControlTask",
    "remote-task": "/API/RemoteMeterTask/UpdateControlTask",
  },
  token: {
    "gprs-task": "/API/GPRSMeterTask/GPRSUpdateTokenTask",
    "remote-task": "/API/RemoteMeterTask/UpdateTokenTask",
  },
  "transparent-forwarding": {
    "gprs-task": null,
    "remote-task": null,
  },
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function isTaskCategory(value: string): value is TaskCategory {
  return Object.prototype.hasOwnProperty.call(readEndpoints, value);
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result.map((entry) => asRecord(entry));
  }

  const root = asRecord(result);
  for (const key of ["rows", "data", "list", "records", "items"]) {
    if (Array.isArray(root[key])) {
      return root[key].map((entry) => asRecord(entry));
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

async function forwardCandidates(
  request: AuthenticatedRequest,
  response: Response,
  path: string,
  body: Record<string, unknown>,
) {
  const plan = buildUpstreamRequestPlan(path, body);

  return forwardWithUpstreamSessionRecovery(
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
}

async function readTaskEndpoint(
  request: AuthenticatedRequest,
  response: Response,
  endpoint: TaskEndpoint,
  body: Record<string, unknown>,
): Promise<UpstreamTaskResult> {
  const upstreamResult = await forwardCandidates(request, response, endpoint.path, body);
  const rows =
    upstreamResult.statusCode < 400 && upstreamResult.payload.code === 0
      ? extractRows(upstreamResult.payload.result)
      : [];

  return {
    path: endpoint.path,
    source: endpoint.source,
    rows,
    total: extractTotal(upstreamResult.payload.result, rows),
    statusCode: upstreamResult.statusCode,
    reason: upstreamResult.payload.reason || null,
  };
}

function resolveTaskSource(body: Record<string, unknown>): TaskSource {
  const row = asRecord(body.row);
  const source = typeof row.__taskSource === "string"
    ? row.__taskSource
    : typeof body.__taskSource === "string"
      ? body.__taskSource
      : "remote-task";

  return source === "gprs-task" ? "gprs-task" : "remote-task";
}

export async function readCombinedTaskGroup(
  request: AuthenticatedRequest,
  response: Response,
  category: TaskCategory,
  body: Record<string, unknown>,
) {
  const results = await Promise.all(
    readEndpoints[category].map((endpoint) => readTaskEndpoint(request, response, endpoint, body)),
  );
  const rows = results.flatMap((result) =>
    result.rows.map((row) => ({
      ...row,
      __taskSource: result.source,
      taskCategory: category,
    })),
  );

  if (isSupabaseDbEnabled()) {
    void insertAuditLog({
      actor_user_id: request.authSession?.user.id ?? null,
      action: "remote-task-read",
      entity_type: "remote-task",
      entity_id: category,
      request_id: typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
      metadata: {
        category,
        total: rows.length,
        sources: results.map((entry) => ({
          path: entry.path,
          source: entry.source,
          total: entry.total,
          statusCode: entry.statusCode,
          reason: entry.reason,
        })),
      },
    });
  }

  return {
    rows,
    total: rows.length,
    sources: results.map((entry) => ({
      path: entry.path,
      source: entry.source,
      total: entry.total,
      ok: entry.statusCode < 400,
      reason: entry.reason,
    })),
  };
}

export async function updateTaskGroup(
  request: AuthenticatedRequest,
  response: Response,
  category: TaskCategory,
  body: Record<string, unknown>,
) {
  const source = resolveTaskSource(body);
  const path = updateEndpoints[category][source];
  if (!path) {
    throw new Error(`Update is not supported for ${category} ${source} tasks`);
  }

  const upstreamResult = await forwardCandidates(request, response, path, body);

  if (isSupabaseDbEnabled()) {
    const row = asRecord(body.row);
    void insertAuditLog({
      actor_user_id: request.authSession?.user.id ?? null,
      action: upstreamResult.payload.code === 0 ? "remote-task-update-succeeded" : "remote-task-update-failed",
      entity_type: "remote-task",
      entity_id:
        typeof row.meterId === "string"
          ? row.meterId
          : typeof row.MeterId === "string"
            ? row.MeterId
            : category,
      site_code:
        typeof row.stationId === "string"
          ? row.stationId
          : typeof row.siteId === "string"
            ? row.siteId
            : undefined,
      request_id: typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
      metadata: {
        category,
        source,
        path,
        statusCode: upstreamResult.statusCode,
        reason: upstreamResult.payload.reason,
      },
    });
  }

  return {
    path,
    source,
    statusCode: upstreamResult.statusCode,
    payload: upstreamResult.payload,
  };
}
