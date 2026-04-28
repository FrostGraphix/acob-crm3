import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendEnvelope } from "../services/response.js";
import { createWalletRequestContext } from "../services/wallet-domain-store.js";
import { getWalletReconciliationService } from "../services/wallet-reconciliation.js";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toStatusCode(error: unknown) {
  const message = error instanceof Error ? error.message : "Reconciliation request failed";
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("Only") || message.includes("cannot") || message.includes("allowed")) {
    return 403;
  }
  return 400;
}

export const reconciliationRouter = Router();

reconciliationRouter.get("/status", (request, response) => {
  sendEnvelope(response, 200, getWalletReconciliationService().getStatus(), "success");
});

reconciliationRouter.get("/summary", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().getSummary(
        context,
        readString(request.query.businessDate) || undefined,
      ),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load reconciliation summary",
      1,
    );
  }
});

reconciliationRouter.post("/run", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const result = await getWalletReconciliationService().runNow(context, {
      dryRun: body.dryRun === true,
    });
    sendEnvelope(response, result.accepted ? 202 : 409, result, result.reason, result.accepted ? 0 : 1);
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to run reconciliation",
      1,
    );
  }
});

reconciliationRouter.get("/exceptions", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().listExceptions(context, {
        severity: readString(request.query.severity) || undefined,
        status: readString(request.query.status) || undefined,
        searchTerm: readString(request.query.searchTerm) || undefined,
      }),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to list reconciliation exceptions",
      1,
    );
  }
});

reconciliationRouter.get("/exceptions/:exceptionId", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().getExceptionDetail(context, request.params.exceptionId),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load reconciliation exception detail",
      1,
    );
  }
});

reconciliationRouter.post("/exceptions/:exceptionId/assign", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const assignee = readString(body.assignee);
    if (!assignee) {
      sendEnvelope(response, 400, null, "assignee is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().assignException(context, request.params.exceptionId, assignee),
      "Exception assigned",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to assign reconciliation exception",
      1,
    );
  }
});

reconciliationRouter.post("/exceptions/assign", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const row = typeof body.row === "object" && body.row !== null ? (body.row as Record<string, unknown>) : null;
    const exceptionId = readString(body.exceptionId) || readString(row?.id);
    const assignee = readString(body.assignee);
    if (!exceptionId || !assignee) {
      sendEnvelope(response, 400, null, "exceptionId and assignee are required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().assignException(context, exceptionId, assignee),
      "Exception assigned",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to assign reconciliation exception",
      1,
    );
  }
});

reconciliationRouter.post("/exceptions/:exceptionId/escalate", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const reason = readString(body.reason);
    if (!reason) {
      sendEnvelope(response, 400, null, "reason is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().escalateException(context, request.params.exceptionId, reason),
      "Exception escalated",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to escalate reconciliation exception",
      1,
    );
  }
});

reconciliationRouter.post("/exceptions/escalate", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const row = typeof body.row === "object" && body.row !== null ? (body.row as Record<string, unknown>) : null;
    const exceptionId = readString(body.exceptionId) || readString(row?.id);
    const reason = readString(body.reason);
    if (!exceptionId || !reason) {
      sendEnvelope(response, 400, null, "exceptionId and reason are required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().escalateException(context, exceptionId, reason),
      "Exception escalated",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to escalate reconciliation exception",
      1,
    );
  }
});

reconciliationRouter.post("/exceptions/:exceptionId/resolve", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const resolutionCode = readString(body.resolutionCode);
    const resolutionNotes = readString(body.resolutionNotes);
    if (!resolutionCode || !resolutionNotes) {
      sendEnvelope(response, 400, null, "resolutionCode and resolutionNotes are required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().resolveException(
        context,
        request.params.exceptionId,
        resolutionCode,
        resolutionNotes,
      ),
      "Exception resolved",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to resolve reconciliation exception",
      1,
    );
  }
});

reconciliationRouter.post("/exceptions/resolve", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const row = typeof body.row === "object" && body.row !== null ? (body.row as Record<string, unknown>) : null;
    const exceptionId = readString(body.exceptionId) || readString(row?.id);
    const resolutionCode = readString(body.resolutionCode);
    const resolutionNotes = readString(body.resolutionNotes);
    if (!exceptionId || !resolutionCode || !resolutionNotes) {
      sendEnvelope(
        response,
        400,
        null,
        "exceptionId, resolutionCode, and resolutionNotes are required",
        1,
      );
      return;
    }

    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().resolveException(
        context,
        exceptionId,
        resolutionCode,
        resolutionNotes,
      ),
      "Exception resolved",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to resolve reconciliation exception",
      1,
    );
  }
});

reconciliationRouter.get("/settlement/latest", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().getSettlementReport(context, "latest"),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load latest settlement report",
      1,
    );
  }
});

reconciliationRouter.get("/settlement/:settlementRef", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getWalletReconciliationService().getSettlementReport(context, request.params.settlementRef),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load settlement report",
      1,
    );
  }
});
