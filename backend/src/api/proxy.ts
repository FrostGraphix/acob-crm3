import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { resolveEndpointPolicy } from "../services/endpoint-registry.js";
import {
  mapRequestBodyByOperation,
  sanitizeRequestBody,
  validateRequestBodyByPathname,
  validateRequestBodyByOperation,
} from "../services/request-validation.js";
import { sendEnvelope } from "../services/response.js";
import {
  forwardWithUpstreamSessionRecovery,
  UpstreamSessionError,
} from "../services/upstream-session.js";
import { buildUpstreamRequestPlan } from "../services/upstream-request-adapters.js";
import { forwardToUpstream } from "../services/upstream.js";
import { insertAuditLog, insertRemoteTask, isSupabaseDbEnabled } from "../services/supabase-db.js";

function getRequestPath(request: Request) {
  const originalUrl = request.originalUrl || request.url;
  return new URL(originalUrl, "http://localhost").pathname;
}

function maskSensitiveValue(value: string) {
  if (value.length <= 6) {
    return "***";
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function buildRemoteAuditDetails(body: Record<string, unknown>) {
  const details: Record<string, unknown> = {};
  const tokenValue = body.tokenValue;
  if (typeof tokenValue === "string" && tokenValue.length > 0) {
    details.tokenValue = maskSensitiveValue(tokenValue);
  }

  const commandPayload = body.commandPayload;
  if (typeof commandPayload === "string" && commandPayload.length > 0) {
    details.commandPayload = `${commandPayload.slice(0, 8)}***(${commandPayload.length})`;
  }

  const operatorReason = body.operatorReason;
  if (typeof operatorReason === "string" && operatorReason.length > 0) {
    details.operatorReason = operatorReason.slice(0, 60);
  }

  return details;
}

function resolveUpstreamPathname(pathname: string) {
  const aliases = new Map<string, string>([
    ["/api/item/read", "/api/item/readItemList"],
    ["/api/dailyData/read", "/api/DailyData/read"],
    ["/api/dailyData/readMore", "/api/DailyData/readMore"],
    ["/api/dailyData/readMonthly", "/api/DailyData/readMonthly"],
    ["/api/remoteMeterTask/createReadingTask", "/API/RemoteMeterTask/CreateReadingTask"],
    ["/api/remoteMeterTask/createSettingTask", "/API/RemoteMeterTask/CreateSettingTask"],
    ["/api/remoteMeterTask/createControlTask", "/API/RemoteMeterTask/CreateControlTask"],
    ["/api/remoteMeterTask/createTokenTask", "/API/RemoteMeterTask/CreateTokenTask"],
    ["/api/remoteMeterTask/CreateTransparentForwardingTask", "/API/RemoteMeterTask/CreateTransparentForwardingTask"],
    ["/api/remoteMeterTask/getReadingTask", "/API/RemoteMeterTask/GetReadingTask"],
    ["/api/remoteMeterTask/getSettingTask", "/API/RemoteMeterTask/GetSettingTask"],
    ["/api/remoteMeterTask/getControlTask", "/API/RemoteMeterTask/GetControlTask"],
    ["/api/remoteMeterTask/getTokenTask", "/API/RemoteMeterTask/GetTokenTask"],
    ["/api/remoteMeterTask/GetTransparentForwardingTask", "/API/RemoteMeterTask/GetTransparentForwardingTask"],
    ["/api/remoteMeterTask/updateReadingTask", "/API/RemoteMeterTask/UpdateReadingTask"],
    ["/api/remoteMeterTask/updateSettingTask", "/API/RemoteMeterTask/UpdateSettingTask"],
    ["/api/remoteMeterTask/updateControlTask", "/API/RemoteMeterTask/UpdateControlTask"],
    ["/api/remoteMeterTask/updateTokenTask", "/API/RemoteMeterTask/UpdateTokenTask"],
    ["/api/gprsOnlineStatus/read", "/API/GPRSOnlineStatus/Read"],
    ["/api/gprsOnlineStatus/view", "/API/GPRSOnlineStatus/View"],
    ["/api/updateFirmwareTask/getUpdateFirmwareTask", "/API/UpdateFirmwareTask/GetUpdateFirmwareTask"],
    ["/api/updateFirmwareTask/createUpdateFirmwareTask", "/API/UpdateFirmwareTask/CreateUpdateFirmwareTask"],
    ["/api/loadProfile/electricEnergyCurve", "/API/LoadProfile/ElectricEnergyCurve"],
    ["/api/loadProfile/instantaneousValueCurve", "/API/LoadProfile/InstantaneousValueCurve"],
    ["/api/loadProfile/dailyData", "/API/LoadProfile/DailyData"],
    ["/api/loadProfile/monthlyData", "/API/LoadProfile/MonthlyData"],
    ["/api/eventNotification/read", "/API/EventNotification/Read"],
    ["/api/file/upload", "/API/File/Upload"],
    ["/api/file/uploadBin", "/API/File/UploadBin"],
  ]);

  return aliases.get(pathname) ?? pathname;
}

function isBrokenItemCatalogResponse(
  pathname: string,
  result: { statusCode: number; payload: { code: number; reason: string } },
) {
  if (pathname !== "/api/item/readItemList") {
    return false;
  }

  return (
    result.payload.code !== 0 &&
    result.payload.reason.toLowerCase().includes("object reference not set to an instance of an object")
  );
}

export async function proxyCanonicalPath(
  request: Request,
  response: Response,
  pathname: string,
  rawBody: unknown = request.body,
) {
  const authRequest = request as AuthenticatedRequest;
  const policy = resolveEndpointPolicy(pathname);
  const startedAt = Date.now();

  if (!policy) {
    sendEnvelope(response, 404, null, `Endpoint not registered: ${pathname}`, 1);
    return;
  }

  const sanitizedBody = sanitizeRequestBody(rawBody);
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

  const pathValidated = validateRequestBodyByPathname(policy.pathname, mapped.body);
  if (!pathValidated.valid) {
    sendEnvelope(response, 400, null, pathValidated.message ?? "Invalid payload", 1);
    return;
  }

  const upstreamPathname = resolveUpstreamPathname(policy.pathname);
  const requestPlan = buildUpstreamRequestPlan(upstreamPathname, mapped.body);
  const loadProfileFallbackPath =
    upstreamPathname === "/API/LoadProfile/DailyData"
      ? "/api/DailyDataMeter/read"
      : upstreamPathname === "/API/LoadProfile/MonthlyData"
        ? "/api/DailyDataMeter/readMonthly"
        : null;
  const isRemoteTask = upstreamPathname.startsWith("/API/RemoteMeterTask/");
  const remoteTarget =
    typeof mapped.body.target === "object" && mapped.body.target !== null
      ? (mapped.body.target as Record<string, unknown>)
      : null;
  const remoteAudit =
    isRemoteTask
      ? {
          endpoint: upstreamPathname,
          taskType:
            typeof mapped.body.taskType === "string" ? mapped.body.taskType : undefined,
          meterId:
            remoteTarget && typeof remoteTarget.meterId === "string"
              ? remoteTarget.meterId
              : undefined,
          username: authRequest.authSession?.user.username ?? "unknown",
          details: buildRemoteAuditDetails(mapped.body),
        }
      : null;

  try {
    const [firstCandidate, ...fallbackCandidates] = requestPlan.candidateBodies;

    const upstreamResult = await forwardWithUpstreamSessionRecovery(
      authRequest,
      response,
      async (upstreamCookie) => {
        let result = await forwardToUpstream(
          upstreamPathname,
          firstCandidate ?? requestPlan.body,
          upstreamCookie,
          { timeoutMs: requestPlan.timeoutMs },
        );

        if (
          upstreamPathname === "/API/PrepayReport/LowPurchaseSituation" ||
          upstreamPathname === "/API/PrepayReport/LongNonpurchaseSituation" ||
          upstreamPathname === "/API/PrepayReport/ConsumptionStatistics" ||
          upstreamPathname === "/api/DailyData/read" ||
          upstreamPathname === "/api/DailyDataMeter/read" ||
          upstreamPathname === "/api/item/readItemList" ||
          upstreamPathname === "/API/LoadProfile/DailyData" ||
          upstreamPathname === "/API/LoadProfile/MonthlyData" ||
          fallbackCandidates.length > 0
        ) {
          for (const candidateBody of fallbackCandidates) {
            if (result.statusCode < 400 && result.payload.code === 0) {
              break;
            }

            result = await forwardToUpstream(
              upstreamPathname,
              candidateBody,
              upstreamCookie,
              { timeoutMs: requestPlan.timeoutMs },
            );
          }
        }

        if (
          loadProfileFallbackPath &&
          (result.statusCode >= 400 || result.payload.code !== 0)
        ) {
          const fallbackPlan = buildUpstreamRequestPlan(loadProfileFallbackPath, mapped.body);
          const [fallbackFirstCandidate, ...fallbackNextCandidates] =
            fallbackPlan.candidateBodies;

          result = await forwardToUpstream(
            loadProfileFallbackPath,
            fallbackFirstCandidate ?? fallbackPlan.body,
            upstreamCookie,
            { timeoutMs: fallbackPlan.timeoutMs },
          );

          for (const candidateBody of fallbackNextCandidates) {
            if (result.statusCode < 400 && result.payload.code === 0) {
              break;
            }

            result = await forwardToUpstream(
              loadProfileFallbackPath,
              candidateBody,
              upstreamCookie,
              { timeoutMs: fallbackPlan.timeoutMs },
            );
          }
        }

        return result;
      },
    );

    if (isBrokenItemCatalogResponse(upstreamPathname, upstreamResult)) {
      console.warn("[item-catalog] upstream returned null reference, serving empty state", {
        localPathname: pathname,
        upstreamPathname,
      });
      sendEnvelope(response, 200, { rows: [], total: 0 });
      return;
    }

    if (remoteAudit) {
      const isSuccess = upstreamResult.payload.code === 0;

      console.info("[remote-operation]", {
        ...remoteAudit,
        durationMs: Date.now() - startedAt,
        upstreamStatusCode: upstreamResult.statusCode,
        upstreamCode: upstreamResult.payload.code,
        success: isSuccess,
      });

      if (isSupabaseDbEnabled() && remoteAudit.meterId) {
        void insertRemoteTask({
          meter_sn: remoteAudit.meterId,
          site_code:
            remoteTarget && typeof remoteTarget.stationId === "string"
              ? remoteTarget.stationId
              : undefined,
          task_type: remoteAudit.taskType ?? upstreamPathname,
          payload: remoteAudit.details,
          result: upstreamResult.payload as unknown as Record<string, unknown>,
          status: isSuccess ? "completed" : "failed",
          initiated_by: authRequest.authSession?.user.id ?? null,
          error_message: isSuccess ? null : (upstreamResult.payload as any)?.reason ?? "Unknown upstream error",
          sent_at: new Date(startedAt).toISOString(),
          completed_at: new Date().toISOString(),
        });
        void insertAuditLog({
          actor_user_id: authRequest.authSession?.user.id ?? null,
          action: isSuccess ? "remote-task-succeeded" : "remote-task-failed",
          entity_type: "remote-task",
          entity_id: remoteAudit.meterId,
          site_code:
            remoteTarget && typeof remoteTarget.stationId === "string"
              ? remoteTarget.stationId
              : undefined,
          request_id:
            typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
          metadata: {
            endpoint: upstreamPathname,
            taskType: remoteAudit.taskType ?? null,
            durationMs: Date.now() - startedAt,
            upstreamStatusCode: upstreamResult.statusCode,
            upstreamCode: upstreamResult.payload.code,
          },
        });
      }
    }

    response.status(upstreamResult.statusCode).json(upstreamResult.payload);
  } catch (error) {
    if (remoteAudit) {
      const errorMessage = error instanceof Error ? error.message : "Upstream request failed";
      
      console.warn("[remote-operation]", {
        ...remoteAudit,
        durationMs: Date.now() - startedAt,
        success: false,
        error: errorMessage,
      });

      if (isSupabaseDbEnabled() && remoteAudit.meterId) {
        void insertRemoteTask({
          meter_sn: remoteAudit.meterId,
          site_code:
            remoteTarget && typeof remoteTarget.stationId === "string"
              ? remoteTarget.stationId
              : undefined,
          task_type: remoteAudit.taskType ?? upstreamPathname,
          payload: remoteAudit.details,
          status: "failed",
          initiated_by: authRequest.authSession?.user.id ?? null,
          error_message: errorMessage,
          sent_at: new Date(startedAt).toISOString(),
          completed_at: new Date().toISOString(),
        });
        void insertAuditLog({
          actor_user_id: authRequest.authSession?.user.id ?? null,
          action: "remote-task-error",
          entity_type: "remote-task",
          entity_id: remoteAudit.meterId,
          site_code:
            remoteTarget && typeof remoteTarget.stationId === "string"
              ? remoteTarget.stationId
              : undefined,
          request_id:
            typeof response.locals?.traceId === "string" ? response.locals.traceId : null,
          metadata: {
            endpoint: upstreamPathname,
            taskType: remoteAudit.taskType ?? null,
            durationMs: Date.now() - startedAt,
            error: errorMessage,
          },
        });
      }
    }

    if (error instanceof UpstreamSessionError) {
      sendEnvelope(response, 401, null, error.message, 1);
      return;
    }

    const message = error instanceof Error ? error.message : "Upstream request failed";
    sendEnvelope(response, 502, null, message, 1);
  }
}

export async function proxyHandler(request: Request, response: Response) {
  return proxyCanonicalPath(request, response, getRequestPath(request));
}
