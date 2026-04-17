import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { buildTheftPrioritization } from "../services/analytics-mix.js";
import { sendEnvelope } from "../services/response.js";
import { theftIntelligenceService } from "../services/theft-intelligence.js";

function sanitizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const theftRouter = Router();

theftRouter.get("/prioritization", async (request, response) => {
  try {
    const result = await buildTheftPrioritization(request as AuthenticatedRequest, response);
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load theft prioritization";
    sendEnvelope(response, 502, null, message, 1);
  }
});

theftRouter.post("/signals/read", (_request, response) => {
  sendEnvelope(response, 200, { rows: theftIntelligenceService.listSignals() }, "success");
});

theftRouter.post("/cases/read", (_request, response) => {
  sendEnvelope(response, 200, { rows: theftIntelligenceService.listCases() }, "success");
});

theftRouter.post("/cases/create", async (request, response) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const row =
    typeof body.row === "object" && body.row !== null ? (body.row as Record<string, unknown>) : {};
  const meterId = sanitizeString(body.meterId) || sanitizeString(row.meterId);
  if (!meterId) {
    sendEnvelope(response, 400, null, "meterId is required", 1);
    return;
  }

  const scoreRaw = body.score;
  const score =
    typeof scoreRaw === "number"
      ? scoreRaw
      : typeof scoreRaw === "string" && scoreRaw.length > 0
        ? Number(scoreRaw)
        : undefined;
  const severityRaw = sanitizeString(body.severity);
  const severity =
    severityRaw === "watch" || severityRaw === "suspect" || severityRaw === "critical"
      ? severityRaw
      : undefined;
  const signalIds = Array.isArray(body.signalIds)
    ? body.signalIds.filter((entry): entry is string => typeof entry === "string")
    : [];

  const created = await theftIntelligenceService.createCase({
    meterId,
    customerName: sanitizeString(body.customerName) || sanitizeString(row.customerName) || undefined,
    severity,
    score: Number.isFinite(score as number) ? (score as number) : undefined,
    signalIds,
    owner: sanitizeString(body.owner) || undefined,
    notes: sanitizeString(body.notes) || undefined,
  });

  sendEnvelope(response, 200, created, "Case created");
});

theftRouter.post("/cases/update", async (request, response) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const row =
    typeof body.row === "object" && body.row !== null ? (body.row as Record<string, unknown>) : {};
  const id = sanitizeString(body.id) || sanitizeString(row.id);
  if (!id) {
    sendEnvelope(response, 400, null, "id is required", 1);
    return;
  }

  const statusRaw = sanitizeString(body.status);
  const status =
    statusRaw === "new" ||
    statusRaw === "active" ||
    statusRaw === "investigating" ||
    statusRaw === "confirmed-theft" ||
    statusRaw === "false-positive" ||
    statusRaw === "closed"
      ? statusRaw
      : undefined;

  const updated = await theftIntelligenceService.updateCase({
    id,
    status,
    owner: sanitizeString(body.owner) || undefined,
    notes: sanitizeString(body.notes) || undefined,
  });

  if (!updated) {
    sendEnvelope(response, 404, null, "Case not found", 1);
    return;
  }

  sendEnvelope(response, 200, updated, "Case updated");
});

theftRouter.post("/cases/:id/actions", async (request, response) => {
  const id = sanitizeString(request.params.id);
  const body = (request.body ?? {}) as Record<string, unknown>;
  const action = sanitizeString(body.action);
  if (!id || !action) {
    sendEnvelope(response, 400, null, "id and action are required", 1);
    return;
  }

  const authRequest = request as AuthenticatedRequest;
  const updated = await theftIntelligenceService.addCaseAction({
    id,
    action,
    actor: authRequest.authSession?.user.username ?? "unknown",
    notes: sanitizeString(body.notes) || undefined,
  });

  if (!updated) {
    sendEnvelope(response, 404, null, "Case not found", 1);
    return;
  }

  sendEnvelope(response, 200, updated, "Case action logged");
});
